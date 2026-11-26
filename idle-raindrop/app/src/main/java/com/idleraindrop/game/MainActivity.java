package com.idleraindrop.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedDispatcher;

/** Shows the bundled game and gives it saving, haptics, clipboard and screen insets. */
public class MainActivity extends Activity {
    private static final String PREFS = "save", KEY = "game";
    private WebView web;
    private Ads ads;
    private boolean loaded;
    private String insets = "0,0,0,0";

    @SuppressLint("SetJavaScriptEnabled") // only bundled pages are ever loaded
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.hud));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setBlockNetworkLoads(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                loaded = true;
                sendInsets();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return true; // never leave the game
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                loaded = false;
                recreate();
                return true;
            }
        });

        web.setOnApplyWindowInsetsListener((v, in) -> {
            int t, b, l, r;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                t = i.top; b = i.bottom; l = i.left; r = i.right;
            } else {
                t = in.getSystemWindowInsetTop(); b = in.getSystemWindowInsetBottom();
                l = in.getSystemWindowInsetLeft(); r = in.getSystemWindowInsetRight();
            }
            float d = getResources().getDisplayMetrics().density;
            insets = Math.round(t / d) + "," + Math.round(b / d) + "," + Math.round(l / d) + "," + Math.round(r / d);
            sendInsets();
            return in;
        });
        setContentView(web);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
        web.loadUrl("file:///android_asset/game/index.html");
        ads = new Ads(this);
        ads.start();
    }

    private void js(String code) {
        if (loaded) web.evaluateJavascript("window.Game&&(" + code + ")", null);
    }

    private void sendInsets() {
        js("Game.insets(" + insets + ")");
    }

    /** Back closes a dialog, then the sheet, then leaves the app. */
    private void goBack() {
        if (!loaded) {
            moveTaskToBack(true);
            return;
        }
        web.evaluateJavascript("!!(window.Game&&Game.back())", r -> {
            if (!"true".equals(r)) moveTaskToBack(true);
        });
    }

    @SuppressLint("GestureBackNavigation") // newer versions use the dispatcher above
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        goBack();
    }

    @Override
    protected void onPause() {
        js("Game.pause()");
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        js("Game.resume()");
    }

    @Override
    protected void onDestroy() {
        ads.destroy();
        web.destroy();
        super.onDestroy();
    }

    private final class Bridge {
        @JavascriptInterface
        public void save(String data) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY, data).apply();
        }

        @JavascriptInterface
        public String load() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY, "");
        }

        @JavascriptInterface
        public void haptic(int kind) {
            int k = kind == 0 ? HapticFeedbackConstants.CLOCK_TICK
                    : kind == 1 ? HapticFeedbackConstants.VIRTUAL_KEY : HapticFeedbackConstants.LONG_PRESS;
            runOnUiThread(() -> web.performHapticFeedback(k));
        }

        @JavascriptInterface
        public boolean adReady() {
            return ads != null && ads.ready();
        }

        @JavascriptInterface
        public void showAd() {
            runOnUiThread(() -> ads.show(earned -> js("Game.adResult(" + earned + ")")));
        }

        @JavascriptInterface
        public boolean privacyNeeded() {
            return ads != null && ads.privacyNeeded();
        }

        @JavascriptInterface
        public void showPrivacy() {
            runOnUiThread(() -> ads.showPrivacy());
        }

        @JavascriptInterface
        public void copy(String text) {
            runOnUiThread(() -> ((ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE))
                    .setPrimaryClip(ClipData.newPlainText("Idle Raindrop", text)));
        }
    }
}
