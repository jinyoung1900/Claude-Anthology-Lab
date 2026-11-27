'use client';

/**
 * Shareable walk card: snapshot of the 3D duo + route sketch + stats → 1080x1350 PNG.
 * Android: written to cache via Filesystem, then the native share sheet.
 * Browser: Web Share API with a file, or a download.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useRef, useState } from 'react';
import AvatarScene from './three/AvatarScene';
import { useStore } from '@/lib/store';
import { formatDistance, formatDuration } from '@/lib/geo';
import { haptic } from '@/lib/feedback';
import type { LatLng, Walk } from '@/lib/types';
import { dateLocale, useT } from '@/lib/i18n';
import { FEELING_EMOJI } from '@/lib/feelings';

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRoute(ctx: CanvasRenderingContext2D, segments: LatLng[][], x: number, y: number, size: number) {
  ctx.fillStyle = '#E3F0DC';
  roundRect(ctx, x, y, size, size, 36);
  ctx.fill();
  const pts = segments.flat();
  if (pts.length < 2) {
    ctx.font = '120px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('🐾', x + size / 2, y + size / 2 + 40);
    ctx.textAlign = 'left';
    return;
  }
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const w = Math.max((maxLng - minLng) * k, 1e-6), h = Math.max(maxLat - minLat, 1e-6);
  const span = Math.max(w, h);
  const pad = 40, S = size - pad * 2;
  const proj = ([la, ln]: LatLng) => [x + pad + (((ln - minLng) * k + (span - w) / 2) / span) * S, y + pad + ((maxLat - la + (span - h) / 2) / span) * S];
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const [color, width] of [['#ffffff', 22], ['#E0607E', 12]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const seg of segments) {
      if (seg.length < 2) continue;
      ctx.beginPath();
      seg.forEach((p, i) => {
        const [px, py] = proj(p);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
  }
  const [sx, sy] = proj(pts[0]);
  ctx.fillStyle = '#6BA368';
  ctx.beginPath();
  ctx.arc(sx, sy, 14, 0, Math.PI * 2);
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lh);
      line = word;
      if (++lines >= maxLines - 1) break;
    } else line = test;
  }
  ctx.fillText(lines >= maxLines - 1 && words.length ? line + '…' : line, x, y + lines * lh);
}

export default function ShareCard({ walk, onClose }: { walk: Walk; onClose: () => void }) {
  const { data } = useStore();
  const { t, lang } = useT();
  const dog = data.dogs.find((d) => d.id === walk.dogId) ?? data.dogs[0];
  const sceneRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const compose = () => {
    const gl = sceneRef.current?.querySelector('canvas');
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#FFF7EC';
    ctx.fillRect(0, 0, W, H);

    // 3D snapshot
    ctx.save();
    roundRect(ctx, 40, 40, W - 80, 720, 56);
    ctx.clip();
    ctx.fillStyle = '#BFE3F2';
    ctx.fillRect(40, 40, W - 80, 720);
    if (gl) {
      const scale = Math.max((W - 80) / gl.width, 720 / gl.height);
      const dw = gl.width * scale, dh = gl.height * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(gl, 40 + (W - 80 - dw) / 2, 40 + (720 - dh) / 2, dw, dh);
    }
    ctx.restore();

    // name chip
    const chip = `${walk.mode === 'virtual' ? '✨' : '🦮'} ${walk.dogName}`;
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(ctx, 76, 76, ctx.measureText(chip).width + 56, 84, 42);
    ctx.fill();
    ctx.fillStyle = '#5B3A29';
    ctx.fillText(chip, 104, 133);

    // stats
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.fillText(formatDistance(walk.distanceM), 440, 860);
    ctx.font = '700 36px system-ui, sans-serif';
    ctx.fillStyle = '#8a6f60';
    ctx.fillText(new Date(walk.startedAt).toLocaleDateString(dateLocale(lang), { weekday: 'long', month: 'long', day: 'numeric' }), 440, 912);
    ctx.fillStyle = '#5B3A29';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText(`⏱ ${formatDuration(walk.durationMs)}`, 440, 990);
    ctx.fillText(`${walk.mode === 'virtual' ? '🐾' : '🌸'} ${walk.blooms?.length ?? 0}   🦴 ${walk.finds?.length ?? 0}${walk.feeling ? '   ' + FEELING_EMOJI[walk.feeling] : ''}`, 440, 1050);
    if (walk.note) {
      ctx.font = 'italic 600 34px system-ui, sans-serif';
      ctx.fillStyle = '#6d5446';
      wrap(ctx, `“${walk.note}”`, 440, 1120, 580, 44, 3);
    }

    drawRoute(ctx, walk.segments, 60, 800, 350);

    // brand
    ctx.fillStyle = '#6BA368';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillText('Dog-go 🐾', 60, 1290);
    ctx.fillStyle = '#a08b7f';
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillText(t('app.tagline'), 300, 1288);
    setImg(c.toDataURL('image/png'));
  };

  const share = async () => {
    if (!img) return;
    setBusy(true);
    setMsg('');
    haptic('tap');
    const name = `dog-go-walk-${new Date(walk.startedAt).toISOString().slice(0, 10)}.png`;
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await Filesystem.writeFile({ path: name, data: img.split(',')[1], directory: Directory.Cache });
        await Share.share({ title: t('share.walkWith', { name: walk.dogName }), files: [res.uri] });
      } else {
        const blob = await (await fetch(img)).blob();
        const file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: t('share.walkWith', { name: walk.dogName }) });
        else {
          const a = document.createElement('a');
          a.href = img;
          a.download = name;
          a.click();
          setMsg(t('share.saved'));
        }
      }
    } catch (e) {
      if (!(e instanceof Error && /cancel|abort/i.test(e.message))) setMsg(t('share.fail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-bark/70 sm:items-center" onClick={onClose}>
      <div className="max-h-[94dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-[2rem] bg-cream p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black">{t('share.title')}</h2>
        {!img ? (
          <>
            <p className="text-sm text-bark/70">{t('share.pose')}</p>
            <div ref={sceneRef} className="overflow-hidden rounded-[2rem] shadow-chunky">
              <AvatarScene dog={dog} human={data.human} anim="idle" className="h-64 w-full" preserveBuffer pixelScale={1.5} weather />
            </div>
            <button className="btn-primary w-full" onClick={compose}>{t('share.make')}</button>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="Walk card" className="w-full rounded-2xl shadow-chunky" />
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary" onClick={() => setImg(null)}>{t('share.repose')}</button>
              <button className="btn-primary" disabled={busy} onClick={share}>{busy ? t('share.sharing') : t('share.share')}</button>
            </div>
          </>
        )}
        {msg && <p className="text-center text-xs font-bold text-moss">{msg}</p>}
        <button className="w-full text-sm text-bark/60 underline" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}
