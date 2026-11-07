import { GLYPHS } from "@/lib/glyphs";

export default function Glyph({ i }: { i: number }) {
  return (
    <svg viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true">
      <path d={GLYPHS[i]} fill="none" stroke="currentColor" strokeWidth={0.17} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
