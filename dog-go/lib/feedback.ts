/**
 * Haptics (Capacitor on Android, navigator.vibrate in browsers) + tiny WebAudio-synthesized
 * sounds, so there are no audio assets to ship. Toggled from Settings.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { loadSettings } from './storage';

export type HapticKind = 'tap' | 'tick' | 'success' | 'heavy';

export function haptic(kind: HapticKind = 'tap') {
  if (!loadSettings().hapticsOn) return;
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'tick') void Haptics.selectionChanged();
      else void Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(kind === 'success' ? [30, 60, 30] : kind === 'heavy' ? 40 : kind === 'tick' ? 6 : 12);
    }
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!loadSettings().soundOn || typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  /** Two-part "ruff!" – a pitched square blip + a filtered noise puff */
  bark() {
    const a = audio();
    if (!a) return;
    tone(420, 0.09, 'square', 0.08, 0, 260);
    tone(360, 0.12, 'sawtooth', 0.05, 0.11, 220);
    const len = Math.floor(a.sampleRate * 0.12);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    const g = a.createGain();
    g.gain.value = 0.25;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  },
  tick() {
    tone(1400, 0.03, 'triangle', 0.06);
  },
  win(rarity: 'common' | 'rare' | 'epic' = 'common') {
    const notes = rarity === 'epic' ? [523, 659, 784, 1047, 1319] : rarity === 'rare' ? [523, 659, 784, 1047] : [523, 784];
    notes.forEach((n, i) => tone(n, 0.25, 'triangle', 0.12, i * 0.09));
  },
  find() {
    tone(880, 0.08, 'sine', 0.12);
    tone(1175, 0.14, 'sine', 0.12, 0.08);
  },
  bloom() {
    tone(660, 0.12, 'sine', 0.06, 0, 990);
  },
  coin() {
    tone(988, 0.06, 'square', 0.05);
    tone(1319, 0.16, 'square', 0.05, 0.06);
  },
};
