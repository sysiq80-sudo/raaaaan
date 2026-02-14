# 📨 API الرسائل والإشعارات - ران RAAN

## 📌 نظرة عامة
النظام يشمل 3 أنواع رئيسية من الاتصالات:
1. **Push Notifications** - إشعارات فورية عبر المتصفح
2. **SMS/WhatsApp Messages** - رسائل نصية وواتس
3. **In-App Messages** - رسائل داخل التطبيق (في الرحلة)

---

## 🚀 Edge Functions (الخوادم الخلفية)

### 1️⃣ **send-push-notification**
**الملف**: `supabase/functions/send-push-notification/index.ts`

#### الوظائف الرئيسية:
- إرسال إشعارات Web Push
- إدارة اشتراكات المستخدمين
- تتبع توصيل الإشعارات
- تسجيل تحليلات الإشعارات

#### الإجراءات المدعومة:
```typescript
// 1. حفظ اشتراك (Subscribe)
POST /send-push-notification
{
  "action": "subscribe",
  "subscription": {
    "driver_id": "uuid",
    "endpoint": "https://...",
    "p256dh_key": "...",
    "auth_key": "..."
  }
}

// 2. إرسال إشعار (Send Notification)
POST /send-push-notification
{
  "action": "send",
  "ride": {
    "id": "ride-123",
    "pickup_address": "...",
    "dropoff_address": "...",
    "estimated_fare": 15000,
    "vehicle_type": "economy"
  },
  "driver_ids": ["driver-1", "driver-2"],
  "max_radius_km": 15,
  "payload": {
    "title": "طلب رحلة جديد 🚗",
    "body": "راكب ينتظرك...",
    "icon": "https://...",
    "data": {...}
  }
}

// 3. تتبع فتح الإشعار (Notification Opened)
POST /send-push-notification
{
  "action": "notification_opened",
  "notification_id": "notif_...",
  "opened_at": "2026-02-02T10:30:00Z"
}
```

#### المميزات:
- ✅ إعادة محاولة تلقائية (Exponential Backoff)
- ✅ تسجيل مفصل للتسليم (Delivery Logs)
- ✅ تحليلات في الوقت الفعلي
- ✅ حساب التأخير (Delivery Delay)
- ✅ معالجة الاشتراكات المنتهية

#### جداول قاعدة البيانات:
```
- push_subscriptions: تخزين بيانات اشتراك المتصفح
- notifications_log: سجل جميع الإشعارات المرسلة
- notification_analytics: إحصائيات يومية للإشعارات
```

---

### 2️⃣ **send-sms**
**الملف**: `supabase/functions/send-sms/index.ts`

#### الوظائف:
- إرسال رسائل SMS
- إرسال رسائل WhatsApp
- توثيق الرسائل
- التتبع والتحليل

#### الطلب:
```typescript
POST /send-sms
{
  "phone": "+964791234567",
  "message": "مرحباً، رحلتك جاهزة!",
  "messageType": "notification", // promotional | notification | transactional
  "provider": "whatsapp" // whatsapp | sms
}
```

#### التحقق:
- ✅ التحقق من صلاحية المسؤول (Admin Only)
- ✅ صيغة رقم الهاتف (العراقي: 964)
- ✅ حد أقصى 500 حرف
- ✅ تتبع IP الطالب

#### أنواع الرسائل:
| النوع | الاستخدام | المثال |
|------|----------|--------|
| **transactional** | رسائل ضرورية | OTP، تأكيد الدفع |
| **notification** | تحديثات الرحلة | السائق في الطريق |
| **promotional** | عروض ومكافآت | 50% خصم على الرحلة |

#### جداول قاعدة البيانات:
```
- sms_history: سجل الرسائل النصية
- sms_analytics: إحصائيات الرسائل
```

---

### 3️⃣ **send-otp**
**الملف**: `supabase/functions/send-otp/index.ts`

#### الوظائف:
- إنشاء وإرسال رموز OTP
- التحقق من الأرقام
- إدارة انتهاء الصلاحية

---

## 💾 جداول قاعدة البيانات

### 1. **notifications** - الإشعارات العامة
```typescript
{
  id: string;
  driver_id?: string;
  rider_id?: string;
  title: string;
  message: string;
  type: string; // 'ride_request' | 'ride_started' | 'rating' | 'message'
  data?: Json;  // بيانات إضافية
  created_at: timestamp;
  read_at?: timestamp;
}
```

### 2. **driver_notifications** - إشعارات السائقين
```typescript
{
  id: string;
  driver_id: string;      // Foreign Key
  title: string;
  body: string;
  type: string;
  data?: Json;
  is_read: boolean;
  created_at: timestamp;
}
```

### 3. **rider_notifications** - إشعارات الركاب
```typescript
{
  id: string;
  rider_id: string;       // Foreign Key
  title: string;
  body: string;
  type: string;
  data?: Json;
  is_read: boolean;
  created_at: timestamp;
}
```

### 4. **push_subscriptions** - اشتراكات الويب
```typescript
{
  id: string;
  driver_id: string;          // Foreign Key
  endpoint: string;           // WebPush endpoint
  p256dh_key: string;        // Encryption key
  auth_key: string;          // Authentication key
  created_at: timestamp;
  updated_at: timestamp;
}
```

### 5. **notifications_log** - سجل الإشعارات المفصل
```typescript
{
  id: string;
  driver_id?: string;
  notification_type: string;
  title: string;
  body: string;
  data?: Json;
  status: 'sent' | 'failed' | 'delivered';
  error_message?: string;
  retry_count: number;
  notification_id: string;
  sent_at: timestamp;
  delivered_at?: timestamp;
  opened_at?: timestamp;
  delivery_delay_ms?: number;
}
```

### 6. **notification_analytics** - إحصائيات يومية
```typescript
{
  id: string;
  date: string;
  notification_type: string;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_opened: number;
  avg_delivery_delay_ms: number;
}
```

### 7. **notification_preferences** - تفضيلات المستخدم
```typescript
{
  id: string;
  user_id: string;                    // Foreign Key
  push_enabled: boolean;
  push_token?: string;
  push_platform?: string;             // 'web' | 'android' | 'ios'
  ride_updates: boolean;
  chat_messages: boolean;
  earnings: boolean;
  promotions: boolean;
  system_alerts: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;         // HH:MM
  quiet_hours_end?: string;           // HH:MM
  notification_language?: string;     // 'ar' | 'en' | 'ku'
}
```

### 8. **notification_topics** - مواضيع الاشتراك
```typescript
{
  id: string;
  driver_id?: string;
  topic: string;                      // 'ride_requests' | 'promotions' | 'earnings'
  is_active: boolean;
  created_at: timestamp;
}
```

### 9. **ride_messages** - رسائل الرحلة (In-App Chat)
```typescript
{
  id: string;
  ride_id: string;                    // Foreign Key
  sender_id: string;                  // driver_id أو rider_id
  sender_type: 'driver' | 'rider';
  message: string;
  attachment_urls?: string[];
  is_read: boolean;
  created_at: timestamp;
  updated_at: timestamp;
}
```

### 10. **admin_notifications** - إشعارات المدراء
```typescript
{
  id: string;
  admin_id: string;
  title: string;
  body: string;
  type: string; // 'system_alert' | 'new_complaint' | 'suspicious_activity'
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  created_at: timestamp;
}
```

### 11. **sms_log** - سجل الرسائل النصية
```typescript
{
  id: string;
  phone: string;
  message: string;
  message_type: 'transactional' | 'notification' | 'promotional';
  provider: 'sms' | 'whatsapp';
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  created_at: timestamp;
  sent_at?: timestamp;
}
```

---

## 📊 أنواع الإشعارات

### إشعارات الرحلة:
```typescript
{
  type: 'ride_request',
  title: '🚗 طلب رحلة جديد',
  body: 'راكب في الشارع الرئيسي ينتظرك',
  data: {
    ride_id: 'ride-123',
    pickup_lat: 33.31,
    pickup_lng: 44.36,
    distance_km: 2.5,
    estimated_fare: 15000
  }
}

{
  type: 'ride_accepted',
  title: '✅ تم قبول الرحلة',
  body: 'السائق وافق على طلبك - أحمد م.',
  data: {
    ride_id: 'ride-123',
    driver_name: 'أحمد محمد',
    driver_rating: 4.8,
    vehicle_plate: 'ب 123 ع'
  }
}

{
  type: 'driver_arrived',
  title: '🏁 السائق وصل',
  body: 'السائق على بعد 50 متر من موقعك',
  data: {
    ride_id: 'ride-123',
    driver_location: { lat: 33.312, lng: 44.362 }
  }
}

{
  type: 'ride_completed',
  title: '✅ تمت الرحلة',
  body: 'شكراً لاستخدامك ران - السعر: 15,500 د.ع',
  data: {
    ride_id: 'ride-123',
    total_fare: 15500,
    rating_prompt: true
  }
}
```

### إشعارات الدفع:
```typescript
{
  type: 'payment_successful',
  title: '💰 تم السداد بنجاح',
  body: 'تم خصم 15,500 د.ع من محفظتك',
  data: {
    ride_id: 'ride-123',
    amount: 15500,
    method: 'wallet'
  }
}

{
  type: 'payment_failed',
  title: '❌ فشل الدفع',
  body: 'لم يتمكن من خصم المبلغ - حاول مجدداً',
  data: {
    error: 'insufficient_balance'
  }
}
```

### إشعارات النظام:
```typescript
{
  type: 'system_maintenance',
  title: '🔧 صيانة النظام',
  body: 'سيكون التطبيق غير متاح من 2:00 - 3:00 صباحاً',
  data: {
    maintenance_start: '2026-02-03T02:00:00Z',
    maintenance_end: '2026-02-03T03:00:00Z'
  }
}
```

---

## 🔧 استخدام الـ API من الـ Frontend

### مثال 1: تسجيل اشتراك في الإشعارات
```typescript
// في المتصفح
const subscription = await serviceWorker.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey
});

// إرسال للسيرفر
await supabase.functions.invoke('send-push-notification', {
  body: {
    action: 'subscribe',
    subscription: {
      driver_id: userId,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.getKey('p256dh'),
      auth_key: subscription.getKey('auth')
    }
  }
});
```

### مثال 2: إرسال إشعار لسائقين
```typescript
await supabase.functions.invoke('send-push-notification', {
  body: {
    action: 'send',
    driver_ids: ['driver-1', 'driver-2'],
    ride: {
      id: rideId,
      pickup_address: 'شارع الرشيد',
      dropoff_address: 'جسر السنك',
      estimated_fare: 15000,
      vehicle_type: 'economy',
      pickup_lat: 33.31,
      pickup_lng: 44.36
    },
    max_radius_km: 10,
    payload: {
      title: '🚗 طلب رحلة جديد',
      body: 'راكب ينتظرك الآن',
      icon: '...',
      data: { ride_id: rideId }
    }
  }
});
```

### مثال 3: إرسال رسالة SMS
```typescript
await supabase.functions.invoke('send-sms', {
  body: {
    phone: '+964791234567',
    message: 'مرحباً في ران - رحلتك جاهزة الآن',
    messageType: 'notification',
    provider: 'whatsapp'
  },
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

### مثال 4: قراءة رسائل الرحلة
```typescript
const { data: messages } = await supabase
  .from('ride_messages')
  .select('*')
  .eq('ride_id', rideId)
  .order('created_at', { ascending: true });
```

### مثال 5: تحديث تفضيلات الإشعارات
```typescript
await supabase
  .from('notification_preferences')
  .upsert({
    user_id: userId,
    push_enabled: true,
    ride_updates: true,
    chat_messages: false,
    quiet_hours_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00'
  });
```

---

## 📈 إحصائيات وتحليلات

### الوصول لإحصائيات الإشعارات:
```typescript
// إحصائيات اليوم
const { data } = await supabase
  .from('notification_analytics')
  .select('*')
  .eq('notification_type', 'ride_request')
  .eq('date', today);

// النتائج تشمل:
// - total_sent: عدد المرسل
// - total_delivered: عدد المُسلّم
// - total_opened: عدد المفتوح
// - total_failed: عدد الفاشل
// - avg_delivery_delay_ms: متوسط التأخير
```

---

## 🔐 Row Level Security (RLS)

كل الجداول محمية بـ RLS:
- **المستخدم يرى إشعاراته فقط**
- **السائق لا يرى رسائل الراكب**
- **Admin يرى الكل**

---

## ⚙️ الإعدادات المهمة

### متغيرات البيئة المطلوبة:
```env
# SUPABASE
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# OTPIQ (SMS Provider)
OTPIQ_API_KEY=...

# WebPush Keys
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## 📞 الخوادم الخارجية المتصلة

### 1. OTPIQ (SMS & WhatsApp Provider)
- **الدول المدعومة**: العراق، السعودية، الإمارات
- **الخدمات**: SMS، WhatsApp، رسائل صوتية
- **معدل السرعة**: ~100 رسالة/ثانية

### 2. Web Push Protocol (W3C)
- **البروتوكول**: Web Notifications API
- **الدعم**: جميع المتصفحات الحديثة
- **الحد الأقصى**: 3-5 أيام انتظار للإرسال

---

## 🚨 الأخطاء الشائعة والحلول

| الخطأ | السبب | الحل |
|------|------|-----|
| `subscription_expired` | الاشتراك انتهى | إعادة الاشتراك في push |
| `insufficient_balance` | محفظة فارغة | إضافة رصيد |
| `invalid_phone` | رقم هاتف خاطئ | التحقق من الصيغة (964) |
| `delivery_timeout` | انقطاع الإنترنت | إعادة المحاولة تلقائياً |

---

**تم الحمد لله رب العالمين** 🤲

*آخر تحديث: 2026-02-02*
