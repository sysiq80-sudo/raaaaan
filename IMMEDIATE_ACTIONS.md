# 📋 ملف الإجراءات الموصى بها الفورية

**تاريخ الإنشاء:** 1 يناير 2026  
**الأولوية:** 🔴 حرجة جداً

---

## 1️⃣ الأمان (قبل الإنتاج مباشرة) 🔒

### أ) تفعيل حماية الكلمات السرية المسربة
```
⏱️ الوقت المتوقع: 5 دقائق
📍 المكان: https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt/auth/providers
```

**الخطوات:**
1. اذهب إلى Auth → Providers → Password
2. فعّل "Block repeated failed login"
3. فعّل "Leaked password protection"
4. اضبط "Auto-confirm users" على OFF

**التأثير:** منع هجمات brute force واكتشاف حسابات مخترقة

---

### ب) تحديد نطاق Mapbox Token
```
⏱️ الوقت المتوقع: 5 دقائق
📍 المكان: https://account.mapbox.com/tokens/
```

**الخطوات:**
1. افتح Access Tokens → tokens name
2. اضبط على "Restricted to a URL"
3. أضف نطاقك فقط: `https://yourdomain.com/*`
4. احذف أي Scopes غير ضرورية

**التأثير:** منع استخدام توكنك من مواقع أخرى

---

### ج) إنشاء `.env` محلي آمن
```bash
# أنشئ ملف .env محلي (لا تسجله في Git)
cp .env.example .env

# امإلأ القيم الصحيحة:
VITE_SUPABASE_URL=https://wgolkcztdrwdphwjvqxt.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key
VITE_MAPBOX_TOKEN=your-actual-mapbox-token
```

**تحقق من `.gitignore`:**
```
.env
.env.local
.env.*.local
```

---

## 2️⃣ الأداء (هذا الأسبوع) ⚡

### أ) تحسين تحميل الخريطة
```typescript
// FILE: src/components/LazyMap.tsx
// أضف مؤشر تحميل:

const [isLoading, setIsLoading] = useState(true);

return (
  <>
    {isLoading && <MapSkeleton />}
    <Map onLoad={() => setIsLoading(false)} />
  </>
);
```

**الأثر المتوقع:** تجربة مستخدم أفضل بـ 2 ثانية أقل

---

### ب) تفعيل Skeleton Loading على كل الصفحات الثقيلة
```typescript
// استخدم هذا النمط:
import { Skeleton } from "@/components/ui/skeleton";

<Skeleton className="h-12 w-full" /> // row
<Skeleton className="h-96 w-full" /> // map
```

**الصفحات المطلوبة:**
- [ ] RiderHomeCustom (الخريطة)
- [ ] AdminDashboard (الجداول الكبيرة)
- [ ] DriverStatistics (الرسوم البيانية)

---

### ج) تقليل تحديثات Geolocation
```typescript
// FILE: src/hooks/useRiderLocation.ts
// غيّر من "مستمر" إلى "كل 5 ثواني"

const updateLocationInterval = 5000; // 5 ثواني
setInterval(() => updateDriverLocation(), updateLocationInterval);
```

**الأثر المتوقع:** توفير 30% من استهلاك البطارية

---

## 3️⃣ جودة الكود (هذا الشهر) 🧹

### أولوية 1: إصلاح أخطاء `any` في الـ Hooks الحرجة

#### الملفات المطلوبة:
```
src/hooks/useActiveRide.ts ❌ 5 أخطاء
src/hooks/useBroadcastChannel.ts ❌ 8 أخطاء
src/hooks/useRiderInitialization.ts ❌ 3 أخطاء
src/hooks/useServiceAreas.ts ❌ 1 خطأ
```

**مثال الإصلاح:**
```typescript
// ❌ قبل:
const handleMessage = (data: any) => { ... }

// ✅ بعد:
interface RideMessage {
  type: 'accepted' | 'arrived' | 'completed';
  driverId: string;
  rideId: string;
  timestamp: number;
}

const handleMessage = (data: RideMessage) => { ... }
```

---

### أولوية 2: إصلاح `useEffect` Dependencies

**الملفات الحرجة:**
- src/pages/admin/AdminDrivers.tsx (2 أخطاء)
- src/pages/rider/RiderHomeCustom.tsx (1 خطأ)
- src/hooks/useBroadcastChannel.ts (2 أخطاء)

**النمط:**
```typescript
// ❌ خطير:
useEffect(() => {
  fetchData();
}, []); // fetchData قد تتغير!

// ✅ صحيح:
useEffect(() => {
  fetchData();
}, [fetchData]); // أو استخدم useCallback
```

---

## 4️⃣ الاختبارات (الأسبوع المقبل) 🧪

### أ) اختبار E2E الأساسي (Playwright)

```bash
npm install -D @playwright/test
npx playwright install
```

**اختبر السيناريو الأول:**
```typescript
// tests/rider-request.spec.ts
import { test, expect } from '@playwright/test';

test('Rider can request a ride', async ({ page }) => {
  await page.goto('http://localhost:8080/rider');
  
  // انتقر على pickup location
  await page.click('[data-testid="pickup-input"]');
  await page.fill('[data-testid="pickup-input"]', 'Downtown');
  
  // اختر وجهة
  await page.click('[data-testid="dropoff-input"]');
  await page.fill('[data-testid="dropoff-input"]', 'Airport');
  
  // اطلب رحلة
  await page.click('[data-testid="request-ride-btn"]');
  
  // تحقق من ظهور شاشة الانتظار
  await expect(page.locator('[data-testid="waiting-screen"]')).toBeVisible();
});
```

---

## 5️⃣ البنية (الشهر المقبل) 🏗️

### توحيد مسارات الراكب

```typescript
// ❌ تجنب المسارات المتعددة:
// /rider, /rider2, /rider-1custom, /rider11

// ✅ استخدم مسار واحد مع خيارات:
<Route path="/rider" element={<RiderHome layoutType={Layout.CUSTOM} />} />
<Route path="/rider/map" element={<RiderHome layoutType={Layout.MAP} />} />
<Route path="/rider/classic" element={<RiderHome layoutType={Layout.CLASSIC} />} />
```

---

## 📊 قائمة الفحص النهائية قبل الإنتاج

### الأمان:
- [ ] تفعيل Leaked Password Protection
- [ ] تحديد نطاق Mapbox Token
- [ ] فحص CSP headers على الخادم
- [ ] مراجعة سياسات RLS

### الأداء:
- [ ] قياس Lighthouse Performance > 90
- [ ] تحميل الخريطة < 2 ثانية
- [ ] حجم Bundle < 1.5 MB gzip

### جودة الكود:
- [ ] أقل من 50 خطأ linting
- [ ] اختبارات E2E تغطي السيناريوهات الرئيسية
- [ ] لا توجد أخطاء TypeScript

### الميزات:
- [ ] جميع الصفحات 47 تعمل بدون أخطاء
- [ ] الدردشة بين الراكب والسائق تعمل
- [ ] الإشعارات Push تعمل

---

## 🎯 الأهداف القصيرة الأجل

| المهمة | الأولوية | الجهد | الموعد |
|--------|---------|-------|---------|
| تفعيل Leaked Password | 🔴 | 5 دقائق | اليوم |
| تحديد Mapbox Token | 🔴 | 5 دقائق | اليوم |
| إصلاح أخطاء `any` | 🟠 | 8 ساعات | هذا الأسبوع |
| Skeleton Loading | 🟠 | 4 ساعات | هذا الأسبوع |
| اختبارات E2E | 🟠 | 12 ساعة | الأسبوع القادم |
| محفظة إلكترونية | 🟡 | 40 ساعة | الشهر القادم |

---

**انتهى**  
*للمزيد، اطلع على DEEP_AUDIT_REPORT.md*
