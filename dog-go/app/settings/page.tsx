'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/reminders';
import { exportBackup, readBackup, restorePhotos } from '@/lib/backup';
import { haptic, sfx } from '@/lib/feedback';
import { dateLocale, LANGS, useT } from '@/lib/i18n';
import BatteryTip from '@/components/BatteryTip';

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span>
        <span className="font-bold">{label}</span>
        {hint && <span className="block text-xs text-bark/60">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" aria-checked={checked} className="h-6 w-6 shrink-0 accent-moss" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const mb = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${(n / 1e6).toFixed(1)} MB`);

export default function SettingsPage() {
  const router = useRouter();
  const { data, settings, updateSettings, replaceAll, activeDog } = useStore();
  const { t, lang } = useT();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState(false);
  const [storage, setStorage] = useState<{ used: number; quota: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.quota && setStorage({ used: e.usage ?? 0, quota: e.quota }));
  }, [data.walks.length]);

  const setReminder = async (on: boolean, time = settings.reminderTime) => {
    if (on) {
      const ok = await scheduleDailyReminder(time, activeDog?.name ?? t('home.yourPup'));
      updateSettings({ reminderOn: ok, reminderTime: time });
      setMsg(ok ? t('s.reminderSet', { time }) : t('s.denied'));
    } else {
      await cancelDailyReminder();
      updateSettings({ reminderOn: false, reminderTime: time });
    }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const r = await exportBackup(data, settings);
      setMsg(r.native ? t('s.backupReady') : t('s.downloaded', { name: r.name }));
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setMsg(t('s.backupFail'));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file?: File) => {
    if (!file) return;
    try {
      const b = await readBackup(file);
      const when = new Date(b.exportedAt).toLocaleString(dateLocale(lang));
      if (!confirm(t('s.restoreQ', { when, d: b.data.dogs.length, w: b.data.walks.length }))) return;
      setBusy(true);
      await restorePhotos(b.photos);
      replaceAll(b.data);
      updateSettings({ ...b.settings, onboarded: true });
      sfx.win('rare');
      haptic('success');
      setMsg(t('s.restored'));
    } catch {
      setMsg(t('s.badFile'));
    } finally {
      setBusy(false);
    }
  };

  const buyAdFree = () => {
    if (!confirm(t('s.buyQ'))) return;
    updateSettings({ adFree: true });
    sfx.win('epic');
    haptic('success');
    setMsg(t('s.adFreeOn'));
  };

  // Changing the reminder language: reschedule so the notification text follows
  const setLang = (l: typeof lang) => {
    updateSettings({ language: l });
    haptic('tick');
    if (settings.reminderOn) setTimeout(() => void scheduleDailyReminder(settings.reminderTime, activeDog?.name ?? ''), 50);
  };

  const nearlyFull = storage && storage.used / storage.quota > 0.85;

  return (
    <main className="screen space-y-3 px-4 pt-3">
      <header className="flex items-center gap-3 pt-3">
        <Link href="/" className="btn-secondary px-3 py-2" aria-label={t('common.back')}>
          ←
        </Link>
        <h1 className="text-2xl font-black">{t('settings.title')}</h1>
      </header>

      {msg && (
        <p role="status" className="animate-pop rounded-2xl bg-moss/15 px-4 py-2 text-center text-sm font-bold text-moss">
          {msg}
        </p>
      )}

      <section className="card space-y-2">
        <h2 className="label">🌐 {t('s.language')}</h2>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t('s.language')}>
          {LANGS.map((l) => (
            <button key={l.id} role="radio" aria-checked={lang === l.id} onClick={() => setLang(l.id)} className={`rounded-xl py-2 text-sm font-bold ${lang === l.id ? 'bg-moss text-white' : 'bg-cream'}`}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="label">{t('s.walks')}</h2>
        <label className="block">
          <span className="font-bold">{t('s.goal', { n: settings.weeklyGoalKm })}</span>
          <span className="flex items-center gap-2">
            <input className="flex-1" type="range" min={1} max={50} step={0.5} value={Math.min(50, settings.weeklyGoalKm)} onChange={(e) => updateSettings({ weeklyGoalKm: +e.target.value })} />
            <input
              className="input w-20 py-1 text-center text-sm"
              type="number"
              inputMode="decimal"
              min={0.5}
              max={500}
              step={0.5}
              aria-label={t('home.goalKm')}
              value={settings.weeklyGoalKm}
              onChange={(e) => {
                const n = +e.target.value;
                if (n >= 0.5 && n <= 500) updateSettings({ weeklyGoalKm: n });
              }}
            />
          </span>
        </label>
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="font-bold">{t('s.reminder')}</span>
            <span className="block text-xs text-bark/60">{settings.reminderOn ? t('s.every', { time: settings.reminderTime }) : t('s.off')}</span>
          </span>
          <input
            type="time"
            className="input w-28 py-1 text-sm"
            aria-label={t('s.reminder')}
            value={settings.reminderTime}
            onChange={(e) => (settings.reminderOn ? setReminder(true, e.target.value) : updateSettings({ reminderTime: e.target.value }))}
          />
          <input type="checkbox" role="switch" className="h-6 w-6 accent-moss" checked={settings.reminderOn} onChange={(e) => setReminder(e.target.checked)} aria-label={t('s.reminder')} />
        </div>
        <button className="btn-secondary w-full text-sm" onClick={() => setTip(true)}>
          {t('s.battery')}
        </button>
        {!Capacitor.isNativePlatform() && <p className="text-[11px] text-bark/50">{t('s.batteryWeb')}</p>}
      </section>

      <section className="card space-y-1">
        <h2 className="label">{t('s.feel')}</h2>
        <Toggle label={t('s.sound')} hint={t('s.soundHint')} checked={settings.soundOn} onChange={(v) => { updateSettings({ soundOn: v }); if (v) setTimeout(() => sfx.bark(), 50); }} />
        <Toggle label={t('s.vibe')} hint={t('s.vibeHint')} checked={settings.hapticsOn} onChange={(v) => { updateSettings({ hapticsOn: v }); if (v) setTimeout(() => haptic('success'), 50); }} />
      </section>

      <section className="card space-y-1">
        <h2 className="label">{t('s.access')}</h2>
        <Toggle label={t('s.reduceMotion')} hint={t('s.reduceMotionHint')} checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
        <Toggle label={t('s.largeText')} checked={settings.largeText} onChange={(v) => updateSettings({ largeText: v })} />
      </section>

      <section className="card space-y-2">
        <h2 className="label">{t('s.premium')}</h2>
        {settings.adFree ? (
          <>
            <p className="font-bold text-moss">{t('s.adFreeOn')}</p>
            <button className="text-xs text-bark/50 underline" onClick={() => updateSettings({ adFree: false })}>
              {t('s.restoreAds')}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="font-bold">{t('s.adFree')}</span>
              <span className="block text-xs text-bark/60">{t('s.adFreeHint')}</span>
            </span>
            <button className="btn-berry shrink-0 px-4 py-2 text-sm" onClick={buyAdFree}>
              {t('s.buy')}
            </button>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="label">{t('s.backup')}</h2>
        <p className="text-sm text-bark/70">{t('s.backupHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary text-sm" disabled={busy} onClick={doExport}>
            {t('s.saveBackup')}
          </button>
          <button className="btn-secondary text-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {t('s.restore')}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = ''; }} />
        <p className="text-[11px] text-bark/50">
          {t('s.counts', { d: data.dogs.length, w: data.walks.length, p: data.walks.reduce((s, w) => s + (w.photos?.length ?? 0), 0) })}
        </p>
        {storage && <p className="text-[11px] text-bark/50">{t('s.storage', { used: mb(storage.used), quota: mb(storage.quota) })}</p>}
        {nearlyFull && (
          <p role="alert" className="rounded-xl bg-berry/15 px-3 py-2 text-xs font-bold text-berry">
            {t('s.storageWarn')}
          </p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="label">{t('s.about')}</h2>
        <Link href="/privacy/" className="btn-secondary w-full text-sm">
          {t('s.privacy')}
        </Link>
        <button
          className="btn-secondary w-full text-sm"
          onClick={() => {
            updateSettings({ onboarded: false });
            router.push('/');
          }}
        >
          {t('s.tour')}
        </button>
      </section>

      <p className="pb-4 text-center text-[11px] text-bark/40">{t('s.footer')}</p>
      {tip && <BatteryTip onClose={() => { setTip(false); updateSettings({ batteryTipShown: true }); }} />}
    </main>
  );
}
