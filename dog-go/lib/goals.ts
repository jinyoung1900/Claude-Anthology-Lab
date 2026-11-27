/** Weekly distance goal, walk streaks + milestone rewards, and dog mood. */
import type { DogProfile, Walk } from './types';
import type { TFn } from './i18n';

const DAY = 86_400_000;

export function startOfDay(d: Date | number) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday 00:00 of the week containing `d`. */
export function weekStart(d: Date | number = Date.now()) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - dow);
  return x;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function weekDistanceM(walks: Walk[], now = Date.now()) {
  const ws = weekStart(now).getTime();
  return walks.filter((w) => w.startedAt >= ws).reduce((s, w) => s + w.distanceM, 0);
}

export const weekKey = (now = Date.now()) => `week:${iso(weekStart(now))}`;

/** Current streak of consecutive days with ≥1 walk (ending today, or yesterday if none yet today). */
export function currentStreak(walks: Walk[], now = Date.now()) {
  const days = new Set(walks.map((w) => startOfDay(w.startedAt).getTime()));
  let d = startOfDay(now).getTime();
  if (!days.has(d)) d -= DAY;
  let n = 0;
  while (days.has(d)) {
    n++;
    d -= DAY;
  }
  return { days: n, startedOn: n ? iso(new Date(d + DAY)) : null };
}

export interface Reward {
  spins?: number;
  treats?: number;
  trinketId?: string;
}

export const STREAK_MILESTONES: { days: number; reward: Reward }[] = [
  { days: 3, reward: { spins: 1 } },
  { days: 7, reward: { spins: 1, trinketId: 'medal-streak' } },
  { days: 14, reward: { spins: 3 } },
  { days: 30, reward: { spins: 5, treats: 100 } },
];

export const WEEKLY_REWARD: Reward = { spins: 2, treats: 20 };

export const streakKey = (days: number, startedOn: string) => `streak${days}:${startedOn}`;

export function describeReward(r: Reward, t: TFn) {
  if (r.trinketId === 'medal-streak' && r.spins === 1 && !r.treats) return t('reward.medalSpin');
  return [
    r.spins && t(r.spins > 1 ? 'reward.spins' : 'reward.spin', { n: r.spins }),
    r.treats && t('reward.treats', { n: r.treats }),
    r.trinketId && t('reward.medal'),
  ]
    .filter(Boolean)
    .join(' · ');
}

export type Mood = 'happy' | 'content' | 'sleepy' | 'peaceful' | 'away';

export function dogMood(dog: DogProfile | null, walks: Walk[], now = Date.now()): Mood {
  if (!dog) return 'content';
  if (dog.memorial) return 'peaceful';
  if (dog.away) return 'away';
  const last = walks.find((w) => w.dogId === dog.id)?.startedAt ?? walks[0]?.startedAt;
  if (!last) return dog.createdAt > now - DAY ? 'content' : 'sleepy';
  if (startOfDay(last).getTime() === startOfDay(now).getTime()) return 'happy';
  if (now - last < 2 * DAY) return 'content';
  return 'sleepy';
}

export const MOOD_EMOJI: Record<Mood, string> = { happy: '😊', content: '🙂', sleepy: '😴', peaceful: '🌈', away: '💌' };
