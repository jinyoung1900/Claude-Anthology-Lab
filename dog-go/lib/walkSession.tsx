'use client';

/**
 * Active walk session lives at the app root so tracking keeps running while the user
 * browses other tabs. A snapshot is mirrored to localStorage so a crash / reload
 * restores the walk in "paused" state.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Bloom, Find, FindKind, LatLng, Walk, WalkPhoto } from './types';
import { DEFAULT_CENTER, haversine, simulatePosition, watchPosition, type GeoFix, type StopFn } from './geo';
import { deletePhoto, lsGet, lsSet, savePhoto, uid } from './storage';
import { rollFindTrinket } from './trinkets';

export type WalkStatus = 'idle' | 'active' | 'paused';

interface Snapshot {
  status: WalkStatus;
  mode: 'real' | 'virtual';
  dogId: string | null;
  dogName: string;
  startedAt: number;
  accumulatedMs: number;
  segments: LatLng[][];
  distanceM: number;
  demoGps: boolean;
  blooms: Bloom[];
  finds: Find[];
  photos: WalkPhoto[];
  /** distance (m) at which the next flower / sniff find appears */
  nextBloomAt: number;
  nextFindAt: number;
}

const SNAP_KEY = 'doggo:activeWalk:v1';
const MAX_ACCURACY_M = 40;
const MIN_STEP_M = 4;
const MAX_SPEED_MS = 8;
/** A flower (real walk) or pawprint (virtual walk) blooms every this many metres */
export const BLOOM_EVERY_M = 100;
const FIND_KINDS: FindKind[] = ['bone', 'stick', 'ball', 'sock', 'acorn'];
const nextFindGap = () => 180 + Math.random() * 170; // ~every 180–350 m

function makeFind(pt: LatLng): Find {
  const t = rollFindTrinket();
  return {
    lat: pt[0],
    lng: pt[1],
    kind: FIND_KINDS[Math.floor(Math.random() * FIND_KINDS.length)],
    treats: 3 + Math.floor(Math.random() * 10),
    trinketId: t?.id,
    ts: Date.now(),
  };
}

interface WalkCtx extends Snapshot {
  elapsedMs: number;
  current: GeoFix | null;
  error: string | null;
  start: (opts: { mode: 'real' | 'virtual'; dogId: string | null; dogName: string; demoGps: boolean }) => void;
  pause: () => void;
  resume: () => void;
  finish: () => Walk | null;
  discard: () => void;
  setDemoGps: (v: boolean) => void;
  addPhoto: (dataUrl: string) => Promise<void>;
}

const Ctx = createContext<WalkCtx | null>(null);

const EMPTY: Snapshot = {
  status: 'idle',
  mode: 'real',
  dogId: null,
  dogName: '',
  startedAt: 0,
  accumulatedMs: 0,
  segments: [],
  distanceM: 0,
  demoGps: false,
  blooms: [],
  finds: [],
  photos: [],
  nextBloomAt: BLOOM_EVERY_M,
  nextFindAt: 250,
};

export function WalkSessionProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [current, setCurrent] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<StopFn | null>(null);
  const lastFixRef = useRef<GeoFix | null>(null);
  const statusRef = useRef<WalkStatus>('idle');
  statusRef.current = snap.status;

  // restore after reload
  useEffect(() => {
    const s = lsGet<Snapshot>(SNAP_KEY);
    if (s && s.status !== 'idle') setSnap({ ...EMPTY, ...s, status: 'paused' });
  }, []);

  useEffect(() => {
    lsSet(SNAP_KEY, snap.status === 'idle' ? null : snap);
  }, [snap]);

  // ticking clock while active
  useEffect(() => {
    if (snap.status !== 'active') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [snap.status]);

  const onFix = useCallback((f: GeoFix, demo: boolean) => {
    setCurrent(f);
    setError(null);
    if (statusRef.current !== 'active') return;
    if (!demo && f.accuracy > MAX_ACCURACY_M) return;
    const prev = lastFixRef.current;
    const pt: LatLng = [f.lat, f.lng];
    if (prev) {
      const d = haversine([prev.lat, prev.lng], pt);
      const dt = Math.max(1, (f.ts - prev.ts) / 1000);
      if (d < MIN_STEP_M || d / dt > MAX_SPEED_MS) return;
      lastFixRef.current = f;
      setSnap((s) => {
        const segs = s.segments.length ? [...s.segments] : [[]];
        segs[segs.length - 1] = [...segs[segs.length - 1], pt];
        const distanceM = s.distanceM + d;
        let { blooms, finds, nextBloomAt, nextFindAt } = s;
        if (distanceM >= nextBloomAt) {
          blooms = [...blooms, { lat: pt[0], lng: pt[1], variant: Math.floor(Math.random() * 6), kind: s.mode === 'virtual' ? 'paw' : 'flower' }];
          nextBloomAt += BLOOM_EVERY_M;
        }
        if (distanceM >= nextFindAt) {
          finds = [...finds, makeFind(pt)];
          nextFindAt = distanceM + nextFindGap();
        }
        return { ...s, segments: segs, distanceM, blooms, finds, nextBloomAt, nextFindAt };
      });
    } else {
      lastFixRef.current = f;
      setSnap((s) => {
        const segs = s.segments.length ? [...s.segments] : [[]];
        segs[segs.length - 1] = [...segs[segs.length - 1], pt];
        return { ...s, segments: segs };
      });
    }
  }, []);

  const stopWatch = () => {
    stopRef.current?.();
    stopRef.current = null;
  };

  const startWatch = useCallback(
    async (demo: boolean, seed?: LatLng, dogName?: string) => {
      stopWatch();
      lastFixRef.current = null;
      if (demo) {
        const start = seed ?? (current ? ([current.lat, current.lng] as LatLng) : DEFAULT_CENTER);
        stopRef.current = simulatePosition(start, (f) => onFix(f, true));
      } else {
        stopRef.current = await watchPosition((f) => onFix(f, false), setError, dogName);
      }
    },
    [current, onFix],
  );

  // Keep a passive location watch on the walk screen even before starting (to center the map)
  useEffect(() => () => stopWatch(), []);

  const lastPoint = (segs: LatLng[][]) => {
    for (let i = segs.length - 1; i >= 0; i--) if (segs[i].length) return segs[i][segs[i].length - 1];
    return undefined;
  };

  const start: WalkCtx['start'] = ({ mode, dogId, dogName, demoGps }) => {
    const t = Date.now();
    setSnap({ ...EMPTY, status: 'active', mode, dogId, dogName, startedAt: t, segments: [[]], demoGps, nextFindAt: nextFindGap() });
    setResumedAt(t);
    setNow(t);
    startWatch(demoGps, undefined, dogName);
  };

  const pause = () => {
    setSnap((s) => ({ ...s, status: 'paused', accumulatedMs: s.accumulatedMs + (resumedAt ? Date.now() - resumedAt : 0) }));
    setResumedAt(null);
    stopWatch();
  };

  const resume = () => {
    const t = Date.now();
    setSnap((s) => ({ ...s, status: 'active', segments: [...s.segments, []] }));
    setResumedAt(t);
    setNow(t);
    startWatch(snap.demoGps, lastPoint(snap.segments), snap.dogName);
  };

  const elapsedMs = snap.accumulatedMs + (snap.status === 'active' && resumedAt ? now - resumedAt : 0);

  const finish = (): Walk | null => {
    if (snap.status === 'idle') return null;
    stopWatch();
    const end = Date.now();
    const w: Walk = {
      id: uid(),
      dogId: snap.dogId,
      dogName: snap.dogName,
      mode: snap.mode,
      startedAt: snap.startedAt,
      endedAt: end,
      durationMs: snap.accumulatedMs + (snap.status === 'active' && resumedAt ? end - resumedAt : 0),
      distanceM: snap.distanceM,
      segments: snap.segments.filter((s) => s.length > 0),
      note: '',
      adBonusClaimed: false,
      blooms: snap.blooms,
      finds: snap.finds,
      photos: snap.photos,
    };
    setSnap(EMPTY);
    setResumedAt(null);
    return w;
  };

  const discard = () => {
    stopWatch();
    snap.photos.forEach((p) => void deletePhoto(p.id));
    setSnap(EMPTY);
    setResumedAt(null);
  };

  const setDemoGps = (v: boolean) => {
    setSnap((s) => ({ ...s, demoGps: v }));
    if (snap.status === "active") startWatch(v, lastPoint(snap.segments), snap.dogName);
  };

  const addPhoto = async (dataUrl: string) => {
    const at = current ? ([current.lat, current.lng] as LatLng) : lastPoint(snap.segments) ?? DEFAULT_CENTER;
    const id = uid();
    await savePhoto(id, dataUrl);
    setSnap((s) => ({ ...s, photos: [...s.photos, { id, lat: at[0], lng: at[1], ts: Date.now() }] }));
  };

  return (
    <Ctx.Provider value={{ ...snap, elapsedMs, current, error, start, pause, resume, finish, discard, setDemoGps, addPhoto }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWalkSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWalkSession must be used inside WalkSessionProvider');
  return c;
}
