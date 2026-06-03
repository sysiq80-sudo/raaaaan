# 📐 مواصفات الأزرار السفلية — RAAN
> **هذا الملف مرجع ثابت. لا تعدّل مواضع الأزرار السفلية دون الرجوع إليه.**
> آخر تحديث: 2026-06-03

---

## 🧠 القاعدة الأساسية

### لماذا لا يكفي `env(safe-area-inset-bottom)` وحده؟

Android WebView في وضع edge-to-edge يُرجع `env(safe-area-inset-bottom) = 0` دائماً.
لذلك يُحسب قيمة `--safe-area-bottom` عبر JavaScript في:
**[`src/lib/capacitorBridge.ts`](../src/lib/capacitorBridge.ts)** — دالة `applySafeAreaCSSVariables()`.

```
HTML root → --safe-area-bottom: Xpx   (تُحسب مرة عند البدء + عند تغيير حجم النافذة)
```

دالة `getAndroidBottomInset()` تقارن:
- `env(safe-area-inset-bottom)` (قد يكون 0)
- `window.innerHeight - visualViewport.height` (فجوة شريط Android الحقيقي)

وتأخذ الأكبر منهما، مع حد أقصى **72px** لتجنب رفع الأزرار عند فتح لوحة المفاتيح.

---

## ✅ القاعدة الذهبية للزر السفلي

```tsx
// ✅ صحيح — استخدم دائماً:
style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}

// ✅ صحيح عندما تحتاج حداً أدنى مرئياً:
style={{ paddingBottom: 'max(var(--safe-area-bottom, 0px), 24px)' }}

// ✅ صحيح عند الحاجة لهامش إضافي:
style={{ paddingBottom: 'max(var(--safe-area-bottom, 0px), 32px)' }}

// ❌ خاطئ — لا تضع safe-area على body
// ❌ خاطئ — لا تعتمد على env() وحدها في Android WebView
// ❌ خاطئ — لا تستخدم padding-bottom ثابت (pb-8, pb-10, ...) بدون safe-area
// ❌ خاطئ — لا تضع الزر كـ position:fixed بدون safe-area في الأسفل
```

---

## 🏗️ البنية النموذجية للزر السفلي

كل زر سفلي في كلا التطبيقين يتبع هذا الهيكل:

```tsx
{/* ═══ الزر السفلي الملاصق للشاشة ═══ */}
<div
  className="shrink-0 w-full pointer-events-auto bg-[COLOR] border-t border-[COLOR]/10 relative z-[10]"
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
>
  <div className="flex items-stretch h-[58px]">  {/* أو h-[72px] */}
    <button
      className="flex-1 h-full rounded-none flex items-center justify-center ..."
      style={{ fontFamily: "Cairo, sans-serif" }}
    >
      نص الزر
    </button>
  </div>
</div>
```

**النقاط المهمة في البنية:**
- `shrink-0` — يمنع انضغاط الزر عند امتلاء الشاشة
- `paddingBottom: 'var(--safe-area-bottom, 0px)'` — على الحاوية الخارجية، ليس الزر نفسه
- `rounded-none` — الزر ممتد للحواف بدون زوايا منحنية
- `h-[58px]` أو `h-[72px]` — ارتفاع الزر الداخلي ثابت بدون padding

---

## 📱 تطبيق الراكب (Rider)

### 1. الشاشة الرئيسية / اختيار الموقع — GoPage
**الملف:** [`src/pages/rider/GoPage.tsx`](../src/pages/rider/GoPage.tsx) — السطر ~2571

```tsx
<div
  className="shrink-0 w-full pointer-events-auto bg-card border-t border-white/[0.06] relative z-[10]"
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
>
  <div className="flex items-stretch h-[58px]">
    <motion.button ...>
      {/* زر تأكيد الموقع / الانتقال للوجهة */}
    </motion.button>
  </div>
</div>
```
- **يظهر:** فقط عندما `!isLocationFocused`
- **الارتفاع الداخلي:** `h-[58px]`
- **اللون:** `bg-card` (#0a111c تقريباً)
- **حالة فعّالة:** أخضر `#5bdda6` | معطّل: `#1e293b`

---

### 2. شاشة تأكيد الحجز — BookingConfirmationView
**الملف:** [`src/components/rider/BookingConfirmationView.tsx`](../src/components/rider/BookingConfirmationView.tsx) — السطر ~319

```tsx
<div
  className="shrink-0 w-full pointer-events-auto bg-card border-t border-white/[0.06] relative z-[10]"
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
>
  <div className="flex items-stretch">
    <motion.button className="flex-1 h-[72px] rounded-none ...">
      {/* زر تأكيد الحجز */}
    </motion.button>
  </div>
</div>
```
- **الارتفاع الداخلي:** `h-[72px]` (أكبر لأهمية الإجراء)
- **اللون الفعّال:** أخضر `#5bdda6` مع نص `#070b13`

---

### 3. شاشة اختيار الموقع على الخريطة — LocationSelectionActionBar
**الملف:** [`src/components/rider/LocationSelectionActionBar.tsx`](../src/components/rider/LocationSelectionActionBar.tsx) — السطر ~30

```tsx
<div
  className="absolute bottom-0 left-0 right-0 flex z-[100] gap-2 p-3 bg-[linear-gradient(180deg,...)]"
  style={{ paddingBottom: "max(var(--safe-area-bottom, 0px), 24px)" }}
>
  <motion.button className="flex-auto h-[72px] rounded-[18px] ...">
    {/* زر تأكيد الموقع */}
  </motion.button>
</div>
```
- **وضع:** `absolute bottom-0` (فوق الخريطة مباشرة)
- **الحد الأدنى للـ padding:** `max(..., 24px)` — لضمان مسافة مرئية حتى بدون شريط Android
- **الارتفاع:** `h-[72px]` بزوايا منحنية `rounded-[18px]`
- **لون الانتقال للموقع:** أخضر `#5bdda6` | لون الوجهة: أزرق `#38bdf8`

---

### 4. شاشة انتظار السائق — RideWaitingScreen
**الملف:** [`src/components/rider/RideWaitingScreen.tsx`](../src/components/rider/RideWaitingScreen.tsx) — السطر ~1147

```tsx
<div
  className="shrink-0 bg-[#0b1326]"
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)', zIndex: 10 }}
>
  <button className="w-full h-[72px] rounded-none ... bg-[#F04438]">
    إلغاء الطلب
  </button>
</div>
```
- **الارتفاع:** `h-[72px]`
- **اللون:** أحمر `#F04438` (إلغاء)
- **ملاحظة:** `zIndex: 10` بدلاً من className لتجنب تعارض Tailwind

---

### 5. لوحة الحجز المبسطة — SimplifiedBookingPanel
**الملف:** [`src/components/rider/SimplifiedBookingPanel.tsx`](../src/components/rider/SimplifiedBookingPanel.tsx) — السطر ~259

```tsx
<div
  className="flex w-[calc(100%+2.5rem)] -mx-5 shrink-0 bg-[#131b2e]"
  style={{ paddingBottom: 'max(var(--safe-area-bottom, 0px), 32px)', zIndex: 10 }}
>
  <button className="flex-auto h-[72px] rounded-none ...">
    تأكيد رحلة
  </button>
</div>
```
- **عرض ممتد:** `-mx-5` مع `w-[calc(100%+2.5rem)]` للامتداد خارج padding الحاوية
- **الحد الأدنى:** `max(..., 32px)` — أكبر هامش لأن الشاشة قد تكون Bottom Sheet

---

### 6. شاشة اكتمال الرحلة — RideCompletedScreen
**الملف:** [`src/components/rider/RideCompletedScreen.tsx`](../src/components/rider/RideCompletedScreen.tsx) — السطر ~639

```tsx
<div style={{ paddingBottom: "var(--safe-area-bottom, 0px)" }}>
  {/* أزرار التقييم والمتابعة */}
</div>
```

---

### 7. تدفق التقييم الذكي — SmartRatingFlow
**الملف:** [`src/components/rider/SmartRatingFlow.tsx`](../src/components/rider/SmartRatingFlow.tsx) — السطر ~384

```tsx
<div className="shrink-0 flex border-t-2 border-emerald-500/20 ..."
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
```

---

### 8. شاشة الترحيب / اختيار الموقع الأول — WelcomeLocationScreen
**الملف:** [`src/components/rider/WelcomeLocationScreen.tsx`](../src/components/rider/WelcomeLocationScreen.tsx) — السطر ~555

```tsx
style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
```

---

## 🚗 تطبيق السائق (Driver)

### 1. شريط التنقل السفلي — DriverBottomNav
**الملف:** [`src/components/driver/DriverBottomNav.tsx`](../src/components/driver/DriverBottomNav.tsx) — السطر ~84

```tsx
<div
  dir="rtl"
  className="shrink-0 w-full border-t border-[#5bdda6]/10 bg-[#0b1326]"
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
>
  <div className="backdrop-blur-xl flex items-center h-[68px] bg-[#0b1326]">
    {/* 4 أزرار التنقل */}
  </div>
</div>
```
- **الارتفاع الداخلي:** `h-[68px]`
- **الخلفية:** `#0b1326` (داكن كحلي)
- **يظهر:** فقط عندما لا يوجد رحلة نشطة (hasActiveRide === false)

---

### 2. زر تبديل حالة الخدمة — DutyToggle
**الملف:** [`src/components/driver/DutyToggle.tsx`](../src/components/driver/DutyToggle.tsx) — السطر ~125

```tsx
{!hasActiveRide && (
  <div
    className="shrink-0 w-full pointer-events-auto bg-[#0a0f1c] border-t border-[#34d399]/10 relative z-[10] shadow-[0_-18px_34px_rgba(10,15,28,0.72)]"
    style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
  >
    <div className="flex items-stretch h-[58px]">
      <button className="flex-1 h-full min-w-0 px-4 ...">
        {/* متصل / قطع الاتصال / في استراحة */}
      </button>
    </div>
  </div>
)}
```
- **يظهر:** فقط عندما `!hasActiveRide`
- **الارتفاع:** `h-[58px]`
- **الألوان:**
  - متصل + نشط: `bg-[#34d399]` أخضر، نص `#064e3b`
  - في استراحة: `bg-amber-500` برتقالي، نص أبيض
  - غير متصل: `bg-yellow-400` أصفر، نص `#064e3b`

---

### 3. زر الإجراء الرئيسي في الرحلة النشطة — ActiveRideCard
**الملف:** [`src/components/driver/ActiveRideCard.tsx`](../src/components/driver/ActiveRideCard.tsx) — السطر ~1528

```tsx
<div
  className="shrink-0 w-full pointer-events-auto bg-[#163d30] border-t border-[#34d399]/10 relative z-[10]"
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
>
  <div className="flex items-stretch h-[58px]">
    {/* زر "وصلت" أو "بدء الرحلة" أو "إتمام الرحلة" */}
  </div>
</div>
```
- **الارتفاع:** `h-[58px]`
- **الخلفية:** `#163d30` (أخضر داكن)
- **الحالات الثلاث:**
  - `accepted`: زر "وصلت" — متدرج أخضر
  - `arrived`: زر "ابدأ الرحلة" — أخضر صلب
  - `in_progress`: زر "إتمام الرحلة" — أخضر + تأثير نبض

---

### 4. شاشة إتمام الرحلة والتقييم — DriverRideCompleted
**الملف:** [`src/components/driver/DriverRideCompleted.tsx`](../src/components/driver/DriverRideCompleted.tsx) — السطر ~405

```tsx
<div
  className="shrink-0 w-full pointer-events-auto bg-[#171f33] border-t border-white/[0.06] relative z-[10]"
  style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
>
  <div className="flex items-stretch h-[58px]">
    <button className="w-[100px] h-full ... bg-[#121929]">
      تخطي
    </button>
    <button className="flex-1 h-full ... bg-[#5bdda6]">
      تأكيد التقييم
    </button>
  </div>
</div>
```
- **زرّان جنباً إلى جنب:**
  - "تخطي": عرض ثابت `w-[100px]`، خلفية داكنة
  - "تأكيد التقييم": `flex-1`، أخضر `#5bdda6`

---

### 5. شريط التسجيل — DriverRegister
**الملف:** [`src/pages/driver/DriverRegister.tsx`](../src/pages/driver/DriverRegister.tsx) — السطران ~549، ~641

```tsx
<div className="fixed bottom-0 right-0 left-0 max-w-md mx-auto px-5 pb-safe ...">
  <div style={{ height: 'var(--safe-area-bottom, 4px)' }} />
</div>
```
- يستخدم `fixed bottom-0` مع `pb-safe` من CSS helper

---

### 6. وضع السيارة المدمجة — CarModeQuickDock
**الملف:** [`src/components/driver/CarModeQuickDock.tsx`](../src/components/driver/CarModeQuickDock.tsx) — السطر ~29

```tsx
<div
  className="car-quick-dock shrink-0 z-50 w-full px-2"
  style={{ paddingBottom: `calc(var(--safe-area-bottom, 0px) + 4px)` }}
>
```

---

## 🎨 CSS Helpers المتاحة

تعريفها في [`src/index.css`](../src/index.css):

```css
/* حد أدنى 1rem + safe area */
.safe-area-bottom {
  padding-bottom: max(1rem, var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
}

/* safe area + 1rem ثابت */
.safe-area-pb {
  padding-bottom: calc(1rem + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
}

/* safe area فقط بدون إضافة */
.safe-area-inset {
  padding-bottom: var(--safe-area-bottom, env(safe-area-inset-bottom, 0px));
}
```

---

## 📏 جدول الارتفاعات المعيارية

| الحجم | متى تستخدمه |
|-------|-------------|
| `h-[58px]` | الأزرار الثانوية، CTA بسيط (السائق عموماً) |
| `h-[68px]` | شريط التنقل السفلي (DriverBottomNav) |
| `h-[72px]` | CTA رئيسي، تأكيد حجز، اختيار موقع (الراكب عموماً) |

---

## ⚠️ حالات خاصة يجب مراعاتها

### 1. Bottom Sheet فوق القائمة السفلية
إذا كان الزر داخل Bottom Sheet يجلس فوق `DriverBottomNav` أو `RiderBottomNav`، **لا تضف safe-area** لأن الـ Nav يتكفل بها. استخدم `pb-0`.

### 2. الزر أعلى لوحة المفاتيح
`getAndroidBottomInset()` محدودة بـ **72px** تحديداً لمنع رفع الأزرار عند فتح لوحة المفاتيح. لا تحتاج منطقاً إضافياً.

### 3. شاشة الخريطة الكاملة
الأزرار فوق الخريطة تستخدم `position: absolute bottom-0` مع `max(var(--safe-area-bottom, 0px), 24px)` لضمان رؤيتها حتى بدون شريط Android.

### 4. وضع المتصفح (Web)
`--safe-area-bottom` يُضبط من `env()` في الـ CSS الافتراضي. في المتصفح يساوي 0 غالباً. استخدم `max(..., NNpx)` إذا أردت حداً أدنى مرئياً في الويب.

---

## 🚫 الأخطاء الشائعة التي أدت لإعادة التعديلات

| الخطأ | الأثر | الحل |
|-------|-------|------|
| `paddingBottom` على `<body>` | يرفع المحتوى بالكامل | ضعه على الحاوية المباشرة للزر |
| `env(safe-area-inset-bottom)` مباشرة | يعود 0 على Android WebView | استخدم `var(--safe-area-bottom)` |
| `pb-8` أو `pb-safe` دون JS bridge | لا يعمل على Android بشكل صحيح | استخدم `var(--safe-area-bottom)` inline |
| زر بـ `position:fixed` بدون safe-area | يتراكب مع أزرار Android | أضف `paddingBottom: var(--safe-area-bottom)` |
| إضافة safe-area للـ Nav **و** الزر داخله | padding مضاعف | الـ padding على الحاوية الخارجية فقط |

---

## 🔗 الملفات المرتبطة

| الملف | الدور |
|-------|-------|
| [`src/lib/capacitorBridge.ts`](../src/lib/capacitorBridge.ts) | حساب `--safe-area-bottom` عبر JS |
| [`src/index.css`](../src/index.css) | تعريف CSS helpers و variables |
| [`src/apps/driver/main.tsx`](../src/apps/driver/main.tsx) | تفعيل `app-shell` class للسائق |
| [`src/apps/rider/main.tsx`](../src/apps/rider/main.tsx) | تفعيل `app-shell` class للراكب |
