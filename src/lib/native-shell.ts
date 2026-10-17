/**
 * Bridge to the Stereo Vue Mac app (a native window around this page).
 * The Mac app installs `window.webkit.messageHandlers.stereoVue`.
 */
type NativeHandler = { postMessage: (message: unknown) => void };

function handler(): NativeHandler | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkit?: { messageHandlers?: { stereoVue?: NativeHandler } } };
  return w.webkit?.messageHandlers?.stereoVue ?? null;
}

export function isNativeShell() {
  return handler() !== null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Hands the plate to the Mac app, which shows its save dialog or share menu. */
export async function sendToNativeShell(action: "save" | "share", blob: Blob, filename: string) {
  const h = handler();
  if (!h) return false;
  h.postMessage({ action, filename, data: await blobToDataUrl(blob) });
  return true;
}
