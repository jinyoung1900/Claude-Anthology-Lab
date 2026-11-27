'use client';

/**
 * Two-box 2D canvas cropper.
 *  Box 1 (FACE): square, rotatable, with eye-line + nose-dot guides → mapped onto the head's front face.
 *  Box 2 (FUR):  square swatch → tiled over body, legs, ears & tail.
 * Drag a box to move it, its ↘ corner to resize, the ⟳ knob (face) to rotate, or pinch with two fingers.
 * The sliders below still work too.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CropBox } from '@/lib/image';
import { useT } from '@/lib/i18n';

export type BoxId = 'face' | 'fur';

interface Props {
  image: HTMLImageElement;
  face: CropBox;
  fur: CropBox;
  active: BoxId;
  onActive: (b: BoxId) => void;
  onChange: (b: BoxId, box: CropBox) => void;
}

const FACE_COLOR = '#E0607E';
const FUR_COLOR = '#4F8EF7';
export const EYE_LINE = 0.4; // fraction from top of face box
export const NOSE_DOT = 0.64;

function corners(b: CropBox) {
  const h = b.size / 2;
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ].map(([x, y]) => [b.cx + x * c - y * s, b.cy + x * s + y * c]);
}

/** box-local → image coords */
function localToImg(b: CropBox, lx: number, ly: number) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return [b.cx + lx * c - ly * s, b.cy + lx * s + ly * c];
}

const HANDLE_PX = 13; // drawn radius
const HIT_PX = 26; // touch radius

type Mode =
  | { kind: 'move'; id: BoxId; dx: number; dy: number }
  | { kind: 'resize'; id: BoxId }
  | { kind: 'rotate'; id: BoxId }
  | { kind: 'pinch'; id: BoxId; dist0: number; ang0: number; size0: number; rot0: number };

function inside(b: CropBox, x: number, y: number) {
  const dx = x - b.cx, dy = y - b.cy;
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= b.size / 2 && Math.abs(ly) <= b.size / 2;
}

export default function TwoBoxCropper({ image, face, fur, active, onActive, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ w: 320, h: 320, scale: 1, ox: 0, oy: 0 });
  const drag = useRef<Mode | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const imgMin = Math.min(image.width, image.height);
  const clampSize = (v: number) => Math.max(imgMin * 0.04, Math.min(imgMin, v));
  /** handle positions in image coords for a box */
  const handles = (b: CropBox, id: BoxId) => ({
    resize: localToImg(b, b.size / 2, b.size / 2),
    rotate: id === 'face' ? localToImg(b, 0, -b.size / 2 - 30 / view.scale) : null,
  });
  const { t } = useT();

  // fit image into container
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = Math.min(w * 1.1, 440);
      const scale = Math.min(w / image.width, h / image.height);
      setView({ w, h, scale, ox: (w - image.width * scale) / 2, oy: (h - image.height * scale) / 2 });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [image]);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = view.w * dpr;
    c.height = view.h * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2b1d15';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.drawImage(image, view.ox, view.oy, image.width * view.scale, image.height * view.scale);

    const toView = ([x, y]: number[]) => [view.ox + x * view.scale, view.oy + y * view.scale];

    const drawBox = (b: CropBox, color: string, id: BoxId) => {
      const pts = corners(b).map(toView);
      ctx.save();
      ctx.lineWidth = active === id ? 3 : 2;
      ctx.strokeStyle = color;
      ctx.setLineDash(id === 'fur' ? [6, 4] : []);
      ctx.globalAlpha = active === id ? 1 : 0.6;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // label
      const [lx, ly] = pts[0];
      ctx.fillStyle = color;
      ctx.font = 'bold 11px system-ui';
      const label = t(id === 'face' ? 'create.face' : 'create.fur');
      const tw = ctx.measureText(label).width + 8;
      ctx.translate(lx, ly);
      ctx.rotate(b.rot);
      ctx.fillRect(0, -16, tw, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 4, -4);
      ctx.restore();

      if (active === id) {
        const hs = handles(b, id);
        const knob = ([x, y]: number[], glyph: string) => {
          const [vx, vy] = toView([x, y]);
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(vx, vy, HANDLE_PX, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = color;
          ctx.font = 'bold 14px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(glyph, vx, vy + 1);
          ctx.restore();
        };
        if (hs.rotate) {
          const [tx, ty] = toView(localToImg(b, 0, -b.size / 2));
          const [rx, ry] = toView(hs.rotate);
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.restore();
          knob(hs.rotate, '⟳');
        }
        knob(hs.resize, '↘');
      }

      if (id === 'face') {
        // guides in box-local space
        ctx.save();
        const [cx, cy] = toView([b.cx, b.cy]);
        const s = b.size * view.scale;
        ctx.translate(cx, cy);
        ctx.rotate(b.rot);
        ctx.globalAlpha = active === id ? 0.95 : 0.5;
        ctx.strokeStyle = '#FFF3A0';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        // eye line
        const ey = -s / 2 + s * EYE_LINE;
        ctx.beginPath();
        ctx.moveTo(-s / 2, ey);
        ctx.lineTo(s / 2, ey);
        // centre line
        ctx.moveTo(0, -s / 2);
        ctx.lineTo(0, s / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // eye targets
        ctx.strokeStyle = '#FFF3A0';
        [-1, 1].forEach((k) => {
          ctx.beginPath();
          ctx.arc(k * s * 0.2, ey, Math.max(4, s * 0.06), 0, Math.PI * 2);
          ctx.stroke();
        });
        // nose dot
        ctx.fillStyle = '#FFF3A0';
        ctx.beginPath();
        ctx.arc(0, -s / 2 + s * NOSE_DOT, Math.max(3, s * 0.03), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    // draw inactive first so active is on top
    if (active === 'face') {
      drawBox(fur, FUR_COLOR, 'fur');
      drawBox(face, FACE_COLOR, 'face');
    } else {
      drawBox(face, FACE_COLOR, 'face');
      drawBox(fur, FUR_COLOR, 'fur');
    }
  }, [view, image, face, fur, active, t]);

  useEffect(draw, [draw]);

  const toImgXY = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return [(clientX - r.left - view.ox) / view.scale, (clientY - r.top - view.oy) / view.scale];
  };
  const near = (a: number[] | null, x: number, y: number) => !!a && Math.hypot(a[0] - x, a[1] - y) * view.scale <= HIT_PX;
  const boxOf = (id: BoxId) => (id === 'face' ? face : fur);

  const startPinch = () => {
    const [p1, p2] = [...pointers.current.values()];
    const id = drag.current?.id ?? active;
    const b = boxOf(id);
    drag.current = {
      kind: 'pinch',
      id,
      dist0: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      ang0: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      size0: b.size,
      rot0: b.rot,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone – keep going without capture */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) return startPinch();
    if (pointers.current.size > 2) return;

    const [x, y] = toImgXY(e.clientX, e.clientY);
    // handles of the active box win
    const hs = handles(boxOf(active), active);
    if (near(hs.resize, x, y)) return void (drag.current = { kind: 'resize', id: active });
    if (near(hs.rotate, x, y)) return void (drag.current = { kind: 'rotate', id: active });

    const order: BoxId[] = active === 'face' ? ['face', 'fur'] : ['fur', 'face'];
    const hit = order.find((id) => inside(boxOf(id), x, y)) ?? active;
    const b = boxOf(hit);
    if (hit !== active) onActive(hit);
    if (inside(b, x, y)) drag.current = { kind: 'move', id: hit, dx: x - b.cx, dy: y - b.cy };
    else {
      // tap outside: jump the box centre to the finger
      drag.current = { kind: 'move', id: hit, dx: 0, dy: 0 };
      onChange(hit, { ...b, cx: x, cy: y });
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = drag.current;
    if (!m) return;
    const b = boxOf(m.id);
    if (m.kind === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [p1, p2] = pts;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const next: CropBox = { ...b, size: clampSize(m.size0 * (dist / (m.dist0 || 1))) };
      if (m.id === 'face') next.rot = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, m.rot0 + (ang - m.ang0)));
      return onChange(m.id, next);
    }
    const [x, y] = toImgXY(e.clientX, e.clientY);
    if (m.kind === 'move') return onChange(m.id, { ...b, cx: x - m.dx, cy: y - m.dy });
    // finger position in box-local space
    const dx = x - b.cx, dy = y - b.cy;
    const c = Math.cos(-b.rot), sn = Math.sin(-b.rot);
    const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
    if (m.kind === 'resize') return onChange(m.id, { ...b, size: clampSize(2 * Math.max(Math.abs(lx), Math.abs(ly), 1)) });
    if (m.kind === 'rotate') {
      const rot = Math.atan2(dx, -dy);
      return onChange(m.id, { ...b, rot: Math.max(-Math.PI / 4, Math.min(Math.PI / 4, rot)) });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) drag.current = null;
    else if (pointers.current.size === 1 && drag.current?.kind === 'pinch') {
      // one finger left: continue as a move from where it is
      const [p] = [...pointers.current.values()];
      const [x, y] = toImgXY(p.x, p.y);
      const b = boxOf(drag.current.id);
      drag.current = { kind: 'move', id: drag.current.id, dx: x - b.cx, dy: y - b.cy };
    }
  };

  return (
    <div ref={wrap} className="w-full">
      <canvas
        ref={canvas}
        style={{ width: view.w, height: view.h }}
        className="touch-none rounded-2xl"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </div>
  );
}

export const BOX_COLORS = { face: FACE_COLOR, fur: FUR_COLOR };
