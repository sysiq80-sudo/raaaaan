# الصلاحيات والمصادقة
> تاريخ التوثيق: 2026-05-31 (تحديث — الفحص الأصلي 2026-05-29)
> نظام المصادقة: Supabase Auth
> مصدر الحقيقة: الكود الفعلي

## نظام المصادقة (Authentication)

### طرق تسجيل الدخول
| الطريقة | مفعّلة | الملف |
|---|---|---|
| هاتف + OTP (عراقي E.164) | ✅ | 📁 `src/pages/Auth.tsx` + `src/pages/driver/DriverAuth.tsx` |
| Email + Password | ✅ | 📁 `src/pages/Auth.tsx` |
| OTP (رسالة نصية) | ✅ | 📁 `supabase/functions/send-otp/` |
| تسجيل دخول الأدمن (email/pass) | ✅ | 📁 `src/pages/admin/AdminLogin.tsx` |
| OAuth (Google/Apple) | ❌ | غير موجود في الكود |
| Magic Link | ❌ | غير موجود في الكود |

### تدفق المصادقة
```
المستخدم → Auth.tsx [إدخال الهاتف بصيغة عراقية]
    ↓ تحويل إلى E.164 (+964XXXXXXXXX)
supabase.auth.signInWithOtp({ phone })
    ↓ Edge Function: send-otp/
SMS Provider → المستخدم [OTP]
    ↓ إدخال OTP
supabase.auth.verifyOtp()
    ↓ onAuthStateChange → INITIAL_SESSION
AuthContext.tsx → detectUserRole(userId)
    ↓ فحص user_roles + drivers
تحديد الدور → حفظ cache → توجيه
```

### إدارة الجلسات
- **النوع:** JWT (Supabase Auth) 🟢 مؤكد
- **التجديد:** تلقائي عبر `TOKEN_REFRESHED` event — 📁 `src/contexts/AuthContext.tsx:306`
- **Remember Me:** `raan_remember_me` في localStorage — إذا `false` + أُعيد فتح المتصفح = تسجيل خروج تلقائي 🟢 مؤكد
- **Capacitor (Native):** يبقى مسجلاً دائماً — لا يُفحص `remember_me` 🟢 مؤكد
- **Safety Timeout:** 4 ثوانٍ — إذا لم يستجب Auth يُوقف التحميل 🟢 مؤكد
- **Multi-Device:** كشف عبر `device_id` في localStorage — 📁 `src/contexts/AuthContext.tsx:148`
- **Session Timeout:** 📁 `src/hooks/useSessionTimeout.tsx` — تنظيف جلسات قديمة

## الأدوار والصلاحيات (Authorization)

### الأدوار
| الدور | الوصف | الكشف | المسار |
|---|---|---|---|
| `admin` | مدير النظام | جدول `user_roles` (role = 'admin') | `/admin/*` |
| `driver` | سائق | جدول `drivers` (status = 'approved') | `/driver/*` |
| `rider` | راكب (الافتراضي) | لا يحتاج إدخال — أي مستخدم غير admin/driver | `/rider/*` |

### تبديل الأدوار
- **راكب → سائق:** ممكن إذا `canSwitchToDriver = true` (السائق معتمد) — 📁 `src/contexts/AuthContext.tsx:402`
- **سائق → راكب:** ممكن دائماً — 📁 `src/contexts/AuthContext.tsx:418`
- **أي → أدمن:** غير ممكن من الواجهة — يحتاج إدخال في `user_roles` مباشرة

### ⚠️ ملاحظة أمنية مهمة
> الدور يُحفظ في cache (`raan_role_[userId]` أو `raan_current_role` في localStorage) لتسريع التحميل، ثم يُتحقق منه في الخلفية. هذا يعني:
> - **Frontend:** الدور المخزن مؤقتاً قد يُعرض لحظياً قبل التحقق الفعلي
> - **Backend (RLS + Edge Functions):** تعتمد على JWT الحقيقي — آمنة 🟢

### مكان تطبيق الصلاحيات
| المستوى | التقنية | الملف |
|---|---|---|
| Frontend (Routes) | `ProtectedRoute` component | 📁 `src/components/auth/ProtectedRoute.tsx` |
| Frontend (UI) | `useAuth()` → `userRole` → إظهار/إخفاء عناصر | كل الصفحات |
| API (Edge Functions) | JWT verification + admin check | 📁 `supabase/functions/_shared/` |
| Database (RLS) | Row Level Security Policies | 📁 `supabase/migrations/035_rls_comprehensive_policies.sql` + 10+ migrations إضافية |

## RLS Policies (مختصر)

| المجموعة | مُفحص؟ | الدليل |
|---|---|---|
| `rides` | ✅ | migrations: `035_rls`, `20260528300000`, `20260528310000` |
| `drivers` | ✅ | migrations: `035_rls`, `20260810000000` |
| `profiles` | ✅ | migration: `035_rls` |
| `driver_documents` | ✅ | migration: `20260128000001` |
| `wallet_transactions` | ✅ | migration: `20260521170000_security_hardening_final.sql` |
| `driver_live_locations` | ✅ | migrations: `20260810000000`, `20260811000000` |
| `messenger_accounts` | ✅ | migration: `20260228010000` |
| **⚠️ باقي الجداول (~60+)** | ⚠️ غير مؤكد | لم يُفحص بشكل فردي — بعض migrations تُضيف RLS بشكل شامل |

## Middleware حماية المسارات

| المسار | نوع الحماية | الملف |
|---|---|---|
| `/rider/*` | `ProtectedRoute requiredRole="rider"` | 📁 `src/App.tsx:390-498` |
| `/driver/*` | `ProtectedRoute requiredRole="driver"` | 📁 `src/App.tsx:500-640` |
| `/admin/*` | `ProtectedRoute requiredRole="admin"` | 📁 `src/App.tsx:641-1200+` |
| `/auth`, `/driver/auth` | عام — لا حماية | |
| `/terms`, `/privacy`, `/about`, `/help` | عام — لا حماية | |
| `/track/:token` | عام — رابط مشاركة تتبع | |
| `/payment/result` | عام | |

## العزل (Tenant Isolation)

| المستوى | مطبق؟ | الطريقة | الدليل |
|---|---|---|---|
| عزل المستخدمين | ✅ | RLS: `auth.uid() = user_id` | 📁 `035_rls_comprehensive_policies.sql` |
| عزل السائقين | ✅ | RLS: `auth.uid() = user_id` + فحص status | migrations متعددة |
| عزل الشركات/الأساطيل | ⚠️ جزئي | `fleets` table موجود — RLS ⚠️ غير مؤكد | 📁 `20260612000003_fleet_management.sql` |
| Multi-tenant (شركات متعددة) | ❌ غير مطبق | التطبيق لشركة واحدة (ران) | |

## مسارات API غير محمية (عامة)

| المسار | الطريقة | السبب المتوقع | الخطورة |
|---|---|---|---|
| `/auth` | عام | صفحة تسجيل الدخول | 🟢 طبيعي |
| `/driver/auth`, `/driver/register` | عام | تسجيل السائقين | 🟢 طبيعي |
| `/admin/login` | عام | تسجيل دخول الأدمن | 🟢 طبيعي |
| `/track/:token` | عام | تتبع الرحلة بالرابط | 🟢 طبيعي — محمي بـ token |
| `/payment/result` | عام | callback الدفع | 🟡 يحتاج مراجعة — هل يتحقق من التوقيع؟ |

## أسئلة معلقة
- هل كل الـ ~91 جدول لديها RLS policies مناسبة؟ (تم فحص ~15 جدول فقط)
- هل `/payment/result` تتحقق من صحة callback الدفع (signature verification)؟
- هل هناك آلية لإلغاء جلسات المستخدم عن بُعد (force logout)؟
