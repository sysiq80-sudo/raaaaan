package com.raan.rider;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // ✅ تفعيل فحص WebView عبر Chrome DevTools (chrome://inspect) فقط في وضع التطوير (Debug)
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
