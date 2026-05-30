package com.raan.rider;

import android.os.Bundle;
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
     * ✅ توحيد حجم النص والعرض بين المتصفح و APK
     * Android WebView يأخذ حجم الخط من إعدادات النظام (إعدادات > العرض > حجم الخط)
     * هذا يسبب تضخم الأزرار والنصوص. نُجبره على 100% دائماً.
     */
    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                // ✅ إجبار حجم النص على 100% بغض النظر عن إعدادات النظام
                settings.setTextZoom(100);
                // ✅ منع المستخدم من تكبير/تصغير الصفحة بالقرص
                settings.setSupportZoom(false);
                settings.setBuiltInZoomControls(false);
                settings.setDisplayZoomControls(false);
            }
        } catch (Exception e) {
            // تجاهل — لا يؤثر على عمل التطبيق
        }
    }
}
