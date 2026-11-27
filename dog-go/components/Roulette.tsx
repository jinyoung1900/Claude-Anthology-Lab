'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { haptic, sfx } from '@/lib/feedback';
import { useStore } from '@/lib/store';
import { trinketName, useT } from '@/lib/i18n';
import { RARITY_STYLE, rollTrinket, type TrinketDef } from '@/lib/trinkets';
import type { Rarity } from '@/lib/types';

const TrinketPreview = dynamic(() => import('./three/AvatarScene').then((m) => m.TrinketPreview), { ssr: false });

const SEGMENTS: Rarity[] = ['common', 'rare', 'common', 'epic', 'common', 'rare', 'common', 'common'];
const SEG = 360 / SEGMENTS.length;

const gradient = `conic-gradient(${SEGMENTS.map((r, i) => `${RARITY_STYLE[r].hex} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(',')})`;

export default function Roulette() {
  const { data, settings, activeDog, useSpin, grantTrinket, equip, setRouletteOpen } = useStore();
  const { t, lang } = useT();
  const SPIN_MS = settings.reduceMotion ? 600 : 3200;
  const [rot, setRot] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'spinning' | 'result'>('ready');
  const [won, setWon] = useState<TrinketDef | null>(null);
  const [equippedTo, setEquippedTo] = useState<string | null>(null);

  const spin = () => {
    if (phase === 'spinning' || !useSpin()) return;
    const prize = rollTrinket();
    const candidates = SEGMENTS.map((r, i) => (r === prize.rarity ? i : -1)).filter((i) => i >= 0);
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    const center = idx * SEG + SEG / 2 + (Math.random() - 0.5) * SEG * 0.6;
    const cur = ((rot % 360) + 360) % 360;
    const delta = 360 * (settings.reduceMotion ? 1 : 5) + ((360 - center - cur + 720) % 360);
    setRot(rot + delta);
    setPhase('spinning');
    setWon(null);
    setEquippedTo(null);
    haptic('heavy');
    const ticks = settings.reduceMotion ? 4 : 28;
    for (let k = 1; k <= ticks; k++)
      setTimeout(() => {
        sfx.tick();
        haptic('tick');
      }, SPIN_MS * Math.pow(k / ticks, 2.4));
    setTimeout(() => {
      grantTrinket(prize.id);
      sfx.win(prize.rarity);
      haptic('success');
      setWon(prize);
      setPhase('result');
    }, SPIN_MS + 150);
  };

  const close = () => phase !== 'spinning' && setRouletteOpen(false);
  const rarity = (r: Rarity) => t(`rarity.${r}` as 'rarity.common');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bark/60 backdrop-blur-sm sm:items-center" onClick={close} role="dialog" aria-modal aria-label={t('roulette.title')}>
      <div className="w-full max-w-md rounded-t-[2rem] bg-cream p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black">{t('roulette.title')}</h2>
          <span className="chip bg-peach text-bark">{t('roulette.spins', { n: data.spins })}</span>
        </div>

        {phase !== 'result' ? (
          <div className="flex flex-col items-center">
            <div className="relative my-4 h-64 w-64" aria-hidden>
              <div className="absolute left-1/2 top-[-10px] z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-bark" />
              <div
                className="h-full w-full rounded-full border-8 border-white shadow-chunky"
                style={{
                  background: gradient,
                  transform: `rotate(${rot}deg)`,
                  transition: phase === 'spinning' ? `transform ${SPIN_MS}ms cubic-bezier(.15,.85,.2,1)` : 'none',
                }}
              >
                {SEGMENTS.map((r, i) => (
                  <div key={i} className="absolute left-1/2 top-1/2 h-1/2 origin-top text-center text-[10px] font-black text-white" style={{ transform: `rotate(${i * SEG + SEG / 2 + 180}deg)` }}>
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rotate-180 whitespace-nowrap">{rarity(r).toUpperCase()}</span>
                  </div>
                ))}
              </div>
              <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-2xl shadow-chunky">🐾</div>
            </div>
            <p className="mb-4 text-center text-xs text-bark/60">{t('roulette.odds')}</p>
            {data.spins > 0 || phase === 'spinning' ? (
              <button className="btn-primary w-full text-lg" onClick={spin} disabled={phase === 'spinning'}>
                {phase === 'spinning' ? t('roulette.spinning') : t('roulette.spin')}
              </button>
            ) : (
              <p className="card w-full text-center text-sm">{t('roulette.none')}</p>
            )}
          </div>
        ) : (
          won && (
            <div className="flex animate-pop flex-col items-center" aria-live="polite">
              <span className={`chip mt-2 text-white ${RARITY_STYLE[won.rarity].bg}`}>{rarity(won.rarity)}</span>
              <TrinketPreview id={won.id} className="my-2 h-48 w-48" />
              <h3 className="text-center text-2xl font-black">{trinketName(won.id, lang)}</h3>
              <p className="mb-4 text-sm text-bark/60">{t('roulette.added', { slot: t(`slot.${won.slot}` as 'slot.head') })}</p>
              {equippedTo ? (
                <p className="mb-3 font-bold text-moss">{t('roulette.equipped', { name: equippedTo })}</p>
              ) : (
                <div className="mb-3 grid w-full grid-cols-2 gap-2">
                  {activeDog && (
                    <button className="btn-primary" onClick={() => { equip('dog', won.id); setEquippedTo(activeDog.name); }}>
                      {t('roulette.putOn', { name: activeDog.name })}
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => { equip('human', won.id); setEquippedTo(t('common.you')); }}>
                    {t('roulette.wear')}
                  </button>
                </div>
              )}
              <div className="grid w-full grid-cols-2 gap-2">
                <button className="btn-secondary" onClick={close}>{t('common.done')}</button>
                <button className="btn-berry" disabled={data.spins <= 0} onClick={() => setPhase('ready')}>
                  {t('roulette.again', { n: data.spins })}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
