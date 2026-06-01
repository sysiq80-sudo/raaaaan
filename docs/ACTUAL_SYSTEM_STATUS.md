# حالة النظام الفعلية
> تاريخ الفحص: 2026-05-31 (تحديث شامل مساء)
> مصدر الحقيقة: الكود الفعلي (ليس التوثيق)

## ملخص

| البند | العدد |
|---|---|
| ميزات مكتملة | 44 |
| ميزات جزئية | 11 |
| ميزات مذكورة بالتوثيق وغير موجودة بالكود | 2 |
| ميزات موجودة بالكود وغير موثقة | 5 |
| أكواد تجريبية / TODO | 6 |

## تفاصيل الميزات — الراكب (Rider)

| الميزة | الحالة | الدليل | ملاحظات |
|---|---|---|---|
| المصادقة (OTP + Email) | ✅ مكتملة | 📁 `src/pages/Auth.tsx` + `src/contexts/AuthContext.tsx` | E.164 عراقي |
| الحجز بالخريطة | ✅ مكتملة | 📁 `src/pages/rider/GoPage.tsx` (109KB) | يحتاج تقسيم — **أكبر ملف بالمشروع** |
| الحجز الصوتي (AI Voice) | ✅ مكتملة | 📁 `src/components/rider/AIVoiceHome.tsx` | التعرف على الصوت + TTS |
| تتبع الرحلة المباشر | ✅ مكتملة | 📁 `src/components/LiveRideTracker.tsx` + `src/pages/TrackRide.tsx` | رابط مشاركة عام |
| سجل الرحلات | ✅ مكتملة | 📁 `src/pages/rider/RiderRidesPage.tsx` | |
| الأماكن المحفوظة | ✅ مكتملة | 📁 `src/pages/rider/RiderSavedPlacesPage.tsx` | |
| المحفظة وشحنها | ✅ مكتملة | 📁 `src/pages/rider/WalletTopupPage.tsx` + `RiderPaymentsPage.tsx` | |
| الإشعارات | ✅ مكتملة | 📁 `src/pages/rider/RiderNotificationsPage.tsx` | Push + Web Push |
| الإعدادات | ✅ مكتملة | 📁 `src/pages/rider/RiderSettingsPage.tsx` | |
| التقييم | ✅ مكتملة | 📁 `src/components/RatingDialog.tsx` | |
| Onboarding | ⚠️ جزئية | 📁 `src/pages/Onboarding.tsx` (819 bytes) | ملف صغير جداً — قد يكون wrapper فقط |
| الحجز المجدول | ✅ مكتملة | 📁 `src/pages/rider/GoPage.tsx` — `scheduleMode={true}` | |
| نظام الإحالة | ✅ مكتملة | 📁 `src/components/rider/ReferralCard.tsx` | |
| دعوة واربح | 🔧 تجريبية | 📁 `src/components/rider/RiderSideMenu.tsx:96` | `TODO: ميزة مستقبلية` |

## تفاصيل الميزات — السائق (Driver)

| الميزة | الحالة | الدليل | ملاحظات |
|---|---|---|---|
| المصادقة (هاتف) | ✅ مكتملة | 📁 `src/pages/driver/DriverAuth.tsx` | |
| التسجيل (خطوات متعددة) | ✅ مكتملة | 📁 `src/pages/driver/DriverRegister.tsx` + `DriverCompleteRegistration.tsx` | رفع مستندات |
| حالة الطلب | ✅ مكتملة | 📁 `src/pages/driver/DriverApplicationStatus.tsx` | |
| الشاشة الرئيسية + قبول الطلبات | ✅ مكتملة | 📁 `src/pages/driver/DriverHome.tsx` (56KB) | |
| GPS خلفية | ✅ مكتملة | 📁 `src/hooks/useDriverBackgroundGeolocation.ts` | Transistorsoft v9 — يحتاج اختبار APK |
| الإشعارات الذكية | ✅ مكتملة | 📁 `src/hooks/useDriverNotifications.ts` (28KB) | صوت + اهتزاز |
| المالية (المحفظة + العمولات) | ✅ مكتملة | 📁 `src/pages/driver/DriverFinance.tsx` (54KB) | |
| سجل الرحلات | ✅ مكتملة | 📁 `src/pages/driver/DriverRides.tsx` | |
| الإحصائيات | ✅ مكتملة | 📁 `src/pages/driver/DriverStatistics.tsx` | |
| الملف الشخصي | ✅ مكتملة | 📁 `src/pages/driver/DriverProfile.tsx` | |
| الإعدادات | ✅ مكتملة | 📁 `src/pages/driver/DriverSettings.tsx` | |
| الحوافز | ✅ مكتملة | 📁 `src/pages/driver/DriverIncentives.tsx` | |
| الاشتراكات | ✅ مكتملة | 📁 `src/pages/driver/DriverSubscription.tsx` | |
| دليل السائق | ✅ مكتملة | 📁 `src/pages/driver/DriverGuide.tsx` | |
| لوحة القيادة المُحسّنة | ✅ مكتملة | 📁 `src/pages/driver/DriverDashboardMigrated.tsx` | |

## تفاصيل الميزات — الإدارة (Admin)

| الميزة | الحالة | الدليل | ملاحظات |
|---|---|---|---|
| لوحة التحكم الرئيسية | ✅ مكتملة | 📁 `src/pages/admin/AdminDashboard.tsx` (26KB) | إحصائيات شاملة |
| إدارة السائقين | ✅ مكتملة | 📁 `AdminDrivers.tsx` + `AdminDriverDetails.tsx` (61KB) | |
| إدارة الركاب | ✅ مكتملة | 📁 `AdminRiders.tsx` (39KB) | |
| إدارة الرحلات | ✅ مكتملة | 📁 `AdminRides.tsx` (28KB) | |
| إعدادات الأسعار | ✅ مكتملة | 📁 `AdminFareSettings.tsx` + `AdminSurgePricing.tsx` | |
| إدارة المناطق | ✅ مكتملة | 📁 `AdminRegions.tsx` (26KB) | |
| خريطة الإدارة | ✅ مكتملة | 📁 `AdminMap.tsx` (26KB) | Mapbox |
| إدارة المركبات | ✅ مكتملة | 📁 `AdminVehicleTypes.tsx` | |
| التقارير | ✅ مكتملة | 📁 `AdminReports.tsx` + `AdminCommissionReports.tsx` | |
| إدارة الإشعارات | ✅ مكتملة | 📁 `AdminNotifications.tsx` + `AdminNotificationGroups.tsx` | |
| إدارة القسائم | ✅ مكتملة | 📁 `AdminVouchers.tsx` (25KB) | |
| إدارة الشكاوى | ✅ مكتملة | 📁 `AdminComplaints.tsx` (22KB) | |
| تنبيهات الاحتيال | ✅ مكتملة | 📁 `AdminFraudAlerts.tsx` | |
| سجلات التدقيق | ✅ مكتملة | 📁 `AdminAuditLogs.tsx` | |
| إعدادات الأمان | ✅ مكتملة | 📁 `AdminSecuritySettings.tsx` | |
| إعدادات المطور | ✅ مكتملة | 📁 `AdminDeveloperSettings.tsx` (37KB) | |
| الأساطيل | ✅ مكتملة | 📁 `AdminFleets.tsx` (24KB) | |
| المعالم المحلية | ✅ مكتملة | 📁 `AdminLandmarks.tsx` (32KB) | |
| البوت (Telegram/WhatsApp) | ✅ مكتملة | 📁 `AdminBotController.tsx` + `AdminBotCustomers.tsx` | |
| حسابات المراسلة | ✅ مكتملة | 📁 `AdminMessengerAccounts.tsx` (26KB) | |
| سجلات SMS | ✅ مكتملة | 📁 `AdminSMSLogs.tsx` | |
| إدارة الطوارئ | ✅ مكتملة | 📁 `AdminEmergencySettings.tsx` | |
| Workflows مرئية | ⚠️ جزئية | 📁 `AdminWorkflows.tsx` (635 bytes) | ملف صغير جداً — قد يكون placeholder |
| مهام التطوير | ⚠️ جزئية | 📁 `AdminDevelopmentTasks.tsx` | |

## تفاصيل الميزات — النظام العام

| الميزة | الحالة | الدليل | ملاحظات |
|---|---|---|---|
| نظام التوزيع v2 (Dispatch) | ✅ مكتملة | 📁 `supabase/functions/cron-dispatch/` + `match-ride/` | ETA ذكي |
| حساب الأجرة | ✅ مكتملة | 📁 `src/lib/fareCalculation.ts` + `supabase/functions/calculate-fare/` | routeDuration من OSRM مُمرَّر end-to-end — server-side sanity [5-100 km/h] |
| ETA الرحلة (LiveRideTracker) | ✅ مكتملة | 📁 `src/components/rider/LiveRideTracker.tsx` | OSRM حقيقي + throttle 30s/300m + Leaflet fallback عند فشل Google Maps |
| نظام الإلغاء العادل | ✅ مكتملة | 📁 migration `20260215120000_justice_cancellation_logic.sql` | |
| التسعير الديناميكي (Surge) | ✅ مكتملة | 📁 migration `036_surge_pricing_system.sql` | |
| Rate Limiting | ✅ مكتملة | 📁 `src/hooks/useRateLimiting.ts` + migration `20260226120000` | |
| وضع عدم الاتصال | ✅ مكتملة | 📁 `src/hooks/useOfflineMode.ts` | |
| مراقبة الأداء | ✅ مكتملة | 📁 `src/hooks/usePerformanceMonitoring.ts` | |
| ZainCash (الدفع) | 🔴 معطّل | 📁 `supabase/functions/zaincash-*` | **Known Technical Debt — DR-05**: race condition في callback يتيح double-credit. مُعطَّل بـ `ENABLE_EXTERNAL_PAYMENT_GATEWAYS=false`. لا يُفعَّل قبل إصلاح DR-05 + إعادة Financial DR Audit. |
| NASS (الدفع) | 🔴 معطّل | 📁 `supabase/functions/nass-*` | **Known Technical Debt — DR-07**: race condition في callback مماثل لـ DR-05. مُعطَّل بـ `ENABLE_EXTERNAL_PAYMENT_GATEWAYS=false`. لا يُفعَّل قبل إصلاح DR-07 + إعادة Financial DR Audit. |
| Captain Guardian | ✅ مكتملة | 📁 `supabase/functions/captain-guardian-alerts/` | نظام حماية الكابتن |
| Financial Watchdog | ✅ مكتملة | 📁 `supabase/functions/financial-watchdog/` + migration `20270530100000` | مراقبة مالية تلقائية — 5 فحوصات W01-W05 — pg_cron كل ساعة — E2E PASS=11 مؤكد |
| اداة المراقبة الإدارية (Admin Safety Guard) | ✅ مكتملة | 📁 `supabase/verification/run-watchdog-full.ts` | يطلب RAAN_ADMIN_CONFIRM=yes + RAAN_ENV=production — لا يعمل بدونهما |
| حذف حساب المستخدم | ✅ مكتملة | 📁 `supabase/functions/delete-user-account/` | |
| إعادة تعيين كلمة المرور | ✅ مكتملة | 📁 `supabase/functions/reset-password/` + `src/components/PasswordResetDialog.tsx` | |

## أكواد تحتاج تنظيف

### TODO / FIXME المتبقية (بعد تنظيف 2026-05-31)
| الملف | السطر | النوع | المحتوى |
|---|---|---|---|
| 📁 `src/components/rider/RiderSideMenu.tsx` | L96 | TODO | `ميزة مستقبلية - ادعُ واربح` — معلّقة بقصد |
| 📁 `src/components/rider/RiderSideMenu.tsx` | L98 | TODO | `ميزة مستقبلية - عن التطبيق` — معلّقة بقصد |

**تم حذفها (لا توجد بعد):**
| الملف | سبب الحذف |
|---|---|
| `src/lib/delayAlert.ts` L211 و L232 | migration موجود منذ 2026-01 — التعليق كان خاطئاً |
| `src/pages/rider/RiderSavedPlacesPage.tsx` L780+ | كود slider محذوف (50 سطر) كان داخل `/` */` |

### ملفات كبيرة تحتاج تقسيم
| الملف | الحجم | ملاحظة |
|---|---|---|
| 📁 `src/pages/rider/GoPage.tsx` | **109KB** | أكبر ملف — يحتاج تقسيم عاجل |
| 📁 `src/App.tsx` | 46KB (1231 سطر) | كل routes في ملف واحد — يحتاج تقسيم |
| 📁 `src/pages/admin/AdminDriverDetails.tsx` | 61KB | |
| 📁 `src/pages/driver/DriverHome.tsx` | 56KB | |
| 📁 `src/pages/driver/DriverFinance.tsx` | 54KB | |
| 📁 `src/index.css` | 56KB | CSS ضخم |
| 📁 `src/pages/admin/AdminRoutingComparison.tsx` | 50KB | |
| 📁 `src/pages/admin/AdminSettings.tsx` | 46KB | |
| 📁 `src/pages/Auth.tsx` | 44KB | |
| 📁 `src/hooks/useLocationPicker.ts` | 42KB | |

## أسئلة معلقة
- ✅ تم التحقق: migration `delayAlert` موجود (`20260129000001_delay_alerts_system.sql`) — TODO حُذفت
- ⚠️ لا يزال `AdminWorkflows.tsx` (635 bytes) placeholder — لم يُنفّذ بعد
- ⚠️ `Onboarding.tsx` (819 bytes) wrapper بدون محتوى كاف — لم يُصلح
- ✅ `trigger_driver_compensation_90s` — مُعطّل بقصد (migration 20270527003000) لمنع التعويض المزدوج — ملغى لا يُعاد تفعيله
