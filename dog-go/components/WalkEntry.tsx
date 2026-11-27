'use client';

import { useState } from 'react';
import type { Walk } from '@/lib/types';
import { formatDistance, formatDuration } from '@/lib/geo';
import { dateLocale, useT } from '@/lib/i18n';
import { FEELING_EMOJI } from '@/lib/feelings';
import RouteSketch from './RouteSketch';

/** One walk in History / Memory book: route sketch, stats, feeling, note editing, photos. */
export default function WalkEntry({
  w,
  photos,
  onNote,
  onDelete,
  onShare,
  onPhoto,
}: {
  w: Walk;
  photos: Record<string, string>;
  onNote: (note: string) => void;
  onDelete?: () => void;
  onShare: () => void;
  onPhoto: (src: string) => void;
}) {
  const { t, lang } = useT();
  const loc = dateLocale(lang);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(w.note);
  const pics = (w.photos ?? []).filter((p) => photos[p.id]);

  return (
    <article className="card space-y-2">
      <div className="flex gap-3">
        <RouteSketch segments={w.segments} className="h-24 w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-black">
                {new Date(w.startedAt).toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric' })}
                {w.feeling && (
                  <span className="ml-1" title={t(`feeling.${w.feeling}` as 'feeling.joy')}>
                    {FEELING_EMOJI[w.feeling]}
                  </span>
                )}
              </div>
              <div className="text-xs text-bark/60">
                {new Date(w.startedAt).toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })} · {t('entry.with', { name: w.dogName })}
              </div>
            </div>
            <span className={`chip shrink-0 ${w.mode === 'virtual' ? 'bg-epic/15 text-epic' : 'bg-moss/15 text-moss'}`}>{t(w.mode === 'virtual' ? 'entry.virtual' : 'entry.real')}</span>
          </div>
          <div className="mt-1 text-sm font-bold">
            {formatDistance(w.distanceM)} · {formatDuration(w.durationMs)}
          </div>
          <div className="text-xs text-bark/60">
            {w.mode === 'virtual' ? '🐾' : '🌸'} {w.blooms?.length ?? 0} · 🦴 {w.finds?.length ?? 0} · 📷 {w.photos?.length ?? 0}
          </div>
        </div>
      </div>

      {pics.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {pics.map((p) => (
            <button key={p.id} onClick={() => onPhoto(photos[p.id])} className="shrink-0" aria-label="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[p.id]} alt="" className="h-20 w-20 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <div className="space-y-1">
          <textarea className="input h-16 resize-none text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} autoFocus aria-label={t('walk.note')} />
          <div className="flex gap-3 text-xs font-bold">
            <button className="text-moss" onClick={() => { onNote(draft.trim()); setEditing(false); }}>{t('common.save')}</button>
            <button className="text-bark/50" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            {onDelete && (
              <button className="ml-auto text-berry" onClick={() => confirm(t('entry.deleteQ')) && onDelete()}>
                {t('entry.delete')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <button className="flex-1 text-left text-sm italic text-bark/70" onClick={() => { setDraft(w.note); setEditing(true); }}>
            {w.note ? `“${w.note}”` : t('entry.addNote')}
          </button>
          <button className="chip bg-cream" onClick={onShare}>{t('entry.share')}</button>
        </div>
      )}
    </article>
  );
}

export function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" onClick={onClose} role="dialog" aria-modal>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full rounded-2xl" />
    </div>
  );
}
