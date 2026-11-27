export type Slot = 'head' | 'face' | 'neck' | 'back' | 'body';
export type Rarity = 'common' | 'rare' | 'epic';
export type Equipped = Partial<Record<Slot, string>>;

export type EarStyle = 'pointy' | 'floppy';
export type TailStyle = 'straight' | 'curled' | 'stub' | 'plume';
export type BreedId = 'custom' | 'golden' | 'corgi' | 'husky' | 'dachshund' | 'lab';

export interface DogProportions {
  bodyLength: number; // 0.6 – 1.6
  legLength: number; // 0.4 – 1.6
  earSize: number; // 0.4 – 1.8
  tailLength: number; // 0.2 – 1.8
}

export interface DogMarkings {
  chest: boolean;
  socks: boolean;
  tailTip: boolean;
}

export interface DogProfile {
  id: string;
  name: string;
  /** 256x256 dataURL cropped & rotated from Box 1 */
  faceImg: string;
  /** 64x64 dataURL sampled from Box 2 */
  furImg: string;
  /** Average fur color (hex) – used for tinting & UI chips */
  furColor: string;
  earStyle: EarStyle;
  proportions: DogProportions;
  /** "Away / memorial" dog: walks default to virtual mode */
  memorial: boolean;
  /** dog is alive but far away: walks default to virtual, no memorial styling */
  away?: boolean;
  equipped: Equipped;
  createdAt: number;
  // v2 shape options (optional for old saves – see normalizeDog)
  breed?: BreedId;
  tailStyle?: TailStyle;
  /** 0 – 1: chunkier body, neck ruff, thicker tail */
  fluff?: number;
  /** Second color for chest / socks / tail tip */
  accentColor?: string;
  markings?: DogMarkings;
  /** 'sculpt' (default), 'toon', 'plush' (all the one-piece skinned dog) or 'pixel' (voxel) */
  model?: DogModel;
}

export type HairStyle = 'short' | 'long' | 'bun' | 'bald';
export type EyeStyle = 'oval' | 'dot' | 'happy' | 'lashes';
export type MouthStyle = 'smile' | 'grin' | 'cat' | 'o';
export type Outfit = 'tee' | 'hoodie' | 'dress';

export interface HumanAvatar {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
  equipped: Equipped;
  eyes?: EyeStyle;
  mouth?: MouthStyle;
  specs?: boolean;
  outfit?: Outfit;
}

export type LatLng = [number, number];

export type BloomKind = 'flower' | 'paw';
export interface Bloom {
  lat: number;
  lng: number;
  /** index into the bloom palette */
  variant: number;
  kind: BloomKind;
}

export type FindKind = 'bone' | 'stick' | 'ball' | 'sock' | 'acorn';
export interface Find {
  lat: number;
  lng: number;
  kind: FindKind;
  treats: number;
  /** trinket id when the find contained a trinket */
  trinketId?: string;
  ts: number;
}

/** Photo metadata – image bytes live in IndexedDB under `photo:<id>` */
export interface WalkPhoto {
  id: string;
  lat: number;
  lng: number;
  ts: number;
}

export interface Walk {
  id: string;
  dogId: string | null;
  dogName: string;
  mode: 'real' | 'virtual';
  startedAt: number;
  endedAt: number;
  durationMs: number;
  distanceM: number;
  /** Route split into segments (a new segment starts after each pause) */
  segments: LatLng[][];
  note: string;
  adBonusClaimed: boolean;
  blooms?: Bloom[];
  finds?: Find[];
  photos?: WalkPhoto[];
  feeling?: Feeling;
}

export interface Settings {
  reminderOn: boolean;
  reminderTime: string; // "HH:MM"
  soundOn: boolean;
  hapticsOn: boolean;
  weeklyGoalKm: number;
  batteryTipShown: boolean;
  language: Lang;
  onboarded: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  adFree: boolean;
  /** home scene background */
  scene: 'park' | 'home' | 'snow' | 'river' | 'beach' | 'autumn';
  /** show the owner next to the dog on the home screen */
  showMe: boolean;
}

export type Lang = 'en' | 'ko' | 'fi';
export type DogModel = 'sculpt' | 'toon' | 'plush' | 'pixel';
export type Feeling = 'joy' | 'love' | 'calm' | 'meh' | 'sad' | 'tired';

export interface AppData {
  dogs: DogProfile[];
  activeDogId: string | null;
  human: HumanAvatar;
  walks: Walk[];
  /** trinketId -> count owned */
  inventory: Record<string, number>;
  spins: number;
  /** soft currency from sniff finds & goals */
  treats: number;
  /** reward keys already claimed, e.g. "week:2026-11-23", "streak7:2026-11-20" */
  claimed: string[];
}
