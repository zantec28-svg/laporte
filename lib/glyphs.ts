// Symboles de la porte : dessins originaux générés de façon déterministe, style gravé.
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

// Style « gravé » : un tracé principal (lignes et arcs) et un ou deux ornements (point, triangle, barre).
const G = [-0.7, 0, 0.7];
const H = [-0.7, -0.35, 0, 0.35, 0.7];
const f = (n: number) => +n.toFixed(2);

function makeGlyph(i: number, salt = 0): string {
  if (i === ORIGIN) {
    // Point d'origine : un fanal (cercle, rayons, mât et socle)
    return [
      "M 0 -0.2 m -0.2 0 a 0.2 0.2 0 1 0 0.4 0 a 0.2 0.2 0 1 0 -0.4 0",
      "M 0 0 L 0 0.62",
      "M -0.5 0.62 L 0.5 0.62",
      "M -0.32 -0.5 L -0.52 -0.72",
      "M 0.32 -0.5 L 0.52 -0.72",
      "M 0 -0.48 L 0 -0.8",
    ].join(" ");
  }
  const r = rng(i * 7919 + 101 + salt * 104729);
  const pick = <T,>(a: T[]) => a[(r() * a.length) | 0];
  // Tracé principal : 3 ou 4 points distincts de la grille, un segment peut devenir un arc
  const n = 3 + (r() < 0.45 ? 1 : 0);
  const pts: [number, number][] = [];
  let guard = 0;
  while (pts.length < n && guard++ < 40) {
    const p: [number, number] = [pick(G), pick(G)];
    if (pts.some((q) => q[0] === p[0] && q[1] === p[1])) continue;
    const l = pts[pts.length - 1];
    if (l && Math.hypot(p[0] - l[0], p[1] - l[1]) > 1.5) continue;
    pts.push(p);
  }
  // Rejette les tracés trop plats : le symbole doit occuper sa case en largeur et en hauteur
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  if (Math.max(...xs) - Math.min(...xs) < 0.7 || Math.max(...ys) - Math.min(...ys) < 0.7) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  const arcAt = r() < 0.55 ? 1 + ((r() * (pts.length - 1)) | 0) : -1;
  for (let k = 1; k < pts.length; k++) {
    const [x, y] = pts[k];
    if (k === arcAt) {
      const [px, py] = pts[k - 1];
      const rad = f(Math.hypot(x - px, y - py) * 0.62);
      d += ` A ${rad} ${rad} 0 0 ${r() < 0.5 ? 0 : 1} ${x} ${y}`;
    } else d += ` L ${x} ${y}`;
  }
  // Ornements
  const accents = 1 + (r() < 0.4 ? 1 : 0);
  const used = new Set<string>();
  for (let a = 0; a < accents; a++) {
    const kind = pick(["dot", "dot", "tri", "bar", "ring"]);
    const cx = pick(H);
    const cy = pick(H);
    const key = `${cx},${cy}`;
    if (used.has(key)) continue;
    used.add(key);
    if (kind === "dot") d += ` M ${cx} ${cy} m -0.11 0 a 0.11 0.11 0 1 0 0.22 0 a 0.11 0.11 0 1 0 -0.22 0`;
    else if (kind === "ring") d += ` M ${cx} ${cy} m -0.17 0 a 0.17 0.17 0 1 0 0.34 0 a 0.17 0.17 0 1 0 -0.34 0`;
    else if (kind === "tri") {
      const s = 0.17;
      const up = r() < 0.5 ? -1 : 1;
      d += ` M ${f(cx - s)} ${f(cy + up * s * 0.6)} L ${cx} ${f(cy - up * s)} L ${f(cx + s)} ${f(cy + up * s * 0.6)} Z`;
    } else {
      const v = r() < 0.5;
      d += v ? ` M ${cx} ${f(cy - 0.2)} L ${cx} ${f(cy + 0.2)}` : ` M ${f(cx - 0.2)} ${cy} L ${f(cx + 0.2)} ${cy}`;
    }
  }
  return d;
}

/** Génère les symboles en garantissant qu'ils sont tous différents. */
function buildGlyphs(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < N; i++) {
    let salt = 0;
    let d = makeGlyph(i, salt);
    while ((!d || seen.has(d.split(" M ")[0])) && salt < 200) d = makeGlyph(i, ++salt);
    seen.add(d.split(" M ")[0]);
    out.push(d);
  }
  return out;
}

export const GLYPHS: string[] = buildGlyphs();
