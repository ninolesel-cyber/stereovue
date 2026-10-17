function sampleDepth(
  depth: Float32Array,
  dw: number,
  dh: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const dx = ((x + 0.5) * dw) / width - 0.5;
  const dy = ((y + 0.5) * dh) / height - 0.5;
  const x0 = Math.min(dw - 1, Math.max(0, Math.floor(dx)));
  const y0 = Math.min(dh - 1, Math.max(0, Math.floor(dy)));
  const x1 = Math.min(dw - 1, x0 + 1);
  const y1 = Math.min(dh - 1, y0 + 1);
  const fx = dx - x0;
  const fy = dy - y0;
  const d00 = depth[y0 * dw + x0];
  const d10 = depth[y0 * dw + x1];
  const d01 = depth[y1 * dw + x0];
  const d11 = depth[y1 * dw + x1];
  return d00 * (1 - fx) * (1 - fy) + d10 * fx * (1 - fy) + d01 * (1 - fx) * fy + d11 * fx * fy;
}

function copyPixel(
  src: Uint8ClampedArray,
  dest: Uint8ClampedArray,
  si: number,
  di: number,
) {
  dest[di] = src[si];
  dest[di + 1] = src[si + 1];
  dest[di + 2] = src[si + 2];
  dest[di + 3] = 255;
}

/**
 * Largest parallax (in pixels) between the two eyes at strength 1.
 * Comfortable stereographs keep total parallax near 1/30 of the image width;
 * anything much larger cannot be fused in a viewer.
 */
export function maxParallax(width: number, strength: number) {
  return Math.max(2, width * 0.034 * strength);
}

/**
 * Depth-image-based rendering for one eye.
 * eye = +1 left, -1 right. Depth values: 0 = far, 1 = near.
 *
 * The stereo window sits at the nearest point of the scene: near objects keep
 * zero parallax and the distance recedes behind the frame, as on a Victorian
 * card. Each eye takes half the parallax, far content moving outward (left in
 * the left eye, right in the right eye), which gives uncrossed disparity for
 * parallel (stereoscope) viewing.
 */
export function warpEye(
  src: ImageData,
  depth: Float32Array,
  dw: number,
  dh: number,
  eye: 1 | -1,
  strength: number,
  invert: boolean,
) {
  const { width, height, data } = src;
  const half = maxParallax(width, strength) / 2;
  const out = new ImageData(width, height);
  const dest = out.data;
  const zbuf = new Float32Array(width);

  for (let y = 0; y < height; y++) {
    zbuf.fill(-1);
    const row = y * width;
    // Forward-map each source pixel; nearer pixels win where two land together.
    for (let x = 0; x < width; x++) {
      let d = sampleDepth(depth, dw, dh, x, y, width, height);
      if (invert) d = 1 - d;
      const shift = -eye * (1 - d) * half;
      const destX = Math.round(x + shift);
      if (destX < 0 || destX >= width) continue;
      if (d > zbuf[destX]) {
        zbuf[destX] = d;
        copyPixel(data, dest, (row + x) * 4, (row + destX) * 4);
      }
    }
    // Fill disocclusions from the farther neighbour so foreground edges are
    // not smeared across the background.
    let x = 0;
    while (x < width) {
      if (zbuf[x] >= 0) {
        x++;
        continue;
      }
      let end = x;
      while (end < width && zbuf[end] < 0) end++;
      const l = x - 1;
      const r = end;
      let from = -1;
      if (l >= 0 && r < width) from = zbuf[l] <= zbuf[r] ? l : r;
      else if (l >= 0) from = l;
      else if (r < width) from = r;
      for (let i = x; i < end; i++) {
        if (from >= 0) {
          copyPixel(dest, dest, (row + from) * 4, (row + i) * 4);
          zbuf[i] = zbuf[from];
        } else {
          copyPixel(data, dest, (row + i) * 4, (row + i) * 4);
        }
      }
      x = end;
    }
  }

  return out;
}

export function composeAnaglyph(left: ImageData, right: ImageData) {
  const { width, height } = left;
  const out = new ImageData(width, height);
  const L = left.data;
  const R = right.data;
  const D = out.data;
  for (let i = 0; i < D.length; i += 4) {
    D[i] = 0.299 * L[i] + 0.587 * L[i + 1] + 0.114 * L[i + 2];
    D[i + 1] = R[i + 1];
    D[i + 2] = R[i + 2];
    D[i + 3] = 255;
  }
  return out;
}

export function composeSbs(left: ImageData, right: ImageData) {
  const { width, height } = left;
  const out = new ImageData(width * 2, height);
  const D = out.data;
  const L = left.data;
  const R = right.data;
  for (let y = 0; y < height; y++) {
    const srcRow = y * width * 4;
    const destRow = y * width * 8;
    D.set(L.subarray(srcRow, srcRow + width * 4), destRow);
    D.set(R.subarray(srcRow, srcRow + width * 4), destRow + width * 4);
  }
  return out;
}

export type StereoOpts = {
  image: ImageData;
  depth: Float32Array;
  dw: number;
  dh: number;
  strength: number;
  invert: boolean;
};

export function downsampleImage(image: ImageData, maxEdge: number): ImageData {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  if (scale >= 0.995) return image;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const src = document.createElement("canvas");
  src.width = image.width;
  src.height = image.height;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("Canvas is not available");
  sctx.putImageData(image, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = width;
  dst.height = height;
  const dctx = dst.getContext("2d");
  if (!dctx) throw new Error("Canvas is not available");
  dctx.drawImage(src, 0, 0, width, height);
  return dctx.getImageData(0, 0, width, height);
}

export function liveWarpedPhoto(opts: StereoOpts, maxEdge = 480): ImageData {
  const small = downsampleImage(opts.image, maxEdge);
  return warpEye(small, opts.depth, opts.dw, opts.dh, 1, opts.strength, opts.invert);
}

/**
 * Grow near regions by a couple of depth pixels so the soft transition band at
 * object edges moves with the foreground instead of tearing into streaks.
 */
function dilateNear(depth: Float32Array, w: number, h: number, invert: boolean, radius = 2) {
  const pick = invert ? Math.min : Math.max;
  const tmp = new Float32Array(depth.length);
  const out = new Float32Array(depth.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = depth[y * w + x];
      for (let k = Math.max(0, x - radius); k <= Math.min(w - 1, x + radius); k++) v = pick(v, depth[y * w + k]);
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = tmp[y * w + x];
      for (let k = Math.max(0, y - radius); k <= Math.min(h - 1, y + radius); k++) v = pick(v, tmp[k * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

export function renderStereoViews(opts: StereoOpts) {
  const depth = dilateNear(opts.depth, opts.dw, opts.dh, opts.invert);
  const left = warpEye(opts.image, depth, opts.dw, opts.dh, 1, opts.strength, opts.invert);
  const right = warpEye(opts.image, depth, opts.dw, opts.dh, -1, opts.strength, opts.invert);
  return { left, right };
}
