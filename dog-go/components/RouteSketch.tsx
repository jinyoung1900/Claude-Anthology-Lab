import type { LatLng } from '@/lib/types';

/** Lightweight SVG route thumbnail for history cards (no map tiles needed). */
export default function RouteSketch({ segments, className = '' }: { segments: LatLng[][]; className?: string }) {
  const pts = segments.flat();
  if (pts.length < 2)
    return <div className={`flex items-center justify-center rounded-2xl bg-moss/15 text-2xl ${className}`}>🐾</div>;
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const w = Math.max((maxLng - minLng) * k, 1e-6);
  const h = Math.max(maxLat - minLat, 1e-6);
  const span = Math.max(w, h);
  const pad = 10;
  const S = 100 - pad * 2;
  const proj = ([la, ln]: LatLng) => [pad + (((ln - minLng) * k + (span - w) / 2) / span) * S, pad + ((maxLat - la + (span - h) / 2) / span) * S];
  return (
    <svg viewBox="0 0 100 100" className={`rounded-2xl bg-moss/15 ${className}`}>
      {segments.map((seg, i) =>
        seg.length > 1 ? (
          <polyline key={i} points={seg.map((p) => proj(p).join(',')).join(' ')} fill="none" stroke="#E0607E" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        ) : null,
      )}
      {(() => {
        const [x, y] = proj(pts[0]);
        const [ex, ey] = proj(pts[pts.length - 1]);
        return (
          <>
            <circle cx={x} cy={y} r={5} fill="#6BA368" stroke="#fff" strokeWidth={2} />
            <circle cx={ex} cy={ey} r={5} fill="#5B3A29" stroke="#fff" strokeWidth={2} />
          </>
        );
      })()}
    </svg>
  );
}
