/**
 * Costumes built from the dog's own shape.
 *
 * Every wearable cloth piece (collars, bandanas, scarves, outfits) is the dog's outer shape
 * pushed out by a small thickness and trimmed to a region – a band at the neck seat, a body
 * suit that stops just below the neck, a hood with a face opening… So it always hugs the fur
 * exactly, whatever the proportions / fluff / model, and never floats or sinks in.
 *
 *   solid = { dogField < thickness } ∩ region      (meshed with surface nets)
 *
 * The part of that solid inside the dog is hidden; what shows is the outer skin and a thin
 * hem where the region cuts it. Small rigid extras (knots, buttons, spikes, eyes) are placed
 * on the measured surface.
 */
import * as THREE from 'three';
import { TRINKET_MAP, type TrinketDef } from '@/lib/trinkets';
import { march, type Field } from './anchors';
import { surfaceNets, type V3 } from './sculpt/surfaceNets';
import { VoxelSet, voxelGeometry } from './voxel';

/** what a costume needs to know about a dog model (all model space) */
export interface DogFrame {
  /** outer shape without ears */
  field: Field;
  /** the ears alone (hoods puff out over them) */
  ears?: Field;
  /** collar seat on the neck axis and the axis direction (chest → head) */
  neckP: V3;
  neckD: V3;
  /** mean neck radius at the seat */
  neckR: number;
  headC: V3;
  /** rough head radius */
  R: number;
  bodyY: number;
  legH: number;
  /** z where the rump ends (costumes stop here unless the tail is skinned) */
  rumpZ: number;
  /** the model's tail is part of the skinned shape (sculpt) */
  skinnedTail: boolean;
  /** legs are part of the shape (sculpt) – suits may cover the thighs */
  skinnedLegs: boolean;
  /** model bounds */
  min: V3;
  max: V3;
  /** neck cloth only exists where this is negative (box dogs: just under the head) */
  neckClip?: (p: V3) => number;
  /** box dogs: where the neckline applies to suits (negative = under the head); elsewhere suits cover the whole back */
  neckZone?: (p: V3) => number;
  /** z just behind the front legs, where a harness girth strap goes */
  girthZ?: number;
  /** Pixel style: cloth is made of cubes on the dog's grid instead of a smooth skin */
  voxel?: { u: number; origins: Record<FrameName, V3>; hidden: Record<FrameName, VoxelSet> };
}

export type FrameName = 'body' | 'head';

export interface CostumeLayer {
  geometry: THREE.BufferGeometry;
  /** rigid models parent this to their body or head group */
  frame: FrameName;
}

export interface CostumeExtra {
  kind: 'knot' | 'button' | 'spike' | 'eye' | 'bow' | 'tag' | 'medal' | 'tail' | 'antenna' | 'wing' | 'bulbeye' | 'roundear' | 'horn' | 'dring' | 'buckle';
  pos: V3;
  /** outward direction at that spot */
  n: V3;
  color: string;
  size: number;
  frame: FrameName;
  /** optional second colour */
  accent?: string;
}

export interface Costume {
  layers: CostumeLayer[];
  extras: CostumeExtra[];
}

const color = new THREE.Color();
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

interface LayerSpec {
  frame: FrameName;
  /** thickness over the fur */
  t: number;
  /** region SDF – negative inside */
  region: (p: V3) => number;
  /** own solid shape instead of 'fur pushed out by t' (puffy hoods) */
  shape?: (p: V3) => number;
  /** colour at a vertex */
  paint: (p: V3, n: V3) => string;
  /** meshing bounds + cell size */
  min: V3;
  max: V3;
  cell: number;
}

/** cubes one layer outside the dog, inside the region, on the frame's voxel grid */
function voxelLayer(F: DogFrame, s: LayerSpec): THREE.BufferGeometry | null {
  const V = F.voxel!;
  const u = V.u;
  const o = V.origins[s.frame];
  const set = new VoxelSet();
  const h = u * 0.25;
  const lo = s.min.map((m, a) => Math.floor((m - o[a]) / u) - 1);
  const hi = s.max.map((m, a) => Math.ceil((m - o[a]) / u) + 1);
  for (let i = lo[0]; i <= hi[0]; i++)
    for (let j = lo[1]; j <= hi[1]; j++)
      for (let k = lo[2]; k <= hi[2]; k++) {
        const c: V3 = [o[0] + (i + 0.5) * u, o[1] + (j + 0.5) * u, o[2] + (k + 0.5) * u];
        const d = F.field(c[0], c[1], c[2]);
        if (d <= 0 || (s.shape ? s.shape(c) >= 0 : d > u * 0.9) || s.region(c) >= 0 || V.hidden[s.frame].has(i, j, k)) continue;
        const n = norm([
          F.field(c[0] + h, c[1], c[2]) - F.field(c[0] - h, c[1], c[2]),
          F.field(c[0], c[1] + h, c[2]) - F.field(c[0], c[1] - h, c[2]),
          F.field(c[0], c[1], c[2] + h) - F.field(c[0], c[1], c[2] - h),
        ]);
        set.set(i, j, k, s.paint(c, n));
      }
  if (!set.map.size) return null;
  return voxelGeometry(set, u, o, V.hidden[s.frame]);
}

function meshLayer(F: DogFrame, s: LayerSpec): THREE.BufferGeometry | null {
  if (F.voxel) return voxelLayer(F, s);
  const g = s.shape
    ? (x: number, y: number, z: number) => Math.max(s.shape!([x, y, z]), s.region([x, y, z]))
    : (x: number, y: number, z: number) => Math.max(F.field(x, y, z) - s.t, s.region([x, y, z]));
  const net = surfaceNets(g, s.min, s.max, s.cell);
  if (!net.indices.length) return null;
  const colors = new Float32Array(net.positions.length);
  for (let i = 0; i < net.positions.length; i += 3) {
    const p: V3 = [net.positions[i], net.positions[i + 1], net.positions[i + 2]];
    const n: V3 = [net.normals[i], net.normals[i + 1], net.normals[i + 2]];
    color.set(s.paint(p, n));
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(net.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(net.normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(net.indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** point on the costume surface reached by marching out of `from` along dir */
function surfacePoint(F: DogFrame, from: V3, dir: V3, t: number, solid?: (p: V3) => number): { pos: V3; n: V3 } {
  const d = norm(dir);
  const f = solid ? (x: number, y: number, z: number) => solid([x, y, z]) : (x: number, y: number, z: number) => F.field(x, y, z) - t;
  const dist = march(f, from, d, 1.2, 0.003);
  const pos: V3 = [from[0] + d[0] * dist, from[1] + d[1] * dist, from[2] + d[2] * dist];
  const h = 0.004;
  const n = norm([
    F.field(pos[0] + h, pos[1], pos[2]) - F.field(pos[0] - h, pos[1], pos[2]),
    F.field(pos[0], pos[1] + h, pos[2]) - F.field(pos[0], pos[1] - h, pos[2]),
    F.field(pos[0], pos[1], pos[2] + h) - F.field(pos[0], pos[1], pos[2] - h),
  ]);
  return { pos, n };
}

/**
 * Per-item neck fit (smooth dogs; Pixel dogs use their own straight seam).
 *  lean – how far the band tips forward from square-to-the-neck (radians): more = higher at the nape
 *  up   – where its front sits on the throat, in neck radii up (+) or down (–) from the seat
 *  wrap – how far from the neck the band may reach (neck radii) before it's trimmed
 *  drop – (medal) how far the medal hangs below the band, in neck radii
 */
const NECK_FIT: Record<string, { lean: number; up: number; wrap: number; drop: number }> = {
  default: { lean: 0.4, up: 0, wrap: 1.7, drop: 0.5 },
  collar: { lean: 0.25, up: -0.25, wrap: 1.6, drop: 0 },
  bandana: { lean: 0.25, up: -0.25, wrap: 1.6, drop: 0 },
  scarf: { lean: 0.35, up: 0.15, wrap: 1.8, drop: 0 },
  medal: { lean: 0.4, up: 0.1, wrap: 1.6, drop: 0.55 },
  harness: { lean: 0.4, up: -0.1, wrap: 1.7, drop: 0 },
  cape: { lean: 0.4, up: 0, wrap: 1.7, drop: 0 },
};

export function buildCostume(F: DogFrame, t: TrinketDef): Costume {
  const { neckP, neckR, headC, R, legH, bodyY } = F;
  const neckD = F.neckD;
  const fwd: V3 = norm([0, -neckD[2], neckD[1]]); // front of the neck (throat / chest side)
  /** distance along the neck axis from the seat (+ toward the head) */
  const along = (p: V3) => dot(sub(p, neckP), neckD);
  /** distance in front of the neck axis */
  const ahead = (p: V3) => dot(sub(p, neckP), fwd);
  // Every neck item has its own fit (NECK_FIT below), so tuning one never moves the others.
  const fit = NECK_FIT[t.kind] ?? NECK_FIT.default;
  // On smooth dogs the measured neck axis is close to vertical, so a band square to it would run
  // along the top of the back. Lean the band forward, pivoting about its throat point (fit.up
  // neck-radii up the neck) so the front stays put and only the back rises to the nape.
  const lean = F.voxel ? 0 : fit.lean;
  const throatA = F.voxel ? 0 : fit.up * neckR;
  const la = Math.atan2(neckD[2], neckD[1]) + lean;
  const bandD: V3 = F.voxel ? neckD : [0, Math.cos(la), Math.sin(la)];
  const rise = throatA + (F.voxel ? 0 : neckR * Math.tan(lean));
  const bandP: V3 = [neckP[0] + neckD[0] * rise, neckP[1] + neckD[1] * rise, neckP[2] + neckD[2] * rise];
  const alongB = (p: V3) => dot(sub(p, bandP), bandD);
  /** distance from the band's axis – bands only wrap the neck, never run down a sloping back */
  const radial = (p: V3) => {
    const q = sub(p, bandP);
    const a = dot(q, bandD);
    return Math.hypot(q[0] - bandD[0] * a, q[1] - bandD[1] * a, q[2] - bandD[2] * a);
  };
  const clip = (p: V3) => Math.max(F.neckClip ? F.neckClip(p) : -1, F.voxel ? -1 : radial(p) - neckR * fit.wrap);
  const pad = 0.08;
  const all = { min: [F.min[0] - pad, F.min[1] - pad, F.min[2] - pad] as V3, max: [F.max[0] + pad, F.max[1] + pad, F.max[2] + pad] as V3 };
  const nearNeck = (h: number) => ({
    min: [neckP[0] - neckR * 2.6, neckP[1] - neckR * 2.6 - h, neckP[2] - neckR * 2.6] as V3,
    max: [neckP[0] + neckR * 2.6, neckP[1] + neckR * 2.6 + h, neckP[2] + neckR * 2.6 + h] as V3,
  });
  const layers: CostumeLayer[] = [];
  const extras: CostumeExtra[] = [];
  const add = (s: LayerSpec) => {
    const geo = meshLayer(F, s);
    if (geo) layers.push({ geometry: geo, frame: s.frame });
  };
  const acc = t.accent ?? '#FFF7EC';
  /** a point on the throat at this item's band (the front of its collar line) */
  const throat = (tt: number) => front(throatA, tt);
  const front = (a: number, tt: number) => {
    const from: V3 = [neckP[0] + neckD[0] * a, neckP[1] + neckD[1] * a, neckP[2] + neckD[2] * a];
    return surfacePoint(F, from, fwd, tt);
  };

  /** band round the neck: h tall, tt thick */
  const band = (h: number, tt: number, paint: (p: V3, n: V3) => string, lift = 0) =>
    add({ frame: 'body', t: tt, region: (p) => Math.max(Math.abs(alongB(p) - lift) - h / 2, clip(p)), paint, cell: 0.012, ...nearNeck(h + Math.abs(rise)) });

  /** body suit below the neck seat */
  const torso = (tt: number, paint: (p: V3, n: V3) => string, opts: { neckline?: number; legCut?: number; tail?: boolean } = {}) => {
    const neckline = opts.neckline ?? 0;
    const legCut = opts.legCut ?? (F.skinnedLegs ? legH * 0.62 : legH - 0.01);
    const coverTail = !!opts.tail && F.skinnedTail;
    add({
      frame: 'body',
      t: tt,
      region: (p) => Math.max(F.neckZone && F.neckZone(p) > 0 ? -1 : along(p) - neckline, legCut - p[1], coverTail ? -1 : F.rumpZ - p[2]),
      paint,
      cell: 0.02,
      ...all,
    });
  };

  /**
   * Puffy hood: a soft dome over the head that also swallows the ears (they show as lumps),
   * with a round opening for the face – the rim is the cut edge of the padding.
   */
  const hc: V3 = [headC[0], headC[1] + R * 0.05, headC[2] - R * 0.1];
  const puff = F.voxel ? F.voxel.u * 1.1 : 0.03;
  const smin = (a: number, b: number, k: number) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  };
  const hoodSolid = (p: V3) => {
    const q = sub(p, hc);
    const rx = R * 1.2, ry = R * 1.15, rz = R * 1.12;
    const ell = (Math.hypot(q[0] / rx, q[1] / ry, q[2] / rz) - 1) * R * 1.12;
    let d = smin(ell, F.field(p[0], p[1], p[2]) - puff, R * 0.25);
    if (F.ears) d = smin(d, F.ears(p[0], p[1], p[2]) - puff * 1.2, R * 0.35);
    return d;
  };
  const hood = (paint: (p: V3, n: V3) => string) => {
    add({
      frame: 'head',
      t: puff,
      shape: hoodSolid,
      region: (p) => {
        const q = sub(p, headC);
        const near = Math.hypot(q[0], q[1], q[2]) - R * 2.1;
        const aboveSeat = -along(p) - 0.005;
        // face opening: an oval tunnel through the front
        const hole = Math.max(R * 0.15 - q[2], Math.hypot(q[0] / (R * 0.8), (q[1] + R * 0.1) / (R * 0.76)) - 1);
        return Math.max(near, aboveSeat, -hole);
      },
      paint,
      cell: 0.016,
      min: [headC[0] - R * 2.1, headC[1] - R * 2.1, headC[2] - R * 2.1],
      max: [headC[0] + R * 2.1, headC[1] + R * 2.1, headC[2] + R * 2.1],
    });
  };
  /** a point on the hood surface, looking out from the head centre */
  const onHood = (dir: V3) => surfacePoint(F, headC, dir, 0, hoodSolid);

  /** pale tummy / chest patch for animal suits */
  const belly = (p: V3, n: V3) => n[1] < -0.55 || (n[2] > 0.4 && Math.abs(p[0] - neckP[0]) < neckR * 0.55 && along(p) < 0 && p[1] < neckP[1]);

  switch (t.kind) {
    case 'collar': {
      band(0.05, 0.026, () => t.color);
      const f = throat(0.026);
      extras.push({ kind: 'tag', pos: f.pos, n: f.n, color: acc, size: neckR * 0.5, frame: 'body' });
      break;
    }
    case 'bandana': {
      const tt = 0.028;
      // folded band + a triangle that lies on the chest
      const H = neckR * 1.5, W = neckR * 1.05;
      add({
        frame: 'body',
        t: tt,
        cell: 0.012,
        ...nearNeck(H),
        region: (p) => {
          const a = along(p) - throatA;
          const bandR = Math.abs(alongB(p)) - 0.032;
          const bib = Math.max(-a - H, a - 0.005, Math.abs(p[0] - neckP[0]) - W * (1 + Math.min(0, a) / H), -ahead(p));
          return Math.max(Math.min(bandR, bib), clip(p));
        },
        paint: (p) => {
          const a = along(p) - throatA;
          const stripe = a < -H * 0.35 && a > -H * 0.5;
          return stripe ? acc : t.color;
        },
      });
      break;
    }
    case 'scarf': {
      band(0.075, 0.042, (p) => (Math.floor((along(p) + 1) / 0.025) % 2 ? acc : t.color));
      const f = throat(0.042);
      extras.push({ kind: 'tail', pos: f.pos, n: f.n, color: t.color, accent: acc, size: neckR, frame: 'body' });
      break;
    }
    case 'medal': {
      band(0.022, 0.014, () => acc);
      const f = front(throatA - neckR * fit.drop, 0.016);
      extras.push({ kind: 'medal', pos: f.pos, n: f.n, color: t.color, size: neckR * 0.55, frame: 'body' });
      break;
    }
    case 'bowtie': {
      const f = front(0, 0.012); // on the throat, at the collar line
      extras.push({ kind: 'bow', pos: f.pos, n: f.n, color: t.color, size: neckR * 0.6, frame: 'body' });
      break;
    }
    case 'sweater': {
      torso(0.022, (p) => {
        const a = along(p);
        if (a > -0.03) return acc; // ribbed neckline
        if (p[1] < (F.skinnedLegs ? legH * 0.62 : legH) + 0.03) return acc; // hem
        return Math.floor((p[1] + 2) / 0.05) % 3 === 0 ? acc : t.color; // knit stripes
      }, { neckline: 0.01 });
      break;
    }
    case 'raincoat': {
      torso(0.024, () => t.color, { neckline: 0.004 });
      hood((p) => (p[2] - headC[2] > R * 0.0 && p[1] - headC[1] > R * 0.3 ? acc : t.color));
      for (let i = 0; i < 3; i++) {
        const f = front(-neckR * (0.6 + i * 0.75), 0.024);
        extras.push({ kind: 'button', pos: f.pos, n: f.n, color: acc, size: neckR * 0.16, frame: 'body' });
      }
      break;
    }
    case 'tuxedo': {
      torso(0.022, (p, n) => {
        const a = along(p);
        const shirt = n[2] > 0.15 && Math.abs(p[0]) < neckR * (0.55 + Math.max(0, -a) * 0.6) && p[1] > bodyY - 0.05;
        return shirt ? '#FFFFFF' : t.color;
      }, { neckline: 0.006 });
      const f = front(0, 0.022);
      extras.push({ kind: 'bow', pos: f.pos, n: f.n, color: acc, size: neckR * 0.55, frame: 'body' });
      for (let i = 0; i < 2; i++) {
        const b = front(-neckR * (0.9 + i * 0.6), 0.022);
        extras.push({ kind: 'button', pos: b.pos, n: b.n, color: '#222222', size: neckR * 0.12, frame: 'body' });
      }
      break;
    }
    case 'dino': {
      torso(0.024, (p, n) => (belly(p, n) ? acc : t.color), { neckline: 0.004, tail: true });
      hood(() => t.color);
      // spikes down the back, from the hood to the rump
      const spikeCols = ['#F08A24', '#F2C14E'];
      const zs: number[] = [];
      const z0 = F.rumpZ + 0.04, z1 = neckP[2] - neckR * 0.3;
      const nS = Math.max(3, Math.round((z1 - z0) / 0.09));
      for (let i = 0; i <= nS; i++) zs.push(z0 + ((z1 - z0) * i) / nS);
      zs.forEach((z, i) => {
        const s = surfacePoint(F, [0, bodyY, z], [0, 1, 0], 0.024);
        extras.push({ kind: 'spike', pos: s.pos, n: s.n, color: spikeCols[i % 2], size: 0.065 + 0.03 * Math.sin((Math.PI * i) / nS), frame: 'body' });
      });
      for (const [dy, dz] of [[1, -0.2], [0.8, -0.75]] as [number, number][]) {
        const s = onHood([0, dy, dz]);
        extras.push({ kind: 'spike', pos: s.pos, n: s.n, color: '#F08A24', size: R * 0.3, frame: 'head' });
      }
      for (const sx of [1, -1]) {
        const s = onHood([sx * 0.42, 0.75, 0.45]);
        extras.push({ kind: 'eye', pos: s.pos, n: s.n, color: '#2a1a10', size: R * 0.13, frame: 'head' });
      }
      break;
    }
    case 'cape': {
      band(0.035, 0.022, () => acc);
      add({
        frame: 'body',
        t: 0.026,
        // over the top of the back, from the shoulders to the rump
        region: (p) => Math.max(F.neckZone && F.neckZone(p) > 0 ? -1 : along(p) + 0.01, bodyY + R * 0.05 - p[1], F.rumpZ + 0.03 - p[2]),
        paint: (p) => (p[2] < F.rumpZ + 0.07 ? acc : t.color),
        cell: 0.02,
        ...all,
      });
      const f = front(0, 0.022);
      extras.push({ kind: 'knot', pos: f.pos, n: f.n, color: acc, size: neckR * 0.3, frame: 'body' });
      break;
    }
    case 'bee': {
      torso(0.024, (p) => (Math.floor((p[2] + 4) / 0.075) % 2 ? '#2A2220' : t.color), { neckline: 0.004 });
      hood(() => t.color);
      for (const sx of [1, -1]) {
        const s = onHood([sx * 0.35, 1, 0.15]);
        extras.push({ kind: 'antenna', pos: s.pos, n: norm([sx * 0.35, 1, 0.25]), color: '#2A2220', size: R * 0.55, frame: 'head' });
        const w = surfacePoint(F, [sx * 0.02, bodyY, neckP[2] - neckR * 1.2], [sx * 0.5, 1, 0], 0.024);
        extras.push({ kind: 'wing', pos: w.pos, n: norm([sx * 0.9, 0.7, -0.5]), color: '#EAF6FF', size: R * 0.85, frame: 'body' });
      }
      break;
    }
    case 'frog': {
      torso(0.024, (p, n) => (belly(p, n) ? acc : t.color), { neckline: 0.004, tail: true });
      hood(() => t.color);
      for (const sx of [1, -1]) {
        const s = onHood([sx * 0.5, 0.95, 0.3]);
        extras.push({ kind: 'bulbeye', pos: s.pos, n: s.n, color: '#ffffff', size: R * 0.3, frame: 'head' });
      }
      break;
    }
    case 'bear': {
      torso(0.026, (p, n) => (belly(p, n) ? acc : t.color), { neckline: 0.004, tail: true });
      hood(() => t.color);
      for (const sx of [1, -1]) {
        const s = onHood([sx * 0.75, 0.8, -0.05]);
        extras.push({ kind: 'roundear', pos: s.pos, n: s.n, color: t.color, accent: acc, size: R * 0.32, frame: 'head' });
      }
      break;
    }
    case 'harness': {
      const gz = F.girthZ ?? neckP[2] - neckR * 2.2;
      const strap = acc;
      // neck loop
      band(0.04, 0.03, () => strap, -0.012);
      const torsoOnly = (p: V3) => legH * 0.92 - p[1];
      // girth strap behind the front legs
      add({ frame: 'body', t: 0.03, cell: 0.014, ...all, region: (p) => Math.max(Math.abs(p[2] - gz) - 0.026, torsoOnly(p)), paint: () => strap });
      // padded plate over the shoulders, between the neck loop and the girth
      add({
        frame: 'body',
        t: 0.045,
        cell: 0.016,
        ...all,
        region: (p) => Math.max(Math.abs(p[0] - neckP[0]) - neckR * 0.8, gz - 0.03 - p[2], along(p) + 0.03, bodyY + neckR * 0.35 - p[1]),
        paint: (p) => (Math.abs(p[0] - neckP[0]) > neckR * 0.62 ? strap : t.color),
      });
      // chest pad from the neck loop down to the girth
      add({
        frame: 'body',
        t: 0.04,
        cell: 0.014,
        ...all,
        region: (p) => Math.max(Math.abs(p[0] - neckP[0]) - neckR * 0.32, gz - p[2], along(p) + 0.02, p[1] - (bodyY + neckR * 0.2), legH * 0.92 - p[1]),
        paint: () => t.color,
      });
      // D-ring on the back and side buckles
      const top = surfacePoint(F, [0, bodyY, gz + 0.03], [0, 1, 0], 0.045);
      extras.push({ kind: 'dring', pos: top.pos, n: top.n, color: '#C9CDD2', size: neckR * 0.32, frame: 'body' });
      for (const sx of [1, -1]) {
        const b = surfacePoint(F, [0, bodyY, gz], [sx, -0.15, 0], 0.03);
        extras.push({ kind: 'buckle', pos: b.pos, n: b.n, color: '#2B2B2B', size: neckR * 0.22, frame: 'body' });
      }
      break;
    }
    case 'unicorn': {
      torso(0.024, () => t.color, { neckline: 0.004, tail: true });
      hood(() => t.color);
      const h = onHood([0, 0.8, 0.55]);
      extras.push({ kind: 'horn', pos: h.pos, n: norm([0, 1, 0.45]), color: '#F5C542', size: R * 0.6, frame: 'head' });
      const mane = ['#FF6B8B', '#FFB84D', '#FFE66B', '#7BD389', '#6BB8FF', '#B48CFF'];
      ([[0, 1, -0.05], [0, 0.85, -0.55], [0, 0.45, -0.95], [0, 0.05, -1.05]] as V3[]).forEach((d, i) => {
        const s = onHood(d);
        extras.push({ kind: 'spike', pos: s.pos, n: s.n, color: mane[i % mane.length], size: R * 0.3, frame: 'head' });
      });
      break;
    }
  }
  return { layers, extras };
}

/** costume kinds that are built as body-shaped cloth */
export const SHELL_KINDS = new Set(['collar', 'bandana', 'scarf', 'medal', 'bowtie', 'sweater', 'raincoat', 'tuxedo', 'dino', 'cape', 'bee', 'frog', 'bear', 'unicorn', 'harness']);

/** outfits with a hood – the hood replaces any hat */
export const HOOD_KINDS = new Set(['raincoat', 'dino', 'bee', 'frog', 'bear', 'unicorn']);
export const wearsHood = (bodyId?: string | null) => !!bodyId && !!TRINKET_MAP[bodyId] && HOOD_KINDS.has(TRINKET_MAP[bodyId].kind);
