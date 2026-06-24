/// <reference lib="webworker" />
/**
 * Whisper speech-to-text, off the main thread. The worker owns the model so
 * transcription never blocks the UI. It reports model-download progress, then
 * returns Whisper's raw text + timestamped chunks; all interpretation (language,
 * confidence) happens back on the main thread in stt.ts.
 */
import { pipeline, env } from "@huggingface/transformers";

// Fetch weights from the HF hub (no bundled local models).
env.allowLocalModels = false;

const MODEL = "Xenova/whisper-base"; // multilingual; quantized weights keep the download modest

type InMsg = {
  type: "transcribe";
  id: number;
  audio: Float32Array;
  language: string | null;
};

type Chunk = { timestamp: [number, number | null]; text: string };

// transformers.js's pipeline overloads are too broad for tsc; pin a minimal,
// accurate shape for the ASR pipeline we actually use.
type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string; chunks?: Chunk[] }>;
type PipelineFactory = (
  task: "automatic-speech-recognition",
  model: string,
  options?: { progress_callback?: (p: unknown) => void },
) => Promise<Transcriber>;
const createPipeline = pipeline as unknown as PipelineFactory;

let pipePromise: Promise<Transcriber> | null = null;

function getPipeline(id: number): Promise<Transcriber> {
  if (!pipePromise) {
    pipePromise = createPipeline("automatic-speech-recognition", MODEL, {
      progress_callback: (p: unknown) => {
        const e = p as { status?: string; file?: string; progress?: number };
        if (e.status === "progress") {
          postMessage({
            type: "progress",
            id,
            phase: "download",
            file: e.file,
            progress: Math.round(e.progress ?? 0),
          });
        }
      },
    });
  }
  return pipePromise;
}

self.onmessage = async (event: MessageEvent<InMsg>) => {
  const msg = event.data;
  if (msg.type !== "transcribe") return;
  const { id, audio, language } = msg;
  try {
    const transcriber = await getPipeline(id);
    postMessage({ type: "progress", id, phase: "run", progress: 100 });

    const output = (await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      // null lets Whisper auto-detect; an explicit code forces it.
      language: language ?? undefined,
    })) as { text: string; chunks?: Chunk[] };

    postMessage({
      type: "result",
      id,
      text: output.text ?? "",
      chunks: output.chunks ?? [],
    });
  } catch (err) {
    postMessage({
      type: "error",
      id,
      message: err instanceof Error ? err.message : "Transcription failed.",
    });
  }
};
