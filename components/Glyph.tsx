import { GLYPHS } from "@/lib/glyphs";

/** Symbole au style gravé : sillon (couleur du texte) et arête fine plus sombre. */
export default function Glyph({ i }: { i: number }) {
  return (
    <svg viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true" className="glyph">
      <path d={GLYPHS[i]} fill="none" stroke="currentColor" strokeWidth={0.24} strokeLinecap="round" strokeLinejoin="round" />
      <path d={GLYPHS[i]} className="glyph-edge" fill="none" strokeWidth={0.07} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
