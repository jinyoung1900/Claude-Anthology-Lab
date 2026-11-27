'use client';

/**
 * Leaflet + free OpenStreetMap tiles. Leaflet is imported lazily (it touches `window`).
 * Draws routes, route flowers / pawprints, sniff finds and walk photos.
 */
import { useEffect, useRef, useState } from 'react';
import type * as LType from 'leaflet';
import type { Bloom, Find, LatLng, WalkPhoto } from '@/lib/types';
import { DEFAULT_CENTER } from '@/lib/geo';
import { loadPhoto } from '@/lib/storage';
import { useT } from '@/lib/i18n';

export const BLOOM_EMOJI = ['🌸', '🌼', '🌷', '🌻', '🪻', '🌺'];
export const FIND_EMOJI: Record<Find['kind'], string> = { bone: '🦴', stick: '🪵', ball: '🎾', sock: '🧦', acorn: '🌰' };

interface Props {
  segments: LatLng[][];
  current?: LatLng | null;
  follow?: boolean;
  blooms?: Bloom[];
  finds?: Find[];
  photos?: WalkPhoto[];
  /** zoom to fit everything once data is present (history / garden / memory book) */
  fit?: boolean;
  className?: string;
}

const emojiIcon = (L: typeof LType, emoji: string, size = 22) =>
  L.divIcon({
    className: '',
    html: `<div style="font-size:${size}px;line-height:1;transform:translate(-50%,-60%);filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))">${emoji}</div>`,
    iconSize: [0, 0],
  });

export default function WalkMap({ segments, current = null, follow = false, blooms = [], finds = [], photos = [], fit = false, className = '' }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof LType | null>(null);
  const map = useRef<LType.Map | null>(null);
  const layer = useRef<LType.LayerGroup | null>(null);
  const me = useRef<LType.CircleMarker | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t } = useT();

  useEffect(() => {
    let cancelled = false;
    import('leaflet').catch(() => { setFailed(true); return null; }).then((mod) => {
      if (!mod) return;
      if (cancelled || !el.current || map.current) return;
      const Lf = (mod.default ?? mod) as typeof LType;
      L.current = Lf;
      const m = Lf.map(el.current, { zoomControl: false, attributionControl: true }).setView(current ?? segments.flat()[0] ?? DEFAULT_CENTER, 17);
      Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      layer.current = Lf.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      me.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // routes + markers
  useEffect(() => {
    const Lf = L.current;
    const g = layer.current;
    if (!ready || !Lf || !g) return;
    g.clearLayers();
    for (const seg of segments) {
      if (seg.length < 2) continue;
      Lf.polyline(seg, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(g);
      Lf.polyline(seg, { color: '#E0607E', weight: 5 }).addTo(g);
    }
    const first = segments.find((s) => s.length)?.[0];
    if (first && !fit) Lf.circleMarker(first, { radius: 6, color: '#fff', weight: 3, fillColor: '#6BA368', fillOpacity: 1 }).addTo(g);

    blooms.forEach((b) => Lf.marker([b.lat, b.lng], { icon: emojiIcon(Lf, b.kind === 'paw' ? '🐾' : BLOOM_EMOJI[b.variant % BLOOM_EMOJI.length], 20), interactive: false }).addTo(g));
    finds.forEach((f) =>
      Lf.marker([f.lat, f.lng], { icon: emojiIcon(Lf, FIND_EMOJI[f.kind], 24) })
        .bindPopup(`<b>${t('map.found', { item: t(`find.${f.kind}` as 'find.bone') })}</b><br/>${t('map.treats', { n: f.treats })}${f.trinketId ? t('map.plusTrinket') : ''}`)
        .addTo(g),
    );
    photos.forEach((p) => {
      const mk = Lf.marker([p.lat, p.lng], { icon: emojiIcon(Lf, '📷', 24) }).addTo(g);
      mk.bindPopup(t('map.loading'), { maxWidth: 220 });
      mk.on('popupopen', async () => {
        const src = await loadPhoto(p.id);
        mk.setPopupContent(src ? `<img src="${src}" style="width:200px;border-radius:12px"/>` : t('map.photoMissing'));
      });
    });

    if (fit && !fitted.current) {
      const pts: LatLng[] = [...segments.flat(), ...blooms.map((b) => [b.lat, b.lng] as LatLng), ...photos.map((p) => [p.lat, p.lng] as LatLng)];
      if (pts.length) {
        map.current?.fitBounds(Lf.latLngBounds(pts), { padding: [30, 30], maxZoom: 17 });
        fitted.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, blooms, finds, photos, ready, fit]);

  // me marker + follow
  useEffect(() => {
    const Lf = L.current;
    if (!ready || !Lf || !map.current || !current) return;
    if (!me.current) {
      me.current = Lf.circleMarker(current, { radius: 9, color: '#fff', weight: 4, fillColor: '#4F8EF7', fillOpacity: 1 }).addTo(map.current);
    } else me.current.setLatLng(current);
    if (follow) map.current.panTo(current, { animate: true });
  }, [current, follow, ready]);

  if (failed)
    return (
      <div className={`flex items-center justify-center bg-moss/10 p-6 text-center text-sm font-bold text-bark/70 ${className}`}>🗺️ {t('err.map')}</div>
    );
  return <div ref={el} className={`z-0 ${className}`} role="application" aria-label="map" />;
}
