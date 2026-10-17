const CREAM = { r: 234, g: 214, b: 176 };

function roundedArchPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const rTop = Math.min(w * 0.18, h * 0.14);
  const rBot = Math.min(w * 0.05, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + rBot, y + h);
  ctx.lineTo(x + w - rBot, y + h);
  ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - rBot);
  ctx.lineTo(x + w, y + rTop);
  ctx.quadraticCurveTo(x + w, y, x + w - rTop, y);
  ctx.lineTo(x + rTop, y);
  ctx.quadraticCurveTo(x, y, x, y + rTop);
  ctx.lineTo(x, y + h - rBot);
  ctx.quadraticCurveTo(x, y + h, x + rBot, y + h);
  ctx.closePath();
}

function putImage(ctx: CanvasRenderingContext2D, image: ImageData, x: number, y: number) {
  const tmp = document.createElement("canvas");
  tmp.width = image.width;
  tmp.height = image.height;
  const tctx = tmp.getContext("2d");
  if (!tctx) throw new Error("Canvas is not available");
  tctx.putImageData(image, 0, 0);
  ctx.drawImage(tmp, x, y, image.width, image.height);
}

function fillCream(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = `rgb(${CREAM.r}, ${CREAM.g}, ${CREAM.b})`;
  ctx.fillRect(0, 0, w, h);
}

export async function readyVictorianFont() {
  try {
    await document.fonts.load("700 28px 'Cinzel Decorative'");
    await document.fonts.ready;
  } catch {
    // canvas will fall back to serif
  }
}

function paintCaption(ctx: CanvasRenderingContext2D, width: number, y: number, size: number) {
  ctx.save();
  ctx.fillStyle = "#2a2218";
  ctx.font = `700 ${size}px 'Cinzel Decorative', 'Playfair Display', Palatino, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Made with Stereo Vue", width / 2, y);
  ctx.restore();
}

export async function stampBrandOnBlob(blob: Blob): Promise<Blob> {
  await readyVictorianFont();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const band = Math.max(36, Math.round(canvas.height * 0.09));
  const size = Math.max(11, Math.round(canvas.width * 0.022));
  paintCaption(ctx, canvas.width, canvas.height - band / 2, size);
  return canvasToJpegBlob(canvas, 0.92);
}

export function compositeTwinOnMount(left: ImageData, right: ImageData, arch: boolean) {
  const side = Math.max(28, Math.round(left.width * 0.06));
  const gap = Math.max(12, Math.round(left.width * 0.035));
  const top = Math.max(28, Math.round(left.height * 0.07));
  const bottom = Math.max(44, Math.round(left.height * 0.1));
  const canvas = document.createElement("canvas");
  canvas.width = side + left.width + gap + right.width + side;
  canvas.height = top + left.height + bottom;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  fillCream(ctx, canvas.width, canvas.height);

  const lx = side;
  const rx = side + left.width + gap;
  const y = top;

  const drawEye = (image: ImageData, x: number) => {
    ctx.save();
    if (arch) {
      roundedArchPath(ctx, x, y, image.width, image.height);
      ctx.clip();
    }
    putImage(ctx, image, x, y);
    ctx.restore();
    if (arch) {
      ctx.save();
      roundedArchPath(ctx, x, y, image.width, image.height);
      ctx.strokeStyle = "rgba(42, 34, 24, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  };

  drawEye(left, lx);
  drawEye(right, rx);

  return canvas;
}

export function compositeSingleOnMount(image: ImageData, arch: boolean) {
  const pad = Math.max(28, Math.round(image.width * 0.06));
  const bottom = Math.max(44, Math.round(image.height * 0.1));
  const canvas = document.createElement("canvas");
  canvas.width = image.width + pad * 2;
  canvas.height = image.height + pad + bottom;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  fillCream(ctx, canvas.width, canvas.height);
  const x = pad;
  const y = pad;
  ctx.save();
  if (arch) {
    roundedArchPath(ctx, x, y, image.width, image.height);
    ctx.clip();
  }
  putImage(ctx, image, x, y);
  ctx.restore();
  if (arch) {
    ctx.save();
    roundedArchPath(ctx, x, y, image.width, image.height);
    ctx.strokeStyle = "rgba(42, 34, 24, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  return canvas;
}

export async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not encode image");
  return blob;
}

export function matEyeForGif(image: ImageData, arch: boolean) {
  if (!arch) return image;
  const canvas = compositeSingleOnMount(image, true);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
