# 🔌 مرجع APIs — API REFERENCE

> آخر تحديث: 2026-05-31 (الجلسة الثالثة — `calculate-fare` يدعم `duration_minutes` + server sanity bounds)

---

## 1. Edge Functions (57 وظيفة)

### 1.1 المصادقة والتسجيل
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `admin-login` | POST | تسجيل دخول المدير (controller + auth sync) | Public — يتحقق داخلياً |
| `rider-signup` | POST | تسجيل راكب جديد | Public |
| `driver-signup` | POST | تسجيل سائق جديد | Public |
| `reset-password` | POST | إعادة تعيين كلمة المرور | Public |
| `send-otp` | POST | إرسال رمز OTP | Rate limited |
| `delete-user-account` | POST | حذف حساب مستخدم | Auth required |
| `session-cleanup` | POST | تنظيف الجلسات المنتهية | Internal/Cron |

### 1.2 إدارة المستخدمين (Admin)
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `admin-rpc-proxy` | POST | وكيل RPC آمن للمدير | Admin JWT + DB role check |
| `admin-update-user` | POST | تحديث مستخدم | Admin |
| `admin-delete-rider` | POST | حذف راكب | Admin |

### 1.3 الرحلات
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `match-ride` | POST | مطابقة رحلة مع سائق | Auth required |
| `complete-ride` | POST | إكمال رحلة (atomic) | Auth required |
| `calculate-fare` | POST | حساب الأجرة المتوقعة — **يقبل `duration_minutes` من OSRM** — server-side sanity bounds [5–100 km/h] | Auth required |
| `check-service-area` | POST | فحص منطقة الخدمة | Auth required |
| `generate-tracking-link` | POST | إنشاء رابط تتبع | Auth required |
| `detect-dual-stop` | POST | كشف التوقف المزدوج | Internal |
| `detect-fraud-patterns` | POST | كشف أنماط الاحتيال | Internal |
| `process-scheduled-rides` | POST | معالجة رحلات مجدولة | Cron |

### 1.4 Cron Jobs (مهام مجدولة)
| الوظيفة | الوصف | التكرار |
|---------|-------|---------|
| `cron-dispatch` | توزيع الرحلات | ⚠️ غير مؤكد |
| `cron-cancel-stale-rides` | إلغاء رحلات قديمة | ⚠️ غير مؤكد |
| `cleanup-draft-rides` | تنظيف مسودات الرحلات | ⚠️ غير مؤكد |
| `cleanup-old-otps` | تنظيف OTP قديمة | ⚠️ غير مؤكد |
| `cleanup-stale-rides` | تنظيف رحلات معلقة | ⚠️ غير مؤكد |
| `cleanup-stale-subscriptions` | تنظيف اشتراكات منتهية | ⚠️ غير مؤكد |

### 1.5 الخرائط والمواقع
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `google-maps-proxy` | POST | وكيل Google Maps API | Auth required |
| `mapbox-proxy` | POST | وكيل Mapbox | Auth required |
| `search-places` | POST | بحث أماكن | Auth required |
| `get-demand-zones` | POST | مناطق الطلب المرتفع | Auth required |

### 1.6 الدفع
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `zaincash-init` | POST | بدء عملية دفع ZainCash | Auth required |
| `zaincash-callback` | POST | استجابة ZainCash | Webhook |
| `nass-init-payment` | POST | بدء عملية دفع NASS | Auth required |
| `nass-check-status` | POST | فحص حالة دفع NASS | Auth required |
| `nass-payment-callback` | POST | استجابة NASS | Webhook |
| `process-wallet-topup` | POST | معالجة شحن المحفظة | Auth required |

### 1.7 الإشعارات
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `send-push-notification` | POST | إرسال إشعار Push | Internal |
| `send-sms` | POST | إرسال SMS | Internal |
| `send-emergency-sms` | POST | SMS طوارئ | Auth required |
| `notification-analytics` | POST | تحليلات الإشعارات | Auth required |
| `notify-admin-critical` | POST | إشعار حرج للمدير | Internal |
| `sms-ride-updates` | POST | تحديثات الرحلة عبر SMS | Internal |

### 1.8 البوتات والمراسلة
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `telegram-ai-booking` | POST | حجز عبر Telegram | Webhook |
| `telegram-ride-updates` | POST | تحديثات Telegram | Internal |
| `admin-telegram-webhook` | POST | Webhook إدارة Telegram | Webhook |
| `whatsapp-webhook` | POST | Webhook WhatsApp | Webhook |
| `whatsapp-ride-updates` | POST | تحديثات WhatsApp | Internal |
| `messenger-webhook` | POST | Webhook Messenger | Webhook |
| `sms-booking` | POST | حجز عبر SMS | Webhook |
| `sms-webhook` | POST | Webhook SMS | Webhook |
| `relay-chat-message` | POST | توجيه رسالة شات | Auth required |

### 1.9 الذكاء الاصطناعي
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `ai-assistant` | POST | مساعد AI | Auth required |
| `voice-booking-ai` | POST | حجز صوتي | Auth required |
| `captain-support-bot` | POST | دعم السائق | Auth required |
| `captain-guardian-alerts` | POST | تنبيهات حماية الكابتن | Internal |

### 1.10 أدوات إدارية
| الوظيفة | الطريقة | الوصف | الحماية |
|---------|---------|-------|---------|
| `run-visual-workflow` | POST | تشغيل سير عمل مرئي | Admin |
| `migrate-secrets-to-db` | POST | نقل الأسرار لقاعدة البيانات | Admin || `financial-watchdog` | POST / **pg_cron** | مراقبة مالية تلقائية (5 فحوصات W01-W05) | Internal — تشغيل تلقائي كل ساعة + يدوي عبر `run-watchdog-full.ts` |

> ⚠️ `financial-watchdog` تحتاج RAAN_ADMIN_CONFIRM=yes + RAAN_ENV=production للتشغيل اليدوي
---

## 2. RPCs عبر PostgREST (استدعاء مباشر)

يُستدعى عبر `supabase.rpc('function_name', params)`:

### الأكثر استخداماً
| RPC | المستدعي | الوصف |
|-----|---------|-------|
| `get_admin_dashboard_stats` | Admin Dashboard | إحصائيات شاملة |
| `has_role` | RLS + Frontend | فحص الدور |
| `accept_ride_safely` | Driver | قبول رحلة (atomic) |
| `get_nearby_pending_rides` | Driver | رحلات قريبة معلقة |
| `calculate_distance` | Fare calc | حساب المسافة |
| `get_driver_wallet_balance` | Driver | رصيد المحفظة |
| `process_ride_earnings` | complete-ride EF | معالجة أرباح |

---

## 3. أسئلة معلقة

1. ⚠️ Cron jobs — هل مُفعّلة في Supabase Dashboard أم يدوية؟
2. ⚠️ بعض Edge Functions لا تتحقق من `Authorization` header — يحتاج تدقيق
3. ⚠️ `migrate-secrets-to-db` — أداة لمرة واحدة أم مستمرة؟
