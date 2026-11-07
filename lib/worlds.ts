import { rng } from "./glyphs";

export type Planet = {
  id: string;
  name: string;
  code: string;
  /** Les six symboles de l'adresse (le point d'origine est ajouté à la composition). */
  addr: number[];
  note?: string;
  env?: string;
  temp?: string;
  air?: string;
  threat?: string;
  /** Monde inexploré trouvé par une adresse au hasard. */
  found?: boolean;
  created: number;
};

/** Destination en cours ; `fresh` marque un monde découvert à l'instant. */
export type Destination = Omit<Planet, "id" | "created"> & { id?: string; created?: number; fresh?: boolean };

export const CODE_RE = /^[A-Z][0-9A-Z]{2}-[0-9]{3}$/;

const ENVS: [string, string, string][] = [
  ["Forêt tempérée", "8 à 19 °C", "Respirable"],
  ["Jungle", "28 à 36 °C", "Respirable, très humide"],
  ["Toundra", "−18 à 2 °C", "Respirable"],
  ["Désert", "35 à 52 °C", "Respirable"],
  ["Steppe", "4 à 24 °C", "Respirable"],
  ["Archipel", "18 à 27 °C", "Respirable, salin"],
  ["Lune rocheuse", "−120 à 90 °C", "Aucune atmosphère"],
  ["Marais", "15 à 25 °C", "Respirable, méthane faible"],
  ["Cité en ruines", "6 à 18 °C", "Respirable"],
];
const NOTES = [
  "Aucune activité détectée autour de la porte.",
  "Ruines d'origine inconnue à deux kilomètres de la porte.",
  "Végétation dense, faune nocturne active.",
  "Traces d'occupation récente : foyers éteints, sentiers battus.",
  "Le ciel compte deux soleils. Rayonnement UV élevé.",
  "La porte est à moitié enfouie. Le passage reste praticable.",
  "Un piédestal gravé fait face à la porte.",
  "Champ magnétique perturbé : boussoles inutilisables.",
];
const THREATS = ["Faible", "Faible", "Moyenne", "Moyenne", "Élevée"];
const SYL = ["ka", "vel", "dor", "ae", "thi", "mor", "nu", "ris", "sha", "tel", "or", "ix", "um", "bra", "zen", "lo", "qa", "ar", "en", "sy"];

export const keyOf = (addr: number[]) => addr.join("-");
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fnv(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randCode(r: () => number = Math.random): string {
  return `P${1 + ((r() * 8) | 0)}${"XRMVKLTZ"[(r() * 8) | 0]}-${100 + ((r() * 899) | 0)}`;
}

/** Environ une adresse inconnue sur quatre mène à un monde inexploré, toujours le même pour une adresse donnée. */
export function genWorld(addr: number[]): Destination | null {
  const h = fnv(keyOf(addr));
  if (h % 4 !== 0) return null;
  const r = rng(h);
  const n = 2 + (r() < 0.45 ? 1 : 0);
  let nm = "";
  for (let i = 0; i < n; i++) nm += SYL[(r() * SYL.length) | 0];
  nm = nm[0].toUpperCase() + nm.slice(1);
  const e = ENVS[(r() * ENVS.length) | 0];
  return {
    name: nm,
    code: randCode(r),
    env: e[0],
    temp: e[1],
    air: e[2],
    threat: THREATS[(r() * THREATS.length) | 0],
    note: NOTES[(r() * NOTES.length) | 0],
    addr: [...addr],
    found: true,
  };
}

export function resolve(addr: number[], planets: Planet[]): Destination | null {
  const k = keyOf(addr);
  return planets.find((p) => keyOf(p.addr) === k) ?? genWorld(addr);
}
