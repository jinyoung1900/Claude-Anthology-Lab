/**
 * Local-only persistence.
 *  - IndexedDB (idb-keyval): app data incl. dog photos (dataURLs) and walk routes, can be large.
 *  - localStorage: tiny settings + in-progress walk snapshot (synchronous, crash-safe).
 */
import { del, get, getMany, set } from 'idb-keyval';
import type { AppData, Settings } from './types';

const DATA_KEY = 'doggo:data:v1';
const SETTINGS_KEY = 'doggo:settings:v1';

export async function loadData(): Promise<AppData | undefined> {
  try {
    return await get<AppData>(DATA_KEY);
  } catch (e) {
    console.warn('IndexedDB unavailable, falling back to localStorage', e);
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as AppData) : undefined;
  }
}

/** Returns false when nothing could be written (e.g. storage full). */
export async function saveData(data: AppData): Promise<boolean> {
  try {
    await set(DATA_KEY, data);
    return true;
  } catch {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to persist data', e);
      return false;
    }
  }
}

export const DEFAULT_SETTINGS: Settings = {
  reminderOn: false,
  reminderTime: '18:00',
  soundOn: true,
  hapticsOn: true,
  weeklyGoalKm: 10,
  batteryTipShown: false,
  language: 'en',
  onboarded: false,
  reduceMotion: false,
  largeText: false,
  adFree: false,
  scene: 'park',
  showMe: false,
};

/** First-run language guess from the device. */
export function detectLang(): 'en' | 'ko' | 'fi' {
  if (typeof navigator === 'undefined') return 'en';
  const l = (navigator.language || 'en').toLowerCase();
  return l.startsWith('ko') ? 'ko' : l.startsWith('fi') ? 'fi' : 'en';
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!raw) return { ...DEFAULT_SETTINGS, language: detectLang(), reduceMotion: reduce };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function lsSet(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* quota – ignore */
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------- walk photos (kept out of the main blob so it stays small) ---------- */
const photoKey = (id: string) => 'photo:' + id;
export const savePhoto = (id: string, dataUrl: string) => set(photoKey(id), dataUrl);
export const loadPhoto = (id: string) => get<string>(photoKey(id));
export const deletePhoto = (id: string) => del(photoKey(id));
export async function loadPhotos(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const vals = await getMany<string>(ids.map(photoKey));
  return Object.fromEntries(ids.map((id, i) => [id, vals[i]]).filter(([, v]) => v)) as Record<string, string>;
}
