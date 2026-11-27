/** Sticker achievements. Unlock state is stored as `ach:<id>` keys in AppData.claimed. */
import type { AppData } from './types';
import { currentStreak } from './goals';

export interface Achievement {
  id: string;
  icon: string;
  treats: number;
  test: (d: AppData) => boolean;
}

const totalKm = (d: AppData) => d.walks.reduce((s, w) => s + w.distanceM, 0) / 1000;
const hourOf = (ts: number) => new Date(ts).getHours();

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-walk', icon: '👣', treats: 10, test: (d) => d.walks.length >= 1 },
  { id: 'km-10', icon: '🥉', treats: 20, test: (d) => totalKm(d) >= 10 },
  { id: 'km-50', icon: '🥈', treats: 50, test: (d) => totalKm(d) >= 50 },
  { id: 'km-100', icon: '🥇', treats: 100, test: (d) => totalKm(d) >= 100 },
  { id: 'marathon', icon: '🏔️', treats: 40, test: (d) => d.walks.some((w) => w.distanceM >= 5000) },
  { id: 'flowers-100', icon: '🌻', treats: 40, test: (d) => d.walks.reduce((s, w) => s + (w.blooms?.length ?? 0), 0) >= 100 },
  { id: 'streak-7', icon: '🔥', treats: 40, test: (d) => currentStreak(d.walks).days >= 7 },
  { id: 'early-bird', icon: '🌅', treats: 15, test: (d) => d.walks.some((w) => hourOf(w.startedAt) < 7) },
  { id: 'night-owl', icon: '🦉', treats: 15, test: (d) => d.walks.some((w) => hourOf(w.startedAt) >= 21) },
  { id: 'photographer', icon: '📸', treats: 15, test: (d) => d.walks.some((w) => (w.photos?.length ?? 0) > 0) },
  { id: 'sniffer', icon: '👃', treats: 30, test: (d) => d.walks.reduce((s, w) => s + (w.finds?.length ?? 0), 0) >= 10 },
  { id: 'collector', icon: '🧺', treats: 30, test: (d) => Object.keys(d.inventory).length >= 10 },
  { id: 'kennel-3', icon: '🏠', treats: 20, test: (d) => d.dogs.length >= 3 },
  { id: 'virtual', icon: '✨', treats: 10, test: (d) => d.walks.some((w) => w.mode === 'virtual') },
  { id: 'storyteller', icon: '📝', treats: 20, test: (d) => d.walks.filter((w) => w.note.trim()).length >= 5 },
];

export const achKey = (id: string) => `ach:${id}`;

/** Achievements whose condition is met but that haven't been recorded yet. */
export function newlyUnlocked(d: AppData) {
  return ACHIEVEMENTS.filter((a) => !d.claimed.includes(achKey(a.id)) && a.test(d));
}
