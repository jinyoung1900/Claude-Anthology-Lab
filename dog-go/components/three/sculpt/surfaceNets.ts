/**
 * Signed-distance helpers + a small "surface nets" mesher.
 *
 * The dog is described as a handful of soft primitives (ellipsoids, round cones) that are
 * blended together with a smooth minimum, so legs, ears and tail grow out of the body like
 * clay instead of being separate meshes. Surface nets then samples that field on a coarse
 * grid and places one vertex per surface-crossing cell, which gives a single, seamless,
 * low-poly skin.
 */

export type V3 = [number, number, number];

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));

/** polynomial smooth minimum: blends two distances over radius k */
export function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** approximate ellipsoid distance */
export function sdEllipsoid(px: number, py: number, pz: number, c: V3, r: V3) {
  const x = px - c[0], y = py - c[1], z = pz - c[2];
  const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** capsule whose radius tapers from r1 at a to r2 at b */
export function sdRoundCone(px: number, py: number, pz: number, a: V3, b: V3, r1: number, r2: number) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// cube corner offsets and the 12 edges between them
const CORNERS: V3[] = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];
const EDGES: [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export interface NetsMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

/**
 * Mesh the zero level of `field` inside [min, max] with cubic cells of size `cell`.
 * Normals come from the field gradient; triangle winding is made to face outward.
 */
export function surfaceNets(field: (x: number, y: number, z: number) => number, min: V3, max: V3, cell: number): NetsMesh {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  const vals = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) vals[at(i, j, k)] = field(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);

  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellAt = (i: number, j: number, k: number) => i + cx * (j + cy * k);
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);
  const pos: number[] = [];
  const v = new Float32Array(8);

  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORNERS[c];
          v[c] = vals[at(i + o[0], j + o[1], k + o[2])];
          if (v[c] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [e0, e1] of EDGES) {
          const a = v[e0], b = v[e1];
          if (a < 0 === b < 0) continue;
          const t = a / (a - b);
          const o0 = CORNERS[e0], o1 = CORNERS[e1];
          sx += o0[0] + (o1[0] - o0[0]) * t;
          sy += o0[1] + (o1[1] - o0[1]) * t;
          sz += o0[2] + (o1[2] - o0[2]) * t;
          n++;
        }
        cellVert[cellAt(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
      }

  // one quad per sign-changing grid edge, joining the 4 cells around it
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v0 = vals[at(i, j, k)] < 0;
        if (i < cx && j > 0 && k > 0 && j < cy && k < cz && v0 !== vals[at(i + 1, j, k)] < 0)
          quad(cellVert[cellAt(i, j - 1, k - 1)], cellVert[cellAt(i, j, k - 1)], cellVert[cellAt(i, j, k)], cellVert[cellAt(i, j - 1, k)], v0);
        if (j < cy && i > 0 && k > 0 && i < cx && k < cz && v0 !== vals[at(i, j + 1, k)] < 0)
          quad(cellVert[cellAt(i - 1, j, k - 1)], cellVert[cellAt(i - 1, j, k)], cellVert[cellAt(i, j, k)], cellVert[cellAt(i, j, k - 1)], v0);
        if (k < cz && i > 0 && j > 0 && i < cx && j < cy && v0 !== vals[at(i, j, k + 1)] < 0)
          quad(cellVert[cellAt(i - 1, j - 1, k)], cellVert[cellAt(i, j - 1, k)], cellVert[cellAt(i, j, k)], cellVert[cellAt(i - 1, j, k)], v0);
      }

  // gradient normals
  const positions = new Float32Array(pos);
  const normals = new Float32Array(pos.length);
  const h = cell * 0.5;
  for (let p = 0; p < positions.length; p += 3) {
    const x = positions[p], y = positions[p + 1], z = positions[p + 2];
    const gx = field(x + h, y, z) - field(x - h, y, z);
    const gy = field(x, y + h, z) - field(x, y - h, z);
    const gz = field(x, y, z + h) - field(x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[p] = gx / l;
    normals[p + 1] = gy / l;
    normals[p + 2] = gz / l;
  }

  // make every triangle face along the field gradient
  const indices = new Uint32Array(idx);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const e1x = positions[b] - positions[a], e1y = positions[b + 1] - positions[a + 1], e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a], e2y = positions[c + 1] - positions[a + 1], e2z = positions[c + 2] - positions[a + 2];
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    const nxs = normals[a] + normals[b] + normals[c], nys = normals[a + 1] + normals[b + 1] + normals[c + 1], nzs = normals[a + 2] + normals[b + 2] + normals[c + 2];
    if (fx * nxs + fy * nys + fz * nzs < 0) {
      const s = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = s;
    }
  }
  return { positions, normals, indices };
}
