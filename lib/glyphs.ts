// Symboles de la porte : dessins originaux générés de façon déterministe.
export const N = 39;
export const TAU = Math.PI * 2;
export const STEP = TAU / N;
/** Index du point d'origine (toujours le 7e symbole d'une adresse). */
export const ORIGIN = 0;

export function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GX = [-0.7, 0, 0.7];
const GY = [-0.8, 0, 0.8];

function makeGlyph(i: number): string {
  if (i === ORIGIN) {
    return "M -0.72 0.8 L 0 -0.25 L 0.72 0.8 Z M 0 -0.62 m -0.2 0 a 0.2 0.2 0 1 0 0.4 0 a 0.2 0.2 0 1 0 -0.4 0";
  }
  const r = rng(i * 7919 + 101);
  const strokes = 2 + Math.floor(r() * 2);
  let d = "";
  let made = 0;
  let guard = 0;
  while (made < strokes && guard++ < 20) {
    const n = 2 + Math.floor(r() * 2);
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const p: [number, number] = [GX[(r() * 3) | 0], GY[(r() * 3) | 0]];
      const l = pts[pts.length - 1];
      if (!l || l[0] !== p[0] || l[1] !== p[1]) pts.push(p);
    }
    if (pts.length < 2) continue;
    d += "M " + pts.map((p) => `${p[0]} ${p[1]}`).join(" L ") + " ";
    made++;
  }
  if (r() < 0.4) {
    const cx = GX[(r() * 3) | 0];
    const cy = GY[(r() * 3) | 0];
    const rr = 0.17;
    d += `M ${cx} ${cy} m -${rr} 0 a ${rr} ${rr} 0 1 0 ${rr * 2} 0 a ${rr} ${rr} 0 1 0 -${rr * 2} 0`;
  }
  return d.trim();
}

export const GLYPHS: string[] = Array.from({ length: N }, (_, i) => makeGlyph(i));
