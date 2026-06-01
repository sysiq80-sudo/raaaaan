# 🎨 خريطة الواجهات — UI/UX MAP

> آخر تحديث: 2026-05-31 (الفحص الأصلي: 28 مايو 2026)

---

## 1. خريطة صفحات الراكب (Rider)

| المسار | الصفحة | الملف | الوظيفة | الحالة |
|--------|--------|-------|---------|--------|
| `/rider/go` | حجز رحلة | `rider/GoPage.tsx` (107KB) | الخريطة + البحث + الحجز | ✅ مكتملة |
| `/rider/go` (alt) | حجز (migrated) | `rider/RiderGoMigrated.tsx` | نسخة مُعاد هيكلتها | ⚠️ يحتاج تحقق |
| `/rider/rides` | رحلاتي | `rider/RiderRidesPage.tsx` | سجل الرحلات | ✅ مكتملة |
| `/rider/profile` | الملف الشخصي | `rider/RiderProfileMigratedPage.tsx` | بيانات المستخدم | ✅ مكتملة |
| `/rider/notifications` | الإشعارات | `rider/RiderNotificationsPage.tsx` | إشعارات الراكب | ✅ مكتملة |
| `/rider/payments` | المدفوعات | `rider/RiderPaymentsPage.tsx` | سجل المدفوعات | ✅ مكتملة |
| `/rider/saved-places` | الأماكن المحفوظة | `rider/RiderSavedPlacesPage.tsx` (30KB) | حفظ/حذف أماكن | ✅ مكتملة |
| `/rider/settings` | الإعدادات | `rider/RiderSettingsPage.tsx` | إعدادات المستخدم | ✅ مكتملة |
| `/rider/wallet` | شحن المحفظة | `rider/WalletTopupPage.tsx` | شحن عبر ZainCash/NASS | ✅ مكتملة |
| `/rider/premium` | حجز متميز | `rider/PremiumBookingPage.tsx` (1.5KB) | ⚠️ stub | ⚠️ جزئية |

---

## 2. خريطة صفحات السائق (Driver)

| المسار | الصفحة | الملف | الوظيفة | الحالة |
|--------|--------|-------|---------|--------|
| `/driver/auth` | تسجيل الدخول | `driver/DriverAuth.tsx` | دخول بإيميل + كلمة مرور | ✅ مكتملة |
| `/driver/register` | التسجيل | `driver/DriverRegister.tsx` (36KB) | تسجيل كامل + وثائق | ✅ مكتملة |
| `/driver/complete` | إكمال التسجيل | `driver/DriverCompleteRegistration.tsx` | رفع وثائق | ✅ مكتملة |
| `/driver/status` | حالة الطلب | `driver/DriverApplicationStatus.tsx` | متابعة الموافقة | ✅ مكتملة |
| `/driver/home` | الرئيسية | `driver/DriverHome.tsx` (56KB) | الخريطة + الطلبات | ✅ مكتملة |
| `/driver/rides` | رحلاتي | `driver/DriverRides.tsx` | سجل الرحلات | ✅ مكتملة |
| `/driver/profile` | الملف الشخصي | `driver/DriverProfile.tsx` | بيانات السائق | ✅ مكتملة |
| `/driver/settings` | الإعدادات | `driver/DriverSettings.tsx` | إعدادات السائق | ✅ مكتملة |
| `/driver/finance` | المالية | `driver/DriverFinance.tsx` (54KB) | المحفظة + السحب | ✅ مكتملة |
| `/driver/statistics` | الإحصائيات | `driver/DriverStatistics.tsx` | تقارير أداء | ✅ مكتملة |
| `/driver/subscription` | الاشتراك | `driver/DriverSubscription.tsx` | خطة الاشتراك | ✅ مكتملة |
| `/driver/incentives` | الحوافز | `driver/DriverIncentives.tsx` | برامج حوافز | ✅ مكتملة |
| `/driver/guide` | الدليل | `driver/DriverGuide.tsx` | دليل الاستخدام | ✅ مكتملة |
| `/driver/dashboard` | لوحة القيادة | `driver/DriverDashboardMigrated.tsx` | ⚠️ migrated | ⚠️ يحتاج تحقق |

---

## 3. خريطة صفحات المدير (Admin) — 58 صفحة

### Dashboard والإحصائيات
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/dashboard` | `AdminDashboard.tsx` | لوحة التحكم الرئيسية |
| `/admin/api-stats` | `AdminApiStats.tsx` | إحصائيات API |
| `/admin/system-capacity` | `AdminSystemCapacity.tsx` | سعة النظام |
| `/admin/reports` | `AdminReports.tsx` | التقارير |

### إدارة المستخدمين
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/drivers` | `AdminDrivers.tsx` | قائمة السائقين |
| `/admin/driver/:id` | `AdminDriverDetails.tsx` (61KB) | تفاصيل سائق |
| `/admin/driver-visibility` | `AdminDriverVisibility.tsx` | رؤية السائقين |
| `/admin/driver-application` | `AdminDriverApplication.tsx` | طلبات تسجيل |
| `/admin/riders` | `AdminRiders.tsx` (39KB) | قائمة الركاب |
| `/admin/users` | `AdminUsers.tsx` | المستخدمون |
| `/admin/controllers` | `AdminControllerUsers.tsx` | مدراء النظام |

### الرحلات
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/rides` | `AdminRides.tsx` | كل الرحلات |
| `/admin/pending-rides` | `AdminPendingRides.tsx` | رحلات معلقة |
| `/admin/stopped-rides` | `AdminStoppedRides.tsx` | رحلات متوقفة |
| `/admin/map` | `AdminMap.tsx` | خريطة حية |
| `/admin/routing` | `AdminRoutingComparison.tsx` | مقارنة مسارات |
| `/admin/cancellation-report` | `AdminCancellationReport.tsx` | تقرير الإلغاءات |

### المالية
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/withdrawals` | `AdminWithdrawals.tsx` | طلبات السحب |
| `/admin/wallet-requests` | `AdminWalletRequests.tsx` | طلبات المحفظة |
| `/admin/commission-reports` | `AdminCommissionReports.tsx` | تقارير العمولات |
| `/admin/commission-tiers` | `AdminCommissionTiers.tsx` | شرائح العمولات |

### الإعدادات
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/settings` | `AdminSettings.tsx` (46KB) | إعدادات عامة |
| `/admin/fare-settings` | `AdminFareSettings.tsx` | التسعير |
| `/admin/surge-pricing` | `AdminSurgePricing.tsx` | التسعير الديناميكي |
| `/admin/vehicle-types` | `AdminVehicleTypes.tsx` | أنواع المركبات |
| `/admin/regions` | `AdminRegions.tsx` | المناطق |
| `/admin/landmarks` | `AdminLandmarks.tsx` | المعالم |
| `/admin/security` | `AdminSecuritySettings.tsx` | إعدادات الأمان |
| `/admin/developer` | `AdminDeveloperSettings.tsx` (37KB) | إعدادات المطور |
| `/admin/cost-controls` | `AdminCostControls.tsx` | تحكم بالتكاليف |
| `/admin/rider-wait` | `AdminRiderWaitSettings.tsx` | إعدادات انتظار الراكب |
| `/admin/cancellation-settings` | `AdminCancellationSettings.tsx` | إعدادات الإلغاء |
| `/admin/emergency` | `AdminEmergencySettings.tsx` | إعدادات الطوارئ |
| `/admin/driver-reg` | `DriverRegistrationSettings.tsx` | إعدادات تسجيل السائقين |

### التسويق والإشعارات
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/notifications` | `AdminNotifications.tsx` | الإشعارات |
| `/admin/notification-groups` | `AdminNotificationGroups.tsx` | مجموعات الإشعارات |
| `/admin/promo-banners` | `AdminPromoBanners.tsx` | لافتات ترويجية |
| `/admin/vouchers` | `AdminVouchers.tsx` | القسائم |
| `/admin/referral-codes` | `AdminReferralCodes.tsx` | أكواد الإحالة |
| `/admin/incentives` | `AdminIncentives.tsx` | الحوافز |
| `/admin/subscription-plans` | `AdminSubscriptionPlans.tsx` | خطط الاشتراك |
| `/admin/fleets` | `AdminFleets.tsx` | الأساطيل |

### الأمان والمراقبة
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/audit-logs` | `AdminAuditLogs.tsx` | سجل التدقيق |
| `/admin/sms-logs` | `AdminSMSLogs.tsx` | سجل SMS |
| `/admin/fraud-alerts` | `AdminFraudAlerts.tsx` | تنبيهات الاحتيال |
| `/admin/complaints` | `AdminComplaints.tsx` | الشكاوى |
| `/admin/banned-names` | `AdminBannedNames.tsx` | أسماء محظورة |

### البوتات والرسائل
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/bot-controller` | `AdminBotController.tsx` | تحكم البوت |
| `/admin/bot-customers` | `AdminBotCustomers.tsx` | عملاء البوت |
| `/admin/bot-chats` | `AdminBotChats.tsx` | محادثات البوت |
| `/admin/messenger` | `AdminMessengerAccounts.tsx` | حسابات Messenger |

### أدوات المطور
| المسار | الملف | الوظيفة |
|--------|-------|---------|
| `/admin/dev-inspector` | `AdminDevInspector.tsx` (553B) | ⚠️ stub |
| `/admin/workflows` | `AdminWorkflows.tsx` (635B) | ⚠️ stub |
| `/admin/page-editor` | `AdminPageEditor.tsx` | محرر صفحات |
| `/admin/rider-pages` | `AdminRiderPages.tsx` | صفحات الراكب |
| `/admin/docs` | `AdminDocumentation.tsx` | التوثيق |
| `/admin/dev-tasks` | `AdminDevelopmentTasks.tsx` | مهام التطوير |

---

## 4. الصفحات العامة

| المسار | الملف | الوظيفة | الحالة |
|--------|-------|---------|--------|
| `/` | `Index.tsx` (67KB) | الصفحة الرئيسية (Landing) | ✅ مكتملة |
| `/auth` | `Auth.tsx` (44KB) | تسجيل دخول الراكب | ✅ مكتملة |
| `/about` | `About.tsx` | عن التطبيق | ✅ مكتملة |
| `/help` | `HelpAndContact.tsx` | المساعدة والتواصل | ✅ مكتملة |
| `/privacy` | `Privacy.tsx` | سياسة الخصوصية | ✅ مكتملة |
| `/terms` | `Terms.tsx` | الشروط والأحكام | ✅ مكتملة |
| `/track/:id` | `TrackRide.tsx` | تتبع رحلة (عام) | ✅ مكتملة |
| `/onboarding` | `Onboarding.tsx` | شاشة الترحيب | ⚠️ صغيرة |
| `/*` | `NotFound.tsx` | 404 | ✅ مكتملة |

---

## 5. المكونات المشتركة

### التخطيطات (Layouts)
- `RiderLayout` — تخطيط الراكب مع sidebar
- `DriverLayout` — تخطيط السائق (Parent Route ثابت مع Outlet)
- `AdminLayout` — ⚠️ غير مؤكد — يحتاج تحقق

### مكونات مهمة
- `Map.tsx` (23KB) — خريطة Google Maps مع markers
- `LiveRideTracker.tsx` (29KB) — تتبع حي للرحلة
- `LocationSearchInput.tsx` (30KB) — بحث المواقع
- `ErrorBoundary.tsx` (17KB) — معالجة الأخطاء
- `PushNotificationSetup.tsx` (14KB) — إعداد الإشعارات
- `DevInspector.tsx` (29KB) — أداة فحص المطور

---

## 6. إدارة الحالة (State)

| النوع | الأداة | الملفات |
|-------|--------|---------|
| Global State | Zustand | 4 stores (driver, rider, editor, favorites) |
| Server State | TanStack Query | في كل صفحة |
| Auth State | React Context | `AuthContext.tsx` |
| Theme | React Context | `RaanThemeContext.tsx` |
| Map | React Context | `MapContext.tsx` |
| Config | React Context | `SupabaseConfigContext.tsx` |
| URL State | React Router | params + searchParams |
