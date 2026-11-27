'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';

/** Loads a dataURL/URL into a crunchy, PS1-style (nearest-filtered) texture – or a soft, mipmapped one when smooth. */
export function useImageTexture(url: string | undefined | null, repeat = 1, smooth = false) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let disposed = false;
    const t = new THREE.TextureLoader().load(url, () => {
      if (!disposed) setTex(t);
    });
    t.colorSpace = THREE.SRGBColorSpace;
    if (smooth) {
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = 4;
    } else {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    }
    if (repeat !== 1) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
    }
    return () => {
      disposed = true;
      t.dispose();
    };
  }, [url, repeat, smooth]);
  return tex;
}
