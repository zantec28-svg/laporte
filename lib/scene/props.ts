import * as THREE from "three";

/* Accessoires de la salle (créations originales, formes simples). */

type Track = <T extends { dispose(): void }>(o: T) => T;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Face avant d'une armoire électrique : portes, voyants, étiquette de danger. */
function panelTexture() {
  const W = 512;
  const H = 768;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "#9aa0a3";
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  // Deux portes
  x.strokeStyle = "#4d5356";
  x.lineWidth = 6;
  x.strokeRect(14, 14, W / 2 - 20, H - 28);
  x.strokeRect(W / 2 + 6, 14, W / 2 - 20, H - 28);
  // Poignées
  x.fillStyle = "#2b2f31";
  x.fillRect(W / 2 - 34, H / 2 - 50, 14, 100);
  x.fillRect(W / 2 + 20, H / 2 - 50, 14, 100);
  // Fentes d'aération
  for (let i = 0; i < 8; i++) {
    x.fillRect(50, H - 170 + i * 16, 140, 6);
    x.fillRect(W / 2 + 50, H - 170 + i * 16, 140, 6);
  }
  // Étiquette de danger électrique
  const tri = (cx: number, cy: number, s: number) => {
    x.beginPath();
    x.moveTo(cx, cy - s);
    x.lineTo(cx + s * 1.1, cy + s * 0.8);
    x.lineTo(cx - s * 1.1, cy + s * 0.8);
    x.closePath();
  };
  tri(W / 4, 130, 70);
  x.fillStyle = "#f2c200";
  x.fill();
  x.lineWidth = 8;
  x.strokeStyle = "#111";
  x.stroke();
  x.beginPath();
  x.moveTo(W / 4 + 10, 95);
  x.lineTo(W / 4 - 18, 150);
  x.lineTo(W / 4 + 8, 145);
  x.lineTo(W / 4 - 10, 190);
  x.lineWidth = 7;
  x.stroke();
  // Plaque « HAUTE TENSION »
  x.fillStyle = "#f2c200";
  x.fillRect(W / 2 + 40, 90, 180, 70);
  x.fillStyle = "#111";
  x.font = "700 30px 'Arial Narrow', Arial, sans-serif";
  x.textAlign = "center";
  x.fillText("HAUTE", W / 2 + 130, 120);
  x.fillText("TENSION", W / 2 + 130, 152);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Grosse armoire électrique murale, avec voyants qui clignotent et gaines vers le plafond.
 * `inward` : direction (±1 sur x) vers l'intérieur de la salle depuis le mur.
 */
export function createElectricalPanel(track: Track, wallX: number, inward: number, z: number, ceiling: number) {
  const g = new THREE.Group();
  const W = 1.9;
  const H = 3.0;
  const D = 0.7;
  const mBody = track(new THREE.MeshStandardMaterial({ color: 0x8e9497, roughness: 0.55, metalness: 0.45 }));
  const mFront = track(new THREE.MeshStandardMaterial({ map: track(panelTexture()), roughness: 0.5, metalness: 0.4 }));
  const mPipe = track(new THREE.MeshStandardMaterial({ color: 0x6e7479, roughness: 0.45, metalness: 0.7 }));
  const cx = wallX + inward * (D / 2 + 0.02);
  // Socle et caisson
  g.add(mesh(track(new THREE.BoxGeometry(D + 0.1, 0.15, W + 0.1)), mPipe, cx, 0.075, z));
  const body = mesh(track(new THREE.BoxGeometry(D, H, W)), mBody, cx, 0.15 + H / 2, z);
  g.add(body);
  const front = new THREE.Mesh(track(new THREE.PlaneGeometry(W, H)), mFront);
  front.rotation.y = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
  front.position.set(cx + inward * (D / 2 + 0.005), 0.15 + H / 2, z);
  g.add(front);
  // Rangée de voyants
  const lights: THREE.MeshStandardMaterial[] = [];
  const colors = [0x3dff7a, 0x3dff7a, 0xffb02e, 0x3dff7a, 0xff3b30, 0x3dff7a];
  colors.forEach((col, i) => {
    const m = track(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: col, emissiveIntensity: 1.5 }));
    lights.push(m);
    const l = new THREE.Mesh(track(new THREE.SphereGeometry(0.045, 12, 8)), m);
    l.position.set(cx + inward * (D / 2 + 0.03), 0.15 + H - 0.75, z - W / 2 + 0.4 + i * ((W - 0.8) / 5));
    g.add(l);
  });
  // Gaines vers le plafond
  for (const dz of [-0.7, -0.25, 0.25, 0.7]) {
    const r = dz === -0.25 || dz === 0.25 ? 0.09 : 0.06;
    const len = ceiling - (0.15 + H);
    const p = mesh(track(new THREE.CylinderGeometry(r, r, len, 12)), mPipe, wallX + inward * 0.25, 0.15 + H + len / 2, z + dz);
    g.add(p);
  }
  const phase = Math.random() * 10;
  function update(t: number) {
    lights.forEach((m, i) => {
      m.emissiveIntensity = i === 2 ? (Math.sin(t * 4 + phase) > 0 ? 2.2 : 0.2) : i === 4 ? (Math.sin(t * 1.3 + phase) > 0.6 ? 2.5 : 0.3) : 1.5;
    });
  }
  return { group: g, update };
}

/** Mitrailleuse lourde sur affût, avec bouclier et caisse de munitions. Pointée vers `aim`. */
export function createMountedGun(track: Track, x: number, z: number, aim: THREE.Vector3) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mMetal = track(new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: 0.45, metalness: 0.7 }));
  const mDark = track(new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.4, metalness: 0.75 }));
  const mOlive = track(new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.75, metalness: 0.2 }));
  const mBag = track(new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 0.95 }));

  const toAim = new THREE.Vector3(aim.x - x, aim.y - 1.15, aim.z - z);
  const yaw = Math.atan2(toAim.x, toAim.z);
  // Muret de sacs de sable en arc devant l'affût, tourné vers la cible
  const bags = new THREE.Group();
  bags.rotation.y = yaw;
  g.add(bags);
  const bagGeo = track(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10));
  for (let row = 0; row < 3; row++) {
    const n = 6 - row;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 0.32;
      const b = new THREE.Mesh(bagGeo, mBag);
      b.rotation.z = Math.PI / 2;
      b.scale.set(1, 1, 0.75);
      const rr = 1.15;
      b.position.set(Math.sin(a) * rr, 0.15 + row * 0.27, Math.cos(a) * rr);
      b.rotation.y = a;
      b.castShadow = b.receiveShadow = true;
      bags.add(b);
    }
  }

  // Trépied / pied central
  const base = mesh(track(new THREE.CylinderGeometry(0.35, 0.45, 0.12, 16)), mDark, 0, 0.06, 0);
  g.add(base);
  g.add(mesh(track(new THREE.CylinderGeometry(0.07, 0.09, 1.05, 12)), mMetal, 0, 0.6, 0));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const leg = mesh(track(new THREE.BoxGeometry(0.06, 0.06, 0.6)), mMetal, Math.sin(a) * 0.3, 0.15, Math.cos(a) * 0.3);
    leg.rotation.y = a;
    leg.rotation.x = 0.35;
    g.add(leg);
  }

  // Tête pivotante, orientée vers la cible
  const head = new THREE.Group();
  head.position.y = 1.15;
  g.add(head);
  head.rotation.y = yaw;
  const pitch = new THREE.Group();
  pitch.rotation.x = -Math.atan2(toAim.y, Math.hypot(toAim.x, toAim.z));
  head.add(pitch);
  head.add(mesh(track(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 14)), mDark, 0, -0.04, 0));
  // Boîte de culasse
  pitch.add(mesh(track(new THREE.BoxGeometry(0.22, 0.24, 0.85)), mMetal, 0, 0.08, 0));
  pitch.add(mesh(track(new THREE.BoxGeometry(0.16, 0.06, 0.6)), mDark, 0, 0.23, 0.05));
  // Canon avec manchon de refroidissement
  const jacket = mesh(track(new THREE.CylinderGeometry(0.065, 0.065, 0.75, 14)), mDark, 0, 0.1, 0.8);
  jacket.rotation.x = Math.PI / 2;
  pitch.add(jacket);
  for (let i = 0; i < 6; i++) {
    const ring = mesh(track(new THREE.TorusGeometry(0.072, 0.012, 6, 16)), mMetal, 0, 0.1, 0.5 + i * 0.11);
    pitch.add(ring);
  }
  const barrel = mesh(track(new THREE.CylinderGeometry(0.028, 0.028, 0.55, 10)), mDark, 0, 0.1, 1.4);
  barrel.rotation.x = Math.PI / 2;
  pitch.add(barrel);
  const muzzle = mesh(track(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 10)), mMetal, 0, 0.1, 1.7);
  muzzle.rotation.x = Math.PI / 2;
  pitch.add(muzzle);
  // Poignées arrière
  for (const s of [-1, 1]) {
    const h = mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8)), mDark, s * 0.13, 0.02, -0.5);
    h.rotation.z = Math.PI / 2;
    pitch.add(h);
  }
  // Bouclier
  const shield = mesh(track(new THREE.BoxGeometry(1.0, 0.7, 0.04)), mOlive, 0, 0.2, 0.42);
  pitch.add(shield);
  // Caisse et bande de munitions
  pitch.add(mesh(track(new THREE.BoxGeometry(0.22, 0.28, 0.4)), mOlive, -0.25, -0.02, 0.05));
  const belt = mesh(track(new THREE.BoxGeometry(0.16, 0.03, 0.08)), mMetal, -0.12, 0.13, 0.05);
  pitch.add(belt);

  return { group: g };
}
