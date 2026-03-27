# 🔔 FCM Setup Guide - RAAN Captain App

## Overview
Firebase Cloud Messaging (FCM) is required for native APK notifications. This guide covers all setup steps.

---

## 📋 Prerequisites

✅ **Already Done:**
- Code integrated in `src/lib/capacitorBridge.ts`
- FCM listener setup in `src/hooks/useDriverNotifications.ts`
- Notification preferences stored in Supabase

❌ **Still Needed:**
- Firebase Project
- `google-services.json` file
- Android signing certificate

---

## 🚀 Step 1: Create Firebase Project

### 1.1 Go to Firebase Console
1. Open: https://console.firebase.google.com
2. Click "Add project" or "Create project"
3. Project name: **RAAN Captain** (or similar)
4. Enable Google Analytics (optional)

### 1.2 Create Android App
1. Click "Android" app icon
2. **Package name:** `com.raan.captain`
   - ⚠️ Must match `capacitor.config.ts` → `appId`
3. **App nickname:** RAAN Captain (optional)
4. **SHA-1 certificate fingerprint:** (see step 2 below)
5. Click "Register app"

---

## 🔑 Step 2: Get SHA-1 Certificate Fingerprint

### Option A: Using Keytool (if you have Java/JDK)

```bash
# Windows
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# Linux/Mac
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Look for: `SHA1: AA:BB:CC:DD:...`

### Option B: Debug Build SHA-1
Build APK first, then extract SHA-1:

```bash
cd android
./gradlew assembleDebug
```

### Option C: Use Release Keystore
If you have a production keystore:

```bash
keytool -list -v -keystore path/to/your/keystore.jks -alias your_alias -storepass password
```

---

## 📥 Step 3: Download google-services.json

After registering the Android app in Firebase:

1. Firebase will show: "Download google-services.json"
2. Click "Download google-services.json"
3. **Save to:** `android/app/google-services.json`
   ```
   taksi-iraqi-smart/
   ├── android/
   │   └── app/
   │       └── google-services.json  ← HERE
   ```
4. ⚠️ **DO NOT commit to git** - add to `.gitignore`

---

## ⚙️ Step 4: Configure Android Gradle Files

### 4.1 android/build.gradle
Ensure Google Play Services are configured:

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

### 4.2 android/app/build.gradle
Add at the **end** of the file:

```gradle
apply plugin: 'com.google.gms.google-services'
```

Ensure FCM dependency exists:

```gradle
implementation 'com.google.firebase:firebase-messaging:23.2.1'
```

---

## 🔧 Step 5: Verify Code Integration

The following are **already implemented** in the codebase:

### capacitorBridge.ts
```typescript
// FCM initialization in initNativePushNotifications()
app.registerPlugin(PushNotifications);
await PushNotifications.requestPermissions();
await PushNotifications.register();
```

### useDriverNotifications.ts
```typescript
// FCM token registration and preference sync
registerFCMToken(driverId);
syncNotificationPreferences(driverId);
```

### driverNotificationService.ts
```typescript
// Service functions for mute checking and preferences
isNotificationMutedNow()
checkMuteSchedule(prefs)
saveNotificationPreferences(driverId, prefs)
```

---

## 📦 Step 6: Build and Deploy APK

### 6.1 Build Debug APK
```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### 6.2 Build Release APK
```bash
cd android
./gradlew assembleRelease
# Optional: Sign with jarsigner/apksigner
```

### 6.3 Install on Device
```bash
adb install -r app-debug.apk
```

---

## 🧪 Step 7: Test FCM Notifications

### 7.1 Test from Firebase Console
1. Go to Firebase Console → Messaging
2. Click "Send your first message"
3. Título: "Test"
4. Message: "Testing FCM"
5. Target: Select your Android app
6. Send to a test device:
   - Click "Send test message"
   - Enter FCM token (see 7.2)

### 7.2 Get FCM Token from Device
When app launches on native:
- Check device logs: `adb logcat | grep FCM`
- Or check Supabase: `push_subscriptions` table → `fcm_token` column

### 7.3 Test via App
Trigger a ride request:
1. Open Rider app → Create ride
2. Driver should receive notification with:
   - Ride details
   - Accept/Reject buttons
   - Sound + vibration (if enabled)

---

## 🔍 Troubleshooting

### ❌ "google-services.json not found"
**Fix:** Ensure file is at `android/app/google-services.json`

### ❌ "SHA1 mismatch"
**Fix:** Generate new SHA-1 in Firebase Console:
1. Go to Project Settings → Your Apps
2. Regenerate SHA-1
3. Re-download `google-services.json`

### ❌ "FCM token not registered"
**Fix:** 
- Ensure Capacitor plugin is installed: `@capacitor/push-notifications@8.0.1`
- Check device has Google Play Services
- Rebuild: `npx cap build android`

### ❌ Notifications not arriving
**Fix:**
- Check push_subscriptions table: Does FCM token exist?
- Check notification_preferences: Is mute enabled?
- Check device: Is app backgrounded? Is sound/vibration on?

---

## 📊 Verification Checklist

- [ ] Firebase Project created
- [ ] Android app registered with correct package name: `com.raan.captain`
- [ ] SHA-1 fingerprint added to Firebase
- [ ] `google-services.json` downloaded and placed in `android/app/`
- [ ] `android/build.gradle` has Google Play Services plugin
- [ ] `android/app/build.gradle` has FCM dependency + plugin applied
- [ ] APK built locally
- [ ] Test device receives FCM test message
- [ ] Test device receives ride notification
- [ ] Supabase migration applied (13 SQL operations)
- [ ] Driver can mute notifications (app UI)
- [ ] Driver can schedule mute (app UI)

---

## 📝 File Locations Reference

| File | Purpose |
|------|---------|
| `android/app/google-services.json` | FCM configuration (DO NOT COMMIT) |
| `src/lib/capacitorBridge.ts` | Native FCM initialization |
| `src/hooks/useDriverNotifications.ts` | Hook for FCM integration |
| `src/services/driverNotificationService.ts` | Service for preferences |
| `src/stores/driverStore.ts` | Mute state management |
| `src/components/driver/NotificationMuteScheduler.tsx` | UI for mute scheduling |
| `supabase/migrations/20260226000000_notification_system_upgrade.sql` | Database schema |
| `capacitor.config.ts` | App ID (must match Firebase) |

---

## 🎯 Next Steps

1. ✅ **Supabase Migration** (14 SQL operations completed)
   - Run in Supabase Dashboard → SQL Editor
   
2. 🔲 **Firebase Setup** (this guide)
   - Create project
   - Register Android app
   - Download `google-services.json`
   
3. 🔲 **Build & Test**
   - Build APK with new Firebase config
   - Test on physical device
   - Verify notifications work

---

## 💡 Support

For issues:
- Firebase Docs: https://firebase.google.com/docs/cloud-messaging
- Capacitor Docs: https://capacitorjs.com/docs/plugins/push-notifications  
- Supabase Docs: https://supabase.io/docs

Last Updated: 2025-02-25
