import type { Planet } from "./worlds";
import type { SoundKey } from "./audio";

const PLANETS_KEY = "laporte-carnet";

export function loadPlanets(): Planet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PLANETS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function savePlanets(planets: Planet[]): void {
  try {
    localStorage.setItem(PLANETS_KEY, JSON.stringify(planets));
  } catch {
    /* stockage indisponible (navigation privée…) : le carnet vit le temps de la session */
  }
}

/* Sons importés : conservés dans IndexedDB (les fichiers audio sont trop lourds pour localStorage). */
export type StoredSound = { name: string; blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open("laporte-sons", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("s");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

export async function loadSounds(): Promise<Partial<Record<SoundKey, StoredSound>>> {
  const out: Partial<Record<SoundKey, StoredSound>> = {};
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const cur = db.transaction("s", "readonly").objectStore("s").openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          out[c.key as SoundKey] = c.value as StoredSound;
          c.continue();
        } else resolve();
      };
      cur.onerror = () => resolve();
    });
  } catch {
    /* pas d'IndexedDB : sons synthétisés uniquement */
  }
  return out;
}

async function write(fn: (st: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("s", "readwrite");
    fn(tx.objectStore("s"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const putSound = (key: SoundKey, s: StoredSound) => write((st) => st.put(s, key));
export const deleteSound = (key: SoundKey) => write((st) => st.delete(key));
