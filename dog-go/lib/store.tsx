'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, DogProfile, Equipped, HumanAvatar, Settings, Slot, Walk } from './types';
import { DEFAULT_SETTINGS, loadData, loadSettings, saveData, saveSettings, uid } from './storage';
import { applyBreed, normalizeDog } from './breeds';
import { TRINKET_MAP } from './trinkets';

export const DEFAULT_HUMAN: HumanAvatar = {
  skin: '#E8B98F',
  hair: '#3B2A20',
  hairStyle: 'short',
  shirt: '#E0607E',
  pants: '#3D5A80',
  equipped: {},
  eyes: 'oval',
  mouth: 'smile',
  specs: false,
  outfit: 'tee',
};

export const DEFAULT_PROPORTIONS = { bodyLength: 1, legLength: 1, earSize: 1, tailLength: 1 };

/** Default pup: a golden retriever named Mikene. */
function makeStarterDog(): DogProfile {
  const blank: DogProfile = {
    id: uid(),
    name: 'Mikene',
    faceImg: '',
    furImg: '',
    furColor: '',
    earStyle: 'floppy',
    proportions: { ...DEFAULT_PROPORTIONS },
    memorial: false,
    equipped: { neck: 'bandana-red' },
    createdAt: Date.now(),
  };
  return applyBreed(blank, 'golden', true);
}

function initialData(): AppData {
  const dog = makeStarterDog();
  return {
    dogs: [dog],
    activeDogId: dog.id,
    human: DEFAULT_HUMAN,
    walks: [],
    inventory: { 'bandana-red': 1 },
    spins: 1, // a welcome spin
    treats: 0,
    claimed: [],
  };
}

/** Upgrade saves from older versions so every field exists. */
export function normalizeData(d: Partial<AppData>): AppData {
  return {
    dogs: (d.dogs ?? []).map(normalizeDog),
    activeDogId: d.activeDogId ?? d.dogs?.[0]?.id ?? null,
    human: { ...DEFAULT_HUMAN, ...(d.human ?? {}) },
    walks: (d.walks ?? []).map((w) => ({ blooms: [], finds: [], photos: [], ...w })),
    inventory: d.inventory ?? {},
    spins: d.spins ?? 0,
    treats: d.treats ?? 0,
    claimed: d.claimed ?? [],
  };
}

type Target = 'dog' | 'human';

interface Store {
  loaded: boolean;
  data: AppData;
  settings: Settings;
  activeDog: DogProfile | null;
  // dogs
  saveDog: (dog: DogProfile) => void;
  deleteDog: (id: string) => void;
  setActiveDog: (id: string) => void;
  // human
  updateHuman: (patch: Partial<HumanAvatar>) => void;
  // walks
  addWalk: (w: Walk) => void;
  updateWalk: (id: string, patch: Partial<Walk>) => void;
  deleteWalk: (id: string) => void;
  // rewards
  addSpins: (n: number) => void;
  useSpin: () => boolean;
  grantTrinket: (id: string) => void;
  /** remove `n` copies of a trinket (shop trades); unequips if none left */
  consumeTrinket: (id: string, n: number) => void;
  addTreats: (n: number) => void;
  spendTreats: (n: number) => boolean;
  /** mark a reward key as claimed; returns false if it was already claimed */
  claim: (key: string) => boolean;
  equip: (target: Target, trinketId: string) => void;
  unequip: (target: Target, slot: Slot) => void;
  // settings
  updateSettings: (patch: Partial<Settings>) => void;
  // backup
  replaceAll: (data: AppData) => void;
  // roulette modal (global)
  rouletteOpen: boolean;
  setRouletteOpen: (v: boolean) => void;
  /** last save failed (storage full?) */
  saveError: boolean;
  /** global toast */
  notice: string | null;
  notify: (msg: string | null) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<AppData>(() => normalizeData({}));
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [notice, notify] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Load once on mount
  useEffect(() => {
    setSettings(loadSettings());
    loadData().then((d) => {
      setData(d && d.dogs?.length ? normalizeData(d) : initialData());
      setLoaded(true);
    });
  }, []);

  // Debounced persist
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveData(data).then((ok) => setSaveError(!ok)), 250);
  }, [data, loaded]);

  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    setData((d) => {
      const n = fn(d);
      dataRef.current = n;
      return n;
    });
  }, []);

  const saveDog = useCallback(
    (dog: DogProfile) =>
      mutate((d) => {
        const exists = d.dogs.some((x) => x.id === dog.id);
        return {
          ...d,
          dogs: exists ? d.dogs.map((x) => (x.id === dog.id ? dog : x)) : [...d.dogs, dog],
          activeDogId: d.activeDogId ?? dog.id,
        };
      }),
    [mutate],
  );

  const deleteDog = useCallback(
    (id: string) =>
      mutate((d) => {
        const dogs = d.dogs.filter((x) => x.id !== id);
        return { ...d, dogs, activeDogId: d.activeDogId === id ? dogs[0]?.id ?? null : d.activeDogId };
      }),
    [mutate],
  );

  const setActiveDog = useCallback((id: string) => mutate((d) => ({ ...d, activeDogId: id })), [mutate]);
  const updateHuman = useCallback(
    (patch: Partial<HumanAvatar>) => mutate((d) => ({ ...d, human: { ...d.human, ...patch } })),
    [mutate],
  );
  const addWalk = useCallback((w: Walk) => mutate((d) => ({ ...d, walks: [w, ...d.walks] })), [mutate]);
  const updateWalk = useCallback(
    (id: string, patch: Partial<Walk>) =>
      mutate((d) => ({ ...d, walks: d.walks.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
    [mutate],
  );
  const deleteWalk = useCallback(
    (id: string) => mutate((d) => ({ ...d, walks: d.walks.filter((w) => w.id !== id) })),
    [mutate],
  );
  const addSpins = useCallback((n: number) => mutate((d) => ({ ...d, spins: d.spins + n })), [mutate]);

  const useSpin = useCallback(() => {
    if (dataRef.current.spins <= 0) return false;
    mutate((d) => ({ ...d, spins: Math.max(0, d.spins - 1) }));
    return true;
  }, [mutate]);

  const addTreats = useCallback((n: number) => mutate((d) => ({ ...d, treats: d.treats + n })), [mutate]);
  const spendTreats = useCallback(
    (n: number) => {
      if (dataRef.current.treats < n) return false;
      mutate((d) => ({ ...d, treats: d.treats - n }));
      return true;
    },
    [mutate],
  );

  const claim = useCallback(
    (key: string) => {
      if (dataRef.current.claimed.includes(key)) return false;
      mutate((d) => ({ ...d, claimed: [...d.claimed, key] }));
      return true;
    },
    [mutate],
  );

  const grantTrinket = useCallback(
    (id: string) => mutate((d) => ({ ...d, inventory: { ...d.inventory, [id]: (d.inventory[id] ?? 0) + 1 } })),
    [mutate],
  );

  const consumeTrinket = useCallback(
    (id: string, n: number) =>
      mutate((d) => {
        const left = Math.max(0, (d.inventory[id] ?? 0) - n);
        const inventory = { ...d.inventory };
        if (left) inventory[id] = left;
        else delete inventory[id];
        if (left) return { ...d, inventory };
        const strip = (e: Equipped) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== id)) as Equipped;
        return {
          ...d,
          inventory,
          human: { ...d.human, equipped: strip(d.human.equipped) },
          dogs: d.dogs.map((x) => ({ ...x, equipped: strip(x.equipped) })),
        };
      }),
    [mutate],
  );

  const setEquip = useCallback(
    (target: Target, fn: (e: Equipped) => Equipped) =>
      mutate((d) => {
        if (target === 'human') return { ...d, human: { ...d.human, equipped: fn(d.human.equipped) } };
        return {
          ...d,
          dogs: d.dogs.map((x) => (x.id === d.activeDogId ? { ...x, equipped: fn(x.equipped) } : x)),
        };
      }),
    [mutate],
  );

  const equip = useCallback(
    (target: Target, trinketId: string) => {
      const t = TRINKET_MAP[trinketId];
      if (!t || (target === 'human' && t.slot === 'body')) return;
      setEquip(target, (e) => ({ ...e, [t.slot]: trinketId }));
    },
    [setEquip],
  );
  const unequip = useCallback(
    (target: Target, slot: Slot) =>
      setEquip(target, (e) => {
        const n = { ...e };
        delete n[slot];
        return n;
      }),
    [setEquip],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...patch };
      saveSettings(n);
      return n;
    });
  }, []);

  const replaceAll = useCallback((d: AppData) => mutate(() => normalizeData(d)), [mutate]);

  const activeDog = useMemo(
    () => data.dogs.find((d) => d.id === data.activeDogId) ?? data.dogs[0] ?? null,
    [data.dogs, data.activeDogId],
  );

  const value: Store = {
    loaded,
    data,
    settings,
    activeDog,
    saveDog,
    deleteDog,
    setActiveDog,
    updateHuman,
    addWalk,
    updateWalk,
    deleteWalk,
    addSpins,
    useSpin,
    grantTrinket,
    consumeTrinket,
    addTreats,
    spendTreats,
    claim,
    equip,
    unequip,
    updateSettings,
    replaceAll,
    rouletteOpen,
    setRouletteOpen,
    saveError,
    notice,
    notify,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
