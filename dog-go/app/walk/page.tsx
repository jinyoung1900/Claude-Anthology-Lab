'use client';

import dynamic from 'next/dynamic';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useWalkSession } from '@/lib/walkSession';
import { formatDistance, formatDuration } from '@/lib/geo';
import { fileToDownscaledDataUrl } from '@/lib/image';
import { haptic, sfx } from '@/lib/feedback';
import { trinketName, useT } from '@/lib/i18n';
import type { Feeling, LatLng, Walk } from '@/lib/types';
import { FEELINGS } from '@/lib/feelings';
import { useMockAds } from '@/hooks/useMockAds';
import BatteryTip from '@/components/BatteryTip';
import { BLOOM_EMOJI, FIND_EMOJI } from '@/components/WalkMap';

const WalkMap = dynamic(() => import('@/components/WalkMap'), { ssr: false });
const AvatarScene = dynamic(() => import('@/components/three/AvatarScene'), { ssr: false });
const ShareCard = dynamic(() => import('@/components/ShareCard'), { ssr: false });

/** Walks shorter than this don't earn a spin (prevents tap-farming). */
const MIN_SPIN_DURATION_MS = 60_000;
const MIN_SPIN_DISTANCE_M = 50;

export default function WalkPage() {
  const { data, settings, updateSettings, activeDog, addWalk, addSpins, addTreats, grantTrinket, updateWalk, setRouletteOpen } = useStore();
  const { t, lang } = useT();
  const walk = useWalkSession();
  const ads = useMockAds();
  const prefersVirtual = !!(activeDog?.memorial || activeDog?.away);
  const [mode, setMode] = useState<'real' | 'virtual'>(prefersVirtual ? 'virtual' : 'real');
  const [demo, setDemo] = useState(false);
  const [follow, setFollow] = useState(true);
  const [summary, setSummary] = useState<{ walk: Walk; earned: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [feeling, setFeeling] = useState<Feeling | undefined>();
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [sharing, setSharing] = useState<Walk | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const seen = useRef({ finds: walk.finds.length, blooms: walk.blooms.length });
  const dogName = activeDog?.name ?? t('walk.myPup');

  useEffect(() => {
    if (walk.status === 'idle') setMode(prefersVirtual ? 'virtual' : 'real');
  }, [activeDog?.id, prefersVirtual, walk.status]);

  // celebrate new finds / blooms
  useEffect(() => {
    if (walk.finds.length > seen.current.finds) {
      const f = walk.finds[walk.finds.length - 1];
      sfx.find();
      haptic('success');
      const extra = f.trinketId ? t('walk.foundTrinket', { item: trinketName(f.trinketId, lang) }) : '!';
      setToast(`${FIND_EMOJI[f.kind]} ${t('walk.foundToast', { name: walk.dogName, item: t(`find.${f.kind}` as 'find.bone'), n: f.treats })}${f.trinketId ? extra : ''}`);
    } else if (walk.blooms.length > seen.current.blooms) {
      sfx.bloom();
      haptic('tick');
      const b = walk.blooms[walk.blooms.length - 1];
      setToast(b.kind === 'paw' ? t('walk.pawToast') : t('walk.bloomToast', { icon: BLOOM_EMOJI[b.variant % BLOOM_EMOJI.length] }));
    }
    seen.current = { finds: walk.finds.length, blooms: walk.blooms.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk.finds, walk.blooms, walk.dogName]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const current: LatLng | null = walk.current ? [walk.current.lat, walk.current.lng] : null;
  const pace = walk.distanceM > 20 ? walk.elapsedMs / 60000 / (walk.distanceM / 1000) : 0;
  const virtual = walk.status === 'idle' ? mode === 'virtual' : walk.mode === 'virtual';

  const reallyStart = () => {
    haptic('heavy');
    walk.start({ mode, dogId: activeDog?.id ?? null, dogName, demoGps: demo });
  };
  const start = () => {
    if (Capacitor.isNativePlatform() && !demo && !settings.batteryTipShown) setShowTip(true);
    else reallyStart();
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    const url = await fileToDownscaledDataUrl(file, 900);
    await walk.addPhoto(url);
    haptic('tap');
    setToast(t('walk.photoToast'));
  };

  const doFinish = () => {
    setConfirmFinish(false);
    const w = walk.finish();
    if (!w) return;
    const earned = w.durationMs >= MIN_SPIN_DURATION_MS || w.distanceM >= MIN_SPIN_DISTANCE_M;
    addWalk(w);
    if (earned) addSpins(1);
    const treats = (w.finds ?? []).reduce((s, f) => s + f.treats, 0);
    if (treats) addTreats(treats);
    (w.finds ?? []).forEach((f) => f.trinketId && grantTrinket(f.trinketId));
    sfx.win();
    haptic('success');
    setNote('');
    setFeeling(undefined);
    setBonusClaimed(false);
    setSummary({ walk: w, earned });
  };

  const saveExtras = (patch: Partial<Walk> = {}) => summary && updateWalk(summary.walk.id, { note: note.trim(), feeling, ...patch });

  const claimBonus = () => {
    const grant = () => {
      addSpins(1);
      setBonusClaimed(true);
      if (summary) updateWalk(summary.walk.id, { adBonusClaimed: true });
    };
    if (settings.adFree) {
      sfx.coin();
      grant();
    } else void ads.showRewarded('post_walk_bonus_spin', grant);
  };

  const sw = summary?.walk;
  const swTreats = (sw?.finds ?? []).reduce((s, f) => s + f.treats, 0);

  return (
    <main className="relative mx-auto h-[100dvh] max-w-md overflow-hidden">
      <WalkMap segments={walk.segments} current={current} follow={follow} blooms={walk.blooms} finds={walk.finds} photos={walk.photos} className="absolute inset-0" />

      {/* top stats */}
      <div className="absolute inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 grid grid-cols-3 gap-2 text-center" aria-live="polite">
        <div className="card p-2"><div className="label">{t('walk.time')}</div><div className="text-xl font-black tabular-nums">{formatDuration(walk.elapsedMs)}</div></div>
        <div className="card p-2"><div className="label">{t('walk.distance')}</div><div className="text-xl font-black tabular-nums">{formatDistance(walk.distanceM)}</div></div>
        <div className="card p-2"><div className="label">{t('walk.pace')}</div><div className="text-xl font-black tabular-nums">{pace ? `${pace.toFixed(1)}′` : '-'}</div></div>
      </div>

      {/* One stacked column under the stats so chips, buttons, alerts and toasts never overlap */}
      <div className="pointer-events-none absolute inset-x-3 top-[calc(5.75rem+env(safe-area-inset-top))] z-10 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 text-xs font-bold">
            {walk.status !== 'idle' && (
              <>
                <span className="chip bg-white shadow-chunky">{walk.mode === 'virtual' ? '🐾' : '🌸'} {walk.blooms.length}</span>
                <span className="chip bg-white shadow-chunky">🦴 {walk.finds.length}</span>
                <span className="chip bg-white shadow-chunky">📷 {walk.photos.length}</span>
              </>
            )}
          </div>
          <div className="pointer-events-auto ml-auto flex items-center gap-2">
            <button onClick={() => setFollow(!follow)} aria-pressed={follow} className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-bold shadow-chunky ${follow ? 'bg-rare text-white' : 'bg-white'}`}>
              {follow ? t('walk.following') : t('walk.follow')}
            </button>
            {walk.status !== 'idle' && (
              <button onClick={() => camRef.current?.click()} className="min-h-11 whitespace-nowrap rounded-full bg-white px-4 text-sm font-bold shadow-chunky">
                {t('walk.photo')}
              </button>
            )}
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        {walk.error && !walk.demoGps && (
          <div role="alert" className="rounded-xl bg-berry px-3 py-2 text-xs font-bold text-white shadow-chunky">
            📡 {/denied|permission|not_authorized/i.test(walk.error) ? t('walk.gpsDenied') : t('walk.gpsError', { err: walk.error })}
          </div>
        )}

        {toast && (
          <div role="status" className="mx-3 animate-pop rounded-2xl bg-bark/90 px-4 py-3 text-center text-sm font-bold text-white shadow-chunky">
            {toast}
          </div>
        )}
      </div>

      {/* bottom stack: walking buddies sit right above the controls, same size in every mode */}
      <div className="pointer-events-none absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2">
        {activeDog && (
          <div className="relative h-36 w-36 self-start">
            <AvatarScene dog={activeDog} human={data.human} anim={walk.status === 'active' ? 'walk' : 'idle'} transparent className="h-full w-full" initialYaw={0.9} />
            <div className="absolute bottom-0 left-1">
              <span className="block w-max max-w-[18rem] truncate rounded-full bg-white/90 px-2.5 py-1 text-xs font-black text-bark shadow-chunky">
                {t(virtual ? 'walk.withYou' : 'walk.withDog', { name: activeDog.name })}
              </span>
            </div>
          </div>
        )}

        {/* controls */}
        <div className="pointer-events-auto space-y-2 rounded-3xl bg-cream/95 p-3 shadow-chunky">
          {walk.status === 'idle' ? (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1" role="radiogroup" aria-label={t('walk.start')}>
                {(['real', 'virtual'] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`min-h-11 rounded-xl text-sm font-bold transition-colors ${mode === m ? 'bg-moss text-white' : 'text-bark/70'}`}>
                    {t(m === 'real' ? 'walk.real' : 'walk.virtual')}
                  </button>
                ))}
              </div>
              <p className="min-h-[2.5rem] px-1 text-xs leading-snug text-bark/70">{t(mode === 'real' ? 'walk.realHint' : 'walk.virtualHint', { name: dogName })}</p>
              <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-1 text-sm font-bold">
                <span>{t('walk.demo')}</span>
                <input type="checkbox" className="h-5 w-5 accent-moss" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
              </label>
              <button className="btn-primary w-full py-4 text-lg" onClick={start}>
                {t('walk.start')}
              </button>
            </>
          ) : (
            <>
              <div className="flex min-h-11 items-center justify-between gap-2 px-1 text-sm font-bold">
                <span className="min-w-0 truncate" aria-live="polite">
                  {walk.status === 'active' ? <span className="text-berry motion-safe:animate-pulse">{t('walk.recording')}</span> : <span className="text-bark/60">{t('walk.pausedState')}</span>}{' '}
                  <span className="font-semibold text-bark/70">· {t(walk.mode === 'virtual' ? 'walk.modeLineVirtual' : 'walk.modeLineReal', { name: walk.dogName })}</span>
                </span>
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-xs">
                  {t('walk.demoShort')} <input type="checkbox" className="h-5 w-5 accent-moss" checked={walk.demoGps} onChange={(e) => walk.setDemoGps(e.target.checked)} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {walk.status === 'active' ? (
                  <button className="btn-secondary py-4" onClick={() => { haptic('tap'); walk.pause(); }}>{t('walk.pause')}</button>
                ) : (
                  <button className="btn-primary py-4" onClick={() => { haptic('tap'); walk.resume(); }}>{t('walk.resume')}</button>
                )}
                <button className="btn-berry py-4" onClick={() => setConfirmFinish(true)}>{t('walk.finish')}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showTip && (
        <BatteryTip
          onClose={() => {
            setShowTip(false);
            updateSettings({ batteryTipShown: true });
            reallyStart();
          }}
        />
      )}

      {confirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bark/60 p-6" role="dialog" aria-modal>
          <div className="card w-full max-w-xs text-center">
            <p className="mb-4 font-bold">{t('walk.finishQ')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary" onClick={() => setConfirmFinish(false)}>{t('walk.keepGoing')}</button>
              <button className="btn-berry" onClick={doFinish}>{t('walk.finishShort')}</button>
            </div>
            <button className="mt-3 text-xs text-bark/50 underline" onClick={() => { walk.discard(); setConfirmFinish(false); }}>
              {t('walk.discard')}
            </button>
          </div>
        </div>
      )}

      {summary && sw && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-bark/60 sm:items-center" role="dialog" aria-modal>
          <div className="max-h-[92dvh] w-full max-w-md animate-pop space-y-3 overflow-y-auto rounded-t-[2rem] bg-cream p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-[2rem]">
            <h2 className="text-center text-2xl font-black">{t('walk.goodWalk')}</h2>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="card p-3"><div className="label">{t('walk.distance')}</div><div className="text-xl font-black">{formatDistance(sw.distanceM)}</div></div>
              <div className="card p-3"><div className="label">{t('walk.time')}</div><div className="text-xl font-black">{formatDuration(sw.durationMs)}</div></div>
            </div>
            <div className="card flex flex-wrap items-center justify-center gap-x-4 gap-y-1 p-3 text-sm font-bold">
              <span>{t(sw.mode === 'virtual' ? 'walk.pawprints' : 'walk.flowers', { n: sw.blooms?.length ?? 0 })}</span>
              <span>{t('walk.finds', { n: sw.finds?.length ?? 0 })}</span>
              {swTreats > 0 && <span>{t('walk.treatsEarned', { n: swTreats })}</span>}
              {(sw.finds ?? []).filter((f) => f.trinketId).map((f, i) => (
                <span key={i}>🎁 {trinketName(f.trinketId!, lang)}</span>
              ))}
            </div>
            <div>
              <span className="label">{t('walk.feeling')}</span>
              <div className="mt-1 grid grid-cols-6 gap-1" role="radiogroup" aria-label={t('walk.feeling')}>
                {FEELINGS.map((f) => (
                  <button
                    key={f.id}
                    role="radio"
                    aria-checked={feeling === f.id}
                    aria-label={t(`feeling.${f.id}` as 'feeling.joy')}
                    title={t(`feeling.${f.id}` as 'feeling.joy')}
                    onClick={() => {
                      setFeeling(f.id);
                      haptic('tick');
                      saveExtras({ feeling: f.id });
                    }}
                    className={`rounded-xl py-2 text-2xl ${feeling === f.id ? 'bg-moss/25 ring-2 ring-moss' : 'bg-white'}`}
                  >
                    {f.emoji}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="label">{t('walk.note')}</span>
              <textarea className="input mt-1 h-20 resize-none" placeholder={t('walk.notePh', { name: sw.dogName })} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => saveExtras()} maxLength={500} />
            </label>
            <p className={`text-center ${summary.earned ? 'text-sm font-bold text-moss' : 'text-xs text-bark/60'}`}>{summary.earned ? t('walk.spinEarned') : t('walk.spinRule')}</p>
            <button className="btn-primary w-full py-4 text-lg" disabled={data.spins <= 0} onClick={() => { saveExtras(); setSummary(null); setRouletteOpen(true); }}>
              {t('walk.spinNow', { n: data.spins })}
            </button>
            {summary.earned && (
              <button className="btn-secondary w-full" disabled={bonusClaimed || ads.loading} onClick={claimBonus}>
                {bonusClaimed ? t('walk.bonusAdded') : settings.adFree ? t('walk.bonusFree') : t('walk.watchAd')}
              </button>
            )}
            <button className="btn-secondary w-full" onClick={() => { saveExtras(); setSharing({ ...sw, note: note.trim(), feeling }); }}>
              {t('walk.share')}
            </button>
            <button className="w-full text-sm text-bark/60 underline" onClick={() => { saveExtras(); setSummary(null); }}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      {sharing && <ShareCard walk={sharing} onClose={() => setSharing(null)} />}
    </main>
  );
}
