// Depth Anything already reports near as larger values, so no orientation guess
// is applied here (the top-vs-bottom heuristic flipped close-ups and portraits).
import { percentileStretch } from "./fast-depth";

export type ModelProgress = {
  status: "idle" | "downloading" | "ready" | "unavailable";
  progress: number;
  label: string;
};

type DepthPipe = ((image: HTMLCanvasElement | string) => Promise<{
  predicted_depth?: { data: ArrayLike<number>; dims: number[] };
  depth?: { data: ArrayLike<number>; width: number; height: number };
}>) & { dispose?: () => Promise<void> };

let pipePromise: Promise<DepthPipe> | null = null;
let listeners = new Set<(p: ModelProgress) => void>();
let snapshot: ModelProgress = { status: "idle", progress: 0, label: "AI model idle" };

function emit(next: ModelProgress) {
  snapshot = next;
  listeners.forEach((fn) => fn(next));
}

export function getModelProgress() {
  return snapshot;
}

export function subscribeModelProgress(fn: (p: ModelProgress) => void) {
  listeners.add(fn);
  fn(snapshot);
  return () => {
    listeners.delete(fn);
  };
}

async function loadPipeline() {
  const transformers = await import("@huggingface/transformers");
  const { pipeline, env } = transformers;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.allowRemoteModels = true;
  if (env.backends?.onnx) {
    const wasm = (env.backends.onnx as { wasm?: { numThreads?: number } }).wasm;
    if (wasm) wasm.numThreads = 1;
  }

  const progress_callback = (info: {
    status?: string;
    progress?: number;
    file?: string;
    loaded?: number;
    total?: number;
  }) => {
    if (info.status === "progress" && info.total) {
      const progress = Math.min(1, info.loaded! / info.total);
      emit({
        status: "downloading",
        progress,
        label: info.file ? `Downloading ${info.file.split("/").pop()}` : "Downloading depth model",
      });
    } else if (info.status === "ready" || info.status === "done") {
      emit({ status: "downloading", progress: 1, label: "Preparing model" });
    }
  };

  const tryLoad = async (device?: "webgpu" | "wasm") =>
    (await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
      dtype: "q8",
      progress_callback,
      ...(device ? { device } : {}),
    })) as unknown as DepthPipe;

  try {
    return await tryLoad("wasm");
  } catch {
    return await tryLoad();
  }
}

export function preloadAiDepth() {
  if (typeof window === "undefined") return;
  if (pipePromise) return;
  emit({ status: "downloading", progress: 0.02, label: "Loading Depth Anything V2" });
  pipePromise = loadPipeline()
    .then((pipe) => {
      emit({ status: "ready", progress: 1, label: "Depth Anything V2 ready" });
      return pipe;
    })
    .catch((error) => {
      pipePromise = null;
      emit({
        status: "unavailable",
        progress: 0,
        label: error instanceof Error ? error.message : "AI model unavailable",
      });
      throw error;
    });
  void pipePromise.catch(() => {
    // Preload should not surface as an unhandled rejection.
  });
}

function tensorToDepth(data: ArrayLike<number>, dims: number[]) {
  const h = dims[dims.length - 2] ?? 1;
  const w = dims[dims.length - 1] ?? data.length;
  const depth = new Float32Array(w * h);
  for (let i = 0; i < depth.length; i++) depth[i] = Number(data[i] ?? 0);
  return { depth: percentileStretch(depth), width: w, height: h };
}

export async function estimateAiDepth(canvas: HTMLCanvasElement) {
  preloadAiDepth();
  if (!pipePromise) throw new Error("Could not start depth model");
  const pipe = await pipePromise;
  const url = canvas.toDataURL("image/jpeg", 0.85);
  const output = await pipe(url);
  if (output.predicted_depth?.data && output.predicted_depth.dims) {
    return tensorToDepth(output.predicted_depth.data, output.predicted_depth.dims);
  }
  if (output.depth) {
    const { data, width, height } = output.depth;
    const depth = new Float32Array(width * height);
    for (let i = 0; i < depth.length; i++) depth[i] = Number(data[i] ?? 0) / 255;
    return { depth: percentileStretch(depth), width, height };
  }
  throw new Error("Depth model returned an empty result");
}
