import type { Rarity, Slot } from './types';

export type TrinketKind =
  | 'beanie'
  | 'partyhat'
  | 'tophat'
  | 'crown'
  | 'halo'
  | 'flowercrown'
  | 'glasses'
  | 'sunglasses'
  | 'starshades'
  | 'bandana'
  | 'collar'
  | 'bowtie'
  | 'backpack'
  | 'jetpack'
  | 'medal'
  | 'santahat'
  | 'scarf'
  | 'pumpkin'
  | 'strawhat'
  | 'sweater'
  | 'raincoat'
  | 'tuxedo'
  | 'dino'
  | 'cape'
  | 'bee'
  | 'frog'
  | 'bear'
  | 'unicorn'
  | 'harness';

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** Northern-hemisphere meteorological seasons (Korea & Finland). */
export function currentSeason(d = new Date()): Season {
  const m = d.getMonth();
  return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
}

export interface TrinketDef {
  id: string;
  name: string;
  slot: Slot;
  kind: TrinketKind;
  rarity: Rarity;
  color: string;
  accent?: string;
  /** only from goals/streaks – never in the roulette or shop */
  rewardOnly?: boolean;
  /** only appears in roulette / shop during this season (kept forever once owned) */
  season?: Season;
}

export const TRINKETS: TrinketDef[] = [
  // Common
  { id: 'bandana-red', name: 'Red Bandana', slot: 'neck', kind: 'bandana', rarity: 'common', color: '#D9453B' },
  { id: 'bandana-sun', name: 'Sunny Bandana', slot: 'neck', kind: 'bandana', rarity: 'common', color: '#F2C14E' },
  { id: 'collar-blue', name: 'Blue Collar', slot: 'neck', kind: 'collar', rarity: 'common', color: '#3D7DD8', accent: '#F2C14E' },
  { id: 'collar-leather', name: 'Leather Collar', slot: 'neck', kind: 'collar', rarity: 'common', color: '#7A4A2A', accent: '#C0C0C0' },
  { id: 'beanie-green', name: 'Moss Beanie', slot: 'head', kind: 'beanie', rarity: 'common', color: '#6BA368', accent: '#FFF7EC' },
  { id: 'glasses-round', name: 'Round Specs', slot: 'face', kind: 'glasses', rarity: 'common', color: '#3A2A20' },
  // Rare
  { id: 'partyhat', name: 'Party Hat', slot: 'head', kind: 'partyhat', rarity: 'rare', color: '#E0607E', accent: '#F2C14E' },
  { id: 'flowercrown', name: 'Flower Crown', slot: 'head', kind: 'flowercrown', rarity: 'rare', color: '#6BA368', accent: '#F7A1C4' },
  { id: 'sunglasses', name: 'Cool Shades', slot: 'face', kind: 'sunglasses', rarity: 'rare', color: '#111111' },
  { id: 'bowtie', name: 'Dapper Bow Tie', slot: 'neck', kind: 'bowtie', rarity: 'rare', color: '#4F8EF7' },
  { id: 'backpack', name: 'Explorer Pack', slot: 'back', kind: 'backpack', rarity: 'rare', color: '#C9773B', accent: '#5B3A29' },
  // Epic
  { id: 'crown', name: 'Golden Crown', slot: 'head', kind: 'crown', rarity: 'epic', color: '#F5C542', accent: '#E0607E' },
  { id: 'tophat', name: 'Fancy Top Hat', slot: 'head', kind: 'tophat', rarity: 'epic', color: '#222222', accent: '#A55EEA' },
  { id: 'halo', name: 'Rainbow Halo', slot: 'head', kind: 'halo', rarity: 'epic', color: '#FFF3A0' },
  { id: 'starshades', name: 'Star Shades', slot: 'face', kind: 'starshades', rarity: 'epic', color: '#FFCE2E' },
  { id: 'jetpack', name: 'Tiny Jetpack', slot: 'back', kind: 'jetpack', rarity: 'epic', color: '#B8C2CC', accent: '#FF7A1A' },
  // Outfits (dog only) – built from the dog's own shape
  { id: 'sweater-red', name: 'Cozy Knit Sweater', slot: 'body', kind: 'sweater', rarity: 'common', color: '#D9453B', accent: '#FFF7EC' },
  { id: 'raincoat', name: 'Puddle Raincoat', slot: 'body', kind: 'raincoat', rarity: 'rare', color: '#F2C14E', accent: '#3D7DD8' },
  { id: 'tuxedo', name: 'Tiny Tuxedo', slot: 'body', kind: 'tuxedo', rarity: 'rare', color: '#1E1E24', accent: '#D9453B' },
  { id: 'harness-blue', name: 'Trail Harness', slot: 'body', kind: 'harness', rarity: 'common', color: '#3D7DD8', accent: '#24324A' },
  { id: 'harness-pink', name: 'Comfy Pink Harness', slot: 'body', kind: 'harness', rarity: 'rare', color: '#F07CA8', accent: '#F4EDE4' },
  { id: 'cape-hero', name: 'Hero Cape', slot: 'body', kind: 'cape', rarity: 'common', color: '#D9453B', accent: '#F5C542' },
  { id: 'bee', name: 'Bumble Bee Suit', slot: 'body', kind: 'bee', rarity: 'rare', color: '#F7C531', accent: '#2A2220' },
  { id: 'frog', name: 'Froggy Suit', slot: 'body', kind: 'frog', rarity: 'rare', color: '#5DBB63', accent: '#E8F5C8' },
  { id: 'bear', name: 'Teddy Bear Suit', slot: 'body', kind: 'bear', rarity: 'rare', color: '#9A6B47', accent: '#E9CBA7' },
  { id: 'unicorn', name: 'Unicorn Suit', slot: 'body', kind: 'unicorn', rarity: 'epic', color: '#FBF7FF', accent: '#FF9BC8' },
  { id: 'dino', name: 'Dino Suit', slot: 'body', kind: 'dino', rarity: 'epic', color: '#3FA34D', accent: '#F4E3CF' },
  // Reward-only
  { id: 'medal-streak', name: '7-Day Streak Medal', slot: 'neck', kind: 'medal', rarity: 'epic', color: '#F5C542', accent: '#E0607E', rewardOnly: true },
  // Seasonal
  { id: 'santahat', name: 'Santa Hat', slot: 'head', kind: 'santahat', rarity: 'rare', color: '#D9453B', accent: '#FFFFFF', season: 'winter' },
  { id: 'scarf-winter', name: 'Cozy Scarf', slot: 'neck', kind: 'scarf', rarity: 'common', color: '#4F8EF7', accent: '#FFFFFF', season: 'winter' },
  { id: 'pumpkin', name: 'Pumpkin Hat', slot: 'head', kind: 'pumpkin', rarity: 'rare', color: '#F08A24', accent: '#3E7A3A', season: 'autumn' },
  { id: 'leafcrown', name: 'Autumn Leaf Crown', slot: 'head', kind: 'flowercrown', rarity: 'common', color: '#8A5A2B', accent: '#E0702E', season: 'autumn' },
  { id: 'sakura', name: 'Cherry Blossom Crown', slot: 'head', kind: 'flowercrown', rarity: 'rare', color: '#7A5A44', accent: '#FFC0D6', season: 'spring' },
  { id: 'strawhat', name: 'Straw Sun Hat', slot: 'head', kind: 'strawhat', rarity: 'common', color: '#E8C97A', accent: '#E0607E', season: 'summer' },
  { id: 'medal-goal', name: 'Goal Getter Medal', slot: 'neck', kind: 'medal', rarity: 'rare', color: '#C0C7D0', accent: '#4F8EF7', rewardOnly: true },
];

export const TRINKET_MAP: Record<string, TrinketDef> = Object.fromEntries(TRINKETS.map((t) => [t.id, t]));

export const RARITY_WEIGHTS: Record<Rarity, number> = { common: 70, rare: 25, epic: 5 };

export const RARITY_STYLE: Record<Rarity, { label: string; bg: string; text: string; hex: string }> = {
  common: { label: 'Common', bg: 'bg-moss', text: 'text-moss', hex: '#6BA368' },
  rare: { label: 'Rare', bg: 'bg-rare', text: 'text-rare', hex: '#4F8EF7' },
  epic: { label: 'Epic', bg: 'bg-epic', text: 'text-epic', hex: '#A55EEA' },
};

export function rollRarity(rand = Math.random): Rarity {
  const total = RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.epic;
  let r = rand() * total;
  for (const k of ['common', 'rare', 'epic'] as Rarity[]) {
    r -= RARITY_WEIGHTS[k];
    if (r < 0) return k;
  }
  return 'common';
}

export function rollTrinket(rand = Math.random): TrinketDef {
  const rarity = rollRarity(rand);
  const pool = TRINKETS.filter((t) => t.rarity === rarity && !t.rewardOnly && (!t.season || t.season === currentSeason()));
  return pool[Math.floor(rand() * pool.length)];
}

/** Sniff finds: 12% common trinket, 3% rare, otherwise just treats. */
export function rollFindTrinket(rand = Math.random): TrinketDef | undefined {
  const r = rand();
  const rarity: Rarity | null = r < 0.03 ? 'rare' : r < 0.15 ? 'common' : null;
  if (!rarity) return undefined;
  const pool = TRINKETS.filter((t) => t.rarity === rarity && !t.rewardOnly && (!t.season || t.season === currentSeason()));
  return pool[Math.floor(rand() * pool.length)];
}

export const SHOP_PRICE: Record<Rarity, number> = { common: 30, rare: 90, epic: 240 };
export const SPIN_PRICE = 50;

export const SLOT_LABEL: Record<Slot, string> = { head: 'Head', face: 'Face', neck: 'Neck', back: 'Back', body: 'Outfit' };

/** Cheap 2D icons for grids (avoids spawning a WebGL context per tile on low-end phones). */
export const KIND_ICON: Record<TrinketKind, string> = {
  beanie: '🧶', partyhat: '🥳', tophat: '🎩', crown: '👑', halo: '😇', flowercrown: '🌸',
  glasses: '👓', sunglasses: '🕶️', starshades: '🌟', bandana: '🧣', collar: '📿', bowtie: '🎀',
  backpack: '🎒', jetpack: '🚀', medal: '🏅', santahat: '🎅', scarf: '🧣', pumpkin: '🎃', strawhat: '👒',
  sweater: '🧶', raincoat: '🧥', tuxedo: '🤵', dino: '🦖', cape: '🦸', bee: '🐝', frog: '🐸', bear: '🧸', unicorn: '🦄', harness: '🦺',
};
