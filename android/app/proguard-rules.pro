# ════════════════════════════════════════════════════════════════
# ProGuard Rules — RAAN (Capacitor + Firebase + WebView)
# ════════════════════════════════════════════════════════════════

# ─── Capacitor Core ──────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-dontwarn com.getcapacitor.**

# ─── Capacitor Plugins ───────────────────────────────────────
-keep class com.transistorsoft.** { *; }
-dontwarn com.transistorsoft.**

# Keep all Capacitor plugin classes
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# ─── Firebase / FCM ──────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ─── WebView JavaScript Interface ────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Keep line numbers for crash reports (Sentry) ────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── AndroidX ────────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**

# ─── Prevent stripping of native methods ─────────────────────
-keepclasseswithmembernames class * {
    native <methods>;
}

# ─── Serializable classes ────────────────────────────────────
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ─── Enums ───────────────────────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ─── R classes ───────────────────────────────────────────────
-keep class **.R$* { *; }
