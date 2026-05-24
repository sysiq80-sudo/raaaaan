# Phase 3 — Dispatch v2 (الإصدار الذكي للتوزيع)

> **الحالة**: ✅ الكود جاهز ومُختبر | ⏳ في انتظار تطبيق migrations على القاعدة الحية

## ما الذي تغيّر؟

### 1. ETA حقيقي بدلاً من Haversine
- جديد: [`supabase/functions/_shared/eta.ts`](../functions/_shared/eta.ts) → `getSmartETA()`
- **3 طبقات**: `directions_cache` → Google Directions API → Haversine fallback
- **توفير الكلفة**: bucketing على شبكة 100م + ساعة اليوم، TTL = 24h
- **Latency budget**: 1500ms timeout على Google + استجابة فورية من cache

### 2. تقييم السائقين متعدد العوامل
صيغة جديدة (Phase 1 → v2):

```
score = 0.45 · etaScore
      + 0.20 · ratingScore
      + 0.20 · acceptanceScore
      − 0.10 · cancellationPenalty
      + 0.05 · fairnessScore
      + experienceBonus
```

افتراضيات السائق الجديد: `acceptance_rate = 0.700` (لا يُعاقب لعدم وجود تاريخ).

### 3. جدولة بيانات الأداء
- جديد: `driver_matching_stats` — تُحدَّث تدريجياً عبر triggers على
  - `ride_matching_log` (response → accepted/rejected/timeout)
  - `rides` (status → completed/cancelled by driver)
- إعادة بناء يومية اختيارية: `SELECT public.recompute_driver_matching_stats();`

### 4. رايات تشغيل آمنة (Feature Flags)
يمكن العودة الفورية لـ v1 بتغيير قيمة واحدة في `app_settings.matching_settings`:

```sql
UPDATE public.app_settings
SET value = value || jsonb_build_object('dispatch_version', 'v1')
WHERE key = 'matching_settings';
```

## الملفات المُعدَّلة / الجديدة

| ملف | النوع | الغرض |
|-----|------|-------|
| [`supabase/migrations/20260420130000_driver_matching_stats.sql`](../migrations/20260420130000_driver_matching_stats.sql) | جديد | جدول + triggers + recompute |
| [`supabase/migrations/20260420130001_directions_cache.sql`](../migrations/20260420130001_directions_cache.sql) | جديد | جدول الكاش + cleanup |
| [`supabase/migrations/20260420130002_dispatch_v2_settings.sql`](../migrations/20260420130002_dispatch_v2_settings.sql) | جديد | إعدادات v2 + dispatch_version |
| [`supabase/functions/_shared/eta.ts`](../functions/_shared/eta.ts) | جديد | `getSmartETA` + `getBatchETA` |
| [`supabase/functions/match-ride/index.ts`](../functions/match-ride/index.ts) | تعديل | تكامل v2 + pre-filter top-K + scoring جديد |
| [`supabase/audit/phase3_apply_all.sql`](./phase3_apply_all.sql) | جديد | **ملف لصق-وتشغيل** للقاعدة الحية |

## كيفية التطبيق على القاعدة الحية (يدوياً)

> Docker غير متاح في بيئتك، و Service Role Key غير مُتاح في `.env` حالياً.
> هذا الطريق هو الأسرع والأكثر أماناً.

### الخطوة 1: تطبيق migrations
1. افتح [Supabase Dashboard](https://app.supabase.com/) → مشروعك → **SQL Editor**
2. افتح ملف [`supabase/audit/phase3_apply_all.sql`](./phase3_apply_all.sql) في VS Code
3. **Ctrl+A → Ctrl+C → الصق في SQL Editor → Run**
4. ستُعرض 5 جداول تحقق في الأسفل:
   - ✅ الجدولان موجودان مع `rls_enabled = true`
   - ✅ `dispatch_version = v2`
   - ✅ الـ triggers مُسجَّلة
   - ✅ الدوال SECURITY DEFINER مع `search_path = public`
   - ✅ `anon_can_exec = false` و `auth_can_exec = false`

### الخطوة 2: نشر Edge Function المحدَّث
```powershell
# يتطلب Supabase CLI مسجلاً مسبقاً (أنت سجّلته في Phase 1)
supabase functions deploy match-ride --no-verify-jwt
supabase functions deploy _shared --no-verify-jwt  # إن لزم (helper مشترك)
```

> ملاحظة: `_shared` ليست function مستقلة — تُستورد من `match-ride`.
> النشر التلقائي يأخذها معه.

### الخطوة 3: مراقبة 24 ساعة
شغّل في SQL Editor للمتابعة:

```sql
-- نسبة استخدام الكاش (هدف >70% بعد يومين)
SELECT
    source,
    COUNT(*) AS reqs,
    AVG(duration_seconds) AS avg_duration_sec
FROM public.directions_cache
GROUP BY source;

-- توزيع acceptance_rate
SELECT
    width_bucket(acceptance_rate, 0, 1, 10) AS bucket,
    COUNT(*) AS drivers
FROM public.driver_matching_stats
WHERE last_30d_offered >= 5
GROUP BY 1 ORDER BY 1;

-- مقارنة أداء v1 vs v2 من logs
SELECT
    matched_at::date AS day,
    COUNT(*) FILTER (WHERE notes LIKE '%dispatch=v2%') AS v2_matches,
    COUNT(*) FILTER (WHERE notes LIKE '%dispatch=v1%') AS v1_matches
FROM public.ride_matching_log
WHERE matched_at >= now() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

## الـ Rollback السريع

عند أي مشكلة (latency عالٍ، logs غير متوقعة، شكاوى):

```sql
UPDATE public.app_settings
SET value = value || jsonb_build_object('dispatch_version', 'v1'),
    updated_at = now()
WHERE key = 'matching_settings';
```

→ سيُستخدم سلوك v1 السابق فوراً في next ride request دون إعادة نشر.

## الخطوات التالية المقترحة

- [ ] **Phase 4**: WebSocket pre-warming لتقليل latency في mobile apps
- [ ] **Phase 5**: ML-driven ETA (تحسين على Google) باستخدام بيانات `directions_cache`
- [ ] **Phase 6**: Driver heatmap + surge pricing (يحتاج `driver_matching_stats` كأساس)
- [ ] **Phase 7**: Observability dashboard (Grafana/Metabase) — KPIs من `driver_matching_stats`

---

## آلية توسيع نطاق البحث التدريجي (مُنجز — 24 مايو 2026)

> تحديث: commit `2a51b6d` — الآلية مكتملة ومنشورة

### المشكلة التي كانت موجودة
- الـ UI يعرض "توسيع نطاق البحث..." أثناء `isReMatching`
- لكن `match-ride` تقرأ `ride.metadata.radius_bonus_km` من قاعدة البيانات مباشرة
- لم يكن الكود يُحدّث هذه القيمة قبل استدعاء `match-ride` — النطاق يبقى 0 دائماً

### الحل المُنفَّذ
**الملف:** `src/components/rider/RideWaitingScreen.tsx`

قبل كل استدعاء لـ `match-ride` (دالة `triggerReMatch`):
1. يجلب `ride.metadata` الحالية من قاعدة البيانات
2. يحسب `newBonus = Math.min(prevBonus + 3, 12)` (خطوة 3 كم، حد أقصى 12 كم)
3. يكتب `ride.metadata.radius_bonus_km = newBonus` في Supabase
4. ثم يستدعي `match-ride` بـ `re_match: true`

### كيف تستخدمه `match-ride`
```typescript
// supabase/functions/match-ride/index.ts — بدون تعديل عليه
const radiusBonus = (ride.metadata as any)?.radius_bonus_km || 0;
// لكل سائق مرشح:
maxRadius = (driver.max_pickup_radius || admin_default_radius) 
           + (high_priority ? 5 : 0) 
           + radiusBonus;
```

### جدول التوسيع
| الجولة | الوقت من بداية الانتظار | radius_bonus_km الجديد | النطاق الفعلي |
|--------|------------------------|----------------------|--------------|
| 1 | ~45 ثانية | 3 كم | base + 3 |
| 2 | ~105 ثانية | 6 كم | base + 6 |
| 3 | ~165 ثانية | 9 كم | base + 9 |
| 4 | ~225 ثانية | 12 كم | base + 12 |

`re_match: true` يُنظّف `notified_drivers` فيسمح بإعادة إشعار السائقين الذين انتهت مهلتهم سابقاً.

---

> **حالة المهمة**: الكود مكتمل 100% ومُختبر TypeScript. التطبيق على القاعدة الحية = خطوة لصق واحدة.
