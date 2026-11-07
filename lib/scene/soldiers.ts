import * as THREE from "three";
import type { GateEngine } from "../gateEngine";

/*
 * Gardes de la salle : silhouettes de militaires génériques (création originale),
 * en formes simples. Ils se mettent en alerte pendant la composition
 * et mettent la porte en joue quand le vortex s'ouvre.
 */

type Guard = {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  rifle: THREE.Group;
  arms: { upper: THREE.Mesh; lower: THREE.Mesh; shoulder: THREE.Vector3; hand: THREE.Vector3; side: number }[];
  baseYaw: number;
  aimYaw: number;
  phase: number;
  ready: number;
};

const SHOULDER_Y = 1.43;

export function createGuards(gateCenter: THREE.Vector3, posts: { pos: [number, number]; face: [number, number] }[]) {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const t = <T extends { dispose(): void }>(o: T) => (disposables.push(o), o);

  const mUniform = t(new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 0.9 }));
  const mVest = t(new THREE.MeshStandardMaterial({ color: 0x2f3427, roughness: 0.85 }));
  const mHelmet = t(new THREE.MeshStandardMaterial({ color: 0x434a35, roughness: 0.7, metalness: 0.1 }));
  const mBoot = t(new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.6 }));
  const mGun = t(new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.45, metalness: 0.6 }));
  const mBelt = t(new THREE.MeshStandardMaterial({ color: 0x23251f, roughness: 0.8 }));
  const skins = [0xe0b48f, 0xc68d62, 0x8d5a3b, 0xf0c9a8, 0xa86f4c, 0x6b4430].map((c) => t(new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })));

  const g = {
    box: t(new THREE.BoxGeometry(1, 1, 1)),
    cyl: t(new THREE.CylinderGeometry(1, 1, 1, 12)),
    limb: t(new THREE.CylinderGeometry(0.055, 0.05, 1, 10).translate(0, 0.5, 0)),
    head: t(new THREE.SphereGeometry(0.105, 20, 14)),
    helmet: t(new THREE.SphereGeometry(0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    brim: t(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20)),
  };
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };

  const guards: Guard[] = posts.map((post, i) => {
    const skin = skins[i % skins.length];
    const root = new THREE.Group();
    root.position.set(post.pos[0], 0, post.pos[1]);
    const baseYaw = Math.atan2(post.face[0], post.face[1]);
    const aimYaw = Math.atan2(gateCenter.x - post.pos[0], gateCenter.z - post.pos[1]);
    root.rotation.y = baseYaw;

    // Jambes et bottes
    for (const s of [-1, 1]) {
      root.add(part(g.box, mBoot, 0.13, 0.13, 0.27, s * 0.1, 0.065, 0.04));
      root.add(part(g.box, mUniform, 0.15, 0.82, 0.17, s * 0.1, 0.54, 0));
    }
    root.add(part(g.box, mBelt, 0.38, 0.08, 0.22, 0, 0.98, 0));

    // Buste (respire), gilet, tête
    const torso = new THREE.Group();
    torso.position.y = 0.98;
    root.add(torso);
    torso.add(part(g.box, mUniform, 0.4, 0.52, 0.22, 0, 0.27, 0));
    torso.add(part(g.box, mVest, 0.43, 0.38, 0.27, 0, 0.32, 0.01));
    for (const s of [-1, 0, 1]) torso.add(part(g.box, mVest, 0.1, 0.12, 0.05, s * 0.12, 0.24, 0.16));
    torso.add(part(g.box, mVest, 0.1, 0.1, 0.05, 0.13, 0.43, 0.15));
    const head = new THREE.Group();
    head.position.y = 0.6;
    torso.add(head);
    head.add(part(g.cyl, skin, 0.05, 0.08, 0.05, 0, 0.0, 0));
    head.add(part(g.head, skin, 1, 1.08, 1, 0, 0.13, 0.01));
    head.add(part(g.helmet, mHelmet, 1, 0.9, 1.05, 0, 0.17, 0));
    head.add(part(g.brim, mHelmet, 1, 1, 1.05, 0, 0.17, 0));

    // Fusil (axe +z = canon)
    const rifle = new THREE.Group();
    root.add(rifle);
    rifle.add(part(g.box, mGun, 0.06, 0.09, 0.42, 0, 0, 0.12));
    rifle.add(part(g.box, mGun, 0.05, 0.08, 0.24, 0, -0.01, -0.2));
    rifle.add(part(g.box, mGun, 0.04, 0.14, 0.06, 0, -0.1, 0.12));
    rifle.add(part(g.box, mGun, 0.035, 0.08, 0.04, 0, -0.07, -0.02));
    const barrel = part(g.cyl, mGun, 0.014, 0.28, 0.014, 0, 0.01, 0.46);
    barrel.rotation.x = Math.PI / 2;
    rifle.add(barrel);
    rifle.add(part(g.box, mGun, 0.03, 0.04, 0.12, 0, 0.065, 0.1));

    // Bras : épaule → coude → main, recalculés à chaque image
    const arms = [-1, 1].map((side) => {
      const upper = new THREE.Mesh(g.limb, mUniform);
      const lower = new THREE.Mesh(g.limb, side > 0 ? mUniform : mUniform);
      upper.castShadow = lower.castShadow = true;
      root.add(upper, lower);
      const hand = part(g.box, skin, 0.08, 0.08, 0.08, 0, 0, 0);
      root.add(hand);
      return { upper, lower, shoulder: new THREE.Vector3(side * 0.24, SHOULDER_Y, 0), hand: new THREE.Vector3(), side, handMesh: hand };
    });

    group.add(root);
    return { root, torso, head, rifle, arms, baseYaw, aimYaw, phase: i * 1.7, ready: 0 } as Guard;
  });

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const placeLimb = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
    tmpA.subVectors(b, a);
    const len = tmpA.length();
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(up, tmpA.normalize());
    m.scale.set(1, len, 1);
  };
  const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

  function update(e: GateEngine, time: number) {
    const irisOpen = e.irisTarget === 0;
    const target = (e.state === "opening" || e.state === "open") && irisOpen ? 1 : e.state === "dialing" || e.state === "opening" ? 0.45 : 0;
    for (const gd of guards) {
      gd.ready += (target - gd.ready) * (e.reduced ? 1 : 0.06);
      const r = gd.ready;
      // Le garde se tourne vers la porte quand il la met en joue
      gd.root.rotation.y = lerpAngle(gd.baseYaw, gd.aimYaw, Math.min(1, r * 1.4));
      gd.torso.scale.y = 1 + Math.sin(time * 1.6 + gd.phase) * 0.008;
      gd.head.rotation.y = (1 - r) * Math.sin(time * 0.25 + gd.phase) * 0.45;
      gd.head.rotation.x = r * 0.05;
      // Fusil : canon vers le sol au repos, à l'épaule en joue
      gd.rifle.position.set(-0.07 * r + 0.02, 1.15 + 0.27 * r, 0.2 + 0.05 * r);
      gd.rifle.rotation.set(0.85 * (1 - r) - 0.02, 0.35 * (1 - r), -0.5 * (1 - r));
      gd.rifle.updateMatrix();
      const grip = new THREE.Vector3(0, -0.07, -0.02).applyMatrix4(gd.rifle.matrix);
      const fore = new THREE.Vector3(0, -0.04, 0.3).applyMatrix4(gd.rifle.matrix);
      gd.arms.forEach((arm) => {
        const handPos = arm.side < 0 ? grip : fore;
        arm.hand.copy(handPos);
        tmpB.addVectors(arm.shoulder, handPos).multiplyScalar(0.5);
        tmpB.x += arm.side * 0.1;
        tmpB.y -= 0.1;
        const elbow = tmpB.clone();
        placeLimb(arm.upper, arm.shoulder, elbow);
        placeLimb(arm.lower, elbow, handPos);
        (arm as unknown as { handMesh: THREE.Mesh }).handMesh.position.copy(handPos);
      });
    }
  }

  function dispose() {
    disposables.forEach((d) => d.dispose());
  }

  return { group, update, dispose };
}
