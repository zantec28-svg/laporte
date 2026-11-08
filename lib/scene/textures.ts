import * as THREE from "three";
import { GLYPHS, N, STEP, TAU } from "../glyphs";

/** Texture de béton / métal procédurale (bruit + taches), répétable. */
export function noiseTexture(base: [number, number, number], spread: number, opts: { size?: number; tile?: boolean; stripes?: boolean; soft?: boolean } = {}) {
  const size = opts.size ?? 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  const img = x.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (Math.random() - 0.5) * spread;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // Taches diffuses (salissures du béton)
  for (let k = 0; k < (opts.soft ? 14 : 40); k++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = size * (0.05 + Math.random() * 0.2);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(0,0,0,${Math.random() * 0.06})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  if (opts.tile) {
    x.strokeStyle = "rgba(0,0,0,.45)";
    x.lineWidth = 3;
    x.strokeRect(1.5, 1.5, size - 3, size - 3);
  }
  if (opts.stripes) {
    // Grille de caillebotis
    x.strokeStyle = "rgba(0,0,0,.5)";
    x.lineWidth = 2;
    for (let p = 0; p <= size; p += size / 8) {
      x.beginPath();
      x.moveTo(p, 0);
      x.lineTo(p, size);
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Face avant de l'anneau des symboles : cases en relief et symboles gravés. Rayons en fraction du rayon extérieur. */
export function glyphRingTexture(outer: number, inner: number, glyphR: number, glyphSize: number) {
  const S = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const px = S / 2 / outer;
  x.translate(S / 2, S / 2);
  const ro = outer * px;
  const ri = inner * px;
  // Fond métallique
  x.beginPath();
  x.arc(0, 0, ro, 0, TAU);
  x.arc(0, 0, ri, 0, TAU, true);
  x.fillStyle = "#59616a";
  x.fill();
  // Cases : un léger bombé par case, bordure sombre
  for (let i = 0; i < N; i++) {
    const a0 = -Math.PI / 2 + (i - 0.5) * STEP + 0.004;
    const a1 = a0 + STEP - 0.008;
    const am = (a0 + a1) / 2;
    const g = x.createRadialGradient(Math.cos(am) * (ro + ri) / 2, Math.sin(am) * (ro + ri) / 2, 0, Math.cos(am) * (ro + ri) / 2, Math.sin(am) * (ro + ri) / 2, (ro - ri) * 0.7);
    g.addColorStop(0, "#8a939c");
    g.addColorStop(1, "#666e77");
    x.beginPath();
    x.arc(0, 0, ro - 10, a0, a1);
    x.arc(0, 0, ri + 10, a1, a0, true);
    x.closePath();
    x.fillStyle = g;
    x.fill();
    x.strokeStyle = "rgba(20,24,28,.85)";
    x.lineWidth = 5;
    x.stroke();
    x.strokeStyle = "rgba(255,255,255,.12)";
    x.lineWidth = 2;
    x.stroke();
  }
  // Usure
  for (let k = 0; k < 9000; k++) {
    const a = Math.random() * TAU;
    const rr = ri + Math.random() * (ro - ri);
    x.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.06})`;
    x.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 3, 3);
  }
  // Symboles gravés : sillon sombre puis arête claire décalée
  x.lineCap = "round";
  x.lineJoin = "round";
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + i * STEP;
    const path = new Path2D(GLYPHS[i]);
    x.save();
    x.translate(Math.cos(a) * glyphR * px, Math.sin(a) * glyphR * px);
    x.rotate(a + Math.PI / 2);
    x.scale(glyphSize * px, glyphSize * px);
    x.strokeStyle = "#15191d";
    x.lineWidth = 0.27;
    x.stroke(path);
    x.translate(-0.025, -0.025);
    x.strokeStyle = "#dfe5ea";
    x.lineWidth = 0.09;
    x.stroke(path);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Écran de console pour la salle de contrôle. */
export function screenTexture(hue: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const x = c.getContext("2d")!;
  x.fillStyle = "#04121c";
  x.fillRect(0, 0, 256, 160);
  x.strokeStyle = hue;
  x.fillStyle = hue;
  x.globalAlpha = 0.9;
  x.lineWidth = 2;
  x.strokeRect(6, 6, 244, 148);
  for (let i = 0; i < 9; i++) x.fillRect(16, 18 + i * 14, 40 + Math.random() * 120, 5);
  x.beginPath();
  x.arc(200, 80, 34, 0, TAU);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Inscription peinte au pochoir (fond transparent). Redessinée quand la police est chargée. */
export function paintedText(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 384;
  const x = c.getContext("2d")!;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const font = "700 300px 'Saira Condensed', 'Arial Narrow', Impact, sans-serif";
  const draw = () => {
    x.clearRect(0, 0, c.width, c.height);
    x.font = font;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = color;
    x.fillText(text, c.width / 2, c.height / 2 + 10);
    // Usure de la peinture
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(0,0,0,${Math.random() * 0.35})`;
      x.fillRect(Math.random() * c.width, Math.random() * c.height, 2 + Math.random() * 8, 1 + Math.random() * 4);
    }
    x.globalCompositeOperation = "source-over";
    t.needsUpdate = true;
  };
  draw();
  document.fonts?.load(font).then(draw).catch(() => {});
  return t;
}
