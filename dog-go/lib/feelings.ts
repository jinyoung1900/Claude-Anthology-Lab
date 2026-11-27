import type { Feeling } from './types';

/** Post-walk mood journal options. */
export const FEELINGS: { id: Feeling; emoji: string }[] = [
  { id: 'joy', emoji: '😊' },
  { id: 'love', emoji: '🥰' },
  { id: 'calm', emoji: '😌' },
  { id: 'meh', emoji: '😐' },
  { id: 'sad', emoji: '🥲' },
  { id: 'tired', emoji: '😴' },
];

export const FEELING_EMOJI = Object.fromEntries(FEELINGS.map((f) => [f.id, f.emoji])) as Record<Feeling, string>;
