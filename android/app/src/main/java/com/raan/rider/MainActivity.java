package com.raan.rider;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ✅ Edge-to-edge على Android 15+ (API 35) و لأجهزة Gesture Navigation
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }

        // ✅ علامات Edge-to-edge الكاملة
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30): الطريقة الحديثة
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            // Android 5-10: الطريقة القديمة
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }

        // ✅ تفعيل فحص WebView عبر Chrome DevTools فقط في وضع التطوير
        if (0 != (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    /**
     * ✅ تحسينات أداء WebView لتجربة مثل التطبيق الأصلي
     * - حجم النص ثابت 100% بغض النظر عن إعدادات النظام
     * - تفعيل كاش DOM و AppCache لتسريع التحميل
     * - تسريع الرسم بالـ GPU (Hardware Layer)
     * - تسريع التمرير والتفاعل باللمس
     */
    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();

                // ═══ حجم النص والتكبير ═══
                settings.setTextZoom(100);
                settings.setSupportZoom(false);
                settings.setBuiltInZoomControls(false);
                settings.setDisplayZoomControls(false);

                // ═══ الكاش والتخزين — تسريع التحميل ═══
                settings.setDomStorageEnabled(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDatabaseEnabled(true);

                // ═══ تحسينات الرسم والتمرير ═══
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                webView.setVerticalScrollBarEnabled(false);
                webView.setHorizontalScrollBarEnabled(false);
            }
        } catch (Exception e) {
            // تجاهل — لا يؤثر على عمل التطبيق
        }
    }
}
