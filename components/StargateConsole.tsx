"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import GateScene3D from "./GateScene3D";
import Glyph from "./Glyph";
import PlanetForm from "./PlanetForm";
import AddressBook from "./AddressBook";
import SoundSettings from "./SoundSettings";
import DestCard from "./DestCard";
import { ORIGIN, N } from "@/lib/glyphs";
import { SoundEngine } from "@/lib/audio";
import { GateEngine, MAX_OPEN_MS, type GateState, type LogKind } from "@/lib/gateEngine";
import { keyOf, newId, resolve, type Planet } from "@/lib/worlds";
import { loadPlanets, savePlanets } from "@/lib/storage";
import { PRESETS, type PresetName } from "@/lib/scene/gateRoom";

type LogEntry = { id: number; ts: string; msg: string; kind: LogKind };

const LABELS: Record<GateState, string> = {
  idle: "En veille",
  dialing: "Composition",
  failed: "Échec",
  opening: "Ouverture",
  open: "Vortex établi",
  closing: "Fermeture",
};
const SYMBOLS = Array.from({ length: N - 1 }, (_, i) => i + 1);

const pad = (n: number) => String(n).padStart(2, "0");

export default function StargateConsole() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [addr, setAddr] = useState<number[]>([]);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Planet | null>(null);
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState<{ name: PresetName; n: number }>({ name: "ensemble", n: 0 });
  const logSeq = useRef(0);

  const log = useCallback((msg: string, kind: LogKind = "") => {
    const d = new Date();
    const ts = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    setLogs((l) => [{ id: ++logSeq.current, ts, msg, kind }, ...l].slice(0, 60));
  }, []);

  const [sound] = useState(() => new SoundEngine());
  const [gate] = useState(() => new GateEngine(sound, rerender, log));
  const state = gate.state;
  const idle = state === "idle";

  // Chargement du carnet et réglages initiaux
  useEffect(() => {
    gate.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlanets(loadPlanets().sort((a, b) => a.created - b.created));
    setLoaded(true);
    log("Système prêt. Point d'origine : Terre.", "o");
    return () => gate.dispose();
  }, [gate, log]);

  useEffect(() => {
    if (loaded) savePlanets(planets);
  }, [planets, loaded]);

  // Chronomètre du vortex
  useEffect(() => {
    if (state !== "open") return;
    const id = setInterval(rerender, 1000);
    return () => clearInterval(id);
  }, [state]);

  const press = (g: number) => {
    if (!idle || addr.length >= 6 || addr.includes(g)) return;
    sound.beep();
    setAddr((a) => [...a, g]);
  };

  const dial = useCallback(async () => {
    if (gate.state !== "idle") return gate.close();
    if (addr.length !== 6) return;
    const target = resolve(addr, planets);
    const isNew = !!target && target.found && !target.id;
    if (target && isNew) target.fresh = true;
    const opened = await gate.dial(addr, target);
    if (opened && target && isNew) {
      const p: Planet = { ...target, id: newId(), created: Date.now() };
      delete (p as Planet & { fresh?: boolean }).fresh;
      setPlanets((ps) => (ps.some((x) => keyOf(x.addr) === keyOf(p.addr)) ? ps : [...ps, p]));
      log(`Nouveau monde ajouté au carnet : ${p.name} (${p.code})`, "o");
    }
  }, [gate, addr, planets, log]);

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select")) return;
      if (e.key === "Enter" && t.tagName !== "BUTTON") {
        e.preventDefault();
        void dial();
      } else if (e.key === "Backspace" && gate.state === "idle") {
        e.preventDefault();
        setAddr((a) => a.slice(0, -1));
      } else if (e.key === "Escape") gate.close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dial, gate]);

  const randomAddr = () => {
    const pool = [...SYMBOLS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    sound.beep();
    setAddr(pool.slice(0, 6));
  };

  async function savePlanet(f: { name: string; code: string; note: string }) {
    const old = editing;
    let p: Planet = { ...(old ?? {}), id: old?.id ?? newId(), created: old?.created ?? Date.now(), ...f, addr: [...addr] };
    if (old?.found && keyOf(old.addr) !== keyOf(addr)) {
      // L'adresse a changé : les relevés du monde découvert ne s'appliquent plus.
      const { env, temp, air, threat, found, ...rest } = p;
      void env, temp, air, threat, found;
      p = rest;
    }
    setPlanets((ps) => (old ? ps.map((x) => (x.id === old.id ? p : x)) : [...ps, p]));
    log(`${old ? "Planète modifiée" : "Planète enregistrée"} : ${p.name} (${p.code})`, "o");
    setEditing(null);
  }

  const elapsed = state === "open" ? Math.min(MAX_OPEN_MS / 1000, Math.floor((Date.now() - gate.openedAt) / 1000)) : 0;
  const chipState = state === "opening" ? "open" : state === "closing" ? "idle" : state;
  const readout =
    state === "dialing"
      ? `Chevron ${gate.dialIdx + 1} / 7`
      : (state === "open" || state === "opening") && gate.dest
        ? `Destination : ${gate.dest.name}`
        : "Point d'origine : Terre";

  return (
    <div className="page">
      <header className="top">
        <div>
          <div className="eyebrow">Salle d&apos;embarquement · Console de composition</div>
          <h1>La Porte</h1>
          <p>Composez six symboles, le point d&apos;origine s&apos;ajoute en septième. Si une porte répond à l&apos;autre bout, le vortex s&apos;ouvre.</p>
        </div>
        <button
          className="btn"
          type="button"
          aria-pressed={!muted}
          onClick={() => {
            sound.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? "Son : coupé" : "Son : activé"}
        </button>
      </header>

      <main className="layout">
        <section className="gate-col" aria-label="La porte">
          <div className="view">
            <GateScene3D engine={gate} preset={cam} />
            <div className="cams" role="group" aria-label="Points de vue">
              {(Object.keys(PRESETS) as PresetName[]).map((k) => (
                <button key={k} type="button" className={`btn sm${cam.name === k ? " on" : ""}`} onClick={() => setCam((c) => ({ name: k, n: c.n + 1 }))}>
                  {PRESETS[k].label}
                </button>
              ))}
            </div>
            <div className="hud">
              <div className="status">
                <span className="chip" data-s={chipState}>
                  {LABELS[state]}
                </span>
                <span>{readout}</span>
                {state === "open" && (
                  <span className="timer">
                    {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)} / 38:00
                  </span>
                )}
              </div>
              {state === "open" && gate.dest && (
                <div className="dest-overlay">
                  <DestCard dest={gate.dest} />
                </div>
              )}
            </div>
          </div>
          <p className="hint view-hint">Faites glisser pour tourner autour de la salle, molette ou pincement pour zoomer, clic droit ou deux doigts pour vous déplacer.</p>
          {state === "open" && gate.dest && (
            <div className="dest-below">
              <DestCard dest={gate.dest} />
            </div>
          )}
        </section>

        <section className="panel" aria-label="Console">
          <div>
            <div className="label">
              <span>Adresse</span>
              <span>{addr.length} / 6</span>
            </div>
            <div className="slots">
              {Array.from({ length: 7 }, (_, k) => {
                const g = k === 6 ? ORIGIN : addr[k];
                const cls = ["slot"];
                if (g !== undefined) cls.push("filled");
                if (k === 6) cls.push("origin");
                if (k < gate.lockedN) cls.push("locked");
                if (k === gate.dialIdx) cls.push("active");
                return (
                  <div key={k} className={cls.join(" ")} title={k === 6 ? "Point d'origine" : `Chevron ${k + 1}`}>
                    <span className="n">{k + 1}</span>
                    {g !== undefined && <Glyph i={g} />}
                  </div>
                );
              })}
            </div>
            <p className="hint">Clavier : Entrée pour activer, Retour arrière pour effacer un symbole, Échap pour couper le vortex.</p>
          </div>

          <div>
            <div className="label">
              <span>Clavier de symboles</span>
            </div>
            <div className="dhd">
              {SYMBOLS.map((g) => {
                const used = addr.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    className={`key${used ? " used" : ""}`}
                    aria-label={`Symbole ${g}`}
                    disabled={!idle || used || addr.length >= 6}
                    onClick={() => press(g)}
                  >
                    <Glyph i={g} />
                    <span className="n">{g}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="actions">
            <button
              type="button"
              className={`dial${idle || state === "failed" || state === "closing" ? "" : " close"}`}
              disabled={state === "failed" || state === "closing" || (idle && addr.length !== 6)}
              onClick={() => void dial()}
            >
              {state === "dialing" ? "Interrompre" : state === "open" || state === "opening" ? "Fermer le vortex" : "Activer la porte"}
            </button>
            <div className="row">
              <button className="btn" type="button" disabled={!idle || !addr.length} onClick={() => setAddr((a) => a.slice(0, -1))}>
                Retour
              </button>
              <button className="btn" type="button" disabled={!idle || !addr.length} onClick={() => setAddr([])}>
                Effacer
              </button>
              <button className="btn" type="button" disabled={!idle} onClick={randomAddr}>
                Au hasard
              </button>
              <button className="btn" type="button" onClick={() => gate.toggleIris()}>
                {gate.irisTarget ? "Ouvrir l'iris" : "Fermer l'iris"}
              </button>
            </div>
          </div>

          <PlanetForm addr={addr} planets={planets} editing={editing} onSave={savePlanet} onCancel={() => setEditing(null)} />

          <AddressBook
            planets={planets}
            disabled={!idle}
            onLoad={(p) => {
              if (!idle) return;
              sound.beep();
              setAddr([...p.addr]);
            }}
            onEdit={(p) => {
              setEditing(p);
              if (gate.state === "idle") setAddr([...p.addr]);
              document.getElementById("saveForm")?.scrollIntoView({ behavior: gate.reduced ? "auto" : "smooth", block: "center" });
            }}
            onDelete={(p) => {
              setPlanets((ps) => ps.filter((x) => x.id !== p.id));
              if (editing?.id === p.id) setEditing(null);
              log(`Planète supprimée : ${p.name}`);
            }}
          />

          <SoundSettings sound={sound} gateOpen={state === "open"} log={log} />

          <div>
            <div className="label">
              <span>Journal</span>
            </div>
            <ol className="log" aria-live="polite">
              {logs.map((l) => (
                <li key={l.id} className={l.kind}>
                  <span>{l.ts}</span>
                  {l.msg}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
