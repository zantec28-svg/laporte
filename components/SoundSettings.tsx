"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { SOUNDS, type SoundEngine, type SoundKey } from "@/lib/audio";
import { deleteSound, loadSounds, putSound } from "@/lib/storage";
import type { LogKind } from "@/lib/gateEngine";

const MAX_BYTES = 15 * 1024 * 1024;

export default function SoundSettings({ sound, gateOpen, log }: { sound: SoundEngine; gateOpen: boolean; log: (m: string, k?: LogKind) => void }) {
  const [names, setNames] = useState<Partial<Record<SoundKey, string>>>({});

  useEffect(() => {
    let alive = true;
    loadSounds().then(async (stored) => {
      if (!alive) return;
      const n: Partial<Record<SoundKey, string>> = {};
      for (const [k, s] of Object.entries(stored) as [SoundKey, { name: string; blob: Blob }][]) {
        await sound.setCustom(k, s.blob);
        n[k] = s.name;
      }
      setNames(n);
    });
    return () => {
      alive = false;
    };
  }, [sound]);

  async function onFile(key: SoundKey, e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_BYTES) return log("Fichier trop lourd (15 Mo maximum)", "e");
    sound.ctx();
    if (!(await sound.setCustom(key, f))) return log(`Fichier illisible : ${f.name}`, "e");
    try {
      await putSound(key, { name: f.name, blob: f });
    } catch {
      log("Le son est actif mais ne sera pas conservé après rechargement", "e");
    }
    setNames((n) => ({ ...n, [key]: f.name }));
    log(`Son importé : ${f.name}`, "o");
  }

  async function remove(key: SoundKey) {
    sound.removeCustom(key);
    try {
      await deleteSound(key);
    } catch {}
    setNames((n) => {
      const c = { ...n };
      delete c[key];
      return c;
    });
  }

  return (
    <details className="sounds">
      <summary>Sons personnalisés</summary>
      <p className="hint">
        Par défaut, les sons sont synthétisés en direct. Vous pouvez les remplacer par vos propres fichiers audio (MP3, WAV, OGG). Ils restent dans ce navigateur
        uniquement.
      </p>
      <ul className="soundlist">
        {SOUNDS.map(([k, label]) => (
          <li key={k}>
            <span className="sn">{label}</span>
            <span className="sf">{names[k] ?? "Son synthétisé"}</span>
            <span className="sb">
              <label className="btn sm" htmlFor={`sf-${k}`}>
                Importer
              </label>
              <input id={`sf-${k}`} type="file" accept="audio/*" onChange={(e) => onFile(k, e)} />
              <button className="btn sm" type="button" disabled={k === "hum" && gateOpen} onClick={() => sound.preview(k)}>
                Écouter
              </button>
              {names[k] && (
                <button className="btn sm" type="button" onClick={() => remove(k)}>
                  Retirer
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
