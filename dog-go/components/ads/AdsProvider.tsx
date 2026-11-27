'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { makeT } from '@/lib/i18n';
import { loadSettings } from '@/lib/storage';
import { MOCK_REWARDED_SECONDS, type AdPlacement, type AdService, type RewardResult } from '@/lib/ads/adService';

const AdsCtx = createContext<AdService | null>(null);

/** Hosts the mock rewarded-ad modal and exposes an AdService to the tree. */
export function AdsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<AdPlacement | null>(null);
  const [left, setLeft] = useState(MOCK_REWARDED_SECONDS);
  const resolver = useRef<((r: RewardResult) => void) | null>(null);

  const showRewarded = useCallback((placement: AdPlacement) => {
    return new Promise<RewardResult>((resolve) => {
      resolver.current = resolve;
      setLeft(MOCK_REWARDED_SECONDS);
      setOpen(placement);
    });
  }, []);

  useEffect(() => {
    if (!open || left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [open, left]);

  const close = (rewarded: boolean) => {
    setOpen(null);
    resolver.current?.({ rewarded });
    resolver.current = null;
  };

  const service: AdService = { kind: 'mock', showRewarded };
  const t = makeT(loadSettings().language);

  return (
    <AdsCtx.Provider value={service}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-6 text-white">
          <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] text-xs opacity-70">
            {left > 0 ? t('ad.rewardIn', { n: left }) : t('ad.earned')}
          </div>
          <div className="mb-3 rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">{t('ad.mock')}</div>
          <div className="flex h-56 w-full max-w-xs animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-peach to-berry text-center text-lg font-bold">
            🦴 Super Crunchy Treats™
            <br />
            <span className="text-sm font-normal">{t('ad.sim')}</span>
          </div>
          <div className="mt-6 h-2 w-full max-w-xs overflow-hidden rounded bg-white/20">
            <div
              className="h-full bg-moss transition-all duration-1000 ease-linear"
              style={{ width: `${((MOCK_REWARDED_SECONDS - left) / MOCK_REWARDED_SECONDS) * 100}%` }}
            />
          </div>
          {left <= 0 ? (
            <button className="mt-6 rounded-full bg-moss px-6 py-3 font-bold" onClick={() => close(true)}>
              {t('ad.claim')}
            </button>
          ) : (
            <button className="mt-6 text-xs underline opacity-60" onClick={() => close(false)}>
              {t('ad.skip')}
            </button>
          )}
        </div>
      )}
    </AdsCtx.Provider>
  );
}

export function useAdService() {
  const s = useContext(AdsCtx);
  if (!s) throw new Error('useAdService must be used inside AdsProvider');
  return s;
}
