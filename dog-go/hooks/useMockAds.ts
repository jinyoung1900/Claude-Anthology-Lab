'use client';

import { useCallback, useState } from 'react';
import { useAdService } from '@/components/ads/AdsProvider';
import type { AdPlacement } from '@/lib/ads/adService';

/**
 * The only ad API screens use. Swap the provider's AdService for a real AdMob one later
 * and this hook (and every screen) stays the same.
 */
export function useMockAds() {
  const service = useAdService();
  const [loading, setLoading] = useState(false);

  const showRewarded = useCallback(
    async (placement: AdPlacement, onReward: () => void) => {
      setLoading(true);
      try {
        const res = await service.showRewarded(placement);
        if (res.rewarded) onReward();
        return res.rewarded;
      } finally {
        setLoading(false);
      }
    },
    [service],
  );

  return { showRewarded, loading, provider: service.kind };
}
