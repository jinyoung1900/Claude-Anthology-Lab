/**
 * Whole-body poses shared by both dog models.
 * The body pivots around the hind feet (z = -legZ on the ground), so:
 *  - happy  → "happy jump": rears up on the hind legs, front paws paddling, little hops
 *  - sit    → rear drops to the ground, hind legs fold forward, front legs straight
 * Values are eased every frame so poses blend smoothly into each other.
 */
import type { DogAnim } from './Dog3D';

export interface PoseState {
  /** body pitch in radians (positive = front up) */
  pitch: number;
  /** how far the rear is lowered */
  drop: number;
  /** 0..1 blend into a solved sit pose */
  sit: number;
}

/** a sit solved for the model (sculpted dogs) – see solveSit in buildDog.ts */
export interface SolvedSit {
  a: number;
  rootY: number;
  rootZ: number;
}

export interface PoseOut {
  rootRotX: number;
  rootY: number;
  rootZ: number;
  /** 0..1 how far into the solved sit (only with a SolvedSit) */
  sit: number;
  /** extra leg rotations (radians, around x) */
  front: number;
  back: number;
  headX: number;
  tailSpeed: number;
  tailAmp: number;
}

export function newPose(): PoseState {
  return { pitch: 0, drop: 0, sit: 0 };
}

export function stepPose(state: PoseState, anim: DogAnim, t: number, legZ: number, legH: number, solved?: SolvedSit): PoseOut {
  const hipDist = legZ * 2;
  let targetPitch = 0;
  let targetDrop = 0;
  if (anim === 'happy') targetPitch = 0.95 + Math.sin(t * 9) * 0.12;
  if (anim === 'sit' && !solved) {
    targetPitch = 0.55;
    targetDrop = hipDist * Math.sin(0.55) * 0.92;
  }
  const k = anim === 'happy' ? 0.2 : 0.12;
  state.pitch += (targetPitch - state.pitch) * k;
  state.drop += (targetDrop - state.drop) * k;
  state.sit += ((solved && anim === 'sit' ? 1 : 0) - state.sit) * 0.1;
  if (state.sit < 0.001) state.sit = 0;

  const a = state.pitch;
  // rotate around the hind feet: P - R·P with P = (0, 0, -legZ), θ = -a
  const zb = -legZ;
  const hop = anim === 'happy' ? Math.max(0, Math.sin(t * 9)) * 0.07 : 0;
  const rootY = -zb * Math.sin(a) * 1 - state.drop + hop;
  const rootZ = zb * (1 - Math.cos(a));

  let front = 0;
  let back = 0;
  let headX = 0;
  let tailSpeed = 4;
  let tailAmp = 0.45;
  if (anim === 'happy') {
    front = a * 0.2 - 1.0 + Math.sin(t * 16) * 0.35; // paws reaching out & paddling
    back = a; // hind legs stay planted
    headX = a * 0.55; // keep looking at you
    tailSpeed = 24;
    tailAmp = 0.9;
  } else if (anim === 'sit') {
    front = a; // straight down to the ground
    back = a - 1.45; // folded forward under the body
    headX = a * 0.6;
    tailSpeed = 3;
    tailAmp = 0.35;
  } else {
    // easing out of a pose: keep legs consistent with remaining pitch
    front = a;
    back = a - (state.drop > 0.01 ? 1.45 * (state.drop / (hipDist * Math.sin(0.55) * 0.92 || 1)) : 0);
  }
  void legH;
  if (solved && state.sit > 0) {
    // ease along the solved sit: pitch, lift and slide together so the rump never dips under
    const s = state.sit * state.sit * (3 - 2 * state.sit);
    if (anim === 'sit') {
      headX = solved.a * 0.75 * s;
      tailSpeed = 3;
      tailAmp = 0.35;
    }
    return { rootRotX: -a - solved.a * s, rootY: rootY + solved.rootY * s, rootZ: rootZ + solved.rootZ * s, sit: s, front, back, headX, tailSpeed, tailAmp };
  }
  return { rootRotX: -a, rootY, rootZ, sit: 0, front, back, headX, tailSpeed, tailAmp };
}
