
# خطة ربط بوابة دفع NASS E-Payment بالنظام

## 📋 ملخص المشروع

بناءً على تحليل ملف Postman المرفق، بوابة NASS توفر نظام دفع متكامل يتطلب:
1. **المصادقة (Auth)**: `/auth/merchant/login` للحصول على access_token
2. **إنشاء معاملة (Init Transaction)**: `/transaction` لتجهيز بيانات الدفع
3. **تفويض البطاقة (Card Authorization)**: `https://3dsecure.nass.iq/cgi-bin/cgi_json`
4. **فحص حالة الطلب (Check Status)**: `/transaction/{orderId}/checkStatus`

## 🗂️ الملفات التي سيتم إنشاؤها/تعديلها

### الملفات الجديدة:
| الملف | الوصف |
|-------|-------|
| `supabase/functions/nass-init-payment/index.ts` | Edge Function لتهيئة المعاملة مع NASS |
| `supabase/functions/nass-check-status/index.ts` | Edge Function للتحقق من حالة المعاملة |
| `src/pages/rider/WalletTopupPage.tsx` | صفحة شحن المحفظة عبر NASS |
| `src/components/rider/NassPaymentDialog.tsx` | نافذة الدفع عبر NASS |

### الملفات المعدلة:
| الملف | التعديل |
|-------|---------|
| `supabase/functions/nass-payment-callback/index.ts` | تحديث للتوافق مع API الفعلي |
| `supabase/config.toml` | إضافة Edge Functions الجديدة |
| `src/pages/rider/RiderPaymentsPage.tsx` | ربط زر "شحن المحفظة" بالصفحة الجديدة |
| `src/App.tsx` | إضافة route للصفحة الجديدة |

---

## ⚙️ التفاصيل التقنية

### 1. المتطلبات الأولية - Supabase Secrets

يجب إضافة المفاتيح التالية في Supabase Secrets:

```text
NASS_BASE_URL        → https://api.nass.iq (أو عنوان UAT)
NASS_USERNAME        → بيانات تسجيل الدخول للتاجر
NASS_PASSWORD        → كلمة مرور التاجر
NASS_TERMINAL_ID     → معرف الطرفية (اختياري)
```

### 2. Edge Function: `nass-init-payment`

```text
المدخلات:
├── amount: المبلغ بالدينار العراقي
├── orderId: معرف فريد للطلب (UUID)
├── orderDesc: وصف الطلب
└── backRef: رابط الإرجاع بعد الدفع

العملية:
1. المصادقة مع NASS للحصول على access_token
2. إرسال طلب Init Transaction
3. حفظ المعاملة في rider_wallet_transactions بحالة 'pending'
4. إرجاع بيانات الدفع (pSign, transactionParams)

المخرجات:
├── paymentUrl: رابط صفحة الدفع
├── transactionParams: معاملات الدفع المطلوبة
└── pSign: التوقيع الرقمي
```

### 3. Edge Function: `nass-check-status`

```text
المدخلات:
└── orderId: معرف الطلب

العملية:
1. المصادقة مع NASS
2. استدعاء /transaction/{orderId}/checkStatus
3. تحديث حالة المعاملة في قاعدة البيانات
4. تحديث رصيد المحفظة إذا نجحت

المخرجات:
├── status: حالة المعاملة
├── amount: المبلغ
└── transactionDetails: تفاصيل إضافية
```

### 4. تحديث `nass-payment-callback`

تحديث الـ callback الموجود للتعامل مع الحقول الفعلية من NASS API:

```text
الحقول المتوقعة من NASS:
├── status: حالة العملية
├── orderId: معرف الطلب
├── rrn: Reference Retrieval Number
├── intRef: المرجع الداخلي
├── authCode: رمز التفويض
├── amount: المبلغ
└── card: آخر 4 أرقام من البطاقة
```

### 5. صفحة شحن المحفظة `WalletTopupPage.tsx`

```text
واجهة المستخدم:
┌─────────────────────────────────────┐
│  ← شحن المحفظة                      │
├─────────────────────────────────────┤
│                                     │
│  💳 رصيدك الحالي: 0 د.ع            │
│                                     │
│  ── اختر المبلغ ──                  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │5,000│ │10K  │ │25K  │ │50K  │   │
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                     │
│  أو أدخل مبلغ مخصص:                 │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ── طريقة الدفع ──                  │
│  ○ بطاقة ائتمان (NASS)             │
│  ○ زين كاش (تحويل يدوي)            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      متابعة للدفع            │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### 6. نافذة الدفع `NassPaymentDialog.tsx`

```text
التدفق:
1. المستخدم يختار المبلغ ويضغط "متابعة"
2. يتم استدعاء nass-init-payment
3. تظهر نافذة بخيارين:
   أ. فتح صفحة الدفع في نافذة جديدة
   ب. عرض نموذج الدفع مضمن (iframe)
4. بعد إتمام الدفع → إعادة توجيه لـ /payment/result
5. فحص الحالة وتحديث الرصيد
```

---

## 🔐 اعتبارات الأمان

1. **عدم حفظ بيانات البطاقة**: جميع بيانات البطاقة تُعالج مباشرة بواسطة NASS
2. **التحقق من التوقيع**: استخدام pSign للتحقق من صحة الردود
3. **HTTPS فقط**: جميع الاتصالات عبر HTTPS
4. **التحقق من المبلغ**: مطابقة المبلغ المرسل مع المستلم في callback

---

## 🔄 مخطط تدفق العملية

```text
المستخدم                التطبيق                Edge Function              NASS API
   │                       │                        │                         │
   │  1. اختيار المبلغ     │                        │                         │
   │──────────────────────>│                        │                         │
   │                       │  2. nass-init-payment  │                         │
   │                       │───────────────────────>│                         │
   │                       │                        │  3. Auth + Init Txn     │
   │                       │                        │────────────────────────>│
   │                       │                        │  4. pSign + params      │
   │                       │                        │<────────────────────────│
   │                       │  5. Return payment URL │                         │
   │                       │<───────────────────────│                         │
   │  6. Redirect to NASS  │                        │                         │
   │<──────────────────────│                        │                         │
   │                       │                        │                         │
   │  7. Enter card & pay  │                        │                         │
   │───────────────────────────────────────────────────────────────────────>│
   │                       │                        │                         │
   │                       │                        │  8. Callback (success)  │
   │                       │                        │<────────────────────────│
   │                       │                        │  9. Update wallet       │
   │                       │                        │───────> DB              │
   │                       │                        │                         │
   │  10. Redirect to      │                        │                         │
   │      /payment/result  │                        │                         │
   │<──────────────────────────────────────────────────────────────────────│
   │                       │                        │                         │
   │  11. Show success     │                        │                         │
   │<──────────────────────│                        │                         │
```

---

## 📊 تعديلات قاعدة البيانات

لا توجد حاجة لتعديلات جديدة - الجداول الموجودة كافية:

- **rider_wallet_transactions**: لتسجيل المعاملات
- **payment_accounts**: لإعدادات حسابات الدفع (يمكن إضافة إعدادات NASS API)

---

## 📝 خطوات التنفيذ

1. **إضافة Secrets في Supabase** (يتطلب إدخال المستخدم)
   - NASS_BASE_URL
   - NASS_USERNAME  
   - NASS_PASSWORD

2. **إنشاء Edge Functions**
   - `nass-init-payment`: لتهيئة المعاملة
   - `nass-check-status`: للتحقق من الحالة
   - تحديث `nass-payment-callback`: للتوافق مع API الفعلي

3. **إنشاء واجهات المستخدم**
   - صفحة `WalletTopupPage.tsx`
   - مكون `NassPaymentDialog.tsx`

4. **تحديث الملفات الموجودة**
   - ربط `RiderPaymentsPage.tsx` بصفحة الشحن
   - إضافة Routes في `App.tsx`
   - تحديث `supabase/config.toml`

5. **الاختبار**
   - اختبار التدفق الكامل باستخدام بيئة UAT
   - التحقق من الـ callback
   - اختبار حالات الفشل

---

## ⚠️ ملاحظات مهمة

1. **بيئة الاختبار (UAT)**: الـ Postman collection يستخدم بيئة UAT - يجب الحصول على بيانات الإنتاج من NASS
2. **العملة**: الكود 368 = الدينار العراقي (IQD)
3. **رابط الإرجاع**: سيتم استخدام `https://raan.app/payment/result` كما هو موجود حالياً
4. **رابط Callback**: `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/nass-payment-callback`

هل تريد المتابعة مع التنفيذ؟ سأحتاج منك إدخال بيانات الاتصال بـ NASS (username, password, base URL) كـ Secrets في Supabase.
