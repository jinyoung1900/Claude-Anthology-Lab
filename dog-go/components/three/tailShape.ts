/**
 * Shared tail shapes for the dog models, so every model's tail reads the same way.
 * A tail is a short chain of segments; each angle is the segment's pitch above the
 * horizontal (pointing backwards, -z). Radii are a profile along the tail (f = 0 base → 1 tip).
 */
import type { TailStyle } from '@/lib/types';
import type { V3 } from './sculpt/surfaceNets';

/** segment pitches (radians above "straight back") */
export function tailAngles(style: TailStyle): number[] {
  switch (style) {
    case 'plume':
      // retriever "sabre": falls from the rump, then sweeps gently up at the end
      return [-0.8, -0.5, -0.12, 0.3];
    case 'straight':
      // carried up and back, easing upright toward the tip
      return [0.65, 0.8, 0.95, 1.05];
    default:
      return [0.6];
  }
}

/** base tail thickness – kept well below the body so it never reads as a second body */
export function tailBaseRadius(style: TailStyle, fluff: number) {
  return style === 'plume' ? 0.046 * (1 + 0.8 * fluff) : 0.038 * (1 + 0.6 * fluff);
}

/** radius along the tail, f = 0 (base) … 1 (tip) */
export function tailRadius(style: TailStyle, r: number, f: number) {
  if (style === 'plume') return r * (1 + 0.55 * Math.sin(Math.PI * Math.min(1, f * 1.15))) * (1 - 0.65 * f * f * f) + r * 0.05;
  return r * (1 - 0.6 * f);
}

/** centre line of a straight / plume tail starting at base, total length len */
export function tailPoints(style: TailStyle, base: V3, len: number): V3[] {
  const angles = tailAngles(style);
  const seg = len / angles.length;
  const pts: V3[] = [base];
  for (const a of angles) {
    const q = pts[pts.length - 1];
    pts.push([0, q[1] + Math.sin(a) * seg, q[2] - Math.cos(a) * seg]);
  }
  return pts;
}
