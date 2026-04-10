package com.raan.rider;

import android.app.Application;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

/**
 * تطبيق ران — Application class
 * يهيّئ Firebase بشكل آمن قبل تحميل أي إضافة Capacitor
 * لمنع انهيار التطبيق عند عدم وجود google-services.json
 */
public class RaanApplication extends Application {

    private static final String TAG = "RAAN";

    @Override
    public void onCreate() {
        super.onCreate();
        initializeFirebaseSafely();
    }

    private void initializeFirebaseSafely() {
        try {
            // التحقق هل Firebase مُهيّأ بالفعل (عبر google-services.json)
            FirebaseApp.getInstance();
            Log.i(TAG, "Firebase already initialized via google-services.json");
        } catch (IllegalStateException e) {
            // Firebase غير مُهيّأ — إنشاء تهيئة مؤقتة لمنع الانهيار
            try {
                FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId("1:000000000000:android:0000000000000000")
                        .setApiKey("placeholder-no-google-services-json")
                        .setProjectId("raan-placeholder")
                        .build();
                FirebaseApp.initializeApp(this, options);
                Log.w(TAG, "Firebase initialized with placeholder config. " +
                        "Push notifications will NOT work. " +
                        "Add google-services.json to android/app/ to enable push notifications.");
            } catch (Exception ex) {
                Log.e(TAG, "Failed to initialize Firebase placeholder", ex);
            }
        }
    }
}
