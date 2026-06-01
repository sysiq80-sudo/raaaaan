# RAAN — Verification Scripts

## الملفات المتوفرة

| الملف | الغرض |
| --- | --- |
| `voucher-admin-rpc-verify.ts` | فحص صلاحيات الكاردات وRPCs الأدمن |
| `financial-attack-sim.ts` | محاكاة هجمات مالية (8 سيناريو) |
| `financial-integrity-audit.ts` | تدقيق سلامة Ledger المالي (G01→I10) |
| `watchdog-verification.ts` | التحقق end-to-end من financial-watchdog |

---

# Watchdog Verification (`watchdog-verification.ts`)

يتحقق من أن `financial-watchdog` Edge Function تعمل فعلياً:

**الخطوات المُنفَّذة:**
1. **Preflight**: هل الـ watchdog مُنشر ويستجيب؟
2. **Dry Run**: تشغيل على البيانات الحالية (بدون حقن)
3. **Inject Drift**: حقن +5000 IQD مصطنع على راكب حقيقي
4. **Run Watchdog**: تشغيل الـ watchdog بعد الحقن
5. **Verify Alerts**: التحقق من fraud_alerts (W01_WALLET_MISMATCH, severity=high, alerts_sent≥1)
6. **Cleanup**: استعادة wallet_balance + حذف سجلات الاختبار

## المتطلبات

يجب أن يكون `financial-watchdog` مُنشراً قبل التشغيل:
```bash
npx supabase functions deploy financial-watchdog
```

| المتغير | الوصف |
| --- | --- |
| `SUPABASE_URL` | عنوان المشروع |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح service_role |
| `INTERNAL_EDGE_SECRET` | سر الـ watchdog (من Supabase Secrets) |
| `RAAN_VERIFY_ALLOW_PRODUCTION` | `yes` للتشغيل على الإنتاج |

## التشغيل (PowerShell)

```powershell
$env:SUPABASE_URL = "https://wgolkcztdrwdphwjvqxt.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
$env:INTERNAL_EDGE_SECRET = "<internal-edge-secret>"
$env:RAAN_VERIFY_ALLOW_PRODUCTION = "yes"
npx tsx supabase/verification/watchdog-verification.ts
```

**النتيجة المتوقعة (نجاح):**
```
✅ [PASS] Function Deployed         watchdog يستجيب — HTTP 200
✅ [PASS] Dry Run                   لا مشاكل مالية في البيانات الحالية
✅ [PASS] Inject Drift              wallet_balance X → X+5000
✅ [PASS] Watchdog Invocation       HTTP 200 — ok=true
✅ [PASS] W01 in Report             الـ watchdog اكتشف حالة wallet mismatch
✅ [PASS] fraud_alerts Inserted     1 سجل W01_WALLET_MISMATCH أُدرج
✅ [PASS] Severity=high             severity=high ✓
✅ [PASS] Alerts Sent               alerts_sent=1
✅ [PASS] Restore Balance           wallet_balance استُعيد
✅ [PASS] Delete Test Alerts        1 سجل اختبار حُذف

🟢 Watchdog Verification: PASS → Financial Observability = PASS
```

---

# Voucher / Admin RPC Permission Verification

اختبار إثبات أمني (Proven Fixed) لصلاحيات الكاردات وRPCs الأدمن. يُنفّذ `T0 → T10`
ويُخرج تقرير `PASS/FAIL` لكل اختبار + حكماً نهائياً.

## ⚠️ تحذير

- يُشغَّل على **Supabase local أو staging فقط** — **ممنوع على الإنتاج**.
- السكربت يرفض التشغيل إذا كان `SUPABASE_URL` يشير إلى مشروع الإنتاج
  (`wgolkcztdrwdphwjvqxt`).
- لبيئة staging (غير local) يجب تمرير `RAAN_VERIFY_ALLOW_STAGING=yes` تأكيداً صريحاً.
- يُنشئ السكربت مستخدمي/كاردات اختبار ثم **ينظّفها تلقائياً** عند الانتهاء.

## المتطلبات

متغيرات البيئة:

| المتغير | الوصف |
| --- | --- |
| `SUPABASE_URL` | عنوان مشروع staging/local (مثل `http://127.0.0.1:54321`) |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح service_role للتهيئة والتنظيف |
| `SUPABASE_ANON_KEY` | مفتاح anon لمحاكاة جلسات المستخدمين |
| `RAAN_VERIFY_ALLOW_STAGING` | `yes` فقط عند الاستهداف الصريح لـ staging |

## التشغيل

### على local

```powershell
$env:SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_SERVICE_ROLE_KEY = "<local-service-role-key>"
$env:SUPABASE_ANON_KEY = "<local-anon-key>"
npx tsx supabase/verification/voucher-admin-rpc-verify.ts
```

### على staging

```powershell
$env:SUPABASE_URL = "https://<staging-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<staging-service-role-key>"
$env:SUPABASE_ANON_KEY = "<staging-anon-key>"
$env:RAAN_VERIFY_ALLOW_STAGING = "yes"
npx tsx supabase/verification/voucher-admin-rpc-verify.ts
```

> بديل: `bun supabase/verification/voucher-admin-rpc-verify.ts`

## مصفوفة الاختبارات

| المعرّف | السيناريو | المتوقع |
| --- | --- | --- |
| T0 | راكب يحاول ترقية دوره إلى admin | يفشل (RLS) — نقطة الثقة |
| T1 | راكب يستدعي `generate_voucher_batch` | يفشل (غير مصرح) |
| T2 | سائق يستدعي `generate_voucher_batch` | يفشل (غير مصرح) |
| T3 | admin يستدعي `generate_voucher_batch` | ينجح بالبادئة `RR-` |
| T4 | راكب يستخدم كارت سائق (`RD-`) | يُرفض — هذا كارت سائق |
| T5 | سائق يستخدم كارت راكب (`RR-`) | يُرفض — هذا كارت راكب |
| T6 | admin يكمل طلب سحب | ينجح |
| T7 | غير-admin يكمل طلب سحب | يفشل (Unauthorized) |
| T8 | راكب يشحن محفظة مستخدم آخر | يُرفض — محفظتك فقط |
| T9 | anon يستدعي الدوال | يفشل (REVOKE) |
| T10 | إعادة استخدام نفس الكارت مرتين | الثانية تُرفض (idempotency) |

## النتيجة

- رمز الخروج `0` = الحكم النهائي **PASS** (كل الاختبارات نجحت).
- رمز الخروج `1` = **FAIL** (اختبار واحد على الأقل فشل) — لا إطلاق مالي.
