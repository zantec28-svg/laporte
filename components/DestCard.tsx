import type { Destination } from "@/lib/worlds";

export default function DestCard({ dest }: { dest: Destination }) {
  const rows = (
    [
      ["Environnement", dest.env],
      ["Température", dest.temp],
      ["Atmosphère", dest.air],
      ["Menace", dest.threat],
    ] as const
  ).filter((r) => r[1]);
  return (
    <div className="dest">
      <div className="dest-head">
        <h2>{dest.name}</h2>
        <span className="code">{dest.code}</span>
        {dest.fresh && <span className="new">Nouveau monde</span>}
      </div>
      <p>{dest.note || "Aucune note pour cette planète. Vous pouvez en ajouter depuis le carnet."}</p>
      {rows.length > 0 && (
        <dl>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
