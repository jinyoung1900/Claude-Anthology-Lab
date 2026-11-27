/**
 * Ad service contract. The MVP ships a mock implementation driven by <AdsProvider/>.
 *
 * To go live later: implement this interface with @capacitor-community/admob
 * (AdMob.prepareRewardVideoAd + showRewardVideoAd, AdMob.showBanner) and return it from
 * `createAdService()` – no UI code needs to change, screens only call `useMockAds()`.
 */
export type AdPlacement = 'post_walk_bonus_spin' | 'history_banner' | 'closet_banner';

export interface RewardResult {
  rewarded: boolean;
}

export interface AdService {
  readonly kind: 'mock' | 'admob';
  showRewarded(placement: AdPlacement): Promise<RewardResult>;
}

export const MOCK_REWARDED_SECONDS = 3;
