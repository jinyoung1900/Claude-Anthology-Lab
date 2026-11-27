'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { StoreProvider, useStore } from '@/lib/store';
import { WalkSessionProvider } from '@/lib/walkSession';
import { achKey, newlyUnlocked } from '@/lib/achievements';
import { useT } from '@/lib/i18n';
import { haptic, sfx } from '@/lib/feedback';
import { AdsProvider } from './ads/AdsProvider';
import BottomNav from './BottomNav';
import Roulette from './Roulette';
import Onboarding from './Onboarding';

/** Records newly met achievements, pays out treats and shows a toast. */
function AchievementWatcher() {
  const { data, loaded, claim, addTreats, notify } = useStore();
  const { t } = useT();
  useEffect(() => {
    if (!loaded) return;
    const fresh = newlyUnlocked(data);
    if (!fresh.length) return;
    let treats = 0;
    fresh.forEach((a) => {
      if (claim(achKey(a.id))) treats += a.treats;
    });
    if (!treats) return;
    addTreats(treats);
    const a = fresh[0];
    notify(t('stickers.unlocked', { name: `${a.icon} ${t(`ach.${a.id}.title` as never)}`, n: treats }));
    sfx.win('rare');
    haptic('success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.walks, data.inventory, data.dogs.length, loaded]);
  return null;
}

function GlobalToast() {
  const { notice, notify, saveError } = useStore();
  const { t } = useT();
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => notify(null), 3200);
    return () => clearTimeout(id);
  }, [notice, notify]);
  return (
    <>
      {notice && (
        <div role="status" className="fixed inset-x-6 top-[calc(1rem+env(safe-area-inset-top))] z-[90] mx-auto max-w-sm animate-pop rounded-2xl bg-bark/90 px-4 py-3 text-center text-sm font-bold text-white shadow-chunky">
          {notice}
        </div>
      )}
      {saveError && (
        <div role="alert" className="fixed inset-x-3 top-[env(safe-area-inset-top)] z-[95] mx-auto max-w-md rounded-b-2xl bg-berry px-4 py-2 text-center text-xs font-bold text-white">
          {t('err.saveFail')}
        </div>
      )}
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { loaded, rouletteOpen, settings } = useStore();
  const path = usePathname() || '/';

  // accessibility + language on <html>
  useEffect(() => {
    const h = document.documentElement;
    h.lang = settings.language;
    h.classList.toggle('large-text', settings.largeText);
    h.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings.language, settings.largeText, settings.reduceMotion]);

  if (!loaded)
    return (
      <div className="flex h-[100dvh] items-center justify-center text-4xl" aria-busy>
        <span className="animate-bounce">🐾</span>
      </div>
    );

  // first launch: welcome tour (privacy page and photo creator stay reachable from it)
  if (!settings.onboarded && !path.startsWith('/privacy') && !path.startsWith('/create')) return <Onboarding />;

  return (
    <>
      {children}
      <BottomNav />
      {rouletteOpen && <Roulette />}
      <AchievementWatcher />
      <GlobalToast />
    </>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <WalkSessionProvider>
        <AdsProvider>
          <Shell>{children}</Shell>
        </AdsProvider>
      </WalkSessionProvider>
    </StoreProvider>
  );
}
