'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n';

/**
 * Round 📷 button overlaid on a dog's 3D view → opens the photo cropper for that dog.
 * Pass `dogId` to link to the creator, or `onClick` to handle it in place.
 */
/** camera glyph drawn on a 24×24 grid so it's optically centred in the round button */
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden className="block">
      <path d="M8.5 5.5 9.6 4h4.8l1.1 1.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h3.5Z" fill="#5B3A29" />
      <circle cx="12" cy="12.3" r="4" fill="#FFF7EC" />
      <circle cx="12" cy="12.3" r="2.3" fill="#5B3A29" />
      <circle cx="17.6" cy="8.4" r="0.9" fill="#FFF7EC" />
    </svg>
  );
}

export default function PhotoButton({ dogId, onClick, className = 'right-3 top-3' }: { dogId?: string; onClick?: () => void; className?: string }) {
  const { t } = useT();
  const cls = `absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 leading-none shadow-chunky active:translate-y-[2px] active:shadow-none ${className}`;
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={t('photo.change')} title={t('photo.change')}>
        <CameraIcon />
      </button>
    );
  return (
    <Link href={`/create/?id=${dogId}&photo=1`} className={cls} aria-label={t('photo.change')} title={t('photo.change')}>
      <CameraIcon />
    </Link>
  );
}
