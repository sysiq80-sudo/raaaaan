# توثيق قاعدة البيانات
> تاريخ التوثيق: 2026-05-31 (تحديث — الفحص الأصلي 2026-05-29)
> نوع قاعدة البيانات: PostgreSQL + PostGIS (Supabase Hosted)
> الأداة: Supabase Client (`@supabase/supabase-js`)
> مصدر الحقيقة: ملفات Migrations الفعلية

## ملخص

| البند | القيمة |
|---|---|
| عدد الجداول (تقديري) | ~91 🟡 محتمل — مبني على تحليل migrations |
| عدد الـ Migrations | 241 🟢 مؤكد (2026-05-31) |
| آخر Migration | `20270528001000_captain_guardian_internal_secret_callers.sql` |
| أول Migration | `035_rls_comprehensive_policies.sql` |
| RLS مفعّل | ✅ على الجداول الأساسية — ⚠️ لم يُفحص على كل الجداول |
| PostGIS | ✅ مُفعّل (migration `20260527400000_drivers_postgis_spatial.sql`) |

## الجداول الرئيسية (مُستخرجة من Migrations)

### جداول المستخدمين والأدوار
| الجدول | الوظيفة | Migration |
|---|---|---|
| `profiles` | ملفات المستخدمين الأساسية | عدة migrations |
| `user_roles` | أدوار المستخدمين (admin, etc) | `035_rls_comprehensive_policies.sql` |
| `drivers` | بيانات السائقين | عدة migrations |
| `driver_documents` | مستندات السائق (رخصة، هوية) | `20260128000001_fix_driver_documents_rls.sql` |
| `driver_update_requests` | طلبات تحديث بيانات السائق | `20260129000005_driver_update_requests.sql` |
| `controller_users` | مستخدمي التحكم (متقدم) | `20260403040318_create_controller_table.sql` |
| `user_sessions` | جلسات المستخدمين | `add_user_sessions_table.sql` |
| `account_deletions` | طلبات حذف الحسابات | `20260129000002_account_deletions.sql` |
| `banned_names` | أسماء محظورة | `20251227080000_banned_names_system.sql` |
| `kyc_documents` | وثائق KYC | `20260815000000_add_kyc_documents.sql` |

### جداول الرحلات
| الجدول | الوظيفة | Migration |
|---|---|---|
| `rides` | الرحلات الأساسية (أهم جدول) | عدة migrations |
| `ride_ratings` | تقييمات الرحلات | `20250116_create_ride_ratings.sql` |
| `ride_share_links` | روابط مشاركة تتبع الرحلة | `20251226180100_ride_share_links.sql` |
| `ride_chat_messages` | رسائل الدردشة أثناء الرحلة | `20251227100000_ride_chat_system.sql` |
| `ride_status_notifications` | إشعارات حالة الرحلة | `20260711000000_ride_status_notifications.sql` |
| `scheduled_rides` | الرحلات المجدولة | `20260201153000_advanced_scheduled_rides.sql` |

### جداول مالية
| الجدول | الوظيفة | Migration |
|---|---|---|
| `wallet_transactions` | معاملات المحفظة | `20260129000004_driver_wallet_system.sql` |
| `wallet_topup_requests` | طلبات شحن المحفظة | نفس migration |
| `payment_methods` | طرق الدفع | `20260129000003_payment_methods_system.sql` |
| `commission_tiers` | شرائح العمولة | عدة migrations |
| `receipt_transactions` | معاملات الإيصالات | `20260610000001_receipt_transactions.sql` |
| `company_daily_earnings` | أرباح الشركة اليومية | `20260521120000_financial_system_upgrade.sql` |
| `promo_codes` | أكواد ترويجية | `20260612000001_promo_codes_system.sql` |
| `vouchers` | قسائم | `20260521140000_voucher_system.sql` |
| `subscription_plans` | خطط الاشتراك | `20260521130000_daily_subscription_system.sql` |
| `driver_subscriptions` | اشتراكات السائقين | نفس migration |

### جداول جغرافية
| الجدول | الوظيفة | Migration |
|---|---|---|
| `regions` | المناطق الجغرافية | عدة migrations |
| `landmarks` | المعالم المحلية | عدة migrations |
| `service_areas` | مناطق الخدمة | عدة migrations |
| `driver_live_locations` | مواقع السائقين الحية | `20260222100000_driver_live_tracking_system.sql` |
| `governorates` | المحافظات العراقية | `20260113000001_add_governorates.sql` |
| `directions_cache` | كاش المسارات | `20260420130001_directions_cache.sql` |
| `geocode_cache` | كاش الـ Geocoding | `20260528500000_geocode_cache.sql` |
| `demand_zones` | مناطق الطلب | عدة migrations |

### جداول الإشعارات والتواصل
| الجدول | الوظيفة | Migration |
|---|---|---|
| `push_subscriptions` | اشتراكات Push | `20260302000000_push_subscriptions_user_id.sql` |
| `notification_campaigns` | حملات الإشعارات | `20260330000000_notification_management_system.sql` |
| `notification_groups` | مجموعات الإشعارات | نفس migration |
| `sms_logs` | سجلات SMS | `20260301000000_production_fixes_sms.sql` |
| `bot_customers` | عملاء البوت | عدة migrations |
| `bot_conversation_messages` | رسائل محادثات البوت | `20260304000001_bot_conversation_messages.sql` |
| `messenger_accounts` | حسابات المراسلة | `20260227120000_messenger_accounts.sql` |

### جداول الأمان والتدقيق
| الجدول | الوظيفة | Migration |
|---|---|---|
| `audit_logs` | سجلات التدقيق | `20260406150500_admin_audit_logs.sql` |
| `fraud_alerts` | تنبيهات الاحتيال | `20250712000003_create_fraud_alerts_table.sql` |
| `rate_limit_entries` | Rate Limiting | `20260226120000_rate_limit_table.sql` |
| `analytics_events` | أحداث التحليلات | `20260226140000_analytics_events_table.sql` |
| `system_events` | أحداث النظام | `20260527500000_system_events.sql` |
| `emergency_contacts` | جهات اتصال الطوارئ | `20260129200001_emergency_system_tables.sql` |
| `complaints` | الشكاوى | `20260129200002_complaints_system.sql` |

### جداول الإعدادات
| الجدول | الوظيفة | Migration |
|---|---|---|
| `system_configs` | إعدادات النظام العامة | `20260223200000_system_configs_table.sql` |
| `fare_settings` | إعدادات الأسعار | عدة migrations |
| `surge_zones` | مناطق التسعير الديناميكي | `036_surge_pricing_system.sql` |
| `cancellation_rules` | قواعد الإلغاء | `20260215120000_justice_cancellation_logic.sql` |
| `driver_registration_settings` | إعدادات تسجيل السائقين | `20260110120000_driver_registration_settings.sql` |
| `rider_wait_settings` | إعدادات انتظار الراكب | `20260111000000_rider_wait_settings.sql` |
| `security_settings` | إعدادات الأمان | `20260225100000_security_settings.sql` |
| `visual_workflows` | workflows مرئية | `20260227100000_visual_workflow_tables.sql` |
| `dispatch_settings` | إعدادات التوزيع | `20260420130002_dispatch_v2_settings.sql` |
| `promo_banners` | بانرات ترويجية | `20241227000001_promo_banners.sql` |

## Migrations — تسلسل زمني ملخص

| الفترة | العدد | أبرز التغييرات |
|---|---|---|
| 2024-12 — 2025-01 | ~5 | أساسيات RLS + surge pricing + promo banners |
| 2025-07 — 2025-12 | ~70 | تأسيس النظام الأساسي (rides, drivers, regions, إلخ) |
| 2026-01 | ~20 | driver registration + rider wait + governorates |
| 2026-01-29 | ~10 | أنظمة مالية + طوارئ + شكاوى |
| 2026-02 | ~20 | أمان + rate limiting + analytics + notifications |
| 2026-03 — 2026-04 | ~15 | إدارة إشعارات + audit logs + race condition fixes |
| 2026-05-21 | ~10 | نظام مالي متقدم + vouchers + security hardening |
| 2026-05-27/28 | ~15 | **أكبر دفعة:** dispatch v2 + PostGIS + data isolation + أداء |
| 2026-06 — 2026-10 | ~20 | captain guardian + promo codes + ride acceptance fixes |
| 2027-05 | 8 | إصلاحات مالية + captain guardian callers |
| 2026-05-30 | 2 | **جديد:** financial_watchdog_cron (pg_cron) + rider_wallet_ledger_columns |

## Database Functions (RPCs) الرئيسية

| الدالة | الوظيفة | Migration |
|---|---|---|
| `get_nearby_pending_rides` | جلب الرحلات المعلقة القريبة | عدة migrations |
| `accept_ride_atomic` | قبول رحلة بشكل ذري (يمنع double booking) | `20260529000000` |
| `complete_ride_atomic` | إكمال رحلة بشكل ذري | `20260905100000` |
| `cancel_ride_rider_atomic` | إلغاء رحلة من الراكب | `20260904000000` |
| `claim_dispatch_for_driver` | مطالبة بتوزيع رحلة | `20260527320000` |
| `process_wallet_transaction` | معالجة معاملة محفظة | `20260129000004` |
| `get_admin_dashboard_stats` | إحصائيات لوحة التحكم | `20260406150400` |
| `check_ghost_account` | فحص الحسابات الشبحية | `20260611000000` |
| `get_system_capacity_metrics` | مقاييس سعة النظام | `20260528210000` |

## أسئلة معلقة
- ⚠️ ما هو العدد الدقيق الحالي للجداول بعد تطبيق كل الـ 241 migration?
- ✅ تم التحقق: migrations ذات تواريخ 2027 مُطبّقة فعلياً (supabase CLI linked ومتزامنة)
- ⚠️ RLS لم يُفحص على كل الجداول — فحص شامل مطلوب
