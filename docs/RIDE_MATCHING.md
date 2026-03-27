# نظام مطابقة الرحلات الذكي

## نظرة عامة

تم تطوير نظام مطابقة ذكي يربط الركاب بأقرب السائقين المتاحين بناءً على عدة عوامل.

## المكونات الرئيسية

### 1. Edge Function: match-ride

**الموقع:** `supabase/functions/match-ride/index.ts`

**الوظيفة:** مطابقة الرحلات مع السائقين المناسبين

**خوارزمية العمل:**

```
1. جلب تفاصيل الرحلة
2. البحث عن السائقين المتاحين:
   - is_online = true
   - is_available = true
   - status = approved
   - vehicle_type = نفس نوع الرحلة
3. حساب المسافة والأولوية لكل سائق:
   - المسافة من موقع الانطلاق (Haversine formula)
   - وقت الوصول المتوقع (ETA)
   - نقاط الأولوية = (100 - مسافة×10) + (تقييم×20) + (خبرة÷10)
4. تصفية السائقين (فقط ضمن 15 كم)
5. ترتيب حسب الأولوية
6. اختيار أفضل 5 سائقين
7. إرسال إشعارات تدريجية:
   - السائق الأول: فوراً
   - السائق الثاني: بعد 10 ثوان
   - السائق الثالث: بعد 20 ثانية
   - وهكذا...
8. تسجيل المحاولات في ride_matching_log
```

**مثال الاستدعاء:**

```typescript
const { data, error } = await supabase.functions.invoke("match-ride", {
  body: { rideId: "uuid-here" },
});
```

**الاستجابة:**

```json
{
  "success": true,
  "message": "تم مطابقة الرحلة بنجاح",
  "ride_id": "uuid",
  "drivers_notified": 5,
  "total_drivers": 5,
  "top_drivers": [
    {
      "id": "driver-uuid",
      "name": "محمد أحمد",
      "distance_km": 2.3,
      "eta_minutes": 5,
      "rating": 4.8
    }
  ]
}
```

### 2. قاعدة البيانات

**جدول جديد: ride_matching_log**

```sql
CREATE TABLE ride_matching_log (
  id UUID PRIMARY KEY,
  ride_id UUID REFERENCES rides(id),
  driver_id UUID REFERENCES drivers(id),
  distance_km NUMERIC(6,2),
  priority_score INTEGER,
  notified_at TIMESTAMPTZ,
  response TEXT, -- 'accepted', 'rejected', 'timeout', 'ignored'
  responded_at TIMESTAMPTZ
);
```

**حقول جديدة في rides:**

- `matched_at`: وقت المطابقة
- `notified_drivers`: قائمة السائقين المُشعرين (JSONB)
- `matching_attempts`: عدد محاولات المطابقة

**جدول: push_tokens**

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  token TEXT UNIQUE,
  device_type TEXT,
  platform TEXT, -- 'web', 'android', 'ios'
  is_active BOOLEAN,
  last_used_at TIMESTAMPTZ
);
```

### 3. دوال مساعدة

**update_driver_response:**

```sql
SELECT update_driver_response(
  p_ride_id := 'ride-uuid',
  p_driver_id := 'driver-uuid',
  p_response := 'accepted'
);
```

**cleanup_old_push_tokens:**

```sql
SELECT cleanup_old_push_tokens(); -- يحذف tokens أقدم من 90 يوم
```

### 4. View: ride_matching_stats

عرض إحصائيات المطابقة:

```sql
SELECT * FROM ride_matching_stats
WHERE created_at > now() - INTERVAL '7 days';
```

الأعمدة:

- `drivers_notified`: عدد السائقين المُشعرين
- `drivers_accepted`: عدد الذين قبلوا
- `drivers_rejected`: عدد الذين رفضوا
- `drivers_timeout`: عدد الذين لم يردوا
- `nearest_driver_distance`: أقرب سائق
- `avg_driver_distance`: متوسط المسافة

## التكامل مع التطبيق

### في RiderHome.tsx

```typescript
// بعد إنشاء الرحلة مباشرة
supabase.functions
  .invoke("match-ride", {
    body: { rideId: data.id },
  })
  .then(({ data: matchData, error }) => {
    if (!error) {
      console.log("✅ تم إشعار", matchData.drivers_notified, "سائق");
    }
  });
```

### في RideRequestCard.tsx

```typescript
// عند قبول الطلب
await supabase.rpc("update_driver_response", {
  p_ride_id: pendingRide.id,
  p_driver_id: driverId,
  p_response: "accepted",
});

// عند رفض الطلب
await supabase.rpc("update_driver_response", {
  p_ride_id: pendingRide.id,
  p_driver_id: driverId,
  p_response: "rejected",
});
```

## معادلات حساب الأولوية

### 1. نقاط المسافة (Distance Score)

```
distanceScore = max(0, 100 - (distance_km × 10))
```

- سائق على بعد 0 كم = 100 نقطة
- سائق على بعد 5 كم = 50 نقطة
- سائق على بعد 10 كم = 0 نقطة

### 2. نقاط التقييم (Rating Score)

```
ratingScore = rating × 20
```

- تقييم 5.0 = 100 نقطة
- تقييم 4.0 = 80 نقطة
- تقييم 3.0 = 60 نقطة

### 3. نقاط الخبرة (Experience Score)

```
experienceScore = min(50, total_rides ÷ 10)
```

- 500+ رحلة = 50 نقطة (الحد الأقصى)
- 100 رحلة = 10 نقاط
- 0 رحلة = 0 نقطة

### 4. النقاط الإجمالية

```
priorityScore = distanceScore + ratingScore + experienceScore
```

**مثال:**

سائق على بعد 3 كم، تقييم 4.8، 200 رحلة:

- Distance: 100 - (3×10) = 70
- Rating: 4.8×20 = 96
- Experience: min(50, 200÷10) = 20
- **Total: 186 نقطة**

## الإشعارات التدريجية

لتجنب إرباك السائقين وإعطاء الأولوية للأقرب:

```typescript
const delays = [0, 10000, 20000, 30000, 40000]; // بالميلي ثانية

topDrivers.forEach((driver, index) => {
  setTimeout(() => {
    sendNotification(driver);
  }, delays[index]);
});
```

## مراقبة الأداء

### استعلامات مفيدة

**معدل القبول لكل سائق:**

```sql
SELECT
  d.full_name,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN rml.response = 'accepted' THEN 1 END) as accepted,
  ROUND(
    COUNT(CASE WHEN rml.response = 'accepted' THEN 1 END)::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as acceptance_rate
FROM ride_matching_log rml
JOIN drivers d ON d.id = rml.driver_id
WHERE rml.notified_at > now() - INTERVAL '7 days'
GROUP BY d.id, d.full_name
ORDER BY acceptance_rate DESC;
```

**متوسط وقت الاستجابة:**

```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (responded_at - notified_at))) as avg_response_seconds
FROM ride_matching_log
WHERE responded_at IS NOT NULL
AND notified_at > now() - INTERVAL '7 days';
```

**نسبة نجاح المطابقة:**

```sql
SELECT
  COUNT(*) as total_rides,
  COUNT(CASE WHEN status != 'pending' THEN 1 END) as matched_rides,
  ROUND(
    COUNT(CASE WHEN status != 'pending' THEN 1 END)::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as match_success_rate
FROM rides
WHERE created_at > now() - INTERVAL '7 days';
```

## التحسينات المستقبلية

- [ ] إضافة Machine Learning لتحسين الأولويات
- [ ] تحليل أنماط الرفض لكل سائق
- [ ] توسيع نطاق البحث تلقائياً إذا لم يُقبل الطلب
- [ ] إضافة "Surge Pricing" في أوقات الذروة
- [ ] نظام مكافآت للسائقين سريعي الاستجابة

## الأمان

- جميع الدوال محمية بـ RLS (Row Level Security)
- فقط Service Role يمكنه تحديث matching logs
- السائقون يمكنهم رؤية سجلاتهم فقط
- المسؤولون يمكنهم رؤية كل شيء

## الاختبار

```bash
# اختبار Edge Function محلياً
supabase functions serve match-ride

# استدعاء الاختبار
curl -i --location --request POST 'http://localhost:54321/functions/v1/match-ride' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"rideId":"test-ride-uuid"}'
```

## الدعم

للمشاكل أو الأسئلة:

- راجع logs في Supabase Dashboard
- تحقق من `ride_matching_log` للتفاصيل
- استخدم `ride_matching_stats` للإحصائيات
