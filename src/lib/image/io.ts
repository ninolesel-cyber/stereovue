import { isNativeShell, sendToNativeShell } from "@/lib/native-shell";
import { getSession, setSession, type SessionImage } from "./session";

export const MAX_PROCESS_EDGE = 1280;
export const DEPTH_EDGE = 384;

async function decodeToBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    return await createImageBitmap(blob);
  }
}

export async function canvasFromBlob(blob: Blob, maxEdge = MAX_PROCESS_EDGE) {
  const bitmap = await decodeToBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

export function sessionFromCanvas(canvas: HTMLCanvasElement): SessionImage {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const next = {
    canvas,
    data,
    width: canvas.width,
    height: canvas.height,
  };
  setSession(next);
  return next;
}

export function canvasToJpegUrl(canvas: HTMLCanvasElement, quality = 0.88) {
  return canvas.toDataURL("image/jpeg", quality);
}

export function imageDataToJpegUrl(image: ImageData, quality = 0.92) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function imageDataToJpegBlob(image: ImageData, quality = 0.92) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not encode image");
  return blob;
}

export type SaveOutcome = "shared" | "saved" | "downloaded" | "cancelled" | "empty";

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    startIn?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
};

/** A computer with a mouse or trackpad, as opposed to a telephone or tablet. */
export function isComputer() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function canShareFiles() {
  if (isNativeShell()) return true;
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  const probe = new File([new Blob(["x"], { type: "image/jpeg" })], "probe.jpg", { type: "image/jpeg" });
  return navigator.canShare?.({ files: [probe] }) ?? false;
}

/** Opens the system share sheet (Mail, Messages, AirDrop, Photos on a telephone). */
export async function shareFile(blob: Blob, filename: string): Promise<SaveOutcome | "unsupported"> {
  if (await sendToNativeShell("share", blob, filename)) return "shared";
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  if (typeof navigator.share !== "function" || !navigator.canShare?.({ files: [file] })) return "unsupported";
  try {
    await navigator.share({ files: [file], title: "Stereo Vue" });
    return "shared";
  } catch (error) {
    if ((error as DOMException).name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Lets the person choose the folder (Pictures, Downloads, Desktop…) where the
 * browser supports a save dialog; otherwise the browser's own download.
 */
export async function saveToFolder(blob: Blob, filename: string): Promise<SaveOutcome> {
  if (await sendToNativeShell("save", blob, filename)) return "saved";
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (typeof picker === "function") {
    const ext = filename.slice(filename.lastIndexOf("."));
    const mime = blob.type || (ext === ".gif" ? "image/gif" : "image/jpeg");
    try {
      const handle = await picker.call(window, {
        suggestedName: filename,
        startIn: "pictures",
        types: [{ description: "Stereo Vue plate", accept: { [mime]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export async function saveOrShare(
  blob: Blob,
  filename: string,
  mode: "auto" | "download" | "folder" | "share" = "auto",
): Promise<SaveOutcome> {
  if (mode === "folder") return saveToFolder(blob, filename);
  if (mode === "share" || mode === "auto") {
    const shared = await shareFile(blob, filename);
    if (shared !== "unsupported") return shared;
    if (mode === "share") return saveToFolder(blob, filename);
  }
  return saveToFolder(blob, filename);
}

export function requireSession() {
  const current = getSession();
  if (!current) throw new Error("No photo loaded");
  return current;
}
