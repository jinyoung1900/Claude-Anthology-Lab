/** Canvas helpers for the dog creator (all client-side, no uploads). */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Read a File and downscale to keep memory / IndexedDB small. */
export async function fileToDownscaledDataUrl(file: File, maxSide = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface CropBox {
  /** center in source-image pixels */
  cx: number;
  cy: number;
  /** square side in source-image pixels */
  size: number;
  /** radians */
  rot: number;
}

/** Render a rotated square crop of `img` into an `out`x`out` canvas. */
export function cropRotated(img: HTMLImageElement, box: CropBox, out: number, pixelated = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = out;
  c.height = out;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = !pixelated;
  ctx.translate(out / 2, out / 2);
  ctx.rotate(-box.rot);
  ctx.scale(out / box.size, out / box.size);
  ctx.drawImage(img, -box.cx, -box.cy);
  return c;
}

export function averageColor(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  if (!n) return '#c8a27a';
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Low-res, slightly noisy fur swatch – used as a default/fallback texture. */
export function makeFurTexture(color: string, size = 32): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.35; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const a = Math.random() * 0.18;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(x, y, 1, 1 + Math.floor(Math.random() * 2));
  }
  return c.toDataURL('image/png');
}

/** Cute procedural pixel face so the app works before a photo is uploaded. */
export function makeDefaultFace(color: string, size = 128): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  const u = size / 16;
  // muzzle
  ctx.fillStyle = '#F4E3CF';
  ctx.fillRect(4 * u, 8 * u, 8 * u, 6 * u);
  // eyes (on the eye-line at ~40%)
  ctx.fillStyle = '#1d1410';
  ctx.fillRect(4 * u, 5.5 * u, 2 * u, 2 * u);
  ctx.fillRect(10 * u, 5.5 * u, 2 * u, 2 * u);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4.4 * u, 5.8 * u, 0.7 * u, 0.7 * u);
  ctx.fillRect(10.4 * u, 5.8 * u, 0.7 * u, 0.7 * u);
  // nose (nose-dot at ~62%)
  ctx.fillStyle = '#1d1410';
  ctx.fillRect(6.8 * u, 9.2 * u, 2.4 * u, 1.6 * u);
  // mouth
  ctx.fillRect(7.6 * u, 10.8 * u, 0.8 * u, 1 * u);
  ctx.fillRect(6.4 * u, 11.6 * u, 1.2 * u, 0.6 * u);
  ctx.fillRect(8.4 * u, 11.6 * u, 1.2 * u, 0.6 * u);
  // blush
  ctx.fillStyle = 'rgba(224,96,126,0.45)';
  ctx.fillRect(2.5 * u, 9 * u, 1.5 * u, 1 * u);
  ctx.fillRect(12 * u, 9 * u, 1.5 * u, 1 * u);
  return c.toDataURL('image/png');
}

