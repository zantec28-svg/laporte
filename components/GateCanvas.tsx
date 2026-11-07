"use client";

import { useEffect, useRef } from "react";
import { GLYPHS, N, STEP, TAU } from "@/lib/glyphs";
import type { GateEngine } from "@/lib/gateEngine";

const PW = 112; // résolution de la texture du vortex

/** Dessine la porte en continu à partir de l'état du moteur. */
export default function GateCanvas({ engine }: { engine: GateEngine }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const paths = GLYPHS.map((d) => new Path2D(d));
    const pc = document.createElement("canvas");
    pc.width = pc.height = PW;
    const pctx = pc.getContext("2d")!;
    const img = pctx.createImageData(PW, PW);
    let raf = 0;

    const plasma = (t: number) => {
      const d = img.data;
      const s = t * 0.001;
      let i = 0;
      for (let y = 0; y < PW; y++) {
        const v = (y / (PW - 1)) * 2 - 1;
        for (let x = 0; x < PW; x++, i += 4) {
          const u = (x / (PW - 1)) * 2 - 1;
          const r = Math.sqrt(u * u + v * v);
          if (r > 1.02) {
            d[i + 3] = 0;
            continue;
          }
          const w =
            Math.sin(r * 13 - s * 2.4) * 0.5 +
            Math.sin(u * 4.2 + s * 0.8 + Math.sin(v * 3.1 - s * 1.1) * 1.5) * 0.35 +
            Math.sin(v * 5.3 - s * 0.9 + Math.cos(u * 2.7 + s * 0.6) * 1.4) * 0.35;
          let b = 0.48 + 0.27 * w + 0.22 * (1 - r) + (r > 0.88 ? (r - 0.88) * 3.2 : 0);
          b = Math.max(0, Math.min(1.3, b));
          d[i] = Math.min(255, 18 + b * b * 175);
          d[i + 1] = Math.min(255, 85 + b * 150);
          d[i + 2] = Math.min(255, 165 + b * 95);
          d[i + 3] = 255;
        }
      }
      pctx.putImageData(img, 0, 0);
    };
    const annulus = (ro: number, ri: number, fill: string | CanvasGradient) => {
      ctx.beginPath();
      ctx.arc(0, 0, ro, 0, TAU);
      ctx.arc(0, 0, ri, 0, TAU, true);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const metal = (R: number, a: string, b: string, c: string) => {
      const g = ctx.createLinearGradient(-R, -R, R, R);
      g.addColorStop(0, a);
      g.addColorStop(0.5, b);
      g.addColorStop(1, c);
      return g;
    };

    const draw = (now: number) => {
      const e = engine;
      const S = cv.clientWidth || 400;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(S * dpr);
      if (cv.width !== px) cv.width = cv.height = px;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      ctx.translate(S / 2, S / 2);
      const R = S * 0.46;
      const rH = R * 0.635;
      e.irisA += (e.irisTarget - e.irisA) * (e.reduced ? 1 : 0.09);

      // Horizon des événements
      let hA = 0;
      let openP = 0;
      if (e.state === "opening") {
        openP = (now - e.openStart) / e.openDuration;
        hA = Math.max(0, Math.min(1, (openP - 0.3) / 0.45));
      } else if (e.state === "open") hA = 1;
      else if (e.state === "closing") hA = Math.max(0, 1 - (now - e.closeStart) / e.closeDuration);
      if (hA > 0) {
        ctx.save();
        ctx.shadowColor = "rgba(98,201,255,.55)";
        ctx.shadowBlur = R * 0.25;
        ctx.globalAlpha = hA;
        ctx.beginPath();
        ctx.arc(0, 0, rH, 0, TAU);
        ctx.fillStyle = "#2a7fc0";
        ctx.fill();
        ctx.restore();
      }
      const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, rH);
      bg.addColorStop(0, "#121a23");
      bg.addColorStop(1, "#05080b");
      ctx.beginPath();
      ctx.arc(0, 0, rH, 0, TAU);
      ctx.fillStyle = bg;
      ctx.fill();
      if (hA > 0) {
        plasma(now);
        ctx.save();
        ctx.globalAlpha = hA;
        ctx.beginPath();
        ctx.arc(0, 0, rH, 0, TAU);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(pc, -rH * 1.02, -rH * 1.02, rH * 2.04, rH * 2.04);
        ctx.restore();
      }

      // Iris
      if (e.irisA > 0.004) {
        const h = rH * (1 - e.irisA);
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, rH, 0, TAU);
        ctx.arc(0, 0, Math.max(0, h), 0, TAU, true);
        ctx.fillStyle = metal(rH, "#8a95a1", "#3b434c", "#6d7783");
        ctx.fill("evenodd");
        ctx.strokeStyle = "rgba(8,12,16,.75)";
        ctx.lineWidth = Math.max(1, R * 0.006);
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * TAU;
          const a2 = a + 1.0 * e.irisA + 0.15;
          const mid = (h + rH) / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * rH, Math.sin(a) * rH);
          ctx.quadraticCurveTo(
            Math.cos(a + 0.55 * e.irisA) * mid * 1.06,
            Math.sin(a + 0.55 * e.irisA) * mid * 1.06,
            Math.cos(a2) * h,
            Math.sin(a2) * h,
          );
          ctx.stroke();
        }
        ctx.restore();
      }

      // Anneau extérieur
      annulus(R, R * 0.84, metal(R, "#69737e", "#2b3239", "#545d67"));
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = Math.max(1, R * 0.005);
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85);
        ctx.lineTo(Math.cos(a) * R * 0.99, Math.sin(a) * R * 0.99);
        ctx.stroke();
      }
      // Anneau des symboles
      annulus(R * 0.84, R * 0.655, metal(R, "#3a424b", "#1c2228", "#333a42"));
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + (i + 0.5) * STEP + e.ringRot;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66);
        ctx.lineTo(Math.cos(a) * R * 0.835, Math.sin(a) * R * 0.835);
        ctx.stroke();
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + i * STEP + e.ringRot;
        const rr = R * 0.748;
        ctx.save();
        ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
        ctx.rotate(a + Math.PI / 2);
        ctx.scale(R * 0.046, R * 0.046);
        const atTop = Math.abs((((e.ringRot + i * STEP) % TAU) + TAU) % TAU) < 0.02;
        const hot = e.state === "dialing" && atTop;
        ctx.strokeStyle = hot ? "#ffb36b" : "#b9c4cf";
        ctx.lineWidth = 0.17;
        if (hot) {
          ctx.shadowColor = "#ff8f2e";
          ctx.shadowBlur = 8;
        }
        ctx.stroke(paths[i]);
        ctx.restore();
      }
      // Rebord intérieur
      annulus(R * 0.655, rH, metal(R, "#5c6670", "#262c33", "#4b545e"));

      // Chevrons
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k * TAU) / 9;
        ctx.save();
        ctx.rotate(a + Math.PI / 2);
        const off = k === 0 && e.engageT >= 0 ? Math.sin(Math.PI * e.engageT) * R * 0.04 : 0;
        ctx.beginPath();
        ctx.moveTo(-R * 0.12, -R * 1.035);
        ctx.lineTo(R * 0.12, -R * 1.035);
        ctx.lineTo(R * 0.07, -R * 0.8);
        ctx.lineTo(-R * 0.07, -R * 0.8);
        ctx.closePath();
        ctx.fillStyle = metal(R * 0.1, "#7a848f", "#3e464f", "#5d6670");
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.translate(0, off);
        const on = (e.lit[k] && !e.flickOff) || (k === 0 && e.engageT >= 0);
        ctx.beginPath();
        ctx.moveTo(-R * 0.085, -R * 1.0);
        ctx.lineTo(-R * 0.04, -R * 1.0);
        ctx.lineTo(0, -R * 0.905);
        ctx.lineTo(R * 0.04, -R * 1.0);
        ctx.lineTo(R * 0.085, -R * 1.0);
        ctx.lineTo(0, -R * 0.835);
        ctx.closePath();
        if (on) {
          ctx.shadowColor = "#ff8f2e";
          ctx.shadowBlur = R * 0.09;
          ctx.fillStyle = "#ffa44f";
        } else ctx.fillStyle = "#4a2b17";
        ctx.fill();
        ctx.restore();
      }

      // Jaillissement à l'ouverture
      if (e.state === "opening" && openP < 1) {
        const q = Math.min(1, openP / 0.75);
        const s = Math.sin(Math.PI * q);
        if (s > 0.01) {
          const rb = rH * (0.25 + 1.2 * s);
          ctx.save();
          ctx.globalAlpha = Math.min(1, s * 1.25);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rb);
          g.addColorStop(0, "rgba(255,255,255,.97)");
          g.addColorStop(0.45, "rgba(175,228,255,.88)");
          g.addColorStop(0.85, "rgba(70,150,230,.5)");
          g.addColorStop(1, "rgba(40,110,200,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let k = 0; k <= 72; k++) {
            const a = (k / 72) * TAU;
            const n = 1 + 0.07 * Math.sin(a * 5 + now * 0.004) + 0.04 * Math.sin(a * 11 - now * 0.007);
            const x = Math.cos(a) * rb * n;
            const y = Math.sin(a) * rb * n;
            if (k) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return <canvas ref={ref} id="gate" role="img" aria-label="Porte des étoiles" />;
}
