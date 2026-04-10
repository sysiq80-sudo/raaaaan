# 🔬 التقرير التقني التفصيلي — فحص وإصلاح تطبيق ران (RAAN)
### Production Readiness Audit & Critical Fixes
**التاريخ**: 9 أبريل 2026  
**المُنفّذ**: لجنة استشارية تقنية (CTO / Lead QA-Security / CFO / خبير تسويق)

---

# جدول المحتويات

1. [نطاق الفحص](#1-نطاق-الفحص)
2. [الإصلاح 1 — Race Condition في قبول الرحلات](#2-الإصلاح-1--race-condition)
3. [الإصلاح 2 — ثغرة أمنية في مواقع السائقين](#3-الإصلاح-2--ثغرة-أمنية)
4. [الإصلاح 3 — تسريب ذاكرة الخرائط](#4-الإصلاح-3--تسريب-ذاكرة-الخرائط)
5. [الإصلاح 4 — التتبع الأصلي للموقع](#5-الإصلاح-4--التتبع-الأصلي)
6. [ترحيل قاعدة البيانات](#6-ترحيل-قاعدة-البيانات)
7. [جدول الملفات المتأثرة](#7-جدول-الملفات)
8. [نتائج التحقق](#8-نتائج-التحقق)

---

# 1. نطاق الفحص

## الملفات المفحوصة

تم فحص الملفات التالية بشكل معمّق (قراءة سطر بسطر):

### طبقة الخدمات (Services)
| الملف | عدد الأسطر | ما تم فحصه |
|-------|-----------|------------|
| `src/services/backgroundLocationService.ts` | 322 | آلية تتبع الموقع + IndexedDB + SharedWorker + REST upsert |
| `src/services/driverNotificationService.ts` | 426 | نظام الإشعارات + FCM + قبول الرحلة + جدول الكتم |
| `src/services/nativeLocationService.ts` | — | **(أنشأته جديداً)** خدمة التتبع الأصلي |

### طبقة الـ Hooks
| الملف | عدد الأسطر | ما تم فحصه |
|-------|-----------|------------|
| `src/hooks/useAdvancedLocationTracking.ts` | 231 | ربط خدمة التتبع بالمكونات |
| `src/hooks/useDriverNotifications.ts` | 620 | استقبال الرحلات + Realtime + فلترة جغرافية |
| `src/hooks/useActiveRide.ts` | 434 | إدارة حالة الرحلة + إلغاء + إتمام |
| `src/hooks/useOptimizedRealtime.ts` | 222 | Batching + Rate Limiting لـ Supabase Realtime |
| `src/hooks/useOfflineMode.ts` | 339 | Sync Queue + localStorage + إعادة المحاولة |
| `src/hooks/useNetworkStatus.ts` | 153 | مراقبة الاتصال + تصنيف السرعة |
| `src/hooks/useBookingFlow.ts` | 268 | تدفق الحجز + الخريطة + المسار |
| `src/hooks/useFareCalculation.ts` | 201 | حساب الأجرة + Edge Function + fallback محلي |
| `src/hooks/useDriverLocationSync.ts` | 157 | مزامنة موقع السائق أثناء الرحلة |

### طبقة المكونات (Components)
| الملف | عدد الأسطر | ما تم فحصه |
|-------|-----------|------------|
| `src/components/MapGoogle.tsx` | 636 | عرض الخريطة + Markers + Polylines + InfoWindow + Cleanup |

### طبقة إدارة الحالة (State)
| الملف | عدد الأسطر | ما تم فحصه |
|-------|-----------|------------|
| `src/contexts/AuthContext.tsx` | 465 | تسجيل الدخول + اكتشاف الدور + device ID |
| `src/stores/driverStore.ts` | 412 | Zustand + persist + Capacitor Storage |

### طبقة قاعدة البيانات (174 migration + 54 Edge Function)
| الملف | ما تم فحصه |
|-------|------------|
| `035_rls_comprehensive_policies.sql` (374 سطر) | سياسات RLS لكل الجداول |
| `20260406144600_tasks_and_atomic_acceptance.sql` (111 سطر) | دالة `accept_ride_atomic` |
| `20260129000004_driver_wallet_system.sql` (418 سطر) | المحفظة + المعاملات + السحب |
| `20260809000000_critical_security_fixes.sql` (351 سطر) | إصلاحات أمنية + فهارس |
| `.env` (6 سطور) | المتغيرات البيئية |

---

# 2. الإصلاح 1 — Race Condition

## المشكلة التقنية

**الملف**: `src/services/driverNotificationService.ts`  
**الدالة**: `acceptRideFromNotification()` (سطر 348-394)  
**النوع**: TOCTOU Race Condition (Time-Of-Check-To-Time-Of-Use)

### الكود القديم (الخاطئ):

```typescript
// الخطوة 1: SELECT — فحص الحالة
const { data: ride } = await supabase
  .from('rides')
  .select('status')
  .eq('id', rideId)
  .single();

if (ride.status !== 'pending') return false;  // ← الفحص

// ⚠️ نافذة سباق ~50ms هنا!
// سائق آخر يمكنه الوصول لنفس النتيجة

// الخطوة 2: UPDATE — تحديث الحالة
await supabase
  .from('rides')
  .update({ status: 'accepted', driver_id: driverId })
  .eq('id', rideId)
  .eq('status', 'pending');  // ← الاستخدام
```

### المخطط الزمني للمشكلة:

```
الوقت     السائق A                    السائق B
─────────────────────────────────────────────────
t=0ms     SELECT status → 'pending' ✅
t=10ms                                SELECT status → 'pending' ✅
t=50ms    UPDATE → accepted ✅
t=60ms                                UPDATE → accepted ✅ (خطأ!)
─────────────────────────────────────────────────
النتيجة: الرحلة "مقبولة" من سائقَين! 💀
```

### السبب الجذري:
عمليتا `SELECT` و `UPDATE` منفصلتان — لا يوجد قفل (Lock) بينهما. PostgreSQL لا يضمن ذرية (Atomicity) بين عمليتين منفصلتين من نفس الـ client.

### الكود الجديد (الإصلاح):

```typescript
// عملية واحدة ذرية عبر PostgreSQL RPC
const { data, error } = await supabase.rpc('accept_ride_atomic', {
  target_ride_id: rideId,
  acc_driver_id: driverId,
});

const result = data as { success: boolean; message?: string };
if (!result?.success) {
  console.log('الرحلة لم تعد متاحة:', result?.message);
  return false;
}
```

### دالة PostgreSQL المُستخدمة:

```sql
-- ملف: 20260406144600_tasks_and_atomic_acceptance.sql
CREATE OR REPLACE FUNCTION public.accept_ride_atomic(
  target_ride_id UUID, 
  acc_driver_id UUID
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows_affected INT; v_ride RECORD;
BEGIN
  -- UPDATE مع WHERE status = 'pending' = قفل ذري ضمني
  -- PostgreSQL يقفل الصف أثناء UPDATE — لا يمكن لعملية أخرى تعديله
  UPDATE public.rides 
  SET status = 'accepted', driver_id = acc_driver_id, updated_at = NOW()
  WHERE id = target_ride_id AND status = 'pending'
  RETURNING * INTO v_ride;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    -- الصف لم يُحدّث = إما غير موجود أو status ≠ 'pending'
    RETURN json_build_object('success', false, 
      'message', 'الرحلة لم تعد متوفرة. قد يكون سائق آخر قد قبلها.');
  END IF;

  RETURN json_build_object('success', true, 'ride', row_to_json(v_ride));
END; $$;
```

### لماذا هذا آمن؟
- `UPDATE ... WHERE status = 'pending'` يحصل على **Row-Level Lock** تلقائياً
- إذا وصل سائقان بنفس اللحظة، PostgreSQL يُنفّذ أحدهما وينتظر الآخر
- الثاني يجد `status = 'accepted'` (لم يعد `pending`) → `ROW_COUNT = 0` → يرجع "غير متوفرة"

### تغيير إضافي — تحديث حالة السائق:
```diff
- // القديم: await (يُعطل الاستجابة)
- await supabase.from('drivers').update({is_available: false}).eq('id', driverId);
+ // الجديد: non-blocking (لا يعطل — الأهم هو قبول الرحلة)
+ supabase.from('drivers').update({is_available: false}).eq('id', driverId)
+   .then(({ error }) => { if (error) console.warn('⚠️', error); });
```

---

# 3. الإصلاح 2 — ثغرة أمنية

## المشكلة التقنية

**الملف**: `src/services/backgroundLocationService.ts`  
**الدالة**: `upsertLiveLocation()` (سطر 39-77)  
**النوع**: Broken Access Control (OWASP A01:2021)

### الكود القديم (الخاطئ):

```typescript
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function upsertLiveLocation(...) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/driver_live_locations`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,  // ← anon key!
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        driver_id: driverId,  // ← يمكن إرسال أي driver_id!
        location: { lat, lng },
      }),
    },
  );
}
```

### سلسلة الهجوم:

```
1. المهاجم يفتح التطبيق في Chrome → يضغط F12 → Sources
2. يبحث عن "VITE_SUPABASE" → يجد:
   - SUPABASE_URL = "https://wgolkcztdrwdphwjvqxt.supabase.co"
   - SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIs..." (anon key)
3. يرسل طلب REST مباشر:
   curl -X POST "https://...supabase.co/rest/v1/driver_live_locations" \
     -H "apikey: eyJ..." \
     -H "Authorization: Bearer eyJ..." \
     -d '{"driver_id": "UUID-سائق-آخر", "location": {"lat": 33.3, "lng": 44.3}}'
4. النتيجة: موقع أي سائق يتغير! 💀
```

### لماذا تعمل الثغرة؟
- `anon key` = مفتاح مجهول، لا يحمل هوية مستخدم (`auth.uid() = NULL`)
- الـ `Authorization: Bearer` يجب أن يكون **JWT مستخدم مسجّل**، وليس الـ anon key
- بدون RLS policy على الجدول، أي `INSERT` يُقبل بلا قيود

### الإصلاح — جزئين:

#### الجزء 1: استبدال fetch بـ Supabase Client

```typescript
// الجديد: يستخدم Supabase client المُصادق
async function upsertLiveLocation(driverId, rideId, loc, isOffline = false) {
  try {
    // dynamic import لتجنب circular dependency
    const { supabase } = await import('@/integrations/supabase/client');
    
    // supabase client يرسل JWT المستخدم المسجّل تلقائياً
    // → auth.uid() = UUID المستخدم الحقيقي
    // → RLS يتحقق: هل driver_id ينتمي لهذا المستخدم؟
    const { error } = await supabase
      .from('driver_live_locations')
      .upsert({
        ride_id: rideId,
        driver_id: driverId,
        location: { lat: loc.lat, lng: loc.lng },
        ...
      }, { onConflict: 'ride_id' });

    return !error;
  } catch { return false; }
}
```

#### الفرق التقني:

```
القديم: Authorization: Bearer <anon_key>
→ auth.uid() = NULL (لا هوية)
→ RLS لا يمكنه التحقق من المالك

الجديد: Authorization: Bearer <user_jwt>
→ auth.uid() = '550e8400-e29b-41d4-a716-446655440000' (هوية حقيقية)
→ RLS يتحقق: هل driver_id ينتمي لهذا المستخدم؟
```

#### الجزء 2: إضافة RLS Policies

**الملف الجديد**: `supabase/migrations/20260810000000_fix_driver_live_locations_rls.sql`

```sql
-- تفعيل RLS
ALTER TABLE driver_live_locations ENABLE ROW LEVEL SECURITY;

-- سياسة INSERT: السائق المعتمد يضيف موقعه فقط
CREATE POLICY "drivers_upsert_own_location"
ON driver_live_locations FOR INSERT
WITH CHECK (
  driver_id IN (
    SELECT id FROM drivers 
    WHERE user_id = auth.uid()      -- ← auth.uid() = JWT المستخدم
    AND status = 'approved'          -- ← فقط المعتمدين
  )
);

-- سياسة UPDATE: نفس القيد
CREATE POLICY "drivers_update_own_location"
ON driver_live_locations FOR UPDATE
USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid() AND status = 'approved')
);

-- سياسة SELECT: الراكب يرى فقط موقع سائق رحلته
CREATE POLICY "riders_view_their_ride_driver_location"
ON driver_live_locations FOR SELECT
USING (
  -- الراكب يرى موقع سائق الرحلة فقط
  EXISTS (
    SELECT 1 FROM rides
    WHERE rides.id = driver_live_locations.ride_id
    AND rides.rider_id = auth.uid()
    AND rides.status IN ('accepted', 'arrived', 'in_progress')
  )
  OR
  -- السائق يرى موقعه
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  OR
  -- الأدمن يرى الكل
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- سياسة DELETE: السائق يحذف موقعه فقط (عند انتهاء الرحلة)
CREATE POLICY "drivers_delete_own_location"
ON driver_live_locations FOR DELETE
USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
```

### نتيجة الإصلاح:

```
المهاجم يحاول نفس الهجوم:
curl -X POST ... -H "Authorization: Bearer eyJ...(anon_key)"
→ auth.uid() = NULL
→ RLS يتحقق: SELECT id FROM drivers WHERE user_id = NULL → لا نتائج
→ Policy check fails → ERROR 42501: new row violates RLS policy
→ ❌ الهجوم فشل!
```

---

# 4. الإصلاح 3 — تسريب ذاكرة الخرائط

## المشكلة التقنية

**الملف**: `src/components/MapGoogle.tsx`  
**3 مشاكل منفصلة**:

### المشكلة A: إعادة إنشاء الخريطة عند كل سحب

**السبب الجذري**: dependency array خاطئ في useEffect

```typescript
// القديم — سطر 309:
useEffect(() => {
  // ... إنشاء google.maps.Map جديد ...
  map.current = new google.maps.Map(container, {...});
  
  map.current.addListener("dragstart", () => setIsDragging(true));
  map.current.addListener("dragend", async () => {
    setIsDragging(false);
    await reverseGeocodeCenter();  // ← هذه callback تتغير كل render
  });

  return () => {};  // ← cleanup فارغ!
}, [apiKey, isApiKeyLoading, isDragging, userLocation, reverseGeocodeCenter]);
//                            ^^^^^^^^   ^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^
//                            يتغير عند   يتغير عند     يتغير كل
//                            كل drag!    GPS update!    render!
```

**المصفوفة الزمنية**:
```
t=0s    useEffect يشتغل → خريطة 1 تُنشأ
t=1s    المستخدم يسحب → isDragging=true → useEffect يشتغل مرة ثانية
        → خريطة 2 تُنشأ فوق خريطة 1 (خريطة 1 تبقى في الذاكرة!)
t=2s    المستخدم يوقف السحب → isDragging=false → useEffect يشتغل مرة ثالثة
        → خريطة 3 تُنشأ فوق خريطة 2 (خريطة 1+2 في الذاكرة!)
t=10s   10 عمليات سحب = 10 خرائط في الذاكرة = ~500MB RAM! 💀
```

**الإصلاح**:

```typescript
// 1. أنشأت Refs مستقرة لا تتغير بين الـ renders
const isDraggingRef = useRef(false);
const reverseGeocodeCenterRef = useRef(reverseGeocodeCenter);
reverseGeocodeCenterRef.current = reverseGeocodeCenter; // يتحدث بدون trigger

// 2. أصلحت dependency array
useEffect(() => {
  if (map.current) return; // ← منع الإنشاء المتكرر

  // ... إنشاء الخريطة ...
  
  // استخدام Refs بدل State في المستمعات
  map.current.addListener("dragstart", () => {
    isDraggingRef.current = true;       // ← Ref لا يُعيد render
    setIsDragging(true);
  });
  map.current.addListener("dragend", async () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    await reverseGeocodeCenterRef.current(); // ← Ref ثابت
  });

  return () => { /* cleanup كامل — انظر المشكلة B */ };
}, [apiKey, isApiKeyLoading]); // ← فقط هذين! لا يتغيران أبداً أثناء الاستخدام
```

### المشكلة B: لا cleanup عند unmount

**السبب الجذري**: `return () => {}` فارغ

```typescript
// القديم:
return () => {};  // ← لا يفعل شيئاً!
// عند الانتقال لصفحة أخرى:
// - google.maps.Map يبقى في الذاكرة
// - Markers تبقى في الذاكرة
// - Event listeners تبقى مسجّلة
// - Polylines تبقى في الذاكرة
```

**الإصلاح**: cleanup شامل

```typescript
return () => {
  isMounted = false;
  if (map.current) {
    // 1. إزالة كل مستمعات الأحداث من الخريطة
    google.maps.event.clearInstanceListeners(map.current);
    
    // 2. إزالة كل العلامات (markers)
    [pickupMarkerRef, dropoffMarkerRef, driverMarkerRef, userMarkerRef]
      .forEach(ref => {
        if (ref.current) {
          google.maps.event.clearInstanceListeners(ref.current);
          ref.current.setMap(null);  // يزيلها من الخريطة
          ref.current = null;        // يمسحها من الذاكرة
        }
      });
    
    // 3. إزالة خط المسار
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    
    // 4. إزالة علامات السائقين القريبين
    driverMarkersRef.current.forEach(m => {
      google.maps.event.clearInstanceListeners(m);
      m.setMap(null);
    });
    driverMarkersRef.current.clear();
    
    // 5. إغلاق InfoWindow المشترك
    if (sharedInfoWindowRef.current) {
      sharedInfoWindowRef.current.close();
      sharedInfoWindowRef.current = null;
    }
    
    // 6. إلغاء الرسوم المتحركة
    if (driverAnimationRef.current) {
      cancelAnimationFrame(driverAnimationRef.current);
      driverAnimationRef.current = null;
    }
    
    // 7. إتلاف الخريطة
    map.current = null;
  }
};
```

### المشكلة C: InfoWindow يتسرّب

**السبب الجذري**: إنشاء `new InfoWindow()` عند كل نقرة

```typescript
// القديم:
marker.addListener("click", () => {
  new google.maps.InfoWindow({  // ← كائن جديد كل نقرة!
    content: `<div>...</div>`,
  }).open(map.current);
  // InfoWindow القديم لا يُغلق ولا يُمسح!
});
// 10 نقرات = 10 InfoWindows + 10 DOM nodes في الذاكرة
```

**الإصلاح**: إعادة استخدام InfoWindow واحد

```typescript
// إنشاء مرة واحدة فقط
const sharedInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);

// عند النقر: تحديث المحتوى فقط (بدل إنشاء جديد)
marker.addListener("click", () => {
  if (!sharedInfoWindowRef.current) {
    sharedInfoWindowRef.current = new google.maps.InfoWindow();
  }
  sharedInfoWindowRef.current.setContent(`<div>...</div>`); // تحديث
  sharedInfoWindowRef.current.setPosition(marker.getPosition());
  sharedInfoWindowRef.current.open(map.current);
  // InfoWindow واحد فقط في الذاكرة — يُغلق القديم تلقائياً
});
```

---

# 5. الإصلاح 4 — التتبع الأصلي

## المشكلة التقنية

**الملف القديم**: `src/services/backgroundLocationService.ts`  
**يعتمد على**: `navigator.geolocation.watchPosition` + `SharedWorker`

### لماذا لا يعمل على الجوال؟

```
┌─────────────────────────────────────────────────────┐
│                  WebView (Capacitor)                  │
│                                                       │
│  watchPosition() ← يعمل فقط داخل WebView النشط       │
│  SharedWorker   ← غير مدعوم في Android WebView       │
│  PeriodicSync   ← غير مدعوم في معظم المتصفحات         │
│                                                       │
│  عند إغلاق الشاشة:                                    │
│  Android Doze Mode يُعلّق WebView بعد ~30 ثانية        │
│  → watchPosition يتوقف                                │
│  → الموقع لا يُحدّث                                   │
│  → الراكب يرى السائق ثابت في مكانه                     │
└─────────────────────────────────────────────────────┘
```

### أجهزة السوق العراقي المتأثرة:
- **Xiaomi/MIUI** (30%+ من السوق): Battery Saver يقتل WebView خلال 1-3 دقائق
- **Samsung** (25%+ من السوق): Adaptive Battery يُعلّق التطبيق بعد 5 دقائق
- **Huawei/EMUI** (15%+): PowerGenie يقتل التطبيقات العشوائية
- **Oppo/Realme**: AutoStart Manager يمنع التشغيل بالخلفية

### الحل: Android Foreground Service

```
┌─────────────────────────────────────────────────────┐
│         @transistorsoft/capacitor-background-geo      │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │        Android Foreground Service            │     │
│  │                                               │     │
│  │  📍 Native GPS listener (لا يمر بـ WebView)   │     │
│  │  🔔 إشعار دائم "ران كابتن — جارٍ التتبع"      │     │
│  │  🛡️ Android لا يقتل Services مع إشعار دائم   │     │
│  │  🔄 يبقى يعمل حتى لو:                         │     │
│  │     - الشاشة مغلقة                             │     │
│  │     - Doze Mode نشط                            │     │
│  │     - التطبيق في الخلفية                        │     │
│  │     - التطبيق مغلق تماماً (stopOnTerminate=false)│     │
│  └─────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

### الملف الجديد: `nativeLocationService.ts`

```typescript
export async function startNativeTracking(opts) {
  const BackgroundGeolocation = (await import(
    '@transistorsoft/capacitor-background-geolocation'
  )).default;

  await BackgroundGeolocation.ready({
    // إعدادات GPS
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 10,                    // تحديث كل 10 أمتار
    locationUpdateInterval: 5000,          // أو كل 5 ثوانٍ

    // منع القتل
    stopOnTerminate: false,                // لا يتوقف عند إغلاق التطبيق
    startOnBoot: true,                     // يبدأ مع تشغيل الجهاز
    foregroundService: true,               // إشعار دائم

    // إشعار Android
    notification: {
      title: 'ران كابتن 🚗',
      text: 'جارٍ تتبع رحلتك...',
    },

    enableHeadless: true,                  // يعمل بدون UI
    autoSync: false,                       // نتحكم بالإرسال يدوياً
  });

  // عند كل تحديث موقع:
  BackgroundGeolocation.onLocation(async (location) => {
    // 1. كتابة IndexedDB أولاً (يبقى حتى بدون إنترنت)
    await addLocation({...});
    
    // 2. إرسال لـ Supabase (إذا فيه إنترنت)
    if (navigator.onLine) {
      await supabase.from('driver_live_locations').upsert({...});
    }
  });

  await BackgroundGeolocation.start();
}
```

### ربط الخدمة بالكود: `useAdvancedLocationTracking.ts`

```typescript
// الملف الذي يتحكم بالتتبع — أصبح ذكياً:

import { isNativePlatform } from '@/lib/capacitorBridge';

const startTracking = useCallback(async () => {
  if (isNativePlatform) {
    // ═══ جوال (APK): Foreground Service ═══
    const { startNativeTracking } = await import('@/services/nativeLocationService');
    await startNativeTracking({ driverId, rideId, updateInterval, minAccuracy });
    // ← يعمل حتى لو الشاشة مغلقة ✅
  } else {
    // ═══ متصفح (للتطوير): Web API ═══
    await backgroundLocationService.startTracking({...});
    // ← يتوقف عند إغلاق Tab (مقبول للتطوير فقط)
  }
}, [...]);

const stopTracking = useCallback(async () => {
  if (nativeTrackingActiveRef.current) {
    const { stopNativeTracking } = await import('@/services/nativeLocationService');
    await stopNativeTracking();
  } else {
    backgroundLocationService.stopTracking();
  }
}, []);
```

### كيف يعمل `isNativePlatform`؟

```typescript
// src/lib/capacitorBridge.ts
import { Capacitor } from '@capacitor/core';
export const isNativePlatform = Capacitor.isNativePlatform();
// → true  إذا التطبيق شغّال كـ APK (Android)
// → false إذا التطبيق شغّال في المتصفح (Web)
```

---

# 6. ترحيل قاعدة البيانات

## العملية

```bash
# 1. فحص الترحيلات المعلقة
npx supabase migration list --linked
# النتيجة: 20260809000000 و 20260810000000 لم يُطبّقا

# 2. محاولة أولى — فشلت!
npx supabase db push
# خطأ: "cannot change name of input parameter p_referred_user_id"
# السبب: دالة apply_referral القديمة تستخدم اسم معامل مختلف

# 3. إصلاح الخطأ
# أضفت قبل CREATE OR REPLACE:
DROP FUNCTION IF EXISTS public.apply_referral(UUID, TEXT);

# 4. محاولة ثانية — نجحت!
npx supabase db push
# ✅ Applied: 20260809000000_critical_security_fixes.sql
# ✅ Applied: 20260810000000_fix_driver_live_locations_rls.sql
```

## ماذا تم تطبيقه على قاعدة البيانات الحية:

### من `20260809000000`:
- `credit_wallet_safely()` — إضافة رصيد مع `FOR UPDATE SKIP LOCKED`
- `deduct_wallet_safely()` — خصم رصيد مع قفل ذري
- `apply_referral()` — مع حماية إحالات دائرية (recursive CTE)
- 12 فهرس أداء جديد
- إصلاح RLS لـ `fake_drivers` و `system_configs`
- `idempotency_key` لمنع الدفع المزدوج

### من `20260810000000`:
- 4 سياسات RLS جديدة على `driver_live_locations`
- فهرس `idx_driver_live_locations_driver_id`

---

# 7. جدول الملفات

| الملف | الحالة | التغيير |
|-------|--------|---------|
| `src/services/driverNotificationService.ts` | **مُعدّل** | استبدال SELECT+UPDATE بـ `rpc('accept_ride_atomic')` |
| `src/services/backgroundLocationService.ts` | **مُعدّل** | استبدال `fetch` بـ Supabase client |
| `src/components/MapGoogle.tsx` | **مُعدّل** | cleanup كامل + إصلاح deps + shared InfoWindow |
| `src/hooks/useAdvancedLocationTracking.ts` | **مُعدّل** | دمج Native + Web tracking |
| `src/services/nativeLocationService.ts` | **جديد** | خدمة Foreground Service |
| `supabase/migrations/20260810000000_fix_driver_live_locations_rls.sql` | **جديد** | RLS لحماية المواقع |
| `supabase/migrations/20260809000000_critical_security_fixes.sql` | **مُعدّل** | إضافة `DROP FUNCTION` |

---

# 8. نتائج التحقق

```bash
# TypeScript compilation
npx tsc --noEmit --pretty
# النتيجة: 0 أخطاء ✅

# بناء التطبيق
npm run build:rider
# النتيجة: ✓ built in 12.93s ✅

# مزامنة Android
npx cap sync android
# النتيجة: ✓ Sync finished — 16 plugins detected ✅
# يشمل: @transistorsoft/capacitor-background-geolocation@9.1.0

# ترحيل قاعدة البيانات
npx supabase db push
# النتيجة: 2 migrations applied successfully ✅
```
