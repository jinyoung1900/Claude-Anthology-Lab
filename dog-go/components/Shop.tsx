'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { haptic, sfx } from '@/lib/feedback';
import { trinketName, useT } from '@/lib/i18n';
import { currentSeason, KIND_ICON, RARITY_STYLE, SHOP_PRICE, SPIN_PRICE, TRINKETS, TRINKET_MAP } from '@/lib/trinkets';
import type { Rarity } from '@/lib/types';

const SELL_PRICE: Record<Rarity, number> = { common: 5, rare: 15, epic: 40 };
const TRADE_COST = 3;

/** Three daily picks (one per rarity), same for everyone on the same day; seasonal items included in season. */
function dailyPicks(date = new Date()) {
  let seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return (['common', 'rare', 'epic'] as Rarity[]).map((r) => {
    const pool = TRINKETS.filter((x) => x.rarity === r && !x.rewardOnly && (!x.season || x.season === currentSeason()));
    return pool[Math.floor(rand() * pool.length)];
  });
}

export default function Shop() {
  const { data, spendTreats, addSpins, addTreats, grantTrinket, consumeTrinket } = useStore();
  const { t, lang } = useT();
  const [msg, setMsg] = useState<string | null>(null);
  const picks = dailyPicks();
  const dupes = Object.entries(data.inventory)
    .filter(([id, n]) => n > 1 && TRINKET_MAP[id] && !TRINKET_MAP[id].rewardOnly)
    .map(([id, n]) => ({ item: TRINKET_MAP[id], extra: n - 1 }));

  const ok = (text: string) => {
    sfx.coin();
    haptic('success');
    setMsg(text);
  };
  const broke = () => {
    haptic('heavy');
    setMsg(t('shop.broke'));
  };

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between gap-2">
        <div>
          <div className="label">{t('shop.yourTreats')}</div>
          <div className="text-2xl font-black">🍪 {data.treats}</div>
        </div>
        <button className="btn-berry px-3 py-2 text-sm" onClick={() => (spendTreats(SPIN_PRICE) ? (addSpins(1), ok(t('shop.gotSpin'))) : broke())}>
          {t('shop.buySpin', { n: SPIN_PRICE })}
        </button>
      </div>
      {msg && (
        <p className="animate-pop text-center text-sm font-bold text-moss" role="status">
          {msg}
        </p>
      )}

      <section>
        <h3 className="mb-2 font-black">{t('shop.picks')}</h3>
        <div className="grid grid-cols-3 gap-2">
          {picks.map((item) => {
            const price = SHOP_PRICE[item.rarity];
            const name = trinketName(item.id, lang);
            return (
              <button
                key={item.id}
                onClick={() => (spendTreats(price) ? (grantTrinket(item.id), ok(t('shop.got', { name }))) : broke())}
                className="flex flex-col items-center rounded-2xl bg-white p-2 text-center shadow-chunky"
              >
                <span className="text-4xl" aria-hidden>{KIND_ICON[item.kind]}</span>
                <span className="text-[11px] font-bold leading-tight">{name}</span>
                <span className={`text-[10px] font-black ${RARITY_STYLE[item.rarity].text}`}>
                  {t(`rarity.${item.rarity}` as 'rarity.common')} · {t(`slot.${item.slot}` as 'slot.head')}
                </span>
                <span className="chip mt-1 bg-peach">{price} 🍪</span>
                {data.inventory[item.id] ? <span className="text-[10px] text-bark/50">{t('shop.owned', { n: data.inventory[item.id] })}</span> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-center text-[11px] text-bark/50">{t('shop.newPicks')}</p>
      </section>

      <section>
        <h3 className="mb-2 font-black">{t('shop.trade')}</h3>
        {dupes.length === 0 ? (
          <p className="card text-center text-sm text-bark/60">{t('shop.noDupes')}</p>
        ) : (
          <div className="space-y-2">
            {dupes.map(({ item, extra }) => (
              <div key={item.id} className="card flex items-center gap-3 p-3">
                <span className="text-3xl" aria-hidden>{KIND_ICON[item.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black">{trinketName(item.id, lang)}</div>
                  <div className="text-[11px] text-bark/60">{t('shop.spare', { n: extra })}</div>
                </div>
                <button
                  className="chip bg-cream py-2"
                  onClick={() => {
                    consumeTrinket(item.id, 1);
                    addTreats(SELL_PRICE[item.rarity]);
                    ok(t('shop.sold', { n: SELL_PRICE[item.rarity] }));
                  }}
                >
                  {t('shop.sell', { n: SELL_PRICE[item.rarity] })}
                </button>
                <button
                  className="chip bg-berry py-2 text-white disabled:opacity-40"
                  disabled={extra < TRADE_COST}
                  onClick={() => {
                    consumeTrinket(item.id, TRADE_COST);
                    addSpins(1);
                    ok(t('shop.traded'));
                  }}
                >
                  3 → 🎁
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
