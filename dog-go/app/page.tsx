'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { useWalkSession } from '@/lib/walkSession';
import { isReminderDue } from '@/lib/reminders';
import { formatDistance } from '@/lib/geo';
import { haptic, sfx } from '@/lib/feedback';
import { useT } from '@/lib/i18n';
import { currentSeason } from '@/lib/trinkets';
import { currentStreak, describeReward, dogMood, MOOD_EMOJI, STREAK_MILESTONES, streakKey, weekDistanceM, weekKey, WEEKLY_REWARD, type Reward } from '@/lib/goals';
import type { DogAnim } from '@/components/three/Dog3D';
import PhotoButton from '@/components/PhotoButton';
import type { ThrowRequest, ToyKind } from '@/components/three/Fetch';
import { SCENE_ICON, SCENE_IDS } from '@/components/three/Scenery';

const AvatarScene = dynamic(() => import('@/components/three/AvatarScene'), { ssr: false });

export default function Home() {
  const { data, activeDog, setActiveDog, settings, updateSettings, setRouletteOpen, claim, addSpins, addTreats, grantTrinket, notify } = useStore();
  const [throwReq, setThrowReq] = useState<ThrowRequest | null>(null);
  const [held, setHeld] = useState<ToyKind | null>(null);
  const [scenePicker, setScenePicker] = useState(false);
  const [goalEdit, setGoalEdit] = useState<string | null>(null);
  const saveGoal = (v: string) => {
    const n = Math.round(parseFloat(v.replace(',', '.')) * 10) / 10;
    if (Number.isFinite(n) && n >= 0.5 && n <= 500) updateSettings({ weeklyGoalKm: n });
    setGoalEdit(null);
  };
  // pick a toy up (tap again to put it away), then swipe on the scene to throw it
  const holdToy = (kind: ToyKind) => {
    haptic('tick');
    setAnim(restAnim);
    setHeld((h) => (h === kind ? null : kind));
  };
  const release = (swipe: { vx: number; vy: number }) => {
    if (!held) return;
    haptic('tap');
    sfx.bloom();
    const kind = held;
    setHeld(null);
    setThrowReq((r) => ({ kind, id: (r?.id ?? 0) + 1, swipe }));
  };
  const fetched = () => {
    sfx.bark();
    haptic('success');
    notify(t('home.fetched', { name }));
  };
  const { t } = useT();
  const walk = useWalkSession();
  const mood = dogMood(activeDog, data.walks);
  const restAnim: DogAnim = mood === 'sleepy' ? 'sleepy' : 'idle';
  const [anim, setAnim] = useState<DogAnim>(restAnim);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPetToast = useRef(0);
  const name = activeDog?.name ?? t('home.yourPup');

  const happyFor = (ms: number) => {
    setAnim('happy');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnim(restAnim), ms);
  };
  const happy = () => {
    sfx.bark();
    haptic('tap');
    happyFor(1600);
  };
  const pet = () => {
    haptic('tick');
    sfx.bloom();
    happyFor(1200);
    if (Date.now() - lastPetToast.current > 6000) {
      lastPetToast.current = Date.now();
      notify(t('pet.toast', { name }));
    }
  };

  useEffect(() => setAnim(restAnim), [restAnim]);

  // Celebrate once per app session when you come back after today's walk
  useEffect(() => {
    if (mood !== 'happy') return;
    try {
      const k = `doggo:celebrated:${activeDog?.id}:${new Date().toDateString()}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch {
      /* ignore */
    }
    const id = setTimeout(() => happyFor(1800), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, activeDog?.id]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const today = new Date().toDateString();
  const todayDist = data.walks.filter((w) => new Date(w.startedAt).toDateString() === today).reduce((s, w) => s + w.distanceM, 0);
  const due = settings.reminderOn && !activeDog?.memorial && isReminderDue(settings.reminderTime, data.walks[0]?.startedAt);

  // goals
  const goalM = settings.weeklyGoalKm * 1000;
  const weekM = weekDistanceM(data.walks);
  const wKey = weekKey();
  const weekDone = weekM >= goalM;
  const weekClaimed = data.claimed.includes(wKey);
  const streak = currentStreak(data.walks);
  const nextMilestone = STREAK_MILESTONES.find((m) => !streak.startedOn || !data.claimed.includes(streakKey(m.days, streak.startedOn)));
  const claimableStreak = STREAK_MILESTONES.filter((m) => streak.startedOn && streak.days >= m.days && !data.claimed.includes(streakKey(m.days, streak.startedOn)));

  const give = (r: Reward) => {
    if (r.spins) addSpins(r.spins);
    if (r.treats) addTreats(r.treats);
    if (r.trinketId) grantTrinket(r.trinketId);
    sfx.win(r.trinketId ? 'epic' : 'rare');
    haptic('success');
  };
  const claimWeek = () => {
    if (!claim(wKey)) return;
    const firstEver = !data.inventory['medal-goal'];
    give({ ...WEEKLY_REWARD, trinketId: firstEver ? 'medal-goal' : undefined });
    notify(t('home.weeklyToast', { reward: describeReward(WEEKLY_REWARD, t) }) + (firstEver ? t('home.medalBonus') : ''));
  };
  const claimStreak = (days: number) => {
    const m = STREAK_MILESTONES.find((x) => x.days === days);
    if (!m || !streak.startedOn || !claim(streakKey(days, streak.startedOn))) return;
    give(m.reward);
    notify(t('home.streakToast', { n: days, label: describeReward(m.reward, t) }));
  };

  const walkLabel = walk.status === 'idle' ? t('home.walkWith', { name }) : walk.status === 'active' ? t('home.walkInProgress') : t('home.walkPaused');

  return (
    <main className="screen flex flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight">Dog-go</h1>
          <p className="truncate text-xs text-bark/60">{t('app.tagline')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip bg-white py-2 shadow-chunky" aria-label={`${t('common.treats')}: ${data.treats}`}>
            🍪 {data.treats}
          </span>
          <button onClick={() => setRouletteOpen(true)} className="btn-secondary relative px-3 py-2 text-sm" aria-label={`${t('common.spins')}: ${data.spins}`}>
            🎁 <span>{data.spins}</span>
            {data.spins > 0 && !settings.reduceMotion && <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-berry" />}
          </button>
          <Link href="/settings/" className="btn-secondary px-3 py-2 text-sm" aria-label={t('common.settings')}>
            ⚙️
          </Link>
        </div>
      </header>

      {due && (
        <Link href="/walk/" className="mx-4 mt-3 rounded-2xl bg-peach px-4 py-2 text-sm font-bold">
          {t('home.reminderDue', { time: settings.reminderTime, name })}
        </Link>
      )}

      <div className="relative mx-4 mt-3 overflow-hidden rounded-[2rem] shadow-chunky">
        <AvatarScene
          dog={activeDog}
          human={settings.showMe ? data.human : null}
          framing={settings.showMe ? 'duo' : 'dog'}
          anim={walk.status === 'active' ? 'walk' : anim}
          onDogTap={happy}
          onPet={pet}
          weather
          scene={settings.scene}
          throwReq={throwReq}
          onFetched={fetched}
          heldToy={held}
          onRelease={release}
          className="h-[54dvh] min-h-[320px] w-full"
        />
        {activeDog && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-sm font-black">
            {activeDog.memorial && '🌈 '}
            {activeDog.away && '✈️ '}
            {activeDog.name}
          </div>
        )}
        {activeDog && <PhotoButton dogId={activeDog.id} />}
        {/* scene + show-me toggles under the photo button */}
        <div className="absolute right-3 top-16 z-10 flex flex-col items-end gap-2">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl leading-none shadow-chunky active:translate-y-[2px] active:shadow-none"
            aria-label={t('home.scene')}
            aria-expanded={scenePicker}
            title={t('home.scene')}
            onClick={() => setScenePicker((v) => !v)}
          >
            {SCENE_ICON[settings.scene]}
          </button>
          <button
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none shadow-chunky active:translate-y-[2px] active:shadow-none ${settings.showMe ? 'bg-moss text-white' : 'bg-white/90'}`}
            aria-pressed={settings.showMe}
            aria-label={settings.showMe ? t('home.hideMe') : t('home.showMe')}
            title={settings.showMe ? t('home.hideMe') : t('home.showMe')}
            onClick={() => updateSettings({ showMe: !settings.showMe })}
          >
            🧑
          </button>
        </div>
        {scenePicker && (
          <div className="absolute inset-x-3 top-14 z-20 mr-14 flex flex-wrap gap-1.5 rounded-2xl bg-white/95 p-2 shadow-chunky" role="radiogroup" aria-label={t('home.scene')}>
            {SCENE_IDS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={settings.scene === id}
                className={`min-h-9 rounded-full px-3 text-xs font-bold ${settings.scene === id ? 'bg-moss text-white' : 'bg-cream'}`}
                onClick={() => {
                  updateSettings({ scene: id });
                  setScenePicker(false);
                }}
              >
                {SCENE_ICON[id]} {t(`scene.${id}` as 'scene.park')}
              </button>
            ))}
          </div>
        )}
        {anim === 'sleepy' && <div className="pointer-events-none absolute right-[22%] top-[30%] animate-pulse text-2xl font-black text-white drop-shadow">z Z z</div>}
        <div className="absolute bottom-3 right-3 flex gap-2">
          <button className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold" onClick={() => setAnim(anim === 'walk' ? restAnim : 'walk')}>
            {anim === 'walk' ? t('home.rest') : t('home.walkAnim')}
          </button>
          <button className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold" aria-pressed={anim === 'sit'} onClick={() => setAnim(anim === 'sit' ? restAnim : 'sit')}>
            {anim === 'sit' ? t('home.rest') : t('home.sit')}
          </button>
          {!settings.reduceMotion && (
            <button className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold" onClick={happy}>
              {t('home.shake')}
            </button>
          )}
        </div>
        {activeDog && walk.status !== 'active' && (
          <div className="absolute bottom-3 left-3 flex flex-col items-start gap-2">
            {(['ball', 'frisbee'] as ToyKind[]).map((k) => (
              <button
                key={k}
                className={`min-h-9 rounded-full px-3 text-xs font-bold ${held === k ? 'bg-moss text-white' : 'bg-white/85'}`}
                aria-pressed={held === k}
                aria-label={t('home.throwHint', { name })}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => holdToy(k)}
              >
                {t(k === 'ball' ? 'home.ball' : 'home.frisbee')}
              </button>
            ))}
          </div>
        )}
        <p className="pointer-events-none absolute left-3 top-12 max-w-[50%] text-[10px] font-bold leading-tight text-white drop-shadow">{t('home.dragHint')}</p>
        {held && (
          <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center">
            <span className="animate-pulse rounded-full bg-white/90 px-3 py-1 text-sm font-black shadow-chunky">{t('home.swipeHint')}</span>
          </div>
        )}
      </div>

      {activeDog && (
        <p className="mx-4 mt-2 text-center text-xs font-bold text-bark/70">
          {MOOD_EMOJI[mood]} {t(`mood.${mood}` as 'mood.happy', { name })}
        </p>
      )}

      {data.dogs.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {data.dogs.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDog(d.id)}
              aria-pressed={d.id === activeDog?.id}
              className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-2 py-1 pr-3 text-sm font-bold ${d.id === activeDog?.id ? 'border-moss bg-white' : 'border-transparent bg-white/60'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.faceImg} alt="" className="h-7 w-7 rounded-full object-cover" />
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className="mx-4 mt-3">
        <Link href="/walk/" className="btn-primary w-full py-4 text-lg">
          {walkLabel}
        </Link>
      </div>

      <p className="mx-4 mt-2 text-center text-[11px] font-bold text-bark/60">{t(`home.season.${currentSeason()}` as 'home.season.autumn')}</p>

      {/* Goals */}
      <section className="card mx-4 mt-2 space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-black">{t('home.weeklyGoal')}</span>
            <span className="flex items-center gap-2 text-xs font-bold text-bark/60">
              {formatDistance(weekM)} / {settings.weeklyGoalKm} km
              <button
                className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-cream text-sm"
                aria-label={t('home.editGoal')}
                title={t('home.editGoal')}
                onClick={() => setGoalEdit(goalEdit === null ? String(settings.weeklyGoalKm) : null)}
              >
                ✏️
              </button>
            </span>
          </div>
          {goalEdit !== null && (
            <form
              className="mt-2 space-y-2 rounded-2xl bg-cream p-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveGoal(goalEdit);
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  className="input w-24 py-1 text-center text-lg font-black"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={500}
                  step={0.5}
                  autoFocus
                  aria-label={t('home.goalKm')}
                  value={goalEdit}
                  onChange={(e) => setGoalEdit(e.target.value)}
                />
                <span className="text-sm font-bold">{t('home.goalKm')}</span>
                <button type="submit" className="btn-primary ml-auto px-4 py-2 text-sm">
                  {t('common.save')}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[3, 5, 10, 15, 20, 30].map((n) => (
                  <button key={n} type="button" className="min-h-8 rounded-full bg-white px-3 text-xs font-bold" onClick={() => saveGoal(String(n))}>
                    {n} km
                  </button>
                ))}
              </div>
            </form>
          )}
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuemin={0} aria-valuemax={goalM} aria-valuenow={Math.round(weekM)}>
            <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${Math.min(100, (weekM / goalM) * 100)}%` }} />
          </div>
          {weekDone && !weekClaimed ? (
            <button className="btn-berry mt-2 w-full py-2 text-sm" onClick={claimWeek}>
              {t('home.claim', { reward: describeReward(WEEKLY_REWARD, t) })}
            </button>
          ) : (
            <p className="mt-1 text-[11px] text-bark/60">{weekClaimed ? t('home.claimedWeek') : t('home.reward', { reward: describeReward(WEEKLY_REWARD, t) })}</p>
          )}
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-black">{t('home.streak', { n: streak.days })}</span>
            {nextMilestone && <span className="text-right text-xs font-bold text-bark/60">{t('home.nextMilestone', { n: nextMilestone.days, label: describeReward(nextMilestone.reward, t) })}</span>}
          </div>
          <div className="mt-1 flex gap-1">
            {STREAK_MILESTONES.map((m) => (
              <div key={m.days} className={`h-2 flex-1 rounded-full ${streak.days >= m.days ? 'bg-berry' : 'bg-cream'}`} />
            ))}
          </div>
          {claimableStreak.map((m) => (
            <button key={m.days} className="btn-berry mt-2 w-full py-2 text-sm" onClick={() => claimStreak(m.days)}>
              {t('home.claimStreak', { n: m.days, label: describeReward(m.reward, t) })}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="card p-3"><div className="label">{t('home.today')}</div><div className="text-lg font-black">{formatDistance(todayDist)}</div></div>
        <div className="card p-3"><div className="label">{t('home.walks')}</div><div className="text-lg font-black">{data.walks.length}</div></div>
        <div className="card p-3"><div className="label">{t('home.trinkets')}</div><div className="text-lg font-black">{Object.keys(data.inventory).length}</div></div>
      </section>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <Link href="/create/" className="btn-secondary text-sm">{t('home.makeDog')}</Link>
        <Link href="/closet/?tab=me" className="btn-secondary text-sm">{t('home.styleMe')}</Link>
      </div>
    </main>
  );
}
