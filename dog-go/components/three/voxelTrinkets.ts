/**
 * Cube-built hats, glasses and packs for the Pixel dog, laid on the same grid as its head
 * and body so they sit flush on the blocks (no smooth meshes floating on a voxel dog).
 *
 * Head grid (head-local cube indices): head x[-4,4) y[-3,4) z[-4,3); top row is y = 3,
 * front face is z = 3. Body grid: body x[-4,4), top row y = jb1 - 1, length z[zb0, zb1).
 * Cubes where the ears are get skipped so ears poke through hats instead of clipping.
 */
import type { TrinketDef } from '@/lib/trinkets';
import { shadeCss, VoxelSet } from './voxel';

export interface PixelHeadInfo {
  /** cubes taken by the ears (head-local) */
  ears: VoxelSet;
}
export interface PixelBodyInfo {
  jb1: number;
  zb0: number;
  zb1: number;
}

/** outline of the rectangle x[x0,x1) × z[z0,z1) */
function ring(x0: number, x1: number, z0: number, z1: number, f: (i: number, k: number, n: number) => void) {
  let n = 0;
  for (let i = x0; i < x1; i++)
    for (let k = z0; k < z1; k++) if (i === x0 || i === x1 - 1 || k === z0 || k === z1 - 1) f(i, k, n++);
}

export function voxelHeadItem(t: TrinketDef, info: PixelHeadInfo): VoxelSet {
  const v = new VoxelSet();
  const a = t.accent ?? '#ffffff';
  const put = (i: number, j: number, k: number, c: string) => {
    if (!info.ears.has(i, j, k)) v.set(i, j, k, c);
  };
  const inHead = (i: number, j: number, k: number) => i >= -4 && i < 4 && j >= -3 && j < 4 && k >= -4 && k < 3;
  /** one cube layer hugging the head between rows y0..top */
  const cap = (y0: number, c: (i: number, j: number, k: number) => string) => {
    for (let i = -5; i < 5; i++)
      for (let j = y0; j < 5; j++)
        for (let k = -5; k < 4; k++) if (!inHead(i, j, k) && (inHead(i - 1, j, k) || inHead(i + 1, j, k) || inHead(i, j - 1, k) || inHead(i, j, k - 1) || inHead(i, j, k + 1))) put(i, j, k, c(i, j, k));
  };
  switch (t.kind) {
    case 'beanie':
      cap(2, (_i, j) => (j === 2 ? a : t.color));
      v.box(-1, 1, 5, 7, -2, 0, () => a); // pompom
      break;
    case 'santahat':
      cap(2, (_i, j) => (j === 2 ? a : t.color));
      v.box(-2, 2, 5, 6, -3, 1, () => t.color);
      v.box(-1, 1, 6, 7, -3, 0, () => t.color);
      v.box(-1, 0, 7, 8, -4, -2, () => t.color);
      v.box(-1, 1, 7, 9, -5, -3, () => a); // bobble flopping back
      break;
    case 'partyhat':
      [4, 4, 3, 2, 2, 1].forEach((w, n) => {
        const h = Math.floor(w / 2);
        v.box(-h, w - h, 4 + n, 5 + n, -1 - h, -1 + (w - h), () => (n % 2 ? a : t.color));
      });
      v.set(0, 10, -1, a);
      break;
    case 'tophat':
      v.box(-5, 5, 4, 5, -5, 4, () => t.color); // brim
      v.box(-3, 3, 5, 10, -3, 2, (_i, j) => (j === 5 ? a : t.color));
      break;
    case 'crown':
      ring(-3, 3, -3, 2, (i, k, n) => {
        v.set(i, 4, k, t.color);
        if (n % 2 === 0) v.set(i, 5, k, t.color);
      });
      v.set(0, 4, 2, a);
      v.set(-1, 4, 2, a);
      break;
    case 'halo':
      ring(-3, 3, -3, 2, (i, k) => v.set(i, 7, k, t.color));
      break;
    case 'flowercrown':
      ring(-4, 4, -4, 3, (i, k, n) => {
        v.set(i, 4, k, t.color);
        if (n % 3 === 0) v.set(i, 5, k, n % 2 ? a : '#FFF3A0');
      });
      break;
    case 'pumpkin':
      v.box(-3, 3, 4, 7, -3, 2, (i, j, k) => (Math.abs(i) % 2 === 0 || j === 6 ? shadeCss(t.color, -0.1) : t.color));
      v.box(0, 1, 7, 9, -1, 0, () => a);
      v.set(1, 8, -1, a);
      break;
    case 'strawhat':
      v.box(-6, 6, 4, 5, -6, 5, () => t.color); // wide brim
      v.box(-3, 3, 5, 7, -3, 2, (_i, j) => (j === 5 ? a : t.color));
      break;
    // ---- face items: on the front face, around the eyes (rows 0..2) ----
    case 'glasses':
      for (const [x0, x1] of [[-4, -1], [1, 4]] as [number, number][])
        for (let i = x0; i < x1; i++) for (let j = 0; j < 3; j++) if (i === x0 || i === x1 - 1 || j === 0 || j === 2) v.set(i, j, 3, t.color);
      v.box(-1, 1, 2, 3, 3, 4, () => t.color);
      break;
    case 'sunglasses':
      v.box(-4, -1, 0, 3, 3, 4, () => t.color);
      v.box(1, 4, 0, 3, 3, 4, () => t.color);
      v.box(-1, 1, 2, 3, 3, 4, () => t.color);
      v.set(-3, 2, 3, '#555555'); // glint
      v.set(2, 2, 3, '#555555');
      break;
    case 'starshades':
      // a 5-wide pixel star over each eye:  ..X.. / XXXXX / .XXX. / .X.X.
      for (const cx of [-3, 2]) {
        const rows: [number, string][] = [[3, '..X..'], [2, 'XXXXX'], [1, '.XXX.'], [0, '.X.X.']];
        for (const [j, row] of rows)
          for (let n = 0; n < 5; n++) if (row[n] === 'X') v.set(cx - 2 + n, j, 3, j === 2 && n === 1 ? shadeCss(t.color, 0.5) : t.color);
      }
      break;
  }
  return v;
}

export function voxelBackItem(t: TrinketDef, b: PixelBodyInfo): VoxelSet {
  const v = new VoxelSet();
  const a = t.accent ?? '#ffffff';
  const y = b.jb1; // first row above the back
  switch (t.kind) {
    case 'backpack':
      v.box(-3, 3, y, y + 3, -2, 2, (_i, j) => (j === y + 2 ? a : t.color));
      v.box(-2, 2, y, y + 2, -3, -2, () => a); // pocket at the back
      // straps down the sides
      for (const x of [-5, 4]) v.box(x, x + 1, y - 3, y, 0, 1, () => a);
      break;
    case 'jetpack':
      for (const x0 of [-3, 1]) {
        v.box(x0, x0 + 2, y, y + 4, -2, 0, (_i, j) => (j === y + 3 ? shadeCss(t.color, 0.2) : t.color));
        v.box(x0, x0 + 2, y, y + 1, -3, -2, () => a); // flame
      }
      v.box(-1, 1, y, y + 2, -2, 0, () => shadeCss(t.color, -0.2));
      break;
  }
  return v;
}
