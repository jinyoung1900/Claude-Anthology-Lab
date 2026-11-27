'use client';

import { useEffect, useState } from 'react';
import { loadPhotos } from '@/lib/storage';

/** Loads walk-photo dataURLs from IndexedDB for the given ids. */
export function usePhotos(ids: string[]) {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    loadPhotos(key ? key.split(',') : []).then((p) => alive && setPhotos(p));
    return () => {
      alive = false;
    };
  }, [key]);
  return photos;
}
