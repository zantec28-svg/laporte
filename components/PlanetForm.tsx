"use client";

import { FormEvent, useEffect, useState } from "react";
import Glyph from "./Glyph";
import { CODE_RE, keyOf, randCode, type Planet } from "@/lib/worlds";

type Props = {
  addr: number[];
  planets: Planet[];
  editing: Planet | null;
  onSave: (p: { name: string; code: string; note: string }) => Promise<void>;
  onCancel: () => void;
};

export default function PlanetForm({ addr, planets, editing, onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [codeBad, setCodeBad] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "" | "err" | "ok" }>({ text: "", kind: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
    setNote(editing?.note ?? "");
    setCodeBad(false);
    if (editing) setMsg({ text: "", kind: "" });
  }, [editing]);

  const err = (text: string) => setMsg({ text, kind: "err" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const c = code.trim();
    if (addr.length !== 6) return err("Composez d'abord les six symboles de l'adresse.");
    if (!n) return err("Donnez un nom à la planète.");
    if (!CODE_RE.test(c)) {
      setCodeBad(true);
      return err("La désignation suit le format P3X-582 : trois caractères, un tiret, trois chiffres.");
    }
    const k = keyOf(addr);
    const dupA = planets.find((p) => keyOf(p.addr) === k && p.id !== editing?.id);
    if (dupA) return err(`Cette adresse est déjà enregistrée pour ${dupA.name}.`);
    const dupC = planets.find((p) => p.code === c && p.id !== editing?.id);
    if (dupC) {
      setCodeBad(true);
      return err(`La désignation ${c} est déjà prise par ${dupC.name}.`);
    }
    setBusy(true);
    try {
      await onSave({ name: n, code: c, note: note.trim() });
      setMsg({ text: editing ? "Modifications enregistrées." : `${n} est dans le carnet.`, kind: "ok" });
      if (!editing) {
        setName("");
        setCode("");
        setNote("");
      }
    } catch {
      err("L'enregistrement a échoué. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  const missing = 6 - addr.length;

  return (
    <form id="saveForm" className="save" noValidate onSubmit={submit}>
      <div className="label">
        <span>{editing ? `Modifier ${editing.name}` : "Enregistrer une planète"}</span>
      </div>
      <div className="fields">
        <label className="f">
          <span>Nom</span>
          <input id="pName" type="text" maxLength={40} autoComplete="off" placeholder="Ex. Kheloria" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="f">
          <span>Désignation</span>
          <span className="code-row">
            <input
              id="pCode"
              type="text"
              maxLength={7}
              autoComplete="off"
              spellCheck={false}
              placeholder="P3X-582"
              aria-invalid={codeBad}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, ""));
                setCodeBad(false);
              }}
            />
            <button
              className="btn sm"
              type="button"
              onClick={() => {
                let c: string;
                do c = randCode();
                while (planets.some((p) => p.code === c));
                setCode(c);
                setCodeBad(false);
              }}
            >
              Générer
            </button>
          </span>
        </label>
        <label className="f wide">
          <span>
            Notes <em>(facultatif)</em>
          </span>
          <textarea id="pNote" rows={2} maxLength={300} placeholder="Ce que l'équipe doit savoir avant de partir" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="f wide">
          <span>Coordonnées</span>
          <div className="coords">
            {addr.map((g) => (
              <Glyph key={g} i={g} />
            ))}
            <span className="miss">
              {addr.length === 0
                ? "Composez l'adresse avec le clavier de symboles ci-dessus."
                : missing > 0
                  ? ` ${missing} symbole${missing > 1 ? "s" : ""} manquant${missing > 1 ? "s" : ""}`
                  : " + point d'origine"}
            </span>
          </div>
        </div>
      </div>
      <p className={`formmsg ${msg.kind}`} role="status">
        {msg.text}
      </p>
      <div className="form-actions">
        <button className="btn primary" type="submit" disabled={busy || addr.length !== 6 || !name.trim() || !code.trim()}>
          {editing ? "Enregistrer les modifications" : "Enregistrer"}
        </button>
        {editing && (
          <button className="btn" type="button" onClick={onCancel}>
            Annuler la modification
          </button>
        )}
      </div>
    </form>
  );
}
