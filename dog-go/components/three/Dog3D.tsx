'use client';

/** Picks the dog's look: Sculpted (default, the one-piece skinned dog) or the voxel Pixel dog. */
import type { ThreeElements } from '@react-three/fiber';
import type { DogProfile } from '@/lib/types';
import { DogSculpt } from './DogSculpt';
import { DogPixel } from './DogPixel';

export type DogAnim = 'idle' | 'walk' | 'happy' | 'sleepy' | 'sit';

export function Dog3D(props: { dog: DogProfile; anim?: DogAnim; onTap?: () => void; onPetStart?: () => void } & ThreeElements['group']) {
  const m = props.dog.model ?? 'sculpt';
  if (m === 'pixel') return <DogPixel {...props} />;
  return <DogSculpt {...props} />;
}
