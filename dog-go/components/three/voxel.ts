/**
 * Tiny voxel toolkit for the Pixel style: a sparse set of unit cubes, each face with its own
 * colour, turned into one flat-shaded mesh that only contains the faces you can see.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';

/** face order: +x, -x, +y, -y, +z, -z */
export const DIRS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export type FaceColors = string | ((face: number) => string);

export class VoxelSet {
  map = new Map<string, FaceColors>();
  static key(i: number, j: number, k: number) {
    return `${i},${j},${k}`;
  }
  set(i: number, j: number, k: number, c: FaceColors) {
    this.map.set(VoxelSet.key(i, j, k), c);
  }
  has(i: number, j: number, k: number) {
    return this.map.has(VoxelSet.key(i, j, k));
  }
  /** fill an integer box [x0,x1) × [y0,y1) × [z0,z1) */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: (i: number, j: number, k: number) => FaceColors) {
    for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) for (let k = z0; k < z1; k++) this.set(i, j, k, c(i, j, k));
  }
}

// unit-cube face corners (counter-clockwise seen from outside)
const FACE_QUADS: [number, number, number][][] = [
  [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]],
  [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
];

const col = new THREE.Color();

/**
 * Mesh a voxel set. Voxel (i,j,k) spans [i,i+1]·u in each axis, offset by `origin`.
 * `hidden` voxels (e.g. the dog's body under a costume) also hide faces touching them.
 */
export function voxelGeometry(set: VoxelSet, u: number, origin: [number, number, number] = [0, 0, 0], hidden?: VoxelSet) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const cols: number[] = [];
  for (const [key, fc] of set.map) {
    const [i, j, k] = key.split(',').map(Number);
    for (let f = 0; f < 6; f++) {
      const d = DIRS[f];
      if (set.has(i + d[0], j + d[1], k + d[2]) || hidden?.has(i + d[0], j + d[1], k + d[2])) continue;
      col.set(typeof fc === 'string' ? fc : fc(f));
      const q = FACE_QUADS[f].map(([a, b, c]) => [origin[0] + (i + a) * u, origin[1] + (j + b) * u, origin[2] + (k + c) * u]);
      for (const idx of [0, 1, 2, 0, 2, 3]) {
        pos.push(...q[idx]);
        nrm.push(...d);
        cols.push(col.r, col.g, col.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeBoundingSphere();
  return g;
}

export interface Pixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** read an image (data URL) at a small size so each pixel can become a voxel colour */
export function usePixels(url: string | undefined, size: number): Pixels | null {
  const [px, setPx] = useState<Pixels | null>(null);
  useEffect(() => {
    if (!url) return setPx(null);
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, size, size);
      setPx({ w: size, h: size, data: ctx.getImageData(0, 0, size, size).data });
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url, size]);
  return px;
}

/** colour at (x, y) in 0..1 (y up), clamped */
export function samplePx(p: Pixels, x: number, y: number): string {
  const ix = Math.max(0, Math.min(p.w - 1, Math.floor(x * p.w)));
  const iy = Math.max(0, Math.min(p.h - 1, Math.floor((1 - y) * p.h)));
  const o = (iy * p.w + ix) * 4;
  return `rgb(${p.data[o]},${p.data[o + 1]},${p.data[o + 2]})`;
}

/** mix two css colours */
export function mixCss(a: string, b: string, t: number) {
  const ca = new THREE.Color(a);
  ca.lerp(new THREE.Color(b), t);
  return `#${ca.getHexString()}`;
}

/** lighten (+) / darken (-) a css colour */
export function shadeCss(a: string, k: number) {
  const c = new THREE.Color(a);
  if (k > 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.multiplyScalar(1 + k);
  return `#${c.getHexString()}`;
}
