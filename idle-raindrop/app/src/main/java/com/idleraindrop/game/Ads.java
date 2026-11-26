package com.idleraindrop.game;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/** Asks for consent where the law requires it, then keeps one rewarded ad ready. Main thread only, except ready(). */
final class Ads {
    interface Result {
        void done(boolean earned);
    }

    private static final long HOUR = 3600_000L;
    private final Activity activity;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ConsentInformation consent;
    private RewardedAd ad;
    private long loadedAt;
    private boolean started, loading, dead;
    private int failures;
    private volatile boolean ready, privacyNeeded;

    Ads(Activity activity) {
        this.activity = activity;
        consent = UserMessagingPlatform.getConsentInformation(activity);
    }

    void start() {
        consent.requestConsentInfoUpdate(activity, new ConsentRequestParameters.Builder().build(),
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, e -> afterConsent()),
                e -> afterConsent());
        afterConsent(); // consent from an earlier launch may already allow ads
    }

    private void afterConsent() {
        privacyNeeded = consent.getPrivacyOptionsRequirementStatus()
                == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
        if (dead || started || !consent.canRequestAds()) return;
        started = true;
        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG).build());
        MobileAds.initialize(activity.getApplicationContext(), s -> main.post(this::load));
    }

    private void load() {
        if (dead || loading || ready) return;
        loading = true;
        RewardedAd.load(activity, activity.getString(R.string.admob_rewarded_id), new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(RewardedAd loaded) {
                        loading = false;
                        failures = 0;
                        if (dead) return;
                        ad = loaded;
                        loadedAt = System.currentTimeMillis();
                        ready = true;
                        main.postDelayed(Ads.this::dropIfStale, 56 * 60_000L);
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError e) {
                        loading = false;
                        failures = Math.min(failures + 1, 5);
                        main.postDelayed(Ads.this::load, 15_000L << failures); // 30 s, then up to 8 min
                    }
                });
    }

    /** Rewarded ads expire after an hour. */
    private void dropIfStale() {
        if (ad == null || System.currentTimeMillis() - loadedAt < 55 * HOUR / 60) return;
        ad = null;
        ready = false;
        load();
    }

    boolean ready() {
        return ready;
    }

    boolean privacyNeeded() {
        return privacyNeeded;
    }

    void showPrivacy() {
        UserMessagingPlatform.showPrivacyOptionsForm(activity, e -> afterConsent());
    }

    void show(Result result) {
        dropIfStale();
        RewardedAd a = ad;
        if (a == null) {
            result.done(false);
            return;
        }
        ad = null;
        ready = false;
        boolean[] earned = {false};
        a.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                result.done(earned[0]);
                load();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError e) {
                result.done(false);
                load();
            }
        });
        a.show(activity, reward -> earned[0] = true);
    }

    void destroy() {
        dead = true;
        ready = false;
        ad = null;
        main.removeCallbacksAndMessages(null);
    }
}
