"use client";

import { useEffect, useState } from "react";
import Glyph from "./Glyph";
import type { Planet } from "@/lib/worlds";

type Props = {
  planets: Planet[];
  disabled: boolean;
  onLoad: (p: Planet) => void;
  onEdit: (p: Planet) => void;
  onDelete: (p: Planet) => void;
};

export default function AddressBook({ planets, disabled, onLoad, onEdit, onDelete }: Props) {
  // La suppression demande un second clic dans les 4 secondes.
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div>
      <div className="label">
        <span>Carnet d&apos;adresses</span>
        <span>{planets.length ? `${planets.length} planète${planets.length > 1 ? "s" : ""}` : ""}</span>
      </div>
      {planets.length === 0 ? (
        <div className="empty">
          <strong>Votre carnet est vide.</strong>
          Composez six symboles, donnez un nom et une désignation à la planète, puis enregistrez-la. Une adresse enregistrée ouvre toujours le vortex. Une
          adresse inconnue a environ une chance sur quatre de mener à un monde inexploré, qui s&apos;ajoute alors ici.
        </div>
      ) : (
        <ul className="book">
          {planets.map((p) => (
            <li className="erow" key={p.id}>
              <button type="button" className="entry" disabled={disabled} title="Charger cette adresse" onClick={() => onLoad(p)}>
                <span className="nm">{p.name}</span>
                <span className="meta">
                  <b>{p.code}</b>
                  {p.env ? ` · ${p.env}` : ""}
                  {p.found && (
                    <>
                      {" · "}
                      <i>découvert</i>
                    </>
                  )}
                </span>
                <span className="gl">
                  {p.addr.map((g) => (
                    <Glyph key={g} i={g} />
                  ))}
                </span>
              </button>
              <span className="ops">
                <button type="button" className="btn" onClick={() => onEdit(p)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className={`btn danger${armed === p.id ? " armed" : ""}`}
                  onClick={() => {
                    if (armed !== p.id) return setArmed(p.id);
                    setArmed(null);
                    onDelete(p);
                  }}
                >
                  {armed === p.id ? "Confirmer" : "Supprimer"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
