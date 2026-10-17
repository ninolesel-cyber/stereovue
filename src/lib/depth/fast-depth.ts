function lumaAt(data: Uint8ClampedArray, i: number) {
  return (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.114) / 255;
}

function satAt(data: Uint8ClampedArray, i: number) {
  const r = data[i] / 255;
  const g = data[i + 1] / 255;
  const b = data[i + 2] / 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function sampleSource(
  src: ImageData,
  x: number,
  y: number,
  dw: number,
  dh: number,
) {
  const sx = ((x + 0.5) * src.width) / dw;
  const sy = ((y + 0.5) * src.height) / dh;
  const x0 = Math.min(src.width - 1, Math.max(0, Math.floor(sx)));
  const y0 = Math.min(src.height - 1, Math.max(0, Math.floor(sy)));
  return (y0 * src.width + x0) * 4;
}

function boxBlur(src: Float32Array, w: number, h: number, radius: number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const r = Math.max(1, Math.round(radius));

  for (let y = 0; y < h; y++) {
    let sum = 0;
    let count = 0;
    const row = y * w;
    for (let x = 0; x <= r && x < w; x++) {
      sum += src[row + x];
      count += 1;
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / count;
      const add = x + r + 1;
      const rem = x - r;
      if (add < w) {
        sum += src[row + add];
        count += 1;
      }
      if (rem >= 0) {
        sum -= src[row + rem];
        count -= 1;
      }
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    let count = 0;
    for (let y = 0; y <= r && y < h; y++) {
      sum += tmp[y * w + x];
      count += 1;
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / count;
      const add = y + r + 1;
      const rem = y - r;
      if (add < h) {
        sum += tmp[add * w + x];
        count += 1;
      }
      if (rem >= 0) {
        sum -= tmp[rem * w + x];
        count -= 1;
      }
    }
  }
  return out;
}

function guidedSmooth(
  depth: Float32Array,
  guide: Float32Array,
  w: number,
  h: number,
  spatial: number,
  lumaSigma: number,
) {
  const out = new Float32Array(depth);
  const a = Math.exp(-1 / Math.max(1, spatial));

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 1; x < w; x++) {
      const g = Math.exp(-Math.abs(guide[row + x] - guide[row + x - 1]) / lumaSigma);
      const k = a * g;
      out[row + x] = out[row + x] * (1 - k) + out[row + x - 1] * k;
    }
    for (let x = w - 2; x >= 0; x--) {
      const g = Math.exp(-Math.abs(guide[row + x] - guide[row + x + 1]) / lumaSigma);
      const k = a * g;
      out[row + x] = out[row + x] * (1 - k) + out[row + x + 1] * k;
    }
  }

  for (let x = 0; x < w; x++) {
    for (let y = 1; y < h; y++) {
      const i = y * w + x;
      const j = i - w;
      const g = Math.exp(-Math.abs(guide[i] - guide[j]) / lumaSigma);
      const k = a * g;
      out[i] = out[i] * (1 - k) + out[j] * k;
    }
    for (let y = h - 2; y >= 0; y--) {
      const i = y * w + x;
      const j = i + w;
      const g = Math.exp(-Math.abs(guide[i] - guide[j]) / lumaSigma);
      const k = a * g;
      out[i] = out[i] * (1 - k) + out[j] * k;
    }
  }
  return out;
}

export function makeNearPositive(depth: Float32Array, w: number, h: number) {
  const band = Math.max(2, Math.floor(h * 0.2));
  let top = 0;
  let bot = 0;
  let n = 0;
  for (let y = 0; y < band; y++) {
    for (let x = 0; x < w; x++) {
      top += depth[y * w + x];
      bot += depth[(h - 1 - y) * w + x];
      n += 1;
    }
  }
  if (n > 0 && top > bot) {
    for (let i = 0; i < depth.length; i++) depth[i] = 1 - depth[i];
  }
  return depth;
}

export function percentileStretch(depth: Float32Array) {
  const copy = Array.from(depth);
  copy.sort((a, b) => a - b);
  const p2 = copy[Math.floor(copy.length * 0.02)] ?? 0;
  const p98 = copy[Math.floor(copy.length * 0.98)] ?? 1;
  const range = Math.max(1e-6, p98 - p2);
  const out = new Float32Array(depth.length);
  for (let i = 0; i < depth.length; i++) {
    out[i] = Math.min(1, Math.max(0, (depth[i] - p2) / range));
  }
  return out;
}

/**
 * Instant on-device depth prior. Edge-aware, landscape-biased, good enough
 * for a usable stereo pop while the neural model loads.
 * Values: 0 = far, 1 = near.
 */
export function estimateFastDepth(src: ImageData, dw: number, dh: number) {
  const luma = new Float32Array(dw * dh);
  const sat = new Float32Array(dw * dh);
  const { data } = src;

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const i = sampleSource(src, x, y, dw, dh);
      const idx = y * dw + x;
      luma[idx] = lumaAt(data, i);
      sat[idx] = satAt(data, i);
    }
  }

  const coarse = boxBlur(luma, dw, dh, Math.max(6, Math.round(dw / 18)));
  const medium = boxBlur(luma, dw, dh, Math.max(2, Math.round(dw / 48)));
  const depth = new Float32Array(dw * dh);

  for (let y = 0; y < dh; y++) {
    const verticalNear = y / Math.max(1, dh - 1);
    for (let x = 0; x < dw; x++) {
      const i = y * dw + x;
      const sharp = Math.min(1, Math.abs(luma[i] - medium[i]) * 4.2);
      const darkNear = 1 - coarse[i];
      const center = 1 - Math.abs(x / Math.max(1, dw - 1) - 0.5) * 1.15;
      depth[i] =
        0.38 * verticalNear +
        0.22 * sat[i] +
        0.16 * sharp +
        0.16 * darkNear +
        0.08 * Math.max(0, center);
    }
  }

  const smoothed = guidedSmooth(depth, luma, dw, dh, Math.max(4, dw / 40), 0.08);
  return makeNearPositive(percentileStretch(smoothed), dw, dh);
}
