import { useEffect, useRef } from "react";
import styles from "./Analyzer.module.css";

/**
 * The signature element: a live audio analyzer. A speech-like waveform feeds a
 * scrolling spectrogram heatmap — the actual artifact saq inspects. This is the
 * one place chromatic color appears on the page, because this is where the
 * signal lives. Procedural (no audio file needed), DPR-aware, and it freezes to
 * a static frame under prefers-reduced-motion.
 */

const HEAT = ["#1b1d3a", "#45327e", "#9b2f8e", "#e0533f", "#f4b53f"];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const HEAT_RGB = HEAT.map(hexToRgb);

/** Map 0..1 intensity to a color along the heat ramp. */
function heatColor(v: number): string {
  const clamped = Math.max(0, Math.min(1, v));
  const scaled = clamped * (HEAT_RGB.length - 1);
  const i = Math.floor(scaled);
  const t = scaled - i;
  const a = HEAT_RGB[i];
  const b = HEAT_RGB[Math.min(i + 1, HEAT_RGB.length - 1)];
  return `rgb(${lerp(a[0], b[0], t)},${lerp(a[1], b[1], t)},${lerp(a[2], b[2], t)})`;
}

const BANDS = 28; // spectrogram frequency rows

/** One column of spectral energy + a waveform sample for time `t`. */
function spectrum(t: number): { bands: number[]; wave: number } {
  // Voice-like envelope: syllabic gating so it pulses like speech, not a drone.
  const syllable = Math.max(0, Math.sin(t * 3.1) * 0.5 + 0.5) ** 1.6;
  const breath = 0.35 + 0.65 * (Math.sin(t * 0.7) * 0.5 + 0.5);
  const gate = syllable * breath;

  const bands: number[] = [];
  for (let b = 0; b < BANDS; b++) {
    const f = b / BANDS;
    // Formant-ish peaks drifting over time, energy rolling off at high freq.
    const formant1 = Math.exp(-(((f - 0.12) / 0.07) ** 2));
    const formant2 = Math.exp(-(((f - (0.34 + 0.05 * Math.sin(t * 1.3))) / 0.1) ** 2)) * 0.8;
    const formant3 = Math.exp(-(((f - 0.62) / 0.14) ** 2)) * 0.4;
    const rolloff = 1 - f * 0.55;
    const shimmer = 0.78 + 0.22 * Math.sin(t * 9 + b * 1.7);
    const energy = (formant1 + formant2 + formant3) * rolloff * gate * shimmer;
    bands.push(Math.min(1, energy));
  }

  const wave =
    gate *
    (Math.sin(t * 26) * 0.5 + Math.sin(t * 41 + 1) * 0.3 + Math.sin(t * 67) * 0.2) *
    0.9;

  return { bands, wave };
}

export function Analyzer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let waveH = 0;
    let specTop = 0;
    let specH = 0;
    let colW = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      waveH = Math.round(h * 0.32);
      specTop = waveH + 1;
      specH = h - specTop;
      colW = Math.max(2, w / 96);
      paintStatic();
    }

    // Background + axis. Drawn fresh on resize so columns scroll over it.
    function paintBackground() {
      ctx!.fillStyle = "#0e0f1c";
      ctx!.fillRect(0, 0, w, waveH);
      ctx!.fillStyle = HEAT[0];
      ctx!.fillRect(0, specTop, w, specH);
      ctx!.fillStyle = "rgba(244,243,239,0.10)";
      ctx!.fillRect(0, waveH, w, 1);
    }

    function paintWaveColumn(x: number, t: number, wave: number) {
      const mid = waveH / 2;
      const amp = wave * (waveH / 2 - 2);
      ctx!.fillStyle = "rgba(8,9,18,0.18)"; // slight trail fade
      ctx!.fillRect(x, 0, colW, waveH);
      ctx!.fillStyle = `rgba(244,181,63,${0.55 + 0.4 * Math.abs(wave)})`;
      ctx!.fillRect(x, mid - amp, colW, Math.max(1, amp * 2));
      // faint baseline glow
      ctx!.fillStyle = "rgba(224,83,63,0.25)";
      ctx!.fillRect(x, mid - 0.5, colW, 1);
      void t;
    }

    function paintSpecColumn(x: number, bands: number[]) {
      const rowH = specH / BANDS;
      for (let b = 0; b < BANDS; b++) {
        // low frequency at the bottom
        const y = specTop + specH - (b + 1) * rowH;
        ctx!.fillStyle = heatColor(bands[b]);
        ctx!.fillRect(x, y, colW, Math.ceil(rowH) + 1);
      }
    }

    function paintStatic() {
      paintBackground();
      const cols = Math.ceil(w / colW);
      for (let c = 0; c < cols; c++) {
        const t = c * 0.16;
        const { bands, wave } = spectrum(t);
        const x = c * colW;
        paintWaveColumn(x, t, wave);
        paintSpecColumn(x, bands);
      }
    }

    let raf = 0;
    let t = 0;
    let acc = 0;
    let last = performance.now();

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      t += dt;

      // Scroll one column at a fixed cadence regardless of refresh rate.
      const step = 0.045;
      while (acc >= step) {
        acc -= step;
        // shift left by one column
        ctx!.drawImage(canvas!, colW * dpr, 0, (w - colW) * dpr, h * dpr, 0, 0, w - colW, h);
        // re-fill the divider that the shift smeared
        ctx!.fillStyle = "rgba(244,243,239,0.10)";
        ctx!.fillRect(w - colW, waveH, colW, 1);
        const { bands, wave } = spectrum(t);
        const x = w - colW;
        paintWaveColumn(x, t, wave);
        paintSpecColumn(x, bands);
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (!reduced) {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={styles.device} role="img" aria-label="Live audio analyzer: a speech waveform feeding a scrolling spectrogram, the signal saq reads to tell real voice from synthetic.">
      <div className={styles.bezel}>
        <div className={styles.bar}>
          <span className={styles.dot} />
          <span className={styles.label}>saq · analyzer</span>
          <span className={styles.freq}>16 kHz</span>
        </div>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.scale} aria-hidden="true">
          <span>0</span>
          <span>2k</span>
          <span>4k</span>
          <span>8k</span>
        </div>
      </div>
    </div>
  );
}
