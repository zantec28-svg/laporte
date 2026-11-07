"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GateEngine } from "@/lib/gateEngine";
import { buildGateRoom, CONTROL, PRESETS, ROOM, type PresetName } from "@/lib/scene/gateRoom";

type Props = { engine: GateEngine; preset: { name: PresetName; n: number } };

/** Salle de la porte en 3D. La caméra se pilote à la souris ou au doigt. */
export default function GateScene3D({ engine, preset }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; t0: number; from?: { pos: THREE.Vector3; target: THREE.Vector3 } } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const { scene, update, dispose } = buildGateRoom(renderer);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
    const start = PRESETS.ensemble;
    camera.position.set(...start.pos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...start.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.53;
    controls.addEventListener("start", () => (goal.current = null));

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Garde la caméra dans la salle (ou dans la salle de contrôle, derrière la vitre)
    const clampCamera = () => {
      const p = camera.position;
      const m = 0.4;
      if (p.z > ROOM.zMax - 0.3) {
        p.x = THREE.MathUtils.clamp(p.x, -CONTROL.x + m, CONTROL.x - m);
        p.y = THREE.MathUtils.clamp(p.y, CONTROL.yMin + 0.6, CONTROL.yMax - 0.3);
        p.z = Math.min(p.z, CONTROL.zMax - m);
      } else {
        p.x = THREE.MathUtils.clamp(p.x, -ROOM.x + 1.1, ROOM.x - 1.1);
        p.y = THREE.MathUtils.clamp(p.y, 0.4, ROOM.h - 0.8);
        p.z = Math.max(p.z, ROOM.zMin + m);
      }
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -ROOM.x + 1, ROOM.x - 1);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, ROOM.h - 1);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, ROOM.zMin + 0.5, ROOM.zMax - 0.5);
    };

    let visible = true;
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
    io.observe(el);

    renderer.setAnimationLoop((now) => {
      if (!visible) return;
      const g = goal.current;
      if (g) {
        if (!g.from) g.from = { pos: camera.position.clone(), target: controls.target.clone() };
        const p = Math.min(1, (now - g.t0) / (engine.reduced ? 1 : 1300));
        const k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        camera.position.lerpVectors(g.from.pos, g.pos, k);
        controls.target.lerpVectors(g.from.target, g.target, k);
        if (p >= 1) goal.current = null;
      }
      controls.update();
      if (!goal.current) clampCamera();
      update(engine, now);
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [engine]);

  useEffect(() => {
    if (preset.n === 0) return;
    const p = PRESETS[preset.name];
    goal.current = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), t0: performance.now() };
  }, [preset]);

  return (
    <div ref={host} className="scene" role="img" aria-label="Salle de la porte en 3D">
      {failed && <p className="scene-error">La 3D n&apos;est pas disponible sur cet appareil : WebGL est désactivé ou non pris en charge par le navigateur.</p>}
    </div>
  );
}
