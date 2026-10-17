import { applyPalette, GIFEncoder, quantize } from "gifenc";

function downsample(image: ImageData, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const src = document.createElement("canvas");
  src.width = image.width;
  src.height = image.height;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("Canvas is not available");
  sctx.putImageData(image, 0, 0);
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Two-frame wiggle stereograph — the living plate. */
export async function encodeWiggleGif(left: ImageData, right: ImageData, maxEdge = 480) {
  const scale = Math.min(1, maxEdge / Math.max(left.width, left.height));
  const w = Math.max(1, Math.round(left.width * scale));
  const h = Math.max(1, Math.round(left.height * scale));
  const l = downsample(left, w, h);
  const r = downsample(right, w, h);
  const palette = quantize(l.data, 128);
  const gif = GIFEncoder();
  gif.writeFrame(applyPalette(l.data, palette), w, h, { palette, delay: 180, repeat: 0 });
  gif.writeFrame(applyPalette(r.data, palette), w, h, { delay: 180 });
  gif.finish();
  const bytes = gif.bytes();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "image/gif" });
}
