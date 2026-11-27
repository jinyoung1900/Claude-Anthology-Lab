/**
 * Breed shape presets + procedural pixel faces/fur for dogs made without a photo.
 * With a photo, picking a breed only changes the body shape (textures come from the crops).
 */
import type { BreedId, DogMarkings, DogProfile, DogProportions, EarStyle, TailStyle } from './types';

export interface Palette {
  base: string;
  light: string;
  dark: string;
}

export type FaceMask = 'golden' | 'husky' | 'corgi' | 'plain';

export interface BreedPreset {
  id: Exclude<BreedId, 'custom'>;
  label: string;
  emoji: string;
  proportions: DogProportions;
  earStyle: EarStyle;
  tailStyle: TailStyle;
  fluff: number;
  palette: Palette;
  mask: FaceMask;
  accentColor: string;
  markings: DogMarkings;
}

export const BREEDS: BreedPreset[] = [
  {
    id: 'golden', label: 'Golden retriever', emoji: '🐕',
    proportions: { bodyLength: 1.15, legLength: 1.05, earSize: 1.2, tailLength: 1.4 },
    earStyle: 'floppy', tailStyle: 'plume', fluff: 0.45,
    palette: { base: '#D99A45', light: '#F2D3A0', dark: '#B87430' }, mask: 'golden',
    accentColor: '#F2D3A0', markings: { chest: true, socks: false, tailTip: false },
  },
  {
    id: 'corgi', label: 'Corgi', emoji: '🦊',
    proportions: { bodyLength: 1.25, legLength: 0.45, earSize: 1.35, tailLength: 0.25 },
    earStyle: 'pointy', tailStyle: 'stub', fluff: 0.3,
    palette: { base: '#E08A3C', light: '#FFF3E0', dark: '#B8652A' }, mask: 'corgi',
    accentColor: '#FFF3E0', markings: { chest: true, socks: true, tailTip: false },
  },
  {
    id: 'husky', label: 'Husky', emoji: '🐺',
    proportions: { bodyLength: 1.1, legLength: 1.1, earSize: 1.1, tailLength: 1.1 },
    earStyle: 'pointy', tailStyle: 'curled', fluff: 0.6,
    palette: { base: '#6F7782', light: '#F4F4F4', dark: '#3E444C' }, mask: 'husky',
    accentColor: '#F4F4F4', markings: { chest: true, socks: true, tailTip: true },
  },
  {
    id: 'dachshund', label: 'Dachshund', emoji: '🌭',
    proportions: { bodyLength: 1.6, legLength: 0.4, earSize: 1.3, tailLength: 0.9 },
    earStyle: 'floppy', tailStyle: 'straight', fluff: 0,
    palette: { base: '#8B4A22', light: '#C98A55', dark: '#5E2F14' }, mask: 'plain',
    accentColor: '#C98A55', markings: { chest: false, socks: false, tailTip: false },
  },
  {
    id: 'lab', label: 'Black lab', emoji: '🐾',
    proportions: { bodyLength: 1.1, legLength: 1.05, earSize: 1.0, tailLength: 1.2 },
    earStyle: 'floppy', tailStyle: 'straight', fluff: 0.1,
    palette: { base: '#2B2522', light: '#4A403B', dark: '#1A1614' }, mask: 'plain',
    accentColor: '#4A403B', markings: { chest: false, socks: false, tailTip: false },
  },
];

export const BREED_MAP = Object.fromEntries(BREEDS.map((b) => [b.id, b])) as Record<Exclude<BreedId, 'custom'>, BreedPreset>;

/** 16x16-grid pixel face matching the cropper's eye-line (~40%) and nose-dot (~62%). */
export function makePupFace(p: Palette, mask: FaceMask, size = 128): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const u = size / 16;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * u, y * u, w * u, h * u);
  };
  px(0, 0, 16, 16, p.base);

  if (mask === 'golden') {
    px(0, 0, 16, 2, p.dark); px(0, 0, 2, 16, p.dark); px(14, 0, 2, 16, p.dark); px(6, 2, 4, 1, p.dark);
    px(3.5, 4.5, 2.5, 0.8, p.light); px(10, 4.5, 2.5, 0.8, p.light);
    px(4, 8, 8, 6, p.light); px(5, 7, 6, 1, p.light); px(5, 14, 6, 1, p.light);
  } else if (mask === 'husky') {
    // white face mask with dark cap
    px(0, 0, 16, 16, p.dark);
    px(2, 6, 12, 10, p.light); px(6, 2, 4, 6, p.light); px(3, 4.2, 3, 1, p.light); px(10, 4.2, 3, 1, p.light);
  } else if (mask === 'corgi') {
    px(6.5, 1, 3, 7, p.light); px(4, 8, 8, 8, p.light); px(5, 7, 6, 1, p.light);
  } else {
    px(4, 8, 8, 6, p.light); px(0, 0, 16, 1.5, p.dark);
  }

  const eye = mask === 'husky' ? '#3E7CC9' : '#3a2214';
  px(4, 5.6, 2, 2, '#1d1410'); px(10, 5.6, 2, 2, '#1d1410');
  px(4.3, 5.9, 1.4, 1.4, eye); px(10.3, 5.9, 1.4, 1.4, eye);
  px(4.4, 5.8, 0.6, 0.6, '#ffffff'); px(10.4, 5.8, 0.6, 0.6, '#ffffff');
  // nose
  px(6.5, 8.8, 3, 2, '#1d1410'); px(7, 10.8, 2, 0.4, '#1d1410'); px(7.1, 9, 0.8, 0.5, '#5a4a44');
  // mouth + tongue
  px(7.7, 11, 0.6, 1, '#1d1410'); px(6.2, 11.8, 1.5, 0.5, '#1d1410'); px(8.3, 11.8, 1.5, 0.5, '#1d1410');
  px(7.3, 12.3, 1.4, 1.2, '#E86A7E');
  return c.toDataURL('image/png');
}

/** Coat swatch with feathered streaks. */
export function makePupFur(p: Palette, size = 32): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 3; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    ctx.fillStyle = Math.random() > 0.5 ? p.light + '66' : p.dark + '77';
    ctx.fillRect(x, y, 1, 2 + Math.floor(Math.random() * 3));
  }
  return c.toDataURL('image/png');
}

/** Apply a breed's shape (and, if `withLook`, its procedural face/fur/colors). */
export function applyBreed(dog: DogProfile, id: Exclude<BreedId, 'custom'>, withLook: boolean): DogProfile {
  const b = BREED_MAP[id];
  const next: DogProfile = {
    ...dog,
    breed: id,
    proportions: { ...b.proportions },
    earStyle: b.earStyle,
    tailStyle: b.tailStyle,
    fluff: b.fluff,
    markings: { ...b.markings },
    accentColor: b.accentColor,
  };
  if (withLook) {
    next.faceImg = makePupFace(b.palette, b.mask);
    next.furImg = makePupFur(b.palette);
    next.furColor = b.palette.base;
  }
  return next;
}

/** Fill defaults for dogs saved before v2 fields existed. */
export function normalizeDog(d: DogProfile): DogProfile {
  return {
    breed: 'custom',
    tailStyle: 'straight',
    fluff: 0.2,
    accentColor: '#F4E3CF',
    markings: { chest: false, socks: false, tailTip: false },
    ...d,
    // retired styles ('round', 'retro') move to the sculpted dog
    model: d.model === 'pixel' ? 'pixel' : 'sculpt', // Toon / Plush were removed: those dogs become Sculpted
  };
}
