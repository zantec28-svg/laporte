import { ORIGIN, STEP, TAU } from "./glyphs";
import type { SoundEngine } from "./audio";
import type { Destination } from "./worlds";

export type GateState = "idle" | "dialing" | "failed" | "opening" | "open" | "closing";
export type LogKind = "" | "a" | "h" | "e" | "o";

/** Chevrons verrouillés dans l'ordre de composition (0 = chevron du haut, sens horaire). */
export const ORDER = [1, 2, 3, 6, 7, 8, 0];
/** Durée maximale d'un vortex. */
export const MAX_OPEN_MS = 38 * 60 * 1000;

/**
 * Logique de composition, indépendante de React.
 * Le canevas lit ces champs à chaque image ; l'interface est prévenue via `emit`.
 */
export class GateEngine {
  state: GateState = "idle";
  ringRot = 0;
  lit: boolean[] = Array(9).fill(false);
  flickOff = false;
  engageT = -1;
  dialIdx = -1;
  lockedN = 0;
  openStart = 0;
  openedAt = 0;
  closeStart = 0;
  irisA = 0;
  irisTarget = 0;
  dest: Destination | null = null;
  reduced = false;

  private abortFlag = false;
  private stopRumble: () => void = () => {};
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private sound: SoundEngine,
    private emit: () => void,
    private log: (msg: string, kind?: LogKind) => void,
  ) {}

  get openDuration() {
    return this.reduced ? 500 : 1700;
  }
  get closeDuration() {
    return this.reduced ? 200 : 750;
  }

  private tween(ms: number, fn: (p: number) => void): Promise<boolean> {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now: number) => {
        if (this.abortFlag) return res(false);
        const p = Math.min(1, (now - t0) / ms);
        fn(p);
        if (p < 1) requestAnimationFrame(step);
        else res(true);
      };
      requestAnimationFrame(step);
    });
  }
  private wait(ms: number) {
    return this.tween(ms, () => {});
  }

  private async rotateTo(glyph: number, dir: 1 | -1) {
    const target = -glyph * STEP;
    const d = ((((target - this.ringRot) * dir) % TAU) + TAU) % TAU;
    const start = this.ringRot;
    const ms = (this.reduced ? 220 : 650) + (d / TAU) * (this.reduced ? 400 : 2800);
    this.stopRumble = this.sound.rumble(ms / 1000);
    let last = Math.round(this.ringRot / STEP);
    const ok = await this.tween(ms, (p) => {
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this.ringRot = start + dir * d * e;
      const i = Math.round(this.ringRot / STEP);
      if (i !== last) {
        last = i;
        this.sound.tick();
      }
    });
    if (!ok) this.stopRumble();
    return ok;
  }

  private async engage(final: boolean) {
    let played = false;
    const ok = await this.tween(this.reduced ? 180 : 520, (p) => {
      this.engageT = p;
      if (p > 0.45 && !played) {
        played = true;
        this.sound.chevron(final);
      }
    });
    this.engageT = -1;
    return ok;
  }

  /**
   * Compose l'adresse (6 symboles + point d'origine).
   * Renvoie true si le vortex s'ouvre vers `target`, false en cas d'échec ou d'interruption.
   */
  async dial(addr: number[], target: Destination | null): Promise<boolean> {
    if (this.state !== "idle" || addr.length !== 6) return false;
    this.sound.ctx();
    this.abortFlag = false;
    this.state = "dialing";
    this.lockedN = 0;
    this.lit.fill(false);
    const full = [...addr, ORIGIN];
    this.log("Séquence de composition lancée", "a");
    for (let k = 0; k < 7; k++) {
      this.dialIdx = k;
      this.emit();
      if (!(await this.rotateTo(full[k], k % 2 ? -1 : 1))) return this.aborted();
      if (k === 6 && !target) {
        await this.engage(false);
        await this.fail();
        return false;
      }
      if (!(await this.engage(k === 6))) return this.aborted();
      this.lit[ORDER[k]] = true;
      this.lockedN = k + 1;
      this.log(k < 6 ? `Chevron ${k + 1} enclenché · symbole ${full[k]}` : "Chevron 7 verrouillé", k < 6 ? "" : "a");
      this.emit();
      if (!(await this.wait(this.reduced ? 60 : 220))) return this.aborted();
    }
    this.dialIdx = -1;
    this.open(target!);
    return true;
  }

  private aborted() {
    this.stopRumble();
    this.state = "idle";
    this.lit.fill(false);
    this.dialIdx = -1;
    this.lockedN = 0;
    this.engageT = -1;
    this.log("Composition interrompue", "e");
    this.emit();
    return false;
  }

  private async fail() {
    this.state = "failed";
    this.dialIdx = -1;
    this.emit();
    this.sound.fail();
    this.log("Chevron 7 : verrouillage impossible. Aucune porte ne répond à cette adresse.", "e");
    this.abortFlag = false;
    await this.tween(this.reduced ? 300 : 1100, (p) => {
      this.flickOff = Math.floor(p * 9) % 2 === 1;
    });
    this.flickOff = false;
    this.lit.fill(false);
    this.lockedN = 0;
    this.state = "idle";
    this.emit();
  }

  private open(d: Destination) {
    this.state = "opening";
    this.openStart = performance.now();
    this.dest = d;
    this.sound.open();
    this.log(`Vortex établi vers ${d.name} (${d.code})`, "h");
    this.emit();
    this.timers.push(
      setTimeout(() => {
        if (this.state !== "opening") return;
        this.state = "open";
        this.openedAt = Date.now();
        this.sound.humStart();
        this.emit();
        this.timers.push(
          setTimeout(() => {
            if (this.state === "open") {
              this.log("Limite de 38 minutes atteinte", "e");
              this.close();
            }
          }, MAX_OPEN_MS),
        );
      }, this.openDuration),
    );
  }

  /** Ferme le vortex, ou interrompt la composition en cours. */
  close() {
    if (this.state === "dialing") {
      this.abortFlag = true;
      return;
    }
    if (this.state !== "open" && this.state !== "opening") return;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.state = "closing";
    this.closeStart = performance.now();
    this.sound.humEnd();
    this.sound.close();
    this.log("Vortex désactivé", "h");
    this.emit();
    this.timers.push(
      setTimeout(() => {
        this.lit.fill(false);
        this.lockedN = 0;
        this.state = "idle";
        this.dest = null;
        this.emit();
      }, this.closeDuration),
    );
  }

  toggleIris() {
    this.irisTarget = this.irisTarget ? 0 : 1;
    this.sound.iris();
    this.log(this.irisTarget ? "Iris fermé" : "Iris ouvert");
    this.emit();
  }

  dispose() {
    this.abortFlag = true;
    this.timers.forEach(clearTimeout);
    this.sound.humEnd();
  }
}
