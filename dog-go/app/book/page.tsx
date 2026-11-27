'use client';

/** Memory book: a timeline + stats + garden for one dog. Intentionally ad-free. */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { formatDistance, formatDuration } from '@/lib/geo';
import { dateLocale, useT, type TKey } from '@/lib/i18n';
import { FEELING_EMOJI } from '@/lib/feelings';
import type { Feeling, Walk } from '@/lib/types';
import { usePhotos } from '@/hooks/usePhotos';
import WalkEntry, { PhotoViewer } from '@/components/WalkEntry';

const AvatarScene = dynamic(() => import('@/components/three/AvatarScene'), { ssr: false });
const WalkMap = dynamic(() => import('@/components/WalkMap'), { ssr: false });
const ShareCard = dynamic(() => import('@/components/ShareCard'), { ssr: false });

function partOfDay(h: number): TKey {
  if (h < 5) return 'tod.night';
  if (h < 12) return 'tod.morning';
  if (h < 17) return 'tod.afternoon';
  if (h < 21) return 'tod.evening';
  return 'tod.night';
}

function Book() {
  const params = useSearchParams();
  const { data, activeDog, updateWalk } = useStore();
  const { t, lang } = useT();
  const loc = dateLocale(lang);
  const dog = data.dogs.find((d) => d.id === params.get('dog')) ?? activeDog;
  const walks = useMemo(() => data.walks.filter((w) => w.dogId === dog?.id), [data.walks, dog?.id]);
  const photos = usePhotos(walks.flatMap((w) => (w.photos ?? []).map((p) => p.id)));
  const [sharing, setSharing] = useState<Walk | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  if (!dog) return <main className="screen p-6">{t('book.noDog')}</main>;

  const dist = walks.reduce((s, w) => s + w.distanceM, 0);
  const time = walks.reduce((s, w) => s + w.durationMs, 0);
  const blooms = walks.reduce((s, w) => s + (w.blooms?.length ?? 0), 0);
  const finds = walks.reduce((s, w) => s + (w.finds?.length ?? 0), 0);
  const nPhotos = walks.reduce((s, w) => s + (w.photos?.length ?? 0), 0);
  const first = walks[walks.length - 1];
  const longest = walks.reduce<Walk | null>((m, w) => (!m || w.distanceM > m.distanceM ? w : m), null);
  const hours: Partial<Record<TKey, number>> = {};
  walks.forEach((w) => {
    const k = partOfDay(new Date(w.startedAt).getHours());
    hours[k] = (hours[k] ?? 0) + 1;
  });
  const fav = (Object.entries(hours) as [TKey, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
  const feelCount: Partial<Record<Feeling, number>> = {};
  walks.forEach((w) => w.feeling && (feelCount[w.feeling] = (feelCount[w.feeling] ?? 0) + 1));
  const feelList = (Object.entries(feelCount) as [Feeling, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([f, n]) => `${FEELING_EMOJI[f]}×${n}`)
    .join('  ');

  // group by month
  const months: [string, Walk[]][] = [];
  walks.forEach((w) => {
    const k = new Date(w.startedAt).toLocaleDateString(loc, { month: 'long', year: 'numeric' });
    const last = months[months.length - 1];
    if (last && last[0] === k) last[1].push(w);
    else months.push([k, [w]]);
  });

  return (
    <main className="screen space-y-3 px-4 pt-3">
      <header className="flex items-center gap-3 pt-3">
        <Link href="/closet/?tab=kennel" className="btn-secondary px-3 py-2" aria-label={t('common.back')}>
          ←
        </Link>
        <h1 className="flex-1 truncate text-2xl font-black">{t('book.title', { name: dog.name })}</h1>
      </header>

      <div className="relative overflow-hidden rounded-[2rem] shadow-chunky">
        <AvatarScene dog={dog} framing="dog" className="h-56 w-full" autoSpin weather />
        {dog.memorial && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 text-center text-sm font-bold text-white">{t('book.forever')}</div>
        )}
      </div>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="card p-2"><div className="label">{t('book.walks')}</div><div className="font-black">{walks.length}</div></div>
        <div className="card p-2"><div className="label">{t('book.distance')}</div><div className="font-black">{formatDistance(dist)}</div></div>
        <div className="card p-2"><div className="label">{t('book.time')}</div><div className="font-black">{formatDuration(time)}</div></div>
        <div className="card p-2"><div className="label">{t('book.flowers')}</div><div className="font-black">🌸 {blooms}</div></div>
        <div className="card p-2"><div className="label">{t('book.finds')}</div><div className="font-black">🦴 {finds}</div></div>
        <div className="card p-2"><div className="label">{t('book.photos')}</div><div className="font-black">📷 {nPhotos}</div></div>
      </section>

      {walks.length > 0 && (
        <section className="card space-y-1 text-sm">
          {first && <p>{t('book.first', { date: new Date(first.startedAt).toLocaleDateString(loc, { dateStyle: 'long' }) })}</p>}
          {longest && <p>{t('book.longest', { d: formatDistance(longest.distanceM), date: new Date(longest.startedAt).toLocaleDateString(loc) })}</p>}
          {fav && <p>{t('book.fav', { t: t(fav) })}</p>}
          {feelList && <p>{t('book.feelings', { list: feelList })}</p>}
        </section>
      )}

      {walks.some((w) => w.segments.some((s) => s.length > 1)) && (
        <div className="overflow-hidden rounded-[2rem] shadow-chunky">
          <WalkMap segments={walks.flatMap((w) => w.segments)} blooms={walks.flatMap((w) => w.blooms ?? [])} photos={walks.flatMap((w) => w.photos ?? [])} fit className="h-64 w-full" />
        </div>
      )}

      {walks.length === 0 && <div className="card py-8 text-center text-bark/60">{t('book.empty', { name: dog.name })}</div>}

      {months.map(([month, ws]) => (
        <section key={month} className="space-y-2">
          <h2 className="label pt-2">{month}</h2>
          {ws.map((w) => (
            <WalkEntry key={w.id} w={w} photos={photos} onNote={(note) => updateWalk(w.id, { note })} onShare={() => setSharing(w)} onPhoto={setViewing} />
          ))}
        </section>
      ))}

      {sharing && <ShareCard walk={sharing} onClose={() => setSharing(null)} />}
      {viewing && <PhotoViewer src={viewing} onClose={() => setViewing(null)} />}
    </main>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <Book />
    </Suspense>
  );
}
