import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { N, TAU } from "../glyphs";
import type { GateEngine } from "../gateEngine";
import { glyphRingTexture, noiseTexture, paintedText, screenTexture } from "./textures";
import { createGuards } from "./soldiers";
import { createElectricalPanel, createMountedGun } from "./props";

/*
 * Salle de la porte : création originale (base souterraine, rampe, salle de contrôle vitrée).
 * Unités en mètres. La porte fait face à +z ; la salle de contrôle est en hauteur, en face d'elle.
 */

export const R = 5.0; // rayon extérieur de la porte (10 m de diamètre) : le vortex est bien plus large que la rampe
// Proportions de la porte (fractions du rayon extérieur R) : structure fine, grand vortex
const K = {
  outerIn: 0.935, // bord intérieur de l'anneau extérieur
  glyphIn: 0.815, // bord intérieur de l'anneau des symboles
  rimIn: 0.79, // bord intérieur du rebord (= horizon)
};
const RH = R * K.rimIn; // rayon de l'horizon des événements
const RAMP_END = 11.4;
/** La porte repose au sol ; la rampe monte jusqu'au bas de l'horizon des événements. */
export const GATE_Y = R + 0.05;
/*
 * Rampe rehaussée au-dessus du bas du vortex : à ce niveau, l'ouverture fait plus de 4 m de large,
 * assez pour un engin aussi large que la rampe (3,6 m) avec de la marge.
 */
const RAMP_RAISE = 0.55;
const PLATFORM_H = GATE_Y - RH + RAMP_RAISE;
export const ROOM = { x: 13, zMin: -5, zMax: 17.2, h: 12.5 };
const PILLARS_Z = [-2, 3];
export const CONTROL = { x: 6, yMin: 5, yMax: 8.2, zMax: 21 };

export type CameraPreset = { label: string; pos: [number, number, number]; target: [number, number, number] };
export const PRESETS = {
  ensemble: { label: "Vue d'ensemble", pos: [10.5, 7.6, 15.5], target: [0, 4, 1.5] },
  face: { label: "Face à la porte", pos: [0, 4.6, 16], target: [0, GATE_Y, 0] },
  rampe: { label: "Sur la rampe", pos: [0.9, 3.9, 8], target: [0, GATE_Y, 0] },
  controle: { label: "Salle de contrôle", pos: [0, 6.9, 19.6], target: [0, 3.2, 2] },
  gardes: { label: "Près des gardes", pos: [-0.4, 1.75, 14.2], target: [-2.9, 1.15, 12.2] },
  p51: { label: "Accès P-51", pos: [7, 5.4, 3], target: [-13, 5, 11] },
  p52: { label: "Accès P-52", pos: [-7, 5.4, 3], target: [13, 5, 11] },
  tourelle: { label: "Mitrailleuse", pos: [7.5, 2.6, 12.5], target: [4.3, 1.1, 8.2] },
} satisfies Record<string, CameraPreset>;
export type PresetName = keyof typeof PRESETS;

const horizonVert = /* glsl */ `
  uniform float uTime; uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float r = length(p.xy) / ${RH.toFixed(4)};
    p.z += sin(r * 12.0 - uTime * 2.4) * 0.035 * uAlpha * (1.0 - r * 0.6);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const horizonFrag = /* glsl */ `
  uniform float uTime; uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float s = uTime;
    float w = sin(r * 13.0 - s * 2.4) * 0.5
            + sin(p.x * 4.2 + s * 0.8 + sin(p.y * 3.1 - s * 1.1) * 1.5) * 0.35
            + sin(p.y * 5.3 - s * 0.9 + cos(p.x * 2.7 + s * 0.6) * 1.4) * 0.35;
    float b = clamp(0.48 + 0.27 * w + 0.22 * (1.0 - r) + (r > 0.88 ? (r - 0.88) * 3.2 : 0.0), 0.0, 1.3);
    vec3 c = vec3(18.0 + b * b * 175.0, 85.0 + b * 150.0, 165.0 + b * 95.0) / 255.0;
    gl_FragColor = vec4(min(c * 1.25, vec3(1.6)), uAlpha);
  }`;
const irisFrag = /* glsl */ `
  uniform float uA;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float hole = 1.0 - uA;
    if (r > 1.0 || r < hole) discard;
    float a = atan(p.y, p.x) / 6.2831853;
    float k = a * 20.0 + (1.0 - r) * 2.2 * uA;
    float f = fract(k);
    float d = min(f, 1.0 - f);
    float seam = smoothstep(0.02, 0.06, d);
    float shade = 0.55 + 0.25 * (p.x - p.y) + 0.15 * f;
    vec3 col = vec3(0.52, 0.57, 0.62) * shade * mix(0.25, 1.0, seam);
    gl_FragColor = vec4(col, 1.0);
  }`;
const simpleVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function annulus(ro: number, ri: number, depth: number, bevel = 0.04) {
  const s = new THREE.Shape();
  s.absarc(0, 0, ro, 0, TAU, false);
  const h = new THREE.Path();
  h.absarc(0, 0, ri, 0, TAU, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 128 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function poly(points: [number, number][], depth: number) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadows = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 12), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

export function buildGateRoom(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090c);
  scene.fog = new THREE.FogExp2(0x1a1f25, 0.018);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const disposables: { dispose(): void }[] = [pmrem];
  const track = <T extends { dispose(): void }>(o: T) => (disposables.push(o), o);

  /* ---------- Matériaux ---------- */
  // Sol uni gris clair (béton lissé, sans dallage)
  const concreteTex = track(noiseTexture([178, 181, 184], 8, { size: 512, soft: true }));
  concreteTex.repeat.set(3, 3);
  // Murs gris clair en panneaux de béton
  const wallTex = track(noiseTexture([206, 209, 212], 16, { tile: true }));
  wallTex.repeat.set(6, 3);
  const ceilTex = track(noiseTexture([70, 74, 80], 20, { tile: true }));
  ceilTex.repeat.set(6, 5);
  const gratingTex = track(noiseTexture([70, 74, 80], 18, { stripes: true }));
  gratingTex.repeat.set(2, 6);
  const mFloor = track(new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.7, metalness: 0.05 }));
  const mWall = track(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0.02 }));
  const mCeil = track(new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9, metalness: 0.05 }));
  const mYellow = track(new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.55, emissive: 0x3a2c00, emissiveIntensity: 0.6 }));
  const mDoor = track(new THREE.MeshStandardMaterial({ color: 0x59616a, roughness: 0.45, metalness: 0.7 }));
  const mDoorFrame = track(new THREE.MeshStandardMaterial({ color: 0x3c434b, roughness: 0.5, metalness: 0.6 }));
  const mBeam = track(new THREE.MeshStandardMaterial({ color: 0x4b525a, roughness: 0.6, metalness: 0.55 }));
  const mDuct = track(new THREE.MeshStandardMaterial({ color: 0x7c848d, roughness: 0.45, metalness: 0.7 }));
  const mGrate = track(new THREE.MeshStandardMaterial({ map: gratingTex, roughness: 0.55, metalness: 0.7 }));
  const mRail = track(new THREE.MeshStandardMaterial({ color: 0xa7b0b9, roughness: 0.35, metalness: 0.85 }));
  const mHazard = track(new THREE.MeshStandardMaterial({ color: 0xc8a227, roughness: 0.7, emissive: 0x2a1f00 }));
  const mGate = track(new THREE.MeshStandardMaterial({ color: 0x8c959e, roughness: 0.42, metalness: 0.72 }));
  const mGateDark = track(new THREE.MeshStandardMaterial({ color: 0x5b636c, roughness: 0.48, metalness: 0.72 }));
  const mGateDeep = track(new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.6, metalness: 0.6 }));
  const mHousing = track(new THREE.MeshStandardMaterial({ color: 0x9aa3ac, roughness: 0.32, metalness: 0.82 }));

  /* ---------- Salle ---------- */
  const room = new THREE.Group();
  scene.add(room);
  const len = ROOM.zMax - ROOM.zMin;
  const midZ = (ROOM.zMax + ROOM.zMin) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, len), mFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, midZ);
  floor.receiveShadow = true;
  room.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, len), mCeil);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM.h, midZ);
  room.add(ceil);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(len, ROOM.h), mWall);
    w.rotation.y = -s * Math.PI / 2;
    w.position.set(s * ROOM.x, ROOM.h / 2, midZ);
    w.receiveShadow = true;
    room.add(w);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.h), mWall);
  back.position.set(0, ROOM.h / 2, ROOM.zMin);
  back.receiveShadow = true;
  room.add(back);
  // Mur de la salle de contrôle, percé d'une grande vitre
  const zw = ROOM.zMax + 0.2;
  room.add(box(ROOM.x * 2, CONTROL.yMin, 0.4, mWall, 0, CONTROL.yMin / 2, zw, false));
  room.add(box(ROOM.x * 2, ROOM.h - CONTROL.yMax, 0.4, mWall, 0, (ROOM.h + CONTROL.yMax) / 2, zw, false));
  const sideW = ROOM.x - CONTROL.x;
  for (const s of [-1, 1]) room.add(box(sideW, CONTROL.yMax - CONTROL.yMin, 0.4, mWall, s * (CONTROL.x + sideW / 2), (CONTROL.yMin + CONTROL.yMax) / 2, zw, false));
  room.add(box(CONTROL.x * 2, 0.15, 0.6, mBeam, 0, CONTROL.yMin + 0.07, ROOM.zMax - 0.05));
  for (const i of [-2, -1, 1, 2]) room.add(box(0.12, CONTROL.yMax - CONTROL.yMin, 0.18, mBeam, i * 2.6, (CONTROL.yMin + CONTROL.yMax) / 2, ROOM.zMax, false));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(CONTROL.x * 2, CONTROL.yMax - CONTROL.yMin),
    track(new THREE.MeshStandardMaterial({ color: 0x6f8aa0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.9, depthWrite: false })),
  );
  glass.position.set(0, (CONTROL.yMin + CONTROL.yMax) / 2, ROOM.zMax + 0.05);
  glass.rotation.y = Math.PI;
  room.add(glass);

  // Piliers, poutres, gaines
  // Pas de pilier latéral à z = 13 : c'est l'emplacement des grandes portes d'accès
  for (const z of [-2, 3, 8, 13]) {
    if (PILLARS_Z.includes(z)) for (const s of [-1, 1]) room.add(box(0.9, ROOM.h, 0.9, mBeam, s * (ROOM.x - 0.45), ROOM.h / 2, z));
    room.add(box(ROOM.x * 2, 0.6, 0.5, mBeam, 0, ROOM.h - 0.3, z, false));
  }
  for (const s of [-1, 1]) {
    const duct = rod(new THREE.Vector3(s * 8.5, ROOM.h - 1.0, ROOM.zMin), new THREE.Vector3(s * 8.5, ROOM.h - 1.0, ROOM.zMax), 0.38, mDuct);
    room.add(duct);
    room.add(rod(new THREE.Vector3(s * 10.5, ROOM.h - 1.3, ROOM.zMin), new THREE.Vector3(s * 10.5, ROOM.h - 1.3, ROOM.zMax), 0.18, mDuct));
  }
  // Portes d'accès latérales : assez grandes pour faire passer la porte des étoiles
  const DOOR = { z: 9.6, w: 10.4, h: 10.4, frame: 0.35 };
  const doorZ0 = DOOR.z - DOOR.w / 2 - DOOR.frame;
  const doorZ1 = DOOR.z + DOOR.w / 2 + DOOR.frame;

  // Ligne jaune à mi-hauteur, sur tous les murs et autour des piliers (interrompue par les portes)
  const LINE_Y = ROOM.h / 2;
  const LINE_H = 0.3;
  for (const s of [-1, 1]) {
    for (const [z0, z1] of [[ROOM.zMin, doorZ0], [doorZ1, ROOM.zMax]]) {
      room.add(box(0.04, LINE_H, z1 - z0, mYellow, s * (ROOM.x - 0.02), LINE_Y, (z0 + z1) / 2, false));
    }
  }
  room.add(box(ROOM.x * 2, LINE_H, 0.04, mYellow, 0, LINE_Y, ROOM.zMin + 0.02, false));
  // Sur le mur de la salle de contrôle, la ligne s'interrompt au niveau de la vitre
  for (const s of [-1, 1]) room.add(box(ROOM.x - CONTROL.x, LINE_H, 0.04, mYellow, s * (ROOM.x + CONTROL.x) / 2, LINE_Y, ROOM.zMax - 0.02, false));
  for (const z of PILLARS_Z) for (const s of [-1, 1]) room.add(box(0.94, LINE_H, 0.94, mYellow, s * (ROOM.x - 0.45), LINE_Y, z, false));

  const mGlassDoor = track(new THREE.MeshStandardMaterial({ color: 0x20303d, roughness: 0.1, metalness: 0.9, emissive: 0x0d1a24 }));
  const mLamp = track(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d0, emissiveIntensity: 1.5 }));
  ([[-1, "P-51"], [1, "P-52"]] as const).forEach(([s, label]) => {
    const wx = s * ROOM.x;
    const inward = -s;
    const F = DOOR.frame;
    const fx = wx + inward * 0.18;
    // Cadre massif
    room.add(box(0.36, DOOR.h + F, F, mDoorFrame, fx, (DOOR.h + F) / 2, DOOR.z - DOOR.w / 2 - F / 2));
    room.add(box(0.36, DOOR.h + F, F, mDoorFrame, fx, (DOOR.h + F) / 2, DOOR.z + DOOR.w / 2 + F / 2));
    room.add(box(0.36, F, DOOR.w + F * 2, mDoorFrame, fx, DOOR.h + F / 2, DOOR.z));
    // Deux grands battants blindés
    for (const side of [-1, 1]) {
      const leafW = DOOR.w / 2 - 0.03;
      const leafZ = DOOR.z + side * DOOR.w / 4;
      const lx = wx + inward * 0.1;
      room.add(box(0.14, DOOR.h, leafW, mDoor, lx, DOOR.h / 2, leafZ));
      // Renforts horizontaux et verticaux
      for (let y = 0.9; y < DOOR.h - 0.3; y += 1.3) room.add(box(0.08, 0.16, leafW - 0.3, mDoorFrame, lx + inward * 0.1, y, leafZ, false));
      room.add(box(0.08, DOOR.h - 0.4, 0.16, mDoorFrame, lx + inward * 0.1, DOOR.h / 2, leafZ + side * (leafW / 2 - 0.25), false));
      // Hublot
      room.add(box(0.03, 0.5, 0.36, mGlassDoor, lx + inward * 0.09, 1.85, DOOR.z + side * 0.6, false));
    }
    // Joint central
    room.add(box(0.06, DOOR.h, 0.06, mHazard, wx + inward * 0.19, DOOR.h / 2, DOOR.z, false));
    // Bandes de sécurité au sol devant la porte
    const sill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, DOOR.w + 0.8), mHazard);
    sill.rotation.x = -Math.PI / 2;
    sill.position.set(wx + inward * 0.8, 0.013, DOOR.z);
    room.add(sill);
    // Lampes de part et d'autre
    for (const side of [-1, 1]) room.add(box(0.14, 0.5, 0.14, mLamp, wx + inward * 0.12, DOOR.h - 0.4, DOOR.z + side * (DOOR.w / 2 + F + 0.35), false));
    // Gros numéro jaune peint sur les battants
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 2.4),
      track(new THREE.MeshStandardMaterial({ map: track(paintedText(label, "#f2c200")), transparent: true, roughness: 0.7, emissive: 0x3a2c00, emissiveIntensity: 0.5, depthWrite: false })),
    );
    sign.rotation.y = s * -Math.PI / 2;
    sign.position.set(wx + inward * 0.29, DOOR.h * 0.58, DOOR.z);
    room.add(sign);
  });

  // Nervures du mur derrière la porte
  for (let i = 0; i < 5; i++) room.add(box(ROOM.x * 2, 0.25, 0.3, mBeam, 0, 1.8 + i * 2.4, ROOM.zMin + 0.15, false));
  // Marquage au sol au pied de la rampe
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.25), mHazard);
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, 0.012, RAMP_END + 0.5);
  room.add(mark);
  for (const s of [-1, 1]) {
    const m2 = new THREE.Mesh(new THREE.PlaneGeometry(0.25, RAMP_END - 1.2), mHazard);
    m2.rotation.x = -Math.PI / 2;
    m2.position.set(s * 2.2, 0.012, (RAMP_END + 1.2) / 2);
    room.add(m2);
  }

  /* ---------- Plateforme et rampe ---------- */
  // Palier en haut de la rampe, et sa lèvre qui avance jusqu'au plan du vortex
  const rampStart = 2.0;
  const rampEnd = RAMP_END;
  room.add(box(3.6, PLATFORM_H, rampStart - 0.42, mGrate, 0, PLATFORM_H / 2, 0.42 + (rampStart - 0.42) / 2));
  room.add(box(3.6, 0.1, 0.42, mGrate, 0, PLATFORM_H - 0.05, 0.21));
  for (const s of [-1, 1]) room.add(box(0.5, PLATFORM_H, rampStart - 0.42, mBeam, s * 2.05, PLATFORM_H / 2, 0.42 + (rampStart - 0.42) / 2));
  const rampLen = Math.hypot(rampEnd - rampStart, PLATFORM_H);
  const ramp = box(3.4, 0.12, rampLen, mGrate, 0, PLATFORM_H / 2, (rampStart + rampEnd) / 2);
  ramp.rotation.x = Math.atan2(PLATFORM_H, rampEnd - rampStart);
  room.add(ramp);
  const yAt = (z: number) => PLATFORM_H - ((z - rampStart) / (rampEnd - rampStart)) * PLATFORM_H + 0.06;
  for (const s of [-1, 1]) {
    const x = s * 1.6;
    for (let z = rampStart + 0.3; z <= rampEnd; z += 1.55) room.add(rod(new THREE.Vector3(x, yAt(z), z), new THREE.Vector3(x, yAt(z) + 1.0, z), 0.035, mRail));
    room.add(rod(new THREE.Vector3(x, yAt(rampStart) + 1.0, rampStart), new THREE.Vector3(x, yAt(rampEnd) + 1.0, rampEnd), 0.04, mRail));
    room.add(rod(new THREE.Vector3(x, yAt(rampStart) + 0.5, rampStart), new THREE.Vector3(x, yAt(rampEnd) + 0.5, rampEnd), 0.025, mRail));
  }

  /* ---------- Porte ---------- */
  const gate = new THREE.Group();
  gate.position.set(0, GATE_Y, 0);
  scene.add(gate);
  const outer = new THREE.Mesh(annulus(R, R * K.outerIn, 0.5, 0.03), mGate);
  const innerRim = new THREE.Mesh(annulus(R * K.glyphIn, RH, 0.46, 0.02), mGateDark);
  for (const m of [outer, innerRim]) {
    m.castShadow = m.receiveShadow = true;
    gate.add(m);
  }
  // Petit utilitaire : n blocs répartis en cercle (une seule géométrie instanciée)
  const ringOf = (count: number, radius: number, size: [number, number, number], z: number, mat: THREE.Material, parent: THREE.Object3D, offset = 0) => {
    const geo = track(new THREE.BoxGeometry(...size));
    const im = new THREE.InstancedMesh(geo, mat, count);
    const o = new THREE.Object3D();
    for (let k = 0; k < count; k++) {
      const a = ((k + offset) / count) * TAU;
      o.position.set(Math.cos(a) * radius, Math.sin(a) * radius, z);
      o.rotation.set(0, 0, a - Math.PI / 2);
      o.updateMatrix();
      im.setMatrixAt(k, o.matrix);
    }
    im.castShadow = true;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  };
  const band = (a: number, b: number) => (a + b) / 2;
  // Anneau extérieur : 18 segments, stries fines, filet en relief
  ringOf(18, R * band(K.outerIn, 1), [0.05, R * (1 - K.outerIn) * 0.95, 0.06], 0.26, mGateDeep, gate, 0.5);
  ringOf(270, R * 0.99, [0.018, R * 0.02, 0.04], 0.26, mGateDeep, gate);
  const bead = new THREE.Mesh(track(new THREE.TorusGeometry(R * 0.955, 0.02, 6, 200)), mGateDark);
  bead.position.z = 0.27;
  gate.add(bead);
  // Dents mécaniques fines entre l'anneau extérieur et l'anneau des symboles
  ringOf(156, R * (K.outerIn - 0.006), [R * 0.012, R * 0.014, 0.42], 0, mGateDark, gate);
  // Rebord crénelé autour du vortex
  ringOf(120, R * (K.rimIn + 0.006), [R * 0.01, R * 0.014, 0.52], 0, mGateDark, gate);
  ringOf(120, R * (K.rimIn + 0.002), [R * 0.006, R * 0.008, 0.56], 0, mGateDeep, gate, 0.5);

  // Anneau des symboles (seul élément qui tourne)
  const glyphRing = new THREE.Group();
  gate.add(glyphRing);
  const ringBody = new THREE.Mesh(annulus(R * K.outerIn - 0.02, R * K.glyphIn + 0.02, 0.34, 0.015), mGateDark);
  ringBody.castShadow = true;
  glyphRing.add(ringBody);
  const glyphMid = band(K.glyphIn, K.outerIn);
  const glyphTex = track(glyphRingTexture(K.outerIn, K.glyphIn, glyphMid, 0.04));
  const glyphFace = new THREE.Mesh(
    new THREE.RingGeometry(R * K.glyphIn, R * K.outerIn, 234, 1),
    track(new THREE.MeshStandardMaterial({ map: glyphTex, roughness: 0.48, metalness: 0.55, emissive: 0xffffff, emissiveMap: glyphTex, emissiveIntensity: 0.05 })),
  );
  glyphFace.position.z = 0.17 + 0.02;
  glyphRing.add(glyphFace);
  ringOf(N, R * glyphMid, [0.03, R * (K.outerIn - K.glyphIn) * 0.92, 0.04], 0.2, mGateDeep, glyphRing, 0.5);

  // Chevrons : petits logements effilés posés sur l'anneau extérieur, lentille ambre
  const lamps: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  const cy0 = K.outerIn - 0.02;
  const housingGeo = track(poly([[-0.075 * R, 1.025 * R], [0.075 * R, 1.025 * R], [0.035 * R, cy0 * R], [-0.035 * R, cy0 * R]], 0.62));
  const finGeo = track(poly([[0, cy0 * R], [0.03 * R, (cy0 + 0.02) * R], [0.045 * R, 1.015 * R], [0, 1.015 * R]], 0.5));
  const lampGeo = track(
    poly(
      [[-0.05, 1.008], [-0.024, 1.008], [0, 0.958], [0.024, 1.008], [0.05, 1.008], [0, cy0 + 0.005]].map(([x, y]) => [x * R, y * R] as [number, number]),
      0.1,
    ),
  );
  for (let k = 0; k < 9; k++) {
    const g = new THREE.Group();
    g.rotation.z = -(k * TAU) / 9;
    const housing = new THREE.Mesh(housingGeo, mHousing);
    housing.castShadow = true;
    g.add(housing);
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, mGateDark);
      fin.scale.x = s;
      fin.position.x = s * 0.068 * R;
      fin.castShadow = true;
      g.add(fin);
    }
    const mat = track(new THREE.MeshStandardMaterial({ color: 0x7a5418, emissive: 0xffa030, emissiveIntensity: 0, roughness: 0.25, metalness: 0.35 }));
    const lamp = new THREE.Mesh(lampGeo, mat);
    lamp.position.z = 0.34;
    g.add(lamp);
    lamps.push({ mesh: lamp, mat });
    gate.add(g);
  }
  // Pieds de la porte
  for (const s of [-1, 1]) {
    const foot = box(1.3, 0.9, 1.3, mGateDark, s * R * 0.42, -R + 0.45, 0);
    foot.rotation.z = s * 0.35;
    gate.add(foot);
  }

  // Horizon des événements
  const horizonMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: horizonVert,
      fragmentShader: horizonFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const horizon = new THREE.Mesh(new THREE.RingGeometry(0.001, RH, 128, 40), horizonMat);
  horizon.visible = false;
  gate.add(horizon);
  // Jaillissement à l'ouverture
  const burstMat = track(new THREE.MeshBasicMaterial({ color: 0xa8e2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const burst = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, TAU, 0, Math.PI / 2), burstMat);
  burst.rotation.x = Math.PI / 2;
  burst.visible = false;
  gate.add(burst);
  const burstCore = new THREE.Mesh(burst.geometry, track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  burstCore.rotation.x = Math.PI / 2;
  burstCore.visible = false;
  gate.add(burstCore);
  // Iris
  const irisMat = track(new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, vertexShader: simpleVert, fragmentShader: irisFrag, side: THREE.DoubleSide }));
  const iris = new THREE.Mesh(new THREE.CircleGeometry(RH * 1.01, 96), irisMat);
  iris.position.z = 0.08;
  iris.visible = false;
  gate.add(iris);

  /* ---------- Salle de contrôle ---------- */
  const ctrl = new THREE.Group();
  scene.add(ctrl);
  const cDepth = CONTROL.zMax - ROOM.zMax;
  const cMid = (CONTROL.zMax + ROOM.zMax) / 2;
  const cH = CONTROL.yMax - CONTROL.yMin;
  const mCtrl = track(new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.85 }));
  const cFloor = new THREE.Mesh(new THREE.PlaneGeometry(CONTROL.x * 2, cDepth), mCtrl);
  cFloor.rotation.x = -Math.PI / 2;
  cFloor.position.set(0, CONTROL.yMin, cMid);
  const cCeil = cFloor.clone();
  cCeil.rotation.x = Math.PI / 2;
  cCeil.position.y = CONTROL.yMax;
  const cBack = new THREE.Mesh(new THREE.PlaneGeometry(CONTROL.x * 2, cH), mCtrl);
  cBack.rotation.y = Math.PI;
  cBack.position.set(0, CONTROL.yMin + cH / 2, CONTROL.zMax);
  ctrl.add(cFloor, cCeil, cBack);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(cDepth, cH), mCtrl);
    w.rotation.y = -s * Math.PI / 2;
    w.position.set(s * CONTROL.x, CONTROL.yMin + cH / 2, cMid);
    ctrl.add(w);
  }
  const mDesk = track(new THREE.MeshStandardMaterial({ color: 0x3a4149, roughness: 0.6, metalness: 0.3 }));
  const hues = ["#5cd0ff", "#7dffb0", "#ffb35c"];
  for (let i = -2; i <= 2; i++) {
    const x = i * 2.2;
    ctrl.add(box(1.9, 0.9, 0.8, mDesk, x, CONTROL.yMin + 0.45, ROOM.zMax + 0.9, false));
    for (const dx of [-0.45, 0.45]) {
      const tex = track(screenTexture(hues[(i + 5 + (dx > 0 ? 1 : 0)) % 3]));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.47), track(new THREE.MeshBasicMaterial({ map: tex })));
      scr.position.set(x + dx, CONTROL.yMin + 1.25, ROOM.zMax + 1.0);
      scr.rotation.set(-0.2, Math.PI, 0);
      ctrl.add(scr);
    }
  }

  /* ---------- Lumières ---------- */
  scene.add(new THREE.HemisphereLight(0xd6dee6, 0x2a2e33, 1.1));
  // Éclairage d'appoint des murs
  for (const s of [-1, 1]) {
    const wash = new THREE.PointLight(0xe8eef4, 30, 22, 1.6);
    wash.position.set(s * 7, 7.5, 9);
    scene.add(wash);
  }
  const spots: [number, number, boolean][] = [
    [-6, 1, true],
    [6, 1, false],
    [-6, 11, false],
    [6, 11, false],
  ];
  for (const [x, z, shadow] of spots) {
    const sp = new THREE.SpotLight(0xdfe8f2, 140, 0, 0.75, 0.65, 2);
    sp.position.set(x, ROOM.h - 0.4, z);
    sp.target.position.set(x * 0.4, 0, z);
    if (shadow) {
      sp.castShadow = true;
      sp.shadow.mapSize.set(1024, 1024);
      sp.shadow.bias = -0.0004;
    }
    scene.add(sp, sp.target);
    const fixture = box(1.2, 0.12, 0.5, track(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f0ff, emissiveIntensity: 1.2 })), x, ROOM.h - 0.25, z, false);
    scene.add(fixture);
  }
  const ctrlLight = new THREE.PointLight(0xffc58a, 14, 12, 2);
  ctrlLight.position.set(0, CONTROL.yMax - 0.4, cMid);
  scene.add(ctrlLight);
  const gateLight = new THREE.PointLight(0x5cc8ff, 0, 40, 1.6);
  gateLight.position.set(0, GATE_Y, 1.4);
  scene.add(gateLight);
  const chevronLight = new THREE.PointLight(0xffa030, 0, 8, 2);
  chevronLight.position.set(0, GATE_Y + R + 0.3, 1.2);
  scene.add(chevronLight);
  // Gyrophares
  const beacons: { light: THREE.PointLight; mat: THREE.MeshStandardMaterial; phase: number }[] = [];
  const beaconPos: [number, number][] = [
    [-ROOM.x + 0.95, 1],
    [ROOM.x - 0.95, 1],
    [-ROOM.x + 0.95, -3.6],
    [ROOM.x - 0.95, -3.6],
  ];
  beaconPos.forEach(([x, z], i) => {
    const mat = track(new THREE.MeshStandardMaterial({ color: 0x5a0d0d, emissive: 0xff2a1a, emissiveIntensity: 0 }));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.32, 16), mat);
    m.position.set(x, 7.4, z);
    scene.add(m);
    const light = new THREE.PointLight(0xff2a1a, 0, 14, 2);
    light.position.set(x + Math.sign(-x) * 0.5, 7.4, z);
    scene.add(light);
    beacons.push({ light, mat, phase: i * 0.8 });
  });

  /* ---------- Armoire électrique (à gauche de P-51 vue de face) et mitrailleuse ---------- */
  const panel = createElectricalPanel(track, -ROOM.x, 1, DOOR.z + DOOR.w / 2 + DOOR.frame + 1.0, ROOM.h - 0.6);
  scene.add(panel.group);
  const gun = createMountedGun(track, 4.3, 8.2, new THREE.Vector3(0, GATE_Y, 0));
  scene.add(gun.group);

  /* ---------- Gardes ---------- */
  const guards = createGuards(new THREE.Vector3(0, GATE_Y, 0), [
    { pos: [-2.9, 12.2], face: [0, -1] },
    { pos: [2.9, 12.2], face: [0, -1] },
    { pos: [-6.8, 2.0], face: [0.3, 1] },
    { pos: [6.8, 2.0], face: [-0.3, 1] },
    { pos: [-11.4, 3.85], face: [1, 0] },
    { pos: [11.4, 3.85], face: [-1, 0] },
  ]);
  scene.add(guards.group);
  disposables.push(guards);

  /* ---------- Animation ---------- */
  function update(e: GateEngine, now: number) {
    const t = now / 1000;
    e.irisA += (e.irisTarget - e.irisA) * (e.reduced ? 1 : 0.09);
    glyphRing.rotation.z = -e.ringRot;

    let lit = 0;
    lamps.forEach((l, k) => {
      const engaged = k === 0 && e.engageT >= 0;
      const on = (e.lit[k] && !e.flickOff) || engaged;
      if (on) lit++;
      l.mat.emissiveIntensity += ((on ? 3.2 : 0) - l.mat.emissiveIntensity) * 0.35;
      l.mesh.position.y = engaged ? -Math.sin(Math.PI * e.engageT) * R * 0.022 : 0;
    });
    chevronLight.intensity = e.engageT >= 0 ? 6 : 0;

    let hA = 0;
    let openP = 1;
    if (e.state === "opening") {
      openP = (now - e.openStart) / e.openDuration;
      hA = Math.max(0, Math.min(1, (openP - 0.3) / 0.45));
    } else if (e.state === "open") hA = 1;
    else if (e.state === "closing") hA = Math.max(0, 1 - (now - e.closeStart) / e.closeDuration);
    horizon.visible = hA > 0;
    horizonMat.uniforms.uAlpha.value = hA;
    horizonMat.uniforms.uTime.value = t;

    let burstS = 0;
    if (e.state === "opening" && openP < 1) {
      const q = Math.min(1, openP / 0.75);
      burstS = Math.sin(Math.PI * q);
    }
    burst.visible = burstCore.visible = burstS > 0.01;
    if (burst.visible) {
      const rad = RH * (0.75 + 0.35 * burstS);
      burst.scale.set(rad, rad, burstS * 5.5 + 0.01);
      burstMat.opacity = 0.75 * burstS;
      burstCore.scale.set(rad * 0.6, rad * 0.6, burstS * 4 + 0.01);
      (burstCore.material as THREE.MeshBasicMaterial).opacity = 0.6 * burstS;
    }
    const irisClosed = e.irisA > 0.5;
    gateLight.intensity = (hA * (irisClosed ? 0.15 : 1) * (55 + Math.sin(t * 3.1) * 6 + Math.sin(t * 7.3) * 3)) + burstS * 160;

    iris.visible = e.irisA > 0.004;
    irisMat.uniforms.uA.value = e.irisA;

    const alarm = e.state === "dialing" || e.state === "opening";
    beacons.forEach((b) => {
      const p = alarm ? Math.pow(Math.max(0, Math.sin(t * 6 + b.phase)), 3) : 0;
      b.light.intensity = p * 22;
      b.mat.emissiveIntensity = alarm ? 0.4 + p * 3 : 0;
    });
    guards.update(e, t);
    panel.update(t);
    void lit;
  }

  function dispose() {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    disposables.forEach((d) => d.dispose());
    scene.environment?.dispose();
  }

  return { scene, update, dispose };
}
