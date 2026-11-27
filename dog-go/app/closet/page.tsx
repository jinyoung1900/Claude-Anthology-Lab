'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { trinketName, useT, type TKey } from '@/lib/i18n';
import { currentSeason, KIND_ICON, RARITY_STYLE, TRINKETS } from '@/lib/trinkets';
import type { HairStyle, HumanAvatar, Slot } from '@/lib/types';
import Shop from '@/components/Shop';
import PhotoButton from '@/components/PhotoButton';
import { MockBanner } from '@/components/ads/MockBanner';

const AvatarScene = dynamic(() => import('@/components/three/AvatarScene'), { ssr: false });

type Tab = 'kennel' | 'closet' | 'me' | 'shop';
const SLOTS: Slot[] = ['head', 'face', 'neck', 'back', 'body'];

const PALETTES: Record<'skin' | 'hair' | 'shirt' | 'pants', string[]> = {
  skin: ['#FBE0C8', '#E8B98F', '#C98E62', '#9C6644', '#6B4226', '#4A2C1A'],
  hair: ['#111111', '#3B2A20', '#8B5A2B', '#D9A066', '#E6D3A3', '#B8B8B8', '#E0607E', '#4F8EF7'],
  shirt: ['#E0607E', '#6BA368', '#4F8EF7', '#F2C14E', '#FFFFFF', '#5B3A29', '#A55EEA', '#222222'],
  pants: ['#3D5A80', '#222222', '#7A5C3E', '#6B705C', '#B8B8B8', '#E8D2A6'],
};

function Kennel() {
  const { data, activeDog, setActiveDog, deleteDog } = useStore();
  const { t } = useT();
  const router = useRouter();
  return (
    <div className="space-y-3">
      {data.dogs.map((d) => (
        <div key={d.id} className={`card flex items-center gap-3 border-4 ${d.id === activeDog?.id ? 'border-moss' : 'border-transparent'}`}>
          <Link href={`/create/?id=${d.id}&photo=1`} className="relative shrink-0" aria-label={t('photo.change')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.faceImg} alt="" className="h-16 w-16 rounded-full object-cover" />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow-chunky">📷</span>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-black">
              {d.name} {d.memorial && <span title={t('kennel.memorial')}>🌈</span>}
              {d.away && <span title={t('kennel.away')}>✈️</span>}
            </div>
            <div className="text-xs text-bark/60">
              {t('kennel.walks', { n: data.walks.filter((w) => w.dogId === d.id).length })} ·{' '}
              {d.breed && d.breed !== 'custom' ? t(`breed.${d.breed}` as TKey) : t('kennel.custom')}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
              {d.id !== activeDog?.id ? (
                <button className="text-moss" onClick={() => setActiveDog(d.id)}>
                  {t('kennel.walkWith')}
                </button>
              ) : (
                <span className="text-moss">{t('kennel.active')}</span>
              )}
              <button onClick={() => router.push(`/create/?id=${d.id}`)}>{t('kennel.edit')}</button>
              <Link href={`/book/?dog=${d.id}`} className="text-rare">
                {t('kennel.book')}
              </Link>
              {data.dogs.length > 1 && (
                <button className="text-berry" onClick={() => confirm(t('kennel.removeQ', { name: d.name })) && deleteDog(d.id)}>
                  {t('kennel.remove')}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <Link href="/create/" className="btn-primary w-full">
        {t('kennel.adopt')}
      </Link>
    </div>
  );
}

const DEV_CODE = 'mikene-dev';

function Closet({ onEditMe }: { onEditMe: () => void }) {
  const { data, activeDog, equip, unequip, grantTrinket, notify, loaded } = useStore();
  // TESTING: every outfit (Outfit tab) is unlocked by default. Set to false before release.
  const UNLOCK_ALL_OUTFITS = true;
  useEffect(() => {
    if (!UNLOCK_ALL_OUTFITS || !loaded) return;
    TRINKETS.filter((x) => x.slot === 'body' && !data.inventory[x.id]).forEach((x) => grantTrinket(x.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  // dev unlock: tap the Dino Suit card 15 times, then enter the code
  const taps = useRef({ n: 0, at: 0 });
  const [devOpen, setDevOpen] = useState(false);
  const [devCode, setDevCode] = useState('');
  const tapSecret = () => {
    const now = Date.now();
    taps.current = { n: now - taps.current.at < 1500 ? taps.current.n + 1 : 1, at: now };
    if (taps.current.n >= 15) {
      taps.current = { n: 0, at: 0 };
      setDevCode('');
      setDevOpen(true);
    }
  };
  const unlockAll = () => {
    if (devCode.trim().toLowerCase() !== DEV_CODE) return notify(t('dev.wrong'));
    TRINKETS.forEach((x) => {
      if (!data.inventory[x.id]) grantTrinket(x.id);
    });
    setDevOpen(false);
    notify(t('dev.done'));
  };
  const { t, lang } = useT();
  const [target, setTarget] = useState<'dog' | 'human'>('dog');
  const [slot, setSlot] = useState<Slot>('head');
  const equipped = target === 'dog' ? activeDog?.equipped ?? {} : data.human.equipped;
  // out-of-season items only show once owned
  const visible = TRINKETS.filter((x) => !x.season || x.season === currentSeason() || data.inventory[x.id]);
  // outfits are dog-only
  const shownSlot: Slot = target === 'human' && slot === 'body' ? 'head' : slot;
  const items = visible.filter((x) => x.slot === shownSlot);
  const owned = visible.filter((x) => data.inventory[x.id]).length;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[2rem] shadow-chunky">
        <AvatarScene dog={activeDog} human={data.human} framing={target === 'dog' ? 'dog' : 'human'} className="h-60 w-full" initialYaw={0.5} />
        <div className="absolute left-3 top-3 grid grid-cols-2 gap-1 rounded-full bg-white/85 p-1" role="tablist">
          <button role="tab" aria-selected={target === 'dog'} className={`rounded-full px-3 py-1 text-xs font-bold ${target === 'dog' ? 'bg-moss text-white' : ''}`} onClick={() => setTarget('dog')}>
            🐶 {activeDog?.name ?? t('closet.dog')}
          </button>
          <button role="tab" aria-selected={target === 'human'} className={`rounded-full px-3 py-1 text-xs font-bold ${target === 'human' ? 'bg-moss text-white' : ''}`} onClick={() => setTarget('human')}>
            {t('tab.me')}
          </button>
        </div>
        <span className="chip absolute right-3 top-3 bg-white/85">{t('closet.found', { a: owned, b: visible.length })}</span>
        {target === 'dog' && activeDog && <PhotoButton dogId={activeDog.id} className="bottom-3 right-3" />}
        {target === 'dog' && activeDog ? (
          <Link href={`/create/?id=${activeDog.id}`} className="absolute bottom-3 left-3 flex min-h-11 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-bold shadow-chunky active:translate-y-[2px] active:shadow-none">
            ✏️ {t('closet.editDog', { name: activeDog.name })}
          </Link>
        ) : target === 'human' ? (
          <button onClick={onEditMe} className="absolute bottom-3 left-3 flex min-h-11 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-bold shadow-chunky active:translate-y-[2px] active:shadow-none">
            ✏️ {t('closet.editMe')}
          </button>
        ) : null}
      </div>

      <div className={`grid ${target === 'dog' ? 'grid-cols-5' : 'grid-cols-4'} gap-1 rounded-2xl bg-white p-1`} role="tablist">
        {SLOTS.filter((s) => target === 'dog' || s !== 'body').map((s) => (
          <button key={s} role="tab" aria-selected={shownSlot === s} onClick={() => setSlot(s)} className={`rounded-xl py-2 text-xs font-bold ${shownSlot === s ? 'bg-bark text-white' : ''}`}>
            {t(`slot.${s}` as TKey)}
            {equipped[s] && ' •'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const count = data.inventory[item.id] ?? 0;
          const on = equipped[item.slot] === item.id;
          return (
            <button
              key={item.id}
              aria-disabled={!count}
              aria-pressed={on}
              onClick={() => {
                if (item.id === 'dino') tapSecret();
                if (!count) return;
                if (on) unequip(target, item.slot);
                else equip(target, item.id);
              }}
              className={`relative flex flex-col items-center rounded-2xl border-4 bg-white p-2 text-center shadow-chunky ${count ? '' : 'opacity-40'} ${on ? 'border-moss' : 'border-transparent'}`}
            >
              <div className="flex h-14 w-14 items-center justify-center text-4xl" style={{ filter: count ? undefined : 'grayscale(1) brightness(0.3)' }} aria-hidden>
                {KIND_ICON[item.kind]}
              </div>
              <span className="text-[11px] font-bold leading-tight">{count ? trinketName(item.id, lang) : '???'}</span>
              <span className={`text-[10px] font-black ${RARITY_STYLE[item.rarity].text}`}>
                {t(`rarity.${item.rarity}` as TKey)}
                {item.season && ' 🍂'}
              </span>
              {count > 1 && <span className="chip absolute right-1 top-1 bg-peach px-1.5 py-0 text-[10px]">×{count}</span>}
              {on && <span className="absolute left-1 top-1 text-xs">✅</span>}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-bark/50">{t('closet.hint')}</p>

      {devOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bark/60 p-6" role="dialog" aria-modal aria-label={t('dev.title')}>
          <form
            className="card w-full max-w-xs space-y-3 text-center"
            onSubmit={(e) => {
              e.preventDefault();
              unlockAll();
            }}
          >
            <p className="font-black">🛠️ {t('dev.title')}</p>
            <input className="input text-center" autoFocus autoComplete="off" value={devCode} onChange={(e) => setDevCode(e.target.value)} placeholder={t('dev.placeholder')} aria-label={t('dev.placeholder')} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDevOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary">
                {t('dev.unlock')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Me() {
  const { data, updateHuman } = useStore();
  const { t } = useT();
  const h = data.human;
  const row = (key: keyof typeof PALETTES, label: string) => (
    <div>
      <span className="label">{label}</span>
      <div className="mt-1 flex flex-wrap items-center gap-2" role="group" aria-label={label}>
        {PALETTES[key].map((c) => (
          <button key={c} onClick={() => updateHuman({ [key]: c } as Partial<HumanAvatar>)} className={`h-9 w-9 rounded-full border-4 shadow ${h[key] === c ? 'border-moss' : 'border-white'}`} style={{ background: c }} aria-label={`${label} ${c}`} aria-pressed={h[key] === c} />
        ))}
        <input type="color" value={h[key]} onChange={(e) => updateHuman({ [key]: e.target.value } as Partial<HumanAvatar>)} className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent" aria-label={t('me.custom', { label })} />
      </div>
    </div>
  );
  const shirtLabel = h.outfit === 'dress' ? t('outfit.dress') : h.outfit === 'hoodie' ? t('outfit.hoodie') : t('me.shirt');
  const groups: [TKey, 'eyes' | 'mouth' | 'outfit', string[], string][] = [
    ['me.eyes', 'eyes', ['oval', 'dot', 'happy', 'lashes'], 'oval'],
    ['me.mouth', 'mouth', ['smile', 'grin', 'cat', 'o'], 'smile'],
    ['me.outfit', 'outfit', ['tee', 'hoodie', 'dress'], 'tee'],
  ];
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[2rem] shadow-chunky">
        <AvatarScene human={h} framing="human" className="h-64 w-full" initialYaw={0.4} />
      </div>
      <div className="card space-y-3">
        {row('skin', t('me.skin'))}
        {row('hair', t('me.hair'))}
        <div>
          <span className="label">{t('me.hairStyle')}</span>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {(['short', 'long', 'bun', 'bald'] as HairStyle[]).map((s) => (
              <button key={s} aria-pressed={h.hairStyle === s} onClick={() => updateHuman({ hairStyle: s })} className={`rounded-xl py-2 text-xs font-bold ${h.hairStyle === s ? 'bg-moss text-white' : 'bg-cream'}`}>
                {t(`hair.${s}` as TKey)}
              </button>
            ))}
          </div>
        </div>
        {groups.map(([label, key, opts, def]) => (
          <div key={key}>
            <span className="label">{t(label)}</span>
            <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
              {opts.map((o) => {
                const on = (h[key] ?? def) === o;
                return (
                  <button key={o} aria-pressed={on} onClick={() => updateHuman({ [key]: o } as Partial<HumanAvatar>)} className={`rounded-xl py-2 text-xs font-bold ${on ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {t(`${key}.${o}` as TKey)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <label className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm font-bold">
          {t('me.glasses')}
          <input type="checkbox" className="h-5 w-5 accent-moss" checked={!!h.specs} onChange={(e) => updateHuman({ specs: e.target.checked })} />
        </label>
        {row('shirt', shirtLabel)}
        {row('pants', t('me.pants'))}
      </div>
    </div>
  );
}

function ClosetScreen() {
  const params = useSearchParams();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'closet');
  const TABS: [Tab, TKey][] = [
    ['kennel', 'tab.kennel'],
    ['closet', 'tab.closet'],
    ['me', 'tab.me'],
    ['shop', 'tab.shop'],
  ];
  return (
    <main className="screen space-y-3 px-4 pt-3">
      <h1 className="pt-3 text-2xl font-black">{t('closet.title')}</h1>
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-xl px-1 py-2 text-xs font-bold ${tab === id ? 'bg-moss text-white' : ''}`}>
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'kennel' && <Kennel />}
      {tab === 'closet' && <Closet onEditMe={() => setTab('me')} />}
      {tab === 'me' && <Me />}
      {tab === 'shop' && <Shop />}
      <MockBanner placement="closet_banner" />
    </main>
  );
}

export default function ClosetPage() {
  return (
    <Suspense fallback={null}>
      <ClosetScreen />
    </Suspense>
  );
}
