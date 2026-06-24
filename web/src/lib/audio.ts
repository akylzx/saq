/**
 * Audio decoding, resampling, and WAV encoding for the analysis pipeline.
 *
 * Both consumers want a normalized signal: Whisper needs 16 kHz mono float32,
 * and the /api/v1/detect backend accepts wav/flac/ogg/mp3 (not the webm/opus a
 * browser MediaRecorder produces). So we decode any input once, resample to
 * 16 kHz mono, and re-encode a WAV — one clean signal that satisfies both.
 */

export const TARGET_SR = 16000;
export const MAX_BYTES = 15 * 1024 * 1024; // mirror the backend gate
export const MAX_SECONDS = 60;
const MIN_SECONDS = 0.4;
const SILENCE_RMS = 0.0025; // below this the clip is effectively silent

export class AudioInputError extends Error {}

export interface DecodedAudio {
  /** 16 kHz mono samples for the STT model. */
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  /** RMS level, 0..1 — a rough loudness/quality signal. */
  rms: number;
}

let sharedCtx: AudioContext | null = null;
function audioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new AudioInputError("This browser can't decode audio.");
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

/** Decode a File/Blob into 16 kHz mono float32, validating size, duration, and loudness. */
export async function decodeForAnalysis(input: Blob): Promise<DecodedAudio> {
  if (input.size === 0) throw new AudioInputError("That file is empty.");
  if (input.size > MAX_BYTES) {
    throw new AudioInputError("That clip is over 15 MB. Trim it and try again.");
  }

  let buffer: AudioBuffer;
  try {
    const bytes = await input.arrayBuffer();
    buffer = await audioContext().decodeAudioData(bytes);
  } catch {
    throw new AudioInputError("Couldn't read that audio. Try a wav, mp3, ogg, or flac file.");
  }

  if (buffer.duration < MIN_SECONDS) {
    throw new AudioInputError("That clip is too short to analyze. Aim for at least a second of speech.");
  }
  if (buffer.duration > MAX_SECONDS) {
    throw new AudioInputError(`That clip is ${Math.round(buffer.duration)}s — keep it under ${MAX_SECONDS}s.`);
  }

  const mono = await toMono16k(buffer);
  const rms = computeRms(mono);
  if (rms < SILENCE_RMS) {
    throw new AudioInputError("This clip is nearly silent — no speech to analyze.");
  }
  return { samples: mono, sampleRate: TARGET_SR, durationSec: buffer.duration, rms };
}

/** Downmix to mono and resample to 16 kHz via an offline render. */
async function toMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  const frames = Math.ceil(buffer.duration * TARGET_SR);
  const offline = new OfflineAudioContext(1, frames, TARGET_SR);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

function computeRms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/** Encode 16 kHz mono float32 as a 16-bit PCM WAV File the backend will accept. */
export function encodeWav(samples: Float32Array, sampleRate = TARGET_SR, name = "recording.wav"): File {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new File([buffer], name, { type: "audio/wav" });
}
