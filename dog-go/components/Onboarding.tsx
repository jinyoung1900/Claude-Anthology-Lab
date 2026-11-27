'use client';

/**
 * First-launch welcome tour: language → who you walk with → permissions → your dog → you.
 * Re-playable from Settings. Operates on the active dog / avatar, so replaying never wipes data.
 */
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { LANGS, useT } from '@/lib/i18n';
import { applyBreed, BREEDS } from '@/lib/breeds';
import { haptic, sfx } from '@/lib/feedback';
import type { BreedId, DogProfile, HairStyle, HumanAvatar, Outfit } from '@/lib/types';
import PhotoButton from './PhotoButton';

const AvatarScene = dynamic(() => import('./three/AvatarScene'), { ssr: false });

type Path = 'real' | 'away' | 'memorial';
const STEPS = ['lang', 'who', 'perms', 'dog', 'me'] as const;
const SKINS = ['#FBE0C8', '#E8B98F', '#C98E62', '#9C6644', '#6B4226'];
const HAIRS = ['#111111', '#3B2A20', '#8B5A2B', '#D9A066', '#B8B8B8'];
const SHIRTS = ['#E0607E', '#6BA368', '#4F8EF7', '#F2C14E', '#FFFFFF', '#5B3A29', '#A55EEA', '#222222'];
const PANTS = ['#3D5A80', '#222222', '#7A5C3E', '#6B705C', '#B8B8B8', '#E8D2A6'];

async function askLocation(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const p = await Geolocation.requestPermissions();
      return p.location === 'granted';
    }
    return await new Promise((res) => {
      if (!navigator.geolocation) return res(false);
      navigator.geolocation.getCurrentPosition(() => res(true), () => res(false), { timeout: 15000 });
    });
  } catch {
    return false;
  }
}

async function askNotifications(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) return (await LocalNotifications.requestPermissions()).display === 'granted';
    if (typeof Notification === 'undefined') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export default function Onboarding() {
  const router = useRouter();
  const { data, activeDog, settings, updateSettings, saveDog, updateHuman } = useStore();
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<Path>(activeDog?.memorial ? 'memorial' : activeDog?.away ? 'away' : 'real');
  const [dog, setDog] = useState<DogProfile | null>(activeDog);
  const [loc, setLoc] = useState<boolean | null>(null);
  const [notif, setNotif] = useState<boolean | null>(null);
  const human = data.human;

  const go = (d: number) => {
    haptic('tick');
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + d)));
  };

  const commitDog = () => {
    if (!dog) return null;
    const d: DogProfile = { ...dog, name: dog.name.trim() || 'Mikene', memorial: path === 'memorial', away: path === 'away' };
    saveDog(d);
    return d;
  };

  const finish = () => {
    commitDog();
    sfx.bark();
    haptic('success');
    updateSettings({ onboarded: true });
    router.push('/');
  };

  const toPhoto = () => {
    const d = commitDog();
    updateSettings({ onboarded: true });
    router.push(d ? `/create/?id=${d.id}&photo=1` : '/create/');
  };

  const key = STEPS[step];

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      {/* progress */}
      <div className="mb-4 flex gap-1" aria-label={`${step + 1} / ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-moss' : 'bg-bark/15'}`} />
        ))}
      </div>

      <section className="flex flex-1 flex-col">
        {key === 'lang' && (
          <div className="flex flex-1 flex-col animate-pop">
            <div className="mt-6 text-center text-6xl">🐕‍🦺</div>
            <h1 className="mt-4 text-center text-3xl font-black">{t('ob.welcome')}</h1>
            <p className="mt-2 text-center text-bark/70">{t('ob.welcomeSub')}</p>
            <h2 className="label mt-8 text-center">{t('ob.chooseLang')}</h2>
            <div className="mt-2 space-y-2">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => updateSettings({ language: l.id })}
                  className={`card flex w-full items-center gap-3 border-4 py-3 text-lg font-black ${settings.language === l.id ? 'border-moss' : 'border-transparent'}`}
                  aria-pressed={settings.language === l.id}
                >
                  <span className="text-2xl">{l.flag}</span> {l.label}
                  {settings.language === l.id && <span className="ml-auto text-moss">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {key === 'who' && (
          <div className="animate-pop space-y-3">
            <h1 className="text-2xl font-black">{t('ob.whoTitle')}</h1>
            {(['real', 'away', 'memorial'] as Path[]).map((p) => (
              <button
                key={p}
                onClick={() => setPath(p)}
                aria-pressed={path === p}
                className={`card w-full border-4 text-left ${path === p ? 'border-moss' : 'border-transparent'}`}
              >
                <div className="text-lg font-black">{t(`ob.${p}` as 'ob.real')}</div>
                <div className="text-sm text-bark/70">{t(`ob.${p}Hint` as 'ob.realHint')}</div>
              </button>
            ))}
          </div>
        )}

        {key === 'perms' && (
          <div className="animate-pop space-y-3">
            <h1 className="text-2xl font-black">{t('ob.permTitle')}</h1>
            <div className="card space-y-2">
              <div className="text-lg font-black">{t('ob.locTitle')}</div>
              <p className="text-sm text-bark/70">{t('ob.locWhy')}</p>
              <button className={loc ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={!!loc} onClick={async () => setLoc(await askLocation())}>
                {loc ? t('ob.allowed') : t('ob.allow')}
              </button>
            </div>
            <div className="card space-y-2">
              <div className="text-lg font-black">{t('ob.notifTitle')}</div>
              <p className="text-sm text-bark/70">{t('ob.notifWhy')}</p>
              <button className={notif ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={!!notif} onClick={async () => setNotif(await askNotifications())}>
                {notif ? t('ob.allowed') : t('ob.allow')}
              </button>
            </div>
            <p className="text-center text-xs text-bark/60">
              🔒 {t('ob.privacyNote')}{' '}
              <Link href="/privacy/" className="font-bold underline">
                {t('ob.privacyLink')}
              </Link>
            </p>
          </div>
        )}

        {key === 'dog' && dog && (
          <div className="animate-pop space-y-3">
            <h1 className="text-2xl font-black">{t('ob.dogTitle')}</h1>
            <p className="text-sm text-bark/70">{t('ob.dogHint')}</p>
            <div className="relative overflow-hidden rounded-[2rem] shadow-chunky">
              <AvatarScene dog={dog} framing="dog" className="h-56 w-full" anim="idle" weather />
              <PhotoButton onClick={toPhoto} />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {BREEDS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setDog((d) => (d ? applyBreed(d, b.id as Exclude<BreedId, 'custom'>, true) : d))}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${dog.breed === b.id ? 'bg-moss text-white' : 'bg-white'}`}
                >
                  {b.emoji} {t(`breed.${b.id}` as 'breed.golden')}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="label">{t('ob.dogName')}</span>
              <input className="input" value={dog.name} maxLength={20} onChange={(e) => setDog({ ...dog, name: e.target.value })} />
            </label>
            <button className="btn-secondary w-full text-sm" onClick={toPhoto}>
              {t('ob.usePhoto')}
            </button>
          </div>
        )}

        {key === 'me' && (
          <div className="animate-pop space-y-3">
            <h1 className="text-2xl font-black">{t('ob.meTitle')}</h1>
            <p className="text-sm text-bark/70">{t('ob.meHint')}</p>
            <div className="overflow-hidden rounded-[2rem] shadow-chunky">
              <AvatarScene dog={dog} human={human} className="h-56 w-full" />
            </div>
            <div className="card space-y-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('me.skin')}>
                {SKINS.map((c) => (
                  <button key={c} aria-label={`${t('me.skin')} ${c}`} onClick={() => updateHuman({ skin: c })} className={`h-9 w-9 rounded-full border-4 ${human.skin === c ? 'border-moss' : 'border-white'}`} style={{ background: c }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('me.hair')}>
                {HAIRS.map((c) => (
                  <button key={c} aria-label={`${t('me.hair')} ${c}`} onClick={() => updateHuman({ hair: c })} className={`h-9 w-9 rounded-full border-4 ${human.hair === c ? 'border-moss' : 'border-white'}`} style={{ background: c }} />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(['short', 'long', 'bun', 'bald'] as HairStyle[]).map((h) => (
                  <button key={h} onClick={() => updateHuman({ hairStyle: h })} className={`rounded-xl py-2 text-xs font-bold ${human.hairStyle === h ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {t(`hair.${h}` as 'hair.short')}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['tee', 'hoodie', 'dress'] as Outfit[]).map((o) => (
                  <button key={o} onClick={() => updateHuman({ outfit: o } as Partial<HumanAvatar>)} className={`rounded-xl py-2 text-xs font-bold ${(human.outfit ?? 'tee') === o ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {t(`outfit.${o}` as 'outfit.tee')}
                  </button>
                ))}
              </div>
              {/* clothes colours */}
              <div>
                <span className="label">{human.outfit === 'dress' ? t('outfit.dress') : human.outfit === 'hoodie' ? t('outfit.hoodie') : t('me.shirt')}</span>
                <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label={t('me.shirt')}>
                  {SHIRTS.map((c) => (
                    <button key={c} aria-label={`${t('me.shirt')} ${c}`} aria-pressed={human.shirt === c} onClick={() => updateHuman({ shirt: c })} className={`h-9 w-9 rounded-full border-4 ring-1 ring-bark/15 ${human.shirt === c ? 'border-moss' : 'border-white'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
              {human.outfit !== 'dress' && (
                <div>
                  <span className="label">{t('me.pants')}</span>
                  <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label={t('me.pants')}>
                    {PANTS.map((c) => (
                      <button key={c} aria-label={`${t('me.pants')} ${c}`} aria-pressed={human.pants === c} onClick={() => updateHuman({ pants: c })} className={`h-9 w-9 rounded-full border-4 ring-1 ring-bark/15 ${human.pants === c ? 'border-moss' : 'border-white'}`} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <nav className="mt-5 flex gap-2">
        {step > 0 && (
          <button className="btn-secondary px-5" onClick={() => go(-1)} aria-label={t('common.back')}>
            ←
          </button>
        )}
        {key === 'perms' && !loc && !notif ? (
          <button className="btn-secondary flex-1" onClick={() => go(1)}>
            {t('ob.notNow')}
          </button>
        ) : step < STEPS.length - 1 ? (
          <button className="btn-primary flex-1 text-lg" onClick={() => go(1)}>
            {t('common.next')} →
          </button>
        ) : (
          <button className="btn-primary flex-1 text-lg" onClick={finish}>
            {t('ob.start')}
          </button>
        )}
      </nav>
    </main>
  );
}
