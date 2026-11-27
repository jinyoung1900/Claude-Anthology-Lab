/**
 * Accessory anchors computed from the dog's actual outer surface.
 *
 * Every dog model describes its shape (minus the ears) as a signed-distance field in model
 * space. We march rays out of the head, neck and back to find where the fur surface is, then
 * place each slot just outside it with a small clearance, so hats, glasses, collars and packs
 * never sink under the skin whatever the proportions / fluff / model are.
 *
 * Slot unit spaces match components/three/Trinket.tsx:
 *  head : origin near the top of the head, unit = head width
 *  face : origin on the front surface at eye level, +z out of the face, unit = head width
 *  neck : ring centre, ring in the local XZ plane (+y along the neck), unit chosen so the
 *         ring's inner edge (0.4 units) clears the neck surface
 *  back : origin on top of the back, unit = body width
 */
import type { V3 } from './sculpt/surfaceNets';

export type Field = (x: number, y: number, z: number) => number;

export interface SlotAnchor {
  pos: V3;
  rot: V3;
  scale: number;
  /** neck only: fur-surface radius (incl. clearance) at RING_N angles round the neck, model units */
  ring?: number[];
  /** neck only: mean of ring */
  rAvg?: number;
  /** neck only: ring radius straight in front (where tags / knots go) */
  frontR?: number;
  /** neck only: chest surface z relative to the band front, 0.6·rAvg and 1.2·rAvg down the neck */
  drape?: [number, number];
}
export interface DogAnchors {
  head: SlotAnchor;
  face: SlotAnchor;
  neck: SlotAnchor;
  back: SlotAnchor;
}

/** outward clearance between fur and accessory (model units) */
export const CLEARANCE = 0.014;
/** inner radius of the thickest neck ring (scarf), in neck-slot units */
const RING_INNER = 0.4;
/** samples round the neck */
export const RING_N = 24;

/** distance from o along unit dir d until the field turns positive (leaves the dog) */
export function march(f: Field, o: V3, d: V3, max = 0.9, step = 0.004) {
  if (f(o[0], o[1], o[2]) > 0) return 0;
  let t = 0;
  while (t < max) {
    t += step;
    if (f(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t) > 0) {
      // refine between t-step and t
      let lo = t - step, hi = t;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) / 2;
        if (f(o[0] + d[0] * m, o[1] + d[1] * m, o[2] + d[2] * m) > 0) hi = m;
        else lo = m;
      }
      return hi;
    }
  }
  return max;
}

/** signed distance along d to the surface: + if o is inside (exit), - if outside (surface behind o) */
function surfaceAlong(f: Field, o: V3, d: V3) {
  if (f(o[0], o[1], o[2]) <= 0) return march(f, o, d);
  return -march((x, y, z) => -f(x, y, z), o, [-d[0], -d[1], -d[2]]);
}

export interface AnchorSpec {
  /** centre of the skull (model space) */
  headC: V3;
  /** eye height (model space y) */
  eyeY: number;
  /** neck axis from chest to head (model space) */
  neckA: V3;
  neckB: V3;
  /** point inside the torso under where a pack should sit */
  backC: V3;
  /** the bare neck only (no head / chest / ruff): the band hugs this, capped against the full shape */
  neckField?: Field;
  /** 0 = chest end … 1 = head end of the neck axis */
  neckSeat?: number;
}

export function solveAnchors(f: Field, s: AnchorSpec): DogAnchors {
  const { headC, eyeY, neckA, neckB, backC } = s;
  const nf = s.neckField ?? f;

  // head
  const halfW = Math.max(march(f, headC, [1, 0, 0]), march(f, headC, [-1, 0, 0]));
  const top = march(f, headC, [0, 1, 0]);
  const headScale = 1.9 * halfW;
  const head: SlotAnchor = { pos: [headC[0], headC[1] + top - 0.2 * halfW, headC[2]], rot: [0, 0, 0], scale: headScale };

  // face: front surface at eye level, checked across where the lenses sit
  let front = 0;
  for (const x of [0, 0.4 * halfW, -0.4 * halfW]) front = Math.max(front, march(f, [headC[0] + x, eyeY, headC[2]], [0, 0, 1]));
  const face: SlotAnchor = { pos: [headC[0], eyeY, headC[2] + front + CLEARANCE], rot: [0, 0, 0], scale: headScale };

  // neck: measure the fur surface all the way round the neck so neckwear can follow its shape
  const ax = [neckB[0] - neckA[0], neckB[1] - neckA[1], neckB[2] - neckA[2]];
  const al = Math.hypot(ax[0], ax[1], ax[2]) || 1;
  const d: V3 = [ax[0] / al, ax[1] / al, ax[2] / al];
  const u: V3 = [1, 0, 0];
  const v: V3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const fwd: V3 = [-v[0], -v[1], -v[2]]; // ring-local +z (front, where tags hang)
  const ringAt = (p: V3) => {
    const raw: number[] = [];
    for (let k = 0; k < RING_N; k++) {
      // ring angle φ: 0 = +x (dog's left), 90° = front
      const phi = (k / RING_N) * Math.PI * 2;
      const c = Math.cos(phi), sn = Math.sin(phi);
      const dir: V3 = [u[0] * c + fwd[0] * sn, u[1] * c + fwd[1] * sn, u[2] * c + fwd[2] * sn];
      const rNeck = march(nf, p, dir);
      const rFull = march(f, p, dir);
      // hug fur / ruff / chest, but don't balloon where the ray runs into the head or chest
      // the front stays visible (tags / knots), so it may ride further out over a chest bulge
      const frontness = Math.max(0, sn); // 1 at the front, 0 at the sides / back
      raw.push(Math.max(rNeck, Math.min(rFull, rNeck + 0.04 + 0.08 * frontness * frontness)));
    }
    // soften the outline (circular 3-tap blur, twice), never moving inward
    let r = raw.slice();
    for (let it = 0; it < 2; it++) r = r.map((x, k) => Math.max(raw[k], (r[(k + RING_N - 1) % RING_N] + 2 * x + r[(k + 1) % RING_N]) / 4));
    return r.map((x) => x + CLEARANCE);
  };
  // pick the slimmest seat along the neck (fluffy ruffs often swallow the lower neck)
  let p: V3 = [0, 0, 0];
  let ring: number[] = [];
  let bestScore = Infinity;
  const seats = s.neckSeat !== undefined ? [s.neckSeat] : [0.3, 0.375, 0.45, 0.525, 0.6, 0.675, 0.75];
  for (const t of seats) {
    const q: V3 = [neckA[0] + ax[0] * t, neckA[1] + ax[1] * t, neckA[2] + ax[2] * t];
    const r = ringAt(q);
    const score = r.reduce((a2, b2) => a2 + b2, 0) / RING_N + Math.abs(t - 0.45) * 0.02;
    if (score < bestScore) {
      bestScore = score;
      p = q;
      ring = r;
    }
  }
  const rAvg = ring.reduce((a2, b2) => a2 + b2, 0) / RING_N;
  const frontR = ring[RING_N / 4];
  // where the chest is, relative to the band's front, a little way down the neck
  const dropAt = (h: number): number => {
    const q: V3 = [p[0] - d[0] * h, p[1] - d[1] * h, p[2] - d[2] * h];
    return surfaceAlong(f, q, fwd) + CLEARANCE - frontR;
  };
  const neck: SlotAnchor = {
    pos: p,
    rot: [Math.atan2(d[2], d[1]), 0, 0],
    scale: rAvg / RING_INNER,
    ring,
    rAvg,
    frontR,
    drape: [dropAt(rAvg * 0.6), dropAt(rAvg * 1.2)],
  };

  // back
  const backTop = march(f, backC, [0, 1, 0]);
  const halfBW = Math.max(march(f, backC, [1, 0, 0]), march(f, backC, [-1, 0, 0]));
  const back: SlotAnchor = { pos: [backC[0], backC[1] + backTop + CLEARANCE * 0.5, backC[2]], rot: [0, 0, 0], scale: 2 * halfBW };

  return { head, face, neck, back };
}

/** express an anchor relative to a group whose (unrotated) origin sits at `origin` */
export function localTo(a: SlotAnchor, origin: V3): SlotAnchor {
  return { ...a, pos: [a.pos[0] - origin[0], a.pos[1] - origin[1], a.pos[2] - origin[2]] };
}

/** signed distance to a torus with centre c, unit axis n, ring radius R, tube radius r */
export function sdTorus(x: number, y: number, z: number, c: V3, n: V3, R: number, r: number) {
  const px = x - c[0], py = y - c[1], pz = z - c[2];
  const h = px * n[0] + py * n[1] + pz * n[2];
  const qx = px - n[0] * h, qy = py - n[1] * h, qz = pz - n[2] * h;
  const ring = Math.hypot(qx, qy, qz) - R;
  return Math.hypot(ring, h) - r;
}
