import { create } from "zustand";
import { estimateFastDepth } from "@/lib/depth/fast-depth";
import { depthPreviewUrl } from "@/lib/depth/preview";
import {
  canvasFromBlob,
  canvasToJpegUrl,
  DEPTH_EDGE,
  imageDataToJpegBlob,
  imageDataToJpegUrl,
  requireSession,
  saveOrShare,
  type SaveOutcome,
  sessionFromCanvas,
} from "@/lib/image/io";
import { cacheResultBlob, getCachedResultBlob } from "@/lib/image/result-cache";
import { currentGeneration, getSession, nextGeneration } from "@/lib/image/session";
import { composeAnaglyph, liveWarpedPhoto, renderStereoViews } from "@/lib/stereo/render";
import { yieldToMain } from "@/lib/utils";

export type AppView = "home" | "camera" | "workspace" | "result";
export type DepthKind = "fast" | "ai";
export type ResultKind = "sbs" | "anaglyph" | "wiggle";
export type PreviewPane = "photo" | "depth";

type StereoState = {
  view: AppView;
  sourceUrl: string | null;
  sourceWidth: number;
  sourceHeight: number;
  depth: Float32Array | null;
  depthWidth: number;
  depthHeight: number;
  depthPreview: string | null;
  depthKind: DepthKind | null;
  depthStatus: "idle" | "estimating" | "ready" | "enhancing" | "error";
  depthError: string | null;
  modelStatus: "idle" | "downloading" | "ready" | "unavailable";
  modelProgress: number;
  modelLabel: string;
  invertDepth: boolean;
  strength: number;
  archFrame: boolean;
  pane: PreviewPane;
  resultUrl: string | null;
  leftUrl: string | null;
  rightUrl: string | null;
  resultKind: ResultKind | null;
  generating: boolean;
  helpOpen: boolean;
  loadError: string | null;
  brandStamp: boolean;
  photoPreview: string | null;
};

const initial: StereoState = {
  view: "home",
  sourceUrl: null,
  sourceWidth: 0,
  sourceHeight: 0,
  depth: null,
  depthWidth: 0,
  depthHeight: 0,
  depthPreview: null,
  depthKind: null,
  depthStatus: "idle",
  depthError: null,
  modelStatus: "idle",
  modelProgress: 0,
  modelLabel: "",
  invertDepth: false,
  strength: 1,
  archFrame: false,
  pane: "photo",
  resultUrl: null,
  leftUrl: null,
  rightUrl: null,
  resultKind: null,
  generating: false,
  helpOpen: false,
  loadError: null,
  brandStamp: false,
  photoPreview: null,
};

type StereoActions = {
  openCamera: () => void;
  openHelp: (open: boolean) => void;
  setPane: (pane: PreviewPane) => void;
  setStrength: (value: number) => void;
  toggleInvert: () => void;
  toggleArch: () => void;
  setBrandStamp: (on: boolean) => void;
  goHome: () => void;
  backToWorkspace: () => void;
  loadBlob: (blob: Blob) => Promise<void>;
  generate: (kind: ResultKind) => Promise<void>;
  saveResult: (mode?: "auto" | "download" | "folder" | "share") => Promise<SaveOutcome>;
};

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function livePhotoUrl(state: Pick<StereoState, "depth" | "depthWidth" | "depthHeight" | "strength" | "invertDepth">) {
  const session = getSession();
  if (!session || !state.depth) return null;
  try {
    const warped = liveWarpedPhoto({
      image: session.data,
      depth: state.depth,
      dw: state.depthWidth,
      dh: state.depthHeight,
      strength: state.strength,
      invert: state.invertDepth,
    });
    return imageDataToJpegUrl(warped, 0.82);
  } catch {
    return null;
  }
}

function liveDepthUrl(state: Pick<StereoState, "depth" | "depthWidth" | "depthHeight" | "strength" | "invertDepth">) {
  if (!state.depth || !state.depthWidth || !state.depthHeight) return null;
  return depthPreviewUrl(state.depth, state.depthWidth, state.depthHeight, state.invertDepth, state.strength);
}

function refreshPreviews(state: StereoState) {
  return {
    photoPreview: livePhotoUrl(state) ?? state.photoPreview,
    depthPreview: liveDepthUrl(state) ?? state.depthPreview,
  };
}

let strengthTimer: ReturnType<typeof setTimeout> | undefined;

export const useStereo = create<StereoState & StereoActions>((set, get) => ({
  ...initial,

  openCamera: () => set({ view: "camera", loadError: null }),
  openHelp: (helpOpen) => set({ helpOpen }),
  setPane: (pane) => {
    if (pane === "depth" && !get().depthPreview) return;
    set({ pane });
  },
  setStrength: (strength) => {
    set({ strength });
    if (strengthTimer) clearTimeout(strengthTimer);
    strengthTimer = setTimeout(() => {
      set(refreshPreviews({ ...get(), strength }));
    }, 40);
  },

  toggleInvert: () => {
    const invertDepth = !get().invertDepth;
    const state = { ...get(), invertDepth };
    set({ invertDepth, ...refreshPreviews(state) });
  },

  toggleArch: () => {
    set({ archFrame: !get().archFrame });
    const { view, resultKind } = get();
    if (view === "result" && resultKind) void get().generate(resultKind);
  },

  setBrandStamp: (brandStamp) => set({ brandStamp }),

  goHome: () => {
    nextGeneration();
    revokeIfBlob(get().resultUrl);
    cacheResultBlob(null);
    set({
      ...initial,
      modelStatus: get().modelStatus,
      modelProgress: get().modelProgress,
      modelLabel: get().modelLabel,
    });
  },

  backToWorkspace: () => {
    revokeIfBlob(get().resultUrl);
    cacheResultBlob(null);
    set({ view: "workspace", resultUrl: null, resultKind: null, leftUrl: null, rightUrl: null });
  },

  loadBlob: async (blob) => {
    const gen = nextGeneration();
    set({
      view: "workspace",
      depthStatus: "estimating",
      depthError: null,
      loadError: null,
      resultUrl: null,
      leftUrl: null,
      rightUrl: null,
      resultKind: null,
      pane: "photo",
      invertDepth: false,
    });
    try {
      const canvas = await canvasFromBlob(blob);
      if (gen !== currentGeneration()) return;
      const session = sessionFromCanvas(canvas);
      const sourceUrl = canvasToJpegUrl(canvas, 0.86);
      set({
        sourceUrl,
        sourceWidth: session.width,
        sourceHeight: session.height,
      });
      await yieldToMain();
      if (gen !== currentGeneration()) return;

      const scale = DEPTH_EDGE / Math.max(session.width, session.height);
      const dw = Math.max(48, Math.round(session.width * scale));
      const dh = Math.max(48, Math.round(session.height * scale));
      const depth = estimateFastDepth(session.data, dw, dh);
      const depthPreview = liveDepthUrl({
        depth,
        depthWidth: dw,
        depthHeight: dh,
        strength: get().strength,
        invertDepth: get().invertDepth,
      });
      const photoPreview =
        livePhotoUrl({
          depth,
          depthWidth: dw,
          depthHeight: dh,
          strength: get().strength,
          invertDepth: get().invertDepth,
        }) ?? sourceUrl;
      set({
        depth,
        depthWidth: dw,
        depthHeight: dh,
        depthPreview,
        photoPreview,
        depthKind: "fast",
        depthStatus: "ready",
      });

      void enhanceWithAi(gen, set, get);
    } catch (error) {
      set({
        depthStatus: "error",
        loadError: error instanceof Error ? error.message : "That photograph could not be read",
        view: "home",
      });
    }
  },

  generate: async (kind) => {
    const { depth, depthWidth, depthHeight, strength, invertDepth, archFrame } = get();
    if (!depth) {
      set({ depthError: "The relief is not yet ready. A moment more." });
      return;
    }
    set({ generating: true });
    revokeIfBlob(get().resultUrl);
    await yieldToMain();
    try {
      const session = requireSession();
      const views = renderStereoViews({
        image: session.data,
        depth,
        dw: depthWidth,
        dh: depthHeight,
        strength,
        invert: invertDepth,
      });
      const leftUrl = imageDataToJpegUrl(views.left, 0.88);
      const rightUrl = imageDataToJpegUrl(views.right, 0.88);

      let resultUrl: string;
      let blob: Blob;
      if (kind === "wiggle") {
        const { encodeWiggleGif } = await import("@/lib/stereo/wiggle-gif");
        const { matEyeForGif } = await import("@/lib/stereo/mount");
        blob = await encodeWiggleGif(matEyeForGif(views.left, archFrame), matEyeForGif(views.right, archFrame));
        resultUrl = URL.createObjectURL(blob);
      } else {
        const { canvasToJpegBlob, compositeSingleOnMount, compositeTwinOnMount, readyVictorianFont } = await import(
          "@/lib/stereo/mount"
        );
        await readyVictorianFont();
        const canvas =
          kind === "sbs"
            ? compositeTwinOnMount(views.left, views.right, archFrame)
            : compositeSingleOnMount(composeAnaglyph(views.left, views.right), archFrame);
        blob = await canvasToJpegBlob(canvas, 0.92);
        resultUrl = canvas.toDataURL("image/jpeg", 0.92);
      }
      cacheResultBlob(blob);
      set({
        resultUrl,
        leftUrl,
        rightUrl,
        resultKind: kind,
        view: "result",
        generating: false,
      });
    } catch (error) {
      set({
        generating: false,
        depthError: error instanceof Error ? error.message : "The plate could not be prepared",
      });
    }
  },

  saveResult: async (mode = "auto") => {
    const { resultKind, brandStamp } = get();
    if (!resultKind) return "empty";
    let blob = getCachedResultBlob();
    if (!blob) {
      const { resultUrl } = get();
      if (!resultUrl) return "empty";
      blob = await (await fetch(resultUrl)).blob();
    }
    if (brandStamp) {
      const { stampBrandOnBlob } = await import("@/lib/stereo/mount");
      blob = await stampBrandOnBlob(blob);
    }
    const filename =
      resultKind === "sbs"
        ? "stereo-vue-stereograph.jpg"
        : resultKind === "anaglyph"
          ? "stereo-vue-anaglyph.jpg"
          : brandStamp
            ? "stereo-vue-wiggle.jpg"
            : "stereo-vue-wiggle.gif";
    return saveOrShare(blob, filename, mode);
  },
}));

async function enhanceWithAi(
  gen: number,
  set: (partial: Partial<StereoState>) => void,
  get: () => StereoState,
) {
  const { getSession } = await import("@/lib/image/session");
  const session = getSession();
  if (!session) return;
  set({ depthStatus: "enhancing" });
  try {
    const { estimateAiDepth } = await import("@/lib/depth/ai-depth");
    const result = await Promise.race([
      estimateAiDepth(session.canvas),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("The calculating engine timed out")), 90_000);
      }),
    ]);
    if (gen !== currentGeneration()) return;
    const depthPreview = liveDepthUrl({
      depth: result.depth,
      depthWidth: result.width,
      depthHeight: result.height,
      strength: get().strength,
      invertDepth: get().invertDepth,
    });
    const photoPreview =
      livePhotoUrl({
        depth: result.depth,
        depthWidth: result.width,
        depthHeight: result.height,
        strength: get().strength,
        invertDepth: get().invertDepth,
      }) ?? get().photoPreview;
    set({
      depth: result.depth,
      depthWidth: result.width,
      depthHeight: result.height,
      depthPreview,
      photoPreview,
      depthKind: "ai",
      depthStatus: "ready",
      modelStatus: "ready",
    });
  } catch {
    if (gen !== currentGeneration()) return;
    set({
      depthStatus: "ready",
      modelStatus: "unavailable",
    });
  }
}

export function bootStereo() {
  let unsub = () => {};
  let cancelled = false;
  void import("@/lib/depth/ai-depth")
    .then(({ subscribeModelProgress }) => {
      if (cancelled) return;
      unsub = subscribeModelProgress((p) => {
        useStereo.setState({
          modelStatus: p.status,
          modelProgress: p.progress,
          modelLabel: p.label,
        });
      });
    })
    .catch(() => {
      useStereo.setState({ modelStatus: "unavailable" });
    });
  return () => {
    cancelled = true;
    unsub();
  };
}
