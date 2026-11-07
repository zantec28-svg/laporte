// Moteur sonore : tous les sons sont synthétisés en direct (création originale),
// et chacun peut être remplacé par un fichier audio importé par le joueur.

export type SoundKey = "roll" | "chevron" | "lock" | "open" | "hum" | "close" | "fail" | "iris";

export const SOUNDS: [SoundKey, string][] = [
  ["roll", "Rotation de l'anneau"],
  ["chevron", "Chevron enclenché"],
  ["lock", "Chevron 7 verrouillé"],
  ["open", "Ouverture du vortex"],
  ["hum", "Vortex actif (en boucle)"],
  ["close", "Fermeture du vortex"],
  ["fail", "Échec de composition"],
  ["iris", "Iris"],
];

type Stop = () => void;

export class SoundEngine {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private humStop: Stop | null = null;
  private buffers: Partial<Record<SoundKey, AudioBuffer>> = {};
  private pending: Partial<Record<SoundKey, Blob>> = {};
  muted = false;

  /** À appeler depuis un geste du joueur : les navigateurs bloquent l'audio avant. */
  ctx(): AudioContext | null {
    if (!this.ac) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new Ctor();
        this.master = ac.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(ac.destination);
        this.noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.ac = ac;
        for (const k of Object.keys(this.pending) as SoundKey[]) void this.decode(k, this.pending[k]!);
        this.pending = {};
      } catch {
        this.ac = null;
      }
    }
    if (this.ac?.state === "suspended") void this.ac.resume();
    return this.ac;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  /** Enregistre un son importé. Renvoie false si le fichier ne peut pas être décodé. */
  async setCustom(key: SoundKey, blob: Blob): Promise<boolean> {
    if (!this.ac) {
      this.pending[key] = blob;
      return true;
    }
    return this.decode(key, blob);
  }

  removeCustom(key: SoundKey) {
    delete this.buffers[key];
    delete this.pending[key];
  }

  private async decode(key: SoundKey, blob: Blob): Promise<boolean> {
    try {
      this.buffers[key] = await this.ac!.decodeAudioData(await blob.arrayBuffer());
      return true;
    } catch {
      delete this.buffers[key];
      return false;
    }
  }

  private playCustom(key: SoundKey, { loop = false, dur = 0 } = {}): Stop | null {
    const a = this.ctx();
    const b = this.buffers[key];
    if (!a || !b || !this.master) return null;
    const s = a.createBufferSource();
    const g = a.createGain();
    s.buffer = b;
    s.loop = loop;
    s.connect(g);
    g.connect(this.master);
    const t = a.currentTime;
    s.start(t);
    if (dur) {
      g.gain.setValueAtTime(1, t + Math.max(0, dur - 0.12));
      g.gain.linearRampToValueAtTime(0, t + dur);
      s.stop(t + dur + 0.05);
    }
    return () => {
      try {
        g.gain.setTargetAtTime(0, a.currentTime, 0.08);
        s.stop(a.currentTime + 0.5);
      } catch {}
    };
  }

  /* ---- briques de synthèse ---- */
  private nsrc(a: AudioContext) {
    const s = a.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }
  private env(g: GainNode, t: number, peak: number, att: number, dec: number) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  }
  /** Impact métallique : partiels inharmoniques. */
  private metalHit(t: number, base: number, amp: number, dec: number) {
    const a = this.ac!;
    [1, 2.76, 5.4, 8.93].forEach((m, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = base * m;
      this.env(g, t, amp / (i + 1.4), 0.002, dec / (1 + i * 0.6));
      o.connect(g);
      g.connect(this.master!);
      o.start(t);
      o.stop(t + dec + 0.1);
    });
  }
  private thump(t: number, f0: number, amp: number, dec: number) {
    const a = this.ac!;
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(38, t + dec);
    this.env(g, t, amp, 0.004, dec);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + dec + 0.05);
  }
  private hiss(t: number, dur: number, amp: number, freq: number) {
    const a = this.ac!;
    const s = this.nsrc(a);
    const f = a.createBiquadFilter();
    const g = a.createGain();
    f.type = "highpass";
    f.frequency.value = freq;
    this.env(g, t, amp, 0.02, dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master!);
    s.start(t);
    s.stop(t + dur + 0.1);
  }

  /* ---- sons du jeu ---- */
  rumble(sec: number): Stop {
    const c = this.playCustom("roll", { loop: true, dur: sec });
    if (c) return c;
    const a = this.ctx();
    if (!a) return () => {};
    const t = a.currentTime;
    const s = this.nsrc(a);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 150;
    lp.Q.value = 4;
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 34;
    const og = a.createGain();
    og.gain.value = 0.14;
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = 7;
    lg.gain.value = 40;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.75, t + 0.15);
    g.gain.setValueAtTime(0.75, t + Math.max(0.2, sec - 0.18));
    g.gain.linearRampToValueAtTime(0, t + sec);
    s.connect(lp);
    o.connect(og);
    og.connect(lp);
    lp.connect(g);
    g.connect(this.master!);
    const nodes = [s, o, lfo];
    nodes.forEach((n) => {
      n.start(t);
      n.stop(t + sec + 0.05);
    });
    return () => {
      try {
        g.gain.cancelScheduledValues(a.currentTime);
        g.gain.setTargetAtTime(0, a.currentTime, 0.03);
        nodes.forEach((n) => n.stop(a.currentTime + 0.2));
      } catch {}
    };
  }

  /** Cliquetis quand un symbole passe sous le chevron du haut. */
  tick() {
    if (this.buffers.roll) return;
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    const s = this.nsrc(a);
    const f = a.createBiquadFilter();
    const g = a.createGain();
    f.type = "bandpass";
    f.frequency.value = 2400;
    f.Q.value = 6;
    this.env(g, t, 0.18, 0.001, 0.035);
    s.connect(f);
    f.connect(g);
    g.connect(this.master!);
    s.start(t);
    s.stop(t + 0.06);
  }

  chevron(final: boolean) {
    if (this.playCustom(final ? "lock" : "chevron")) return;
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    this.metalHit(t, final ? 118 : 142, final ? 0.5 : 0.38, final ? 0.9 : 0.55);
    this.thump(t, final ? 95 : 120, final ? 0.9 : 0.7, final ? 0.45 : 0.3);
    this.hiss(t + 0.09, final ? 0.35 : 0.22, final ? 0.22 : 0.14, 2500);
    if (final) {
      this.metalHit(t + 0.16, 96, 0.35, 0.8);
      this.thump(t + 0.16, 80, 0.7, 0.5);
    }
  }

  open() {
    if (this.playCustom("open")) return;
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    const s = this.nsrc(a);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(5200, t + 0.4);
    lp.frequency.exponentialRampToValueAtTime(240, t + 2.2);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.3);
    s.connect(lp);
    lp.connect(g);
    g.connect(this.master!);
    s.start(t);
    s.stop(t + 2.4);
    this.thump(t, 70, 1, 1.2);
    const o = a.createOscillator();
    const og = a.createGain();
    o.frequency.setValueAtTime(900, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(160, t + 1.4);
    this.env(og, t + 0.05, 0.12, 0.05, 1.3);
    o.connect(og);
    og.connect(this.master!);
    o.start(t);
    o.stop(t + 1.6);
  }

  humStart() {
    if (this.humStop) return;
    const c = this.playCustom("hum", { loop: true });
    if (c) {
      this.humStop = c;
      return;
    }
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 1.2);
    g.connect(this.master!);
    const o1 = a.createOscillator();
    const o2 = a.createOscillator();
    const g1 = a.createGain();
    const g2 = a.createGain();
    o1.frequency.value = 56;
    o2.frequency.value = 112.7;
    g1.gain.value = 0.07;
    g2.gain.value = 0.035;
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = 0.35;
    lg.gain.value = 0.025;
    lfo.connect(lg);
    lg.connect(g1.gain);
    const s = this.nsrc(a);
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700;
    bp.Q.value = 0.7;
    const gs = a.createGain();
    gs.gain.value = 0.035;
    const l2 = a.createOscillator();
    const l2g = a.createGain();
    l2.frequency.value = 0.13;
    l2g.gain.value = 350;
    l2.connect(l2g);
    l2g.connect(bp.frequency);
    o1.connect(g1);
    o2.connect(g2);
    g1.connect(g);
    g2.connect(g);
    s.connect(bp);
    bp.connect(gs);
    gs.connect(g);
    const nodes = [o1, o2, s, lfo, l2];
    nodes.forEach((n) => n.start());
    this.humStop = () => {
      const t2 = a.currentTime;
      g.gain.cancelScheduledValues(t2);
      g.gain.setTargetAtTime(0, t2, 0.15);
      nodes.forEach((n) => {
        try {
          n.stop(t2 + 0.8);
        } catch {}
      });
    };
  }

  humEnd() {
    this.humStop?.();
    this.humStop = null;
  }

  close() {
    if (this.playCustom("close")) return;
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    const s = this.nsrc(a);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(3500, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.7);
    const g = a.createGain();
    this.env(g, t, 0.7, 0.03, 0.7);
    s.connect(lp);
    lp.connect(g);
    g.connect(this.master!);
    s.start(t);
    s.stop(t + 0.8);
    this.thump(t + 0.55, 90, 0.6, 0.3);
  }

  fail() {
    if (this.playCustom("fail")) return;
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(100, t + 0.8);
    this.env(g, t, 0.25, 0.01, 0.8);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.9);
    this.thump(t + 0.05, 70, 0.5, 0.4);
  }

  iris() {
    if (this.playCustom("iris")) return;
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    for (let i = 0; i < 10; i++) {
      const tt = t + i * 0.045;
      const s = this.nsrc(a);
      const f = a.createBiquadFilter();
      const g = a.createGain();
      f.type = "bandpass";
      f.frequency.value = 1800 + i * 90;
      f.Q.value = 8;
      this.env(g, tt, 0.12, 0.002, 0.05);
      s.connect(f);
      f.connect(g);
      g.connect(this.master!);
      s.start(tt);
      s.stop(tt + 0.08);
    }
    this.metalHit(t + 0.47, 180, 0.3, 0.4);
    this.thump(t + 0.47, 110, 0.5, 0.25);
  }

  beep() {
    const a = this.ctx();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** Aperçu d'un son depuis les réglages. */
  preview(key: SoundKey) {
    switch (key) {
      case "roll": {
        this.rumble(2);
        let n = 0;
        const id = setInterval(() => {
          this.tick();
          if (++n > 14) clearInterval(id);
        }, 130);
        break;
      }
      case "chevron": return this.chevron(false);
      case "lock": return this.chevron(true);
      case "open": return this.open();
      case "hum": {
        this.humStart();
        setTimeout(() => this.humEnd(), 3000);
        break;
      }
      case "close": return this.close();
      case "fail": return this.fail();
      case "iris": return this.iris();
    }
  }
}
