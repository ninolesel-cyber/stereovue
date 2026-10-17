export function depthToImageData(
  depth: Float32Array,
  w: number,
  h: number,
  invert = false,
  strength = 1,
) {
  const image = new ImageData(w, h);
  const { data } = image;
  const contrast = Math.max(0.35, strength);
  for (let i = 0; i < depth.length; i++) {
    let t = invert ? 1 - depth[i] : depth[i];
    t = (t - 0.5) * contrast + 0.5;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const r = Math.round(14 + t * 229);
    const g = Math.round(14 + t * 227);
    const b = Math.round(16 + t * 220);
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  return image;
}

export function depthPreviewUrl(
  depth: Float32Array,
  w: number,
  h: number,
  invert = false,
  strength = 1,
) {
  const image = depthToImageData(depth, w, h, invert, strength);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.82);
}
