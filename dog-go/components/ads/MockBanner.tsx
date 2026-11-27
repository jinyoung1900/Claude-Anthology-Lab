'use client';

import type { AdPlacement } from '@/lib/ads/adService';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';

/**
 * Placeholder 320x50-style banner pinned just above the bottom nav.
 * Only rendered on Walk History and Closet/Kennel (Home + Active Walk stay ad-free),
 * and never once the (mock) "Remove ads" purchase is made.
 */
export function MockBanner({ placement }: { placement: AdPlacement }) {
  const { settings } = useStore();
  const { t } = useT();
  if (settings.adFree) return null;
  return (
    <>
      <div className="h-[54px]" aria-hidden />
      <div
        data-ad-placement={placement}
        role="complementary"
        aria-label="ad"
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 mx-auto flex h-[50px] max-w-md items-center justify-between gap-2 border-y border-bark/20 bg-white/95 px-3 text-xs text-bark"
      >
        <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-[9px] font-bold text-black">AD</span>
        <span className="flex-1 truncate">{t('ad.banner')}</span>
        <span className="opacity-50">ⓘ</span>
      </div>
    </>
  );
}
