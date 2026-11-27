/**
 * Builds the "sculpted" dog: one seamless skinned mesh.
 *
 * 1. The dog's shape options become a list of soft parts (each tied to a bone).
 * 2. The parts are smooth-unioned into one distance field and meshed with surface nets.
 * 3. Every vertex gets skin weights from its distance to each part, so bending a leg bone
 *    pulls the hip smoothly instead of rotating a separate block.
 * 4. Extra per-vertex data drives the shader: a front-projected face-photo UV + weight,
 *    and an accent weight for chest / socks / tail-tip markings.
 *
 * Faces +Z, feet at y = 0 – same frame as the other dog models.
 */
import * as THREE from 'three';
import type { DogProfile } from '@/lib/types';
import { EYE_LINE, NOSE_DOT } from '@/components/TwoBoxCropper';
import { sdEllipsoid, sdRoundCone, smin, surfaceNets, type V3 } from './surfaceNets';
import { solveAnchors, type DogAnchors } from '../anchors';
import { tailBaseRadius, tailPoints, tailRadius } from '../tailShape';
import type { DogFrame } from '../costume';

interface PartBase {
  bone: number;
  /** smooth-union radius with everything before it */
  k: number;
  /** optional anisotropic squash: compress along axis by factor f around c */
  squash?: { c: V3; axis: V3; f: number };
  /** neck-region part (used to seat collars) */
  neck?: boolean;
}
type Part = PartBase &
  ({ kind: 'ell'; c: V3; r: V3 } | { kind: 'cone'; a: V3; b: V3; r1: number; r2: number } | { kind: 'rbox'; c: V3; h: V3; r: number; rotZ?: number });

/** rounded box (optionally tilted about z) */
function sdRBox(x: number, y: number, z: number, c: V3, h: V3, r: number, rotZ = 0) {
  let px = x - c[0], py = y - c[1];
  const pz = z - c[2];
  if (rotZ) {
    const cs = Math.cos(-rotZ), sn = Math.sin(-rotZ);
    [px, py] = [px * cs - py * sn, px * sn + py * cs];
  }
  const qx = Math.abs(px) - h[0], qy = Math.abs(py) - h[1], qz = Math.abs(pz) - h[2];
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

export interface BoneDef {
  name: string;
  parent: number;
  /** rest position in model space */
  pos: V3;
}

export interface SculptBuild {
  geometry: THREE.BufferGeometry;
  bones: BoneDef[];
  BODY: number;
  HEAD: number;
  EARS: [number, number];
  /** upper leg (hip / shoulder) bones, then the knee and paw bone of each leg */
  LEGS: number[];
  KNEES: number[];
  PAWS: number[];
  TAILS: number[];
  /** ears are their own mesh, rigid on the ear bones, so they can flop freely */
  earGeometry: THREE.BufferGeometry;
  /** a sit pose solved for this body: rump on the ground, front legs straight, hind legs folded */
  sit: SitPose;
  legZ: number;
  legH: number;
  bodyY: number;
  br: number;
  L: number;
  R: number;
  headC: V3;
  /** accessory anchors in model space (see anchors.ts) */
  anchors: DogAnchors;
  /** shape info for body-shaped costumes */
  frame: DogFrame;
  /** skin weights for extra meshes (costumes) bound to the same skeleton */
  skinFor: (positions: ArrayLike<number>) => { skinIndex: Uint16Array; skinWeight: Float32Array };
}

export interface SitPose {
  /** body pitch (front up) */
  a: number;
  rootY: number;
  rootZ: number;
  /** local rotations (x) of the hind upper leg, knee and paw; front legs counter the pitch */
  bu: number;
  bk: number;
  bp: number;
}

function partDist(p: Part, x: number, y: number, z: number) {
  let s = 1;
  if (p.squash) {
    const { c, axis, f } = p.squash;
    const qx = x - c[0], qy = y - c[1], qz = z - c[2];
    const d = (qx * axis[0] + qy * axis[1] + qz * axis[2]) * (1 / f - 1);
    x += axis[0] * d;
    y += axis[1] * d;
    z += axis[2] * d;
    s = f;
  }
  const d = p.kind === 'ell' ? sdEllipsoid(x, y, z, p.c, p.r) : p.kind === 'rbox' ? sdRBox(x, y, z, p.c, p.h, p.r, p.rotZ) : sdRoundCone(x, y, z, p.a, p.b, p.r1, p.r2);
  return d * s;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const cache = new Map<string, SculptBuild>();

/** body-shape flavour of the one-piece dog */
export type SculptShape = 'sculpt' | 'toon' | 'plush';
const SHAPE: Record<SculptShape, { head: number; body: number; leg: number; legW: number; snout: number; boxy?: boolean }> = {
  // default: round body & legs, softly squared muzzle and ears (hats sit above the ears)
  sculpt: { head: 0.88, body: 1, leg: 1, legW: 1.05, snout: 1, boxy: true },
  // cartoon: big expressive head, slightly slimmer limbs
  toon: { head: 1.16, body: 0.97, leg: 0.95, legW: 0.92, snout: 0.9 },
  // stuffed toy: big round head, chubby body, short stubby legs, short muzzle
  plush: { head: 1.22, body: 1.14, leg: 0.68, legW: 1.25, snout: 0.7 },
};

export function sculptKey(dog: DogProfile, shape: SculptShape = 'sculpt') {
  const p = dog.proportions;
  const m = dog.markings ?? { chest: false, socks: false, tailTip: false };
  return [shape, p.bodyLength, p.legLength, p.earSize, p.tailLength, dog.fluff ?? 0.2, dog.earStyle, dog.tailStyle ?? 'straight', +m.chest, +m.socks, +m.tailTip]
    .map((v) => (typeof v === 'number' ? v.toFixed(3) : v))
    .join('|');
}

export function buildSculptDog(dog: DogProfile, shape: SculptShape = 'sculpt'): SculptBuild {
  const key = sculptKey(dog, shape);
  const S = SHAPE[shape];
  const hit = cache.get(key);
  if (hit) return hit;

  const p = dog.proportions;
  const fluff = dog.fluff ?? 0.2;
  const tailStyle = dog.tailStyle ?? 'straight';
  const marks = dog.markings ?? { chest: false, socks: false, tailTip: false };

  // same core measurements as the round model so poses & trinkets line up
  const R = 0.26 * S.head;
  const br = 0.2 * (1 + 0.3 * fluff) * S.body;
  const L = 0.5 * p.bodyLength;
  const legH = 0.34 * p.legLength * S.leg;
  const legR = 0.064 * (1 + 0.3 * fluff) * S.legW;
  const bodyY = legH + br * 0.7;
  const tailLen = 0.36 * p.tailLength;
  const tailR = tailBaseRadius(tailStyle, fluff);
  const earS = p.earSize;
  const headC: V3 = [0, bodyY + br * 0.75 + R * 0.55, L / 2 + br * 0.55];
  const legX = br * 0.55;
  const legZ = L / 2 + br * 0.15;

  // ---- bones ----
  const bones: BoneDef[] = [];
  const bone = (name: string, parent: number, pos: V3) => bones.push({ name, parent, pos }) - 1;
  const ROOT = bone('root', -1, [0, 0, 0]);
  const BODY = bone('body', ROOT, [0, bodyY, 0]);
  const HEAD = bone('head', BODY, headC);
  const earPivot = (s: number): V3 =>
    dog.earStyle === 'pointy' ? [s * R * 0.52, headC[1] + R * 0.62, headC[2] - R * 0.12] : [s * R * 0.9, headC[1] + R * 0.28, headC[2] - R * 0.06];
  const EARS: [number, number] = [bone('earL', HEAD, earPivot(1)), bone('earR', HEAD, earPivot(-1))];
  const legSpots: [number, number][] = [
    [legX, legZ],
    [-legX, legZ],
    [legX, -legZ],
    [-legX, -legZ],
  ];
  // three joints per leg: hip / shoulder, knee / elbow, and the paw (wrist / hock)
  const kneeY = legH * 0.5;
  const ankleY = legR * 1.05;
  const LEGS = legSpots.map(([x, z], i) => bone(`leg${i}`, ROOT, [x, legH, z]));
  const KNEES = legSpots.map(([x, z], i) => bone(`knee${i}`, LEGS[i], [x, kneeY, z]));
  const PAWS = legSpots.map(([x, z], i) => bone(`paw${i}`, KNEES[i], [x, ankleY, z]));
  const LEG_ALL = [...LEGS, ...KNEES, ...PAWS];

  // tail as a short chain following a curve
  const tailBase: V3 = [0, bodyY + br * 0.55, -L / 2 - br * 0.6];
  let tailPts: V3[] = [tailBase];
  if (tailStyle === 'stub') {
    tailPts.push([0, tailBase[1] + 0.02, tailBase[2] - 0.05]);
  } else if (tailStyle === 'curled') {
    const rad = 0.08 * p.tailLength + 0.04;
    const c: V3 = [0, tailBase[1] + rad, tailBase[2]];
    for (let i = 1; i <= 4; i++) {
      const a = -Math.PI / 2 + (i / 4) * Math.PI * 1.45; // from straight back, up and over
      tailPts.push([0, c[1] + Math.sin(a) * rad, c[2] - Math.cos(a) * rad]);
    }
  } else {
    tailPts = tailPoints(tailStyle, tailBase, tailLen);
  }
  const TAILS: number[] = [];
  for (let i = 0; i < tailPts.length - 1; i++) TAILS.push(bone(`tail${i}`, i === 0 ? BODY : TAILS[i - 1], tailPts[i]));

  // ---- parts ----
  const parts: Part[] = [];
  const X: V3 = [1, 0, 0];
  const Z: V3 = [0, 0, 1];
  // torso
  parts.push({ kind: 'cone', a: [0, bodyY, -L / 2], b: [0, bodyY + 0.01, L / 2], r1: br * 0.94, r2: br, bone: BODY, k: 0, squash: { c: [0, bodyY, 0], axis: X, f: 0.9 } });
  parts.push({ kind: 'ell', c: [0, bodyY + 0.025, L / 2 + br * 0.12], r: [br * 0.98, br * 1.06, br], bone: BODY, k: 0.08 });
  parts.push({ kind: 'ell', c: [0, bodyY + 0.01, -L / 2 - br * 0.05], r: [br * 0.95, br * 0.98, br * 0.95], bone: BODY, k: 0.08 });
  // neck → head
  const neckA: V3 = [0, bodyY + br * 0.35, L / 2 + br * 0.2];
  const neckB: V3 = [0, headC[1] - R * 0.35, headC[2] - R * 0.2];
  parts.push({ neck: true, kind: 'cone', a: neckA, b: neckB, r1: br * 0.72 * (1 + 0.35 * fluff), r2: R * 0.62, bone: BODY, k: 0.1 });
  if (fluff > 0.15)
    parts.push({ neck: true, kind: 'ell', c: [0, bodyY + br * 0.55, L / 2 + br * 0.38], r: [br * (0.86 + 0.35 * fluff), br * (0.72 + 0.2 * fluff), br * 0.72], bone: BODY, k: 0.09 });
  parts.push({ kind: 'ell', c: headC, r: [R * 1.02, R * 0.93, R * 0.9], bone: HEAD, k: 0.09 });
  // snout: short tapered muzzle
  const snoutA: V3 = [0, headC[1] - R * 0.26, headC[2] + R * 0.36];
  const snoutB: V3 = [0, headC[1] - R * 0.34, headC[2] + R * (0.36 + 0.76 * S.snout)];
  if (S.boxy)
    // softly squared muzzle
    parts.push({ kind: 'rbox', c: [0, headC[1] - R * 0.31, headC[2] + R * 0.9], h: [R * 0.27, R * 0.16, R * 0.48], r: R * 0.17, bone: HEAD, k: 0.09 });
  else parts.push({ kind: 'cone', a: snoutA, b: snoutB, r1: R * 0.47, r2: R * 0.3, bone: HEAD, k: 0.07, squash: { c: snoutA, axis: [0, 1, 0], f: 0.88 } });
  if (fluff > 0.4)
    for (const s of [1, -1]) parts.push({ kind: 'ell', c: [s * R * 0.68, headC[1] - R * 0.32, headC[2] + R * 0.02], r: [R * 0.4, R * 0.38, R * 0.42], bone: HEAD, k: 0.07 });
  // ears
  [1, -1].forEach((s, i) => {
    const piv = earPivot(s);
    if (dog.earStyle === 'pointy') {
      const tip: V3 = [piv[0] + s * 0.05 * earS, piv[1] + 0.22 * earS, piv[2] - 0.03];
      parts.push({ kind: 'cone', a: piv, b: tip, r1: 0.078, r2: 0.014, bone: EARS[i], k: 0.035, squash: { c: piv, axis: Z, f: 0.48 } });
    } else {
      const a: V3 = [piv[0] + s * 0.03, piv[1], piv[2]];
      const b: V3 = [piv[0] + s * 0.08, piv[1] - 0.22 * earS, piv[2] + 0.015];
      if (S.boxy)
        // flat, softly squared flap hanging from the side of the head
        parts.push({ kind: 'rbox', c: [piv[0] + s * 0.035, piv[1] - 0.1 * earS, piv[2] + 0.01], h: [0.016, 0.1 * earS, 0.06], r: 0.016, rotZ: s * 0.16, bone: EARS[i], k: 0.02 });
      else parts.push({ kind: 'cone', a, b, r1: 0.055, r2: 0.075 * Math.sqrt(earS), bone: EARS[i], k: 0.025, squash: { c: a, axis: X, f: 0.5 } });
    }
  });
  // legs + paws
  legSpots.forEach(([x, z], i) => {
    const back = i >= 2;
    const top = legR * (back ? 1.55 : 1.25);
    const mid = legR * (back ? 1.12 : 1.06);
    parts.push({ kind: 'cone', a: [x, legH + br * 0.15, z - (back ? 0.02 : 0)], b: [x, kneeY, z], r1: top, r2: mid, bone: LEGS[i], k: 0.07 });
    parts.push({ kind: 'cone', a: [x, kneeY, z], b: [x, ankleY, z], r1: mid, r2: legR, bone: KNEES[i], k: 0.03 });
    parts.push({ kind: 'ell', c: [x, legR * 0.72, z + legR * 0.35], r: [legR * 1.2, legR * 0.75, legR * 1.55], bone: PAWS[i], k: 0.035 });
  });
  // tail
  if (tailStyle === 'stub') parts.push({ kind: 'ell', c: tailPts[1], r: [tailR * 2.2, tailR * 2.1, tailR * 2.2], bone: TAILS[0], k: 0.05 });
  else
    for (let i = 0; i < TAILS.length; i++) {
      const f0 = i / TAILS.length, f1 = (i + 1) / TAILS.length;
      const rr = (f: number) => tailRadius(tailStyle, tailR, f);
      // plume: feathered – deeper than it is wide
      const squash = tailStyle === 'plume' ? { c: tailPts[i], axis: [1, 0, 0] as V3, f: 0.7 } : undefined;
      parts.push({ kind: 'cone', a: tailPts[i], b: tailPts[i + 1], r1: rr(f0), r2: rr(f1), bone: TAILS[i], k: i === 0 ? 0.05 : 0.025, squash });
    }

  // ---- field + mesh ----
  const isEar = (pt: Part) => pt.bone === EARS[0] || pt.bone === EARS[1];
  const bodyParts = parts.filter((pt) => !isEar(pt));
  const field = (x: number, y: number, z: number) => {
    let d = Infinity;
    for (const pt of bodyParts) d = smin(d, partDist(pt, x, y, z), pt.k);
    return d;
  };
  let mn: V3 = [Infinity, Infinity, Infinity];
  let mx: V3 = [-Infinity, -Infinity, -Infinity];
  for (const b of bones) {
    mn = [Math.min(mn[0], b.pos[0]), Math.min(mn[1], b.pos[1]), Math.min(mn[2], b.pos[2])];
    mx = [Math.max(mx[0], b.pos[0]), Math.max(mx[1], b.pos[1]), Math.max(mx[2], b.pos[2])];
  }
  for (const pt of tailPts) {
    mn = [mn[0], mn[1], Math.min(mn[2], pt[2])];
    mx = [mx[0], Math.max(mx[1], pt[1]), mx[2]];
  }
  const pad = 0.3;
  const cell = 0.022; // fine enough to read as smooth and round
  const net = surfaceNets(field, [-0.45, -cell * 2, mn[2] - pad], [0.45, mx[1] + pad, headC[2] + R * 1.6 + cell * 2], cell);

  // ---- skin weights + shader attributes ----
  const nV = net.positions.length / 3;
  const skinIndex = new Uint16Array(nV * 4);
  const skinWeight = new Float32Array(nV * 4);
  const faceUv = new Float32Array(nV * 2);
  const faceW = new Float32Array(nV);
  const accentW = new Float32Array(nV);

  // front projection: eye line & nose dot of the crop land on the eyes and nose tip
  const eyeY = headC[1] + R * 0.16;
  const noseY = headC[1] - R * (S.boxy ? 0.3 : 0.26);
  const vEye = 1 - EYE_LINE, vNose = 1 - NOSE_DOT;
  const uvScale = (vEye - vNose) / (eyeY - noseY);

  const sigma = 0.022;
  const bw = new Float32Array(bones.length);
  const dists = new Float32Array(parts.length);
  for (let v = 0; v < nV; v++) {
    const x = net.positions[v * 3], y = net.positions[v * 3 + 1], z = net.positions[v * 3 + 2];
    const nz = net.normals[v * 3 + 2];
    let dmin = Infinity;
    for (let i = 0; i < bodyParts.length; i++) {
      dists[i] = partDist(bodyParts[i], x, y, z);
      if (dists[i] < dmin) dmin = dists[i];
    }
    bw.fill(0);
    for (let i = 0; i < bodyParts.length; i++) bw[bodyParts[i].bone] += Math.exp(-(dists[i] - dmin) / sigma);
    let total = 0;
    for (let b = 0; b < bones.length; b++) total += bw[b];
    for (let b = 0; b < bones.length; b++) bw[b] /= total;

    // top-4 bones
    const order = Array.from(bw.keys()).sort((a, b) => bw[b] - bw[a]).slice(0, 4);
    const s4 = order.reduce((s, b) => s + bw[b], 0) || 1;
    order.forEach((b, j) => {
      skinIndex[v * 4 + j] = b;
      skinWeight[v * 4 + j] = bw[b] / s4;
    });

    // face photo: only on the forward-facing part of the head & muzzle
    const u = 0.5 + x * uvScale;
    const vv = vEye + (y - eyeY) * uvScale;
    faceUv[v * 2] = u;
    faceUv[v * 2 + 1] = vv;
    faceW[v] = bw[HEAD] * smooth(0.05, 0.5, nz) * smooth(headC[2] - R * 0.3, headC[2] + R * 0.2, z);

    // markings
    let a = 0;
    if (marks.chest) a = Math.max(a, bw[BODY] * smooth(0.15, 0.55, nz) * smooth(L / 2 - br * 0.1, L / 2 + br * 0.6, z) * smooth(bodyY + br * 0.7, bodyY - br * 0.1, y));
    if (marks.socks) a = Math.max(a, LEG_ALL.reduce((s, b) => s + bw[b], 0) * smooth(legH * 0.42, legH * 0.3, y));
    if (marks.tailTip && TAILS.length > 1) a = Math.max(a, bw[TAILS[TAILS.length - 1]]);
    accentW[v] = Math.min(1, a);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(net.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(net.normals, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  g.setAttribute('faceUv', new THREE.BufferAttribute(faceUv, 2));
  g.setAttribute('faceW', new THREE.BufferAttribute(faceW, 1));
  g.setAttribute('accentW', new THREE.BufferAttribute(accentW, 1));
  g.setIndex(new THREE.BufferAttribute(net.indices, 1));
  g.computeBoundingSphere();

  // accessories sit on the fur surface (ears left out so hats don't balloon over them)
  const noEars = parts.filter((pt) => pt.bone !== EARS[0] && pt.bone !== EARS[1]);
  const anchorField = (x: number, y: number, z: number) => {
    let d = Infinity;
    for (const pt of noEars) d = smin(d, partDist(pt, x, y, z), pt.k);
    return d;
  };
  const earParts = parts.filter((pt) => pt.bone === EARS[0] || pt.bone === EARS[1]);
  const earField = (x: number, y: number, z: number) => {
    let d = Infinity;
    for (const pt of earParts) d = Math.min(d, partDist(pt, x, y, z));
    return d;
  };
  const neckParts = noEars.filter((pt) => pt.neck && pt.kind === 'cone');
  const neckField = (x: number, y: number, z: number) => {
    let d = Infinity;
    for (const pt of neckParts) d = smin(d, partDist(pt, x, y, z), pt.k);
    return d;
  };
  const anchors = solveAnchors(anchorField, { headC, eyeY, neckA, neckB, backC: [0, bodyY, -0.02], neckField });

  const skinFor = (pos: ArrayLike<number>) => {
    const n = pos.length / 3;
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const w = new Float32Array(bones.length);
    for (let v = 0; v < n; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      let dmin = Infinity;
      const ds = bodyParts.map((pt) => {
        const dd = partDist(pt, x, y, z);
        if (dd < dmin) dmin = dd;
        return dd;
      });
      w.fill(0);
      ds.forEach((dd, i) => (w[bodyParts[i].bone] += Math.exp(-(dd - dmin) / sigma)));
      const order = Array.from(w.keys()).sort((a, b) => w[b] - w[a]).slice(0, 4);
      const s4 = order.reduce((acc, b) => acc + w[b], 0) || 1;
      order.forEach((b, j) => {
        si[v * 4 + j] = b;
        sw[v * 4 + j] = w[b] / s4;
      });
    }
    return { skinIndex: si, skinWeight: sw };
  };
  let bmin: V3 = [Infinity, Infinity, Infinity], bmax: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < net.positions.length; i += 3) {
    bmin = [Math.min(bmin[0], net.positions[i]), Math.min(bmin[1], net.positions[i + 1]), Math.min(bmin[2], net.positions[i + 2])];
    bmax = [Math.max(bmax[0], net.positions[i]), Math.max(bmax[1], net.positions[i + 1]), Math.max(bmax[2], net.positions[i + 2])];
  }
  const nr = anchors.neck.rot[0];
  const frame: DogFrame = {
    field: anchorField,
    ears: earField,
    girthZ: legZ - legR * 2.3,
    neckP: anchors.neck.pos,
    neckD: [0, Math.cos(nr), Math.sin(nr)],
    neckR: anchors.neck.rAvg ?? br * 0.7,
    headC,
    R,
    bodyY,
    legH,
    rumpZ: -L / 2 - br * 0.75,
    skinnedTail: true,
    skinnedLegs: true,
    min: bmin,
    max: bmax,
  };

  // ---- ears: own mesh, every vertex rigid on its ear bone ----
  const earMesh = surfaceNets(
    (x, y, z) => {
      let d = Infinity;
      for (const pt of earParts) d = smin(d, partDist(pt, x, y, z), pt.k);
      return d;
    },
    [-0.45, headC[1] - R * 2.2, headC[2] - R * 1.4],
    [0.45, headC[1] + R * 2.6, headC[2] + R * 1.0],
    0.016,
  );
  const nE = earMesh.positions.length / 3;
  const eIdx = new Uint16Array(nE * 4);
  const eW = new Float32Array(nE * 4);
  for (let v = 0; v < nE; v++) {
    eIdx[v * 4] = earMesh.positions[v * 3] > 0 ? EARS[0] : EARS[1];
    eW[v * 4] = 1;
  }
  const earGeometry = new THREE.BufferGeometry();
  earGeometry.setAttribute('position', new THREE.BufferAttribute(earMesh.positions, 3));
  earGeometry.setAttribute('normal', new THREE.BufferAttribute(earMesh.normals, 3));
  earGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(eIdx, 4));
  earGeometry.setAttribute('skinWeight', new THREE.BufferAttribute(eW, 4));
  earGeometry.setAttribute('faceUv', new THREE.BufferAttribute(new Float32Array(nE * 2), 2));
  earGeometry.setAttribute('faceW', new THREE.BufferAttribute(new Float32Array(nE), 1));
  earGeometry.setAttribute('accentW', new THREE.BufferAttribute(new Float32Array(nE), 1));
  earGeometry.setIndex(new THREE.BufferAttribute(earMesh.indices, 1));
  earGeometry.computeBoundingSphere();

  const sit = solveSit({ bodyY, br, L, legH, legZ, legR, kneeY, ankleY });

  const out: SculptBuild = { geometry: g, bones, BODY, HEAD, EARS, LEGS, KNEES, PAWS, TAILS, earGeometry, sit, legZ, legH, bodyY, br, L, R, headC, anchors, frame, skinFor };
  cache.set(key, out);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  return out;
}

/**
 * Sit pose for one body shape. The whole dog pitches front-up around the model origin, then:
 *  - is lifted so the bottom of the rump just touches the ground (no sinking in),
 *  - the pitch is chosen so the straight, vertical front legs end exactly on the ground,
 *  - the hind leg folds: thigh forward along the ground, shin back to the hock, paw flat.
 */
function solveSit(m: { bodyY: number; br: number; L: number; legH: number; legZ: number; legR: number; kneeY: number; ankleY: number }): SitPose {
  const { bodyY, br, L, legH, legZ, legR, kneeY, ankleY } = m;
  // world (y, z) of a rest point after pitching by a (rotation.x = -a)
  const rot = (y: number, z: number, a: number): [number, number] => [y * Math.cos(a) + z * Math.sin(a), -y * Math.sin(a) + z * Math.cos(a)];
  const lift = (a: number) => {
    // lowest rear points: rump ellipsoid and the top of the hind thigh
    const rump = rot(bodyY + 0.01, -L / 2 - br * 0.05, a)[0] - br * 0.97;
    const thigh = rot(legH + br * 0.15, -legZ - 0.02, a)[0] - legR * 1.55;
    return -Math.min(rump, thigh) + 0.004;
  };
  // pitch: front shoulder pivot ends one leg length above the ground
  let lo = 0.15, hi = 1.15;
  for (let i = 0; i < 30; i++) {
    const a = (lo + hi) / 2;
    const f = rot(legH, legZ, a)[0] + lift(a) - legH;
    if (f > 0) hi = a;
    else lo = a;
  }
  const a = (lo + hi) / 2;
  const rootY = lift(a);
  // keep the hind hips over where the hind feet stood
  const hip = rot(legH, -legZ, a);
  const rootZ = -legZ - hip[1];
  const hy = hip[0] + rootY, hz = -legZ;
  const l1 = legH - kneeY, l2 = kneeY - ankleY;
  const dir = (th: number): [number, number] => [-Math.cos(th), -Math.sin(th)];
  let best = { e: Infinity, u: -1, f: 2.4 };
  for (let u = -1.55; u <= -0.2; u += 0.02)
    for (let f = 1.4; f <= 2.95; f += 0.03) {
      const d1 = dir(u), d2 = dir(u + f);
      const ky = hy + l1 * d1[0];
      const ay = ky + l2 * d2[0], az = hz + l1 * d1[1] + l2 * d2[1];
      const e = (ay - ankleY * 0.95) ** 2 * 40 + Math.max(0, legR * 1.1 - ky) ** 2 * 80 + (az - hz) ** 2 * 2 + (u + 1.05) ** 2 * 0.02;
      if (e < best.e) best = { e, u, f };
    }
  return { a, rootY, rootZ, bu: best.u + a, bk: best.f, bp: -(best.u + best.f) };
}
