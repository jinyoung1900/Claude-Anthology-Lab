'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { formatDistance, formatDuration } from '@/lib/geo';
import { currentStreak } from '@/lib/goals';
import { deletePhoto } from '@/lib/storage';
import { useT } from '@/lib/i18n';
import { ACHIEVEMENTS, achKey } from '@/lib/achievements';
import type { Walk } from '@/lib/types';
import { usePhotos } from '@/hooks/usePhotos';
import WalkEntry, { PhotoViewer } from '@/components/WalkEntry';
import { MockBanner } from '@/components/ads/MockBanner';

const WalkMap = dynamic(() => import('@/components/WalkMap'), { ssr: false });
const ShareCard = dynamic(() => import('@/components/ShareCard'), { ssr: false });

type View = 'list' | 'garden' | 'stickers';

export default function HistoryPage() {
  const { data, settings, updateWalk, deleteWalk } = useStore();
  const { t } = useT();
  const [view, setView] = useState<View>('list');
  const [sharing, setSharing] = useState<Walk | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const photos = usePhotos(data.walks.flatMap((w) => (w.photos ?? []).map((p) => p.id)));

  const total = data.walks.reduce((s, w) => s + w.distanceM, 0);
  const totalTime = data.walks.reduce((s, w) => s + w.durationMs, 0);
  const blooms = data.walks.reduce((s, w) => s + (w.blooms?.length ?? 0), 0);
  const streak = currentStreak(data.walks).days;
  const unlocked = ACHIEVEMENTS.filter((a) => data.claimed.includes(achKey(a.id))).length;

  const garden = useMemo(
    () => ({
      segments: data.walks.flatMap((w) => w.segments),
      blooms: data.walks.flatMap((w) => w.blooms ?? []),
      photos: data.walks.flatMap((w) => w.photos ?? []),
    }),
    [data.walks],
  );

  const remove = (w: Walk) => {
    (w.photos ?? []).forEach((p) => void deletePhoto(p.id));
    deleteWalk(w.id);
  };

  const TABS: [View, string][] = [
    ['list', t('history.tabWalks')],
    ['garden', t('history.tabGarden')],
    ['stickers', t('history.tabStickers')],
  ];

  return (
    <main className="screen space-y-3 px-4 pt-3">
      <h1 className="pt-3 text-2xl font-black">{t('history.title')}</h1>

      <section className="grid grid-cols-4 gap-2 text-center">
        <div className="card p-2"><div className="label">{t('history.total')}</div><div className="text-sm font-black">{formatDistance(total)}</div></div>
        <div className="card p-2"><div className="label">{t('history.time')}</div><div className="text-sm font-black">{formatDuration(totalTime)}</div></div>
        <div className="card p-2"><div className="label">{t('history.garden')}</div><div className="text-sm font-black">🌸 {blooms}</div></div>
        <div className="card p-2"><div className="label">{t('history.streak')}</div><div className="text-sm font-black">🔥 {streak}</div></div>
      </section>

      <Link href="/settings/" className="card flex items-center justify-between gap-2 py-3 text-sm">
        <span className="font-bold">{t('history.reminder')}</span>
        <span className="text-bark/60">
          {settings.reminderOn ? t('history.reminderOn', { time: settings.reminderTime }) : t('history.off')} · {t('history.change')}
        </span>
      </Link>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1" role="tablist">
        {TABS.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-xl py-2 text-xs font-bold ${view === v ? 'bg-moss text-white' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'garden' && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-[2rem] shadow-chunky">
            {garden.segments.length ? (
              <WalkMap segments={garden.segments} blooms={garden.blooms} photos={garden.photos} fit className="h-[55dvh] w-full" />
            ) : (
              <div className="flex h-60 items-center justify-center bg-moss/10 p-6 text-center text-sm text-bark/60">{t('history.gardenEmpty')}</div>
            )}
          </div>
          <p className="text-center text-xs text-bark/60">{t('history.gardenHint')}</p>
        </div>
      )}

      {view === 'stickers' && (
        <div className="space-y-2">
          <p className="text-center text-sm font-bold text-bark/70">{t('stickers.progress', { a: unlocked, b: ACHIEVEMENTS.length })}</p>
          <div className="grid grid-cols-3 gap-2">
            {ACHIEVEMENTS.map((a) => {
              const got = data.claimed.includes(achKey(a.id));
              return (
                <div key={a.id} className={`flex flex-col items-center rounded-2xl p-2 text-center shadow-chunky ${got ? 'bg-white' : 'bg-white/50'}`}>
                  <span className="text-4xl" style={{ filter: got ? undefined : 'grayscale(1) opacity(0.35)' }} aria-hidden>
                    {a.icon}
                  </span>
                  <span className="mt-1 text-[11px] font-black leading-tight">{t(`ach.${a.id}.title` as 'ach.first-walk.title')}</span>
                  <span className="text-[10px] leading-tight text-bark/60">{t(`ach.${a.id}.desc` as 'ach.first-walk.desc')}</span>
                  <span className={`mt-1 text-[10px] font-bold ${got ? 'text-moss' : 'text-bark/40'}`}>{got ? `✓ +${a.treats} 🍪` : `🔒 ${t('stickers.locked')}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
        <>
          {data.walks.length === 0 && (
            <div className="card py-10 text-center text-bark/60">
              <div className="text-4xl">🦮</div>
              {t('history.empty')}
            </div>
          )}
          {data.walks.map((w) => (
            <WalkEntry
              key={w.id}
              w={w}
              photos={photos}
              onNote={(note) => updateWalk(w.id, { note })}
              onDelete={() => remove(w)}
              onShare={() => setSharing(w)}
              onPhoto={setViewing}
            />
          ))}
        </>
      )}

      <MockBanner placement="history_banner" />
      {sharing && <ShareCard walk={sharing} onClose={() => setSharing(null)} />}
      {viewing && <PhotoViewer src={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}
