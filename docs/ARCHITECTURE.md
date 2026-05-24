# RAAN — دليل المعمارية التقنية

> مبني على فحص مباشر للكود المصدري | مايو 2026 | آخر فحص شامل: 21 مايو 2026

---

## Stack التقني الكامل

| الطبقة | التقنية |
|--------|---------| 
| Frontend | React 18 + TypeScript 5 + Vite 5 |
| Styling | TailwindCSS 3 + shadcn/ui + Radix UI |
| State | Zustand 5 + TanStack Query 5 |
| Routing | React Router DOM 6 |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |
| Edge Functions | Deno (54 function) |
| Mobile | Capacitor 8 (Android) |
| Maps | Google Maps (`@react-google-maps/api`) |
| Payments | ZainCash + NASS Payment |
| Monitoring | Sentry |
| i18n | i18next + react-i18next |
| Animation | Framer Motion |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Notifications | FCM + Web Push + Telegram + SMS |

---

## المعمارية المعيارية

### 1. طبقة المحوّلات (Adapter Pattern)
```
src/lib/adapters/
```
- **الهدف:** تجريد الخرائط والـ routing والـ geocoding
- **الحالة:** مكتملة 100% مع fallback chains (غير مدمجة بالكامل مع GoPage/DriverHome)

**سلسلة الـ Fallback:**
- خريطة: OSM → Google Maps → Static Map
- Routing: OSRM → Google Directions → Haversine (رياضيات)
- Geocoding: Nominatim → Photon → Google Places

### 2. نظام إلغاء تكرار الأحداث (Lamport Clocks)
```
src/lib/eventDeduplication/
```
- **الهدف:** منع تكرار أحداث Realtime
- **التقنية:** Lamport timestamps + 3-tier dedup (Event ID → Hash → Location proximity)
- **الحالة:** مكتمل، مُدمج في DriverHome

### 3. محرك الإشعارات الذكي
```
src/lib/notificationRouter/
```
- **الهدف:** إشعارات ذكية تراعي السياق (القيادة، الليل، البعد)
- **القواعد:** 8 قواعد افتراضية (critical, driving, parked, batching, ETA, night, lifecycle, dedup)
- **الحالة:** مكتمل، مُدمج جزئياً

---

## هيكل GoPage بعد إعادة الهيكلة

### مخطط Data Flow
```
GoPage (1,789 سطر — UI orchestration)
  ├── useLocationPicker          ← خريطة + geocoding + service area
  ├── useBookingFlow             ← خريطة الحجز + مسار
  ├── useSearchAndPlaces         ← بحث Google/Nominatim
  ├── useUnifiedSearch           ← دمج مصادر البحث
  ├── useRideTracking            ← حالة الرحلة النشطة
  ├── useBestGeolocation         ← GPS مع request cancellation
  ├── useRideBookingSubmission   ← مسار الحجز الكامل
  ├── useLocationSearchPanelHandlers ← أحداث البحث + geofence
  │
  └── JSX Components
      ├── LocationSearchPanel    ← لوحة البحث (pure render)
      ├── SavedPlacesStrip       ← الأماكن المحفوظة (pure render)
      └── LocationSelectionActionBar ← زر التأكيد (pure render)
```

---

## Stores (Zustand)

| Store | الملف | الوظيفة |
|-------|-------|---------| 
| driverStore | `src/stores/driverStore.ts` | حالة السائق + الرحلة النشطة + إعدادات كتم الإشعارات |
| riderStore | `src/stores/riderStore.ts` | حالة الراكب + موقعه + تفضيلات الحجز |
| editorStore | `src/stores/editorStore.ts` | محرر المرئيات (Admin) |
| useFavoritesStore | `src/stores/useFavoritesStore.ts` | المواقع المفضلة |

**ملاحظات تصميمية:**
- `partialize` يحفظ الإعدادات والتفضيلات فقط (لا يحفظ الموقع أو الرحلة النشطة)
- Selectors منفصلة لكل حقل لمنع re-renders غير ضرورية
- `zustandCapacitorStorage` للعمل على Capacitor WebView

---

## Contexts

| Context | الملف | الوظيفة |
|---------|-------|---------| 
| AuthContext | `src/contexts/AuthContext.tsx` | المصادقة + الأدوار + multi-device + instant role cache |
| RaanThemeContext | `src/contexts/RaanThemeContext.tsx` | الثيم الداكن/الفاتح |
| MapContext | `src/contexts/MapContext.tsx` | حالة الخريطة |
| SupabaseConfigContext | `src/contexts/SupabaseConfigContext.tsx` | إعدادات Supabase الديناميكية (تبديل مشاريع — Admin فقط) |
| MarketingLocaleContext | `src/contexts/MarketingLocaleContext.tsx` | لغة صفحات التسويق |

---

## Hooks المهمة (73 hook)

### الموقع والتتبع
- `useBestGeolocation` — GPS مع request cancellation (GEOLOCATION_SUPERSEDED)
- `useAdvancedLocationTracking` — تتبع دقيق + background
- `useNearbyDrivers` — السائقون القريبون (Realtime)
- `useOptimizedNearbyDrivers` — نسخة محسّنة مع caching
- `useDriverLocationSync` — مزامنة موقع السائق

### الرحلة والحجز
- `useActiveRide` — الرحلة النشطة (17KB)
- `useBookingFlow` — تدفق الحجز + Adaptive Routing
- `useRideBookingSubmission` — مسار الحجز الكامل (auth → validation → insert → match)
- `useRealtimeRideEvents` — Realtime + dedup

### البحث والخرائط
- `useLocationPicker` — اختيار الموقع (37KB)
- `useLocationSearchPanelHandlers` — أحداث البحث + geofence chokepoint
- `useUnifiedSearch` — البحث الموحد (16KB)
- `useDynamicPlacesSearch` — بحث Nominatim
- `useAdaptiveGeocoding` — geocoding مع fallback

### الإشعارات
- `useDriverNotifications` — إشعارات السائق (28KB)
- `useNotificationRouter` — محرك الإشعارات الذكي
- `useBroadcastChannel` — تواصل بين التبويبات

### المساعدات
- `addressFormatting.ts` — تنسيق العناوين العراقية (مع اختبارات)
- `riderBooking.ts` — تحقق الحجز: حدود العراق + مسافة + timeout + retry (مع اختبارات)
- `logger.ts` — logger مركزي (debug مخفي في production)

---

## الخدمات (Services)

| الخدمة | الملف | الوظيفة |
|--------|-------|---------| 
| backgroundLocationService | `src/services/backgroundLocationService.ts` | GPS في الخلفية |
| driverNotificationService | `src/services/driverNotificationService.ts` | إشعارات السائق |
| nativeLocationService | `src/services/nativeLocationService.ts` | GPS الأصلي |
| lastKnownLocationService | `src/services/lastKnownLocationService.ts` | آخر موقع معروف |
| locationDB | `src/services/locationDB.ts` | IndexedDB للمواقع |
| rememberMeService | `src/services/rememberMeService.ts` | تذكر المستخدم |

---

## جداول قاعدة البيانات الأساسية

- `profiles` — ملفات المستخدمين
- `drivers` — بيانات السائقين
- `rides` — الرحلات (+ Realtime enabled)
- `driver_live_locations` — مواقع السائقين الحية
- `vehicle_types` — أنواع المركبات
- `regions` — مناطق الخدمة
- `fares` — أسعار التعرفة
- `driver_wallet_transactions` — معاملات المحفظة
- `push_subscriptions` — اشتراكات الإشعارات
- `bot_customers` — عملاء البوت
- `visual_workflows` — سير عمل مرئي
- `messenger_accounts` — حسابات المراسلة
- `fraud_alerts` — تنبيهات الاحتيال
- `ride_complaints` — الشكاوى
- `emergency_events` — أحداث الطوارئ
- `driver_matching_stats` — إحصائيات المطابقة (Dispatch v2)
- `directions_cache` — كاش المسارات
- `rate_limits` — حدود المعدل
- `analytics_events` — أحداث التحليلات
- `audit_logs` — سجلات المراجعة

---

## Edge Functions (54 وظيفة)

| الفئة | الوظائف |
|-------|---------| 
| **المصادقة** | `admin-login`, `rider-signup`, `driver-signup`, `reset-password` |
| **الرحلات** | `match-ride`, `complete-ride`, `detect-dual-stop`, `cleanup-stale-rides` |
| **الإشعارات** | `send-push-notification`, `notification-analytics`, `notify-admin-critical` |
| **الدفع** | `zaincash-init`, `zaincash-callback`, `nass-init-payment`, `nass-check-status`, `process-wallet-topup` |
| **البوت** | `telegram-ai-booking`, `sms-booking`, `whatsapp-webhook`, `messenger-webhook` |
| **الخرائط** | `google-maps-proxy`, `mapbox-proxy`, `search-places` |
| **الذكاء الاصطناعي** | `ai-assistant`, `voice-booking-ai`, `captain-support-bot` |
| **الصيانة** | `session-cleanup`, `cleanup-old-otps`, `cleanup-draft-rides`, `cron-cancel-stale-rides` |

---

## نقاط القوة (مؤكدة من فحص الكود — مايو 2026)

1. **TypeScript صارم** — types.d.ts شامل لـ Google Maps + Supabase types مُولَّدة
2. **Error Boundaries** — في كل route و component
3. **Lazy Loading** — كل الصفحات محمّلة عند الطلب
4. **Prefetch ذكي** — يحمّل الصفحات الأكثر زيارة بعد 3 ثوانٍ
5. **Rate Limiting** — من طرف السيرفر + الـ frontend
6. **Sentry** — مراقبة الأخطاء في الإنتاج
7. **62 Unit Test** ناجح (adapters + booking + formatting)
8. **Logger مركزي** — debug مخفي تلقائياً في production
9. **Request Cancellation** — GPS race conditions مُعالجة
10. **Geofence chokepoint** — policy واحد لكل مسارات اختيار الموقع
11. **Instant Auth Role Load** — cache ثم background verification
12. **Supabase Client محسّن** — heartbeat 15s + exponential backoff reconnect
