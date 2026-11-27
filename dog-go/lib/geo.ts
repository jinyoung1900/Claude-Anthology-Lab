/**
 * GPS abstraction:
 *  - Android: @capacitor-community/background-geolocation (keeps tracking with the screen off),
 *    falling back to @capacitor/geolocation (foreground only).
 *  - Browser: navigator.geolocation.
 *  - "Demo GPS" simulator for testing indoors / on desktop.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { makeT } from './i18n';
import { loadSettings } from './storage';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
import type { LatLng } from './types';

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number;
}

export type StopFn = () => void;

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function routeDistance(segments: LatLng[][]): number {
  let d = 0;
  for (const seg of segments) for (let i = 1; i < seg.length; i++) d += haversine(seg[i - 1], seg[i]);
  return d;
}

/**
 * Android: background-capable watcher. A foreground-service notification ("Walk in progress")
 * keeps GPS running with the screen off or the app in the background.
 */
async function watchBackground(onFix: (f: GeoFix) => void, onError: (msg: string) => void, dogName: string): Promise<StopFn> {
  // Android 13+: the persistent tracking notification needs POST_NOTIFICATIONS
  try {
    const p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') await LocalNotifications.requestPermissions();
  } catch {
    /* non-fatal: tracking still works in the foreground */
  }
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: makeT(loadSettings().language)('notif.tracking'),
      backgroundMessage: makeT(loadSettings().language)('notif.trackingBody', { name: dogName }),
      requestPermissions: true,
      stale: false,
      distanceFilter: 3,
    },
    (loc, err) => {
      if (err) {
        if (err.code === 'NOT_AUTHORIZED') {
          onError('Location permission denied, enable it in Settings');
          if (confirm('Dog-go needs location access to track walks. Open settings?')) BackgroundGeolocation.openSettings();
        } else onError(err.message || 'GPS error');
        return;
      }
      if (!loc) return;
      onFix({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy, ts: loc.time ?? Date.now() });
    },
  );
  return () => void BackgroundGeolocation.removeWatcher({ id });
}

export async function watchPosition(onFix: (f: GeoFix) => void, onError: (msg: string) => void, dogName = 'your pup'): Promise<StopFn> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await watchBackground(onFix, onError, dogName);
    } catch (e) {
      console.warn('Background geolocation unavailable, falling back to foreground GPS', e);
    }
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') perm = await Geolocation.requestPermissions();
      if (perm.location !== 'granted') {
        onError('Location permission denied');
        return () => {};
      }
      const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, (pos, err) => {
        if (err || !pos) return onError(err?.message ?? 'GPS error');
        onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, ts: pos.timestamp });
      });
      return () => void Geolocation.clearWatch({ id });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'GPS unavailable');
      return () => {};
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('Geolocation not supported, try Demo GPS');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, ts: pos.timestamp }),
    (err) => onError(err.message || 'GPS error'),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Simulated wandering walk (~1.4 m/s) starting at `start`. */
export function simulatePosition(start: LatLng, onFix: (f: GeoFix) => void): StopFn {
  let [lat, lng] = start;
  let heading = Math.random() * Math.PI * 2;
  onFix({ lat, lng, accuracy: 5, ts: Date.now() });
  const t = setInterval(() => {
    heading += (Math.random() - 0.5) * 0.6;
    const step = 1.4 * 2; // metres per 2s tick
    lat += (step * Math.cos(heading)) / 111320;
    lng += (step * Math.sin(heading)) / (111320 * Math.cos((lat * Math.PI) / 180));
    onFix({ lat, lng, accuracy: 5, ts: Date.now() });
  }, 2000);
  return () => clearInterval(t);
}

/** Map starts at Songdo Central Park, Incheon, until the first GPS fix arrives. */
export const DEFAULT_CENTER: LatLng = [37.3925, 126.6392];

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}
export function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

/** Opens this app's Android settings page (battery / location permissions). */
export async function openAppSettings() {
  if (Capacitor.isNativePlatform()) {
    try {
      await BackgroundGeolocation.openSettings();
    } catch {
      /* ignore */
    }
  }
}
