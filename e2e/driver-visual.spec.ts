import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env file manually to keep it dependency-free
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://wgolkcztdrwdphwjvqxt.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY is not defined in .env file!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe('ران — اختبار المسار البصري الكامل للسائق', () => {
  test('تسجيل الدخول، الذهاب متصل، استلام الرحلة وتجاوز المراحل بنجاح', async ({ page, context }) => {
    // زيادة المهلة الإجمالية للاختبار لتجنب انتهاء مهلة 30 ثانية الافتراضية
    test.setTimeout(60000);

    // طباعة رسائل كونسول المتصفح والأخطاء لتسهيل استكشاف الأخطاء وإصلاحها
    page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.message}\n${err.stack}`));

    // تهيئة حالة السائق في قاعدة البيانات ليكون "غير متصل" وتصفية الرحلات السابقة لضمان بيئة نظيفة ومستقرة
    console.log('🔄 جاري تهيئة قاعدة البيانات...');
    const { error: resetDriverError } = await supabase
      .from('drivers')
      .update({
        is_online: false,
        is_available: false,
        status: 'approved',
      })
      .eq('id', '6e25a8a9-2ca8-4ae8-bc27-c6aa8e15a578');

    if (resetDriverError) {
      console.error(`⚠️ فشل إعادة تهيئة حالة السائق: ${resetDriverError.message}`);
    } else {
      console.log('✅ تم إعادة تهيئة حالة السائق إلى غير متصل');
    }

    const { error: resetRidesError } = await supabase
      .from('rides')
      .delete()
      .or('rider_id.eq.88a5da11-f728-47f3-9bbe-bf31e736df35,driver_id.eq.6e25a8a9-2ca8-4ae8-bc27-c6aa8e15a578');

    if (resetRidesError) {
      console.error(`⚠️ فشل تصفية الرحلات السابقة: ${resetRidesError.message}`);
    } else {
      console.log('✅ تم تنظيف الرحلات القديمة للسائق والركب');
    }

    // 1. تفعيل صلاحيات تحديد الموقع وإعطاء إحداثيات بغداد (موقع الاختبار)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 33.3152, longitude: 44.3661 });

    // تهيئة localStorage لتجاوز شاشة الترحيب/التهيئة قبل تحميل التطبيق
    await context.addInitScript(() => {
      window.localStorage.setItem('raan_onboarding_completed', 'true');
    });

    // 2. الانتقال إلى صفحة تسجيل دخول السائق
    await page.goto('/driver/auth');
    await page.locator('input[type="tel"]').waitFor({ state: 'visible', timeout: 15000 });

    // 3. تعبئة بيانات الدخول والضغط على زر الدخول
    await page.locator('input[type="tel"]').fill('07800000000');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("تسجيل الدخول")').click();

    // 4. التحقق من الدخول والانتقال إلى لوحة السائق
    await expect(page).toHaveURL(/\/driver/);
    
    // الانتظار حتى تحميل الخريطة (Google Maps tiles loaded)
    const mapContainer = page.locator('.gm-style').first();
    await mapContainer.waitFor({ state: 'visible', timeout: 25000 });
    
    // لقطة شاشة 1: حالة غير متصل
    await page.screenshot({ path: 'e2e/screenshots/1-driver-offline.png' });
    console.log('📸 لقطة شاشة 1: السائق غير متصل');

    // 5. تفعيل حالة الاتصال (Go Online)
    const onlineBtn = page.locator('button[aria-label="الاتصال واستقبال الطلبات"]');
    await onlineBtn.click();
    
    // التحقق من الانتقال إلى حالة "متصل" (قطع الاتصال يظهر)
    const offlineBtn = page.locator('button[aria-label="قطع الاتصال"]');
    await expect(offlineBtn).toBeVisible({ timeout: 15000 });

    // لقطة شاشة 2: حالة متصل وموقع السيارة
    await page.screenshot({ path: 'e2e/screenshots/2-driver-online.png' });
    console.log('📸 لقطة شاشة 2: السائق متصل (تأكيد عدم وجود دوائر متموجة للسيارة)');

    // 6. إنشاء رحلة اختبار معلقة وإسنادها جغرافياً لنطاق السائق
    let ride: any = null;
    try {
      const { data, error } = await supabase.from('rides').insert({
        rider_id: '88a5da11-f728-47f3-9bbe-bf31e736df35', // المعرّف الفعلي للراكب
        pickup_location: { lat: 33.3152, lng: 44.3661 }, // نفس موقع السائق
        pickup_address: "Baghdad Airport Road — شارع مطار بغداد الدولي",
        dropoff_location: { lat: 33.3444, lng: 44.4000 },
        dropoff_address: "Baghdad Bab Al-Sharqi — ساحة التحرير الباب الشرقي",
        status: "pending",
        estimated_fare: 5000,
        payment_method: "cash",
        vehicle_type: "economy",
        trip_type: "app",
      }).select().single();

      if (error) {
        throw new Error(`فشل إنشاء رحلة اختبار: ${error.message}`);
      }
      ride = data;
      console.log(`✅ تم إنشاء رحلة معلقة بالمعرف: ${ride.id}`);

      // 7. انتظار ظهور بطاقة عرض الرحلة على شاشة السائق
      const acceptBtn = page.locator('button:has-text("قبول الرحلة")');
      await acceptBtn.waitFor({ state: 'visible', timeout: 20000 });

      // لقطة شاشة 3: بطاقة الطلب الجديد
      await page.screenshot({ path: 'e2e/screenshots/3-ride-offer.png' });
      console.log('📸 لقطة شاشة 3: ظهور بطاقة طلب الرحلة');

      // 8. قبول الرحلة
      await acceptBtn.click();

      // 9. انتظار الانتقال لصفحة الرحلة النشطة (ظهور زر "وصلت لموقع العميل")
      const arrivedBtn = page.locator('button:has-text("وصلت لموقع العميل")');
      await arrivedBtn.waitFor({ state: 'visible', timeout: 15000 });

      // لقطة شاشة 4: السائق متجه لموقع الاستلام
      await page.screenshot({ path: 'e2e/screenshots/4-ride-accepted.png' });
      console.log('📸 لقطة شاشة 4: الرحلة مقبولة ومتجه للعميل (تأكيد عدم وجود دوائر متموجة لعلامة موقع العميل)');

      // 10. الضغط على "وصلت لموقع العميل"
      await arrivedBtn.click();

      // 11. انتظار الانتقال لحالة "في انتظار العميل" (ظهور زر "بدء الرحلة")
      const startBtn = page.locator('button:has-text("ركب العميل — بدء الرحلة")');
      await startBtn.waitFor({ state: 'visible', timeout: 15000 });

      // لقطة شاشة 5: السائق وصل للعميل
      await page.screenshot({ path: 'e2e/screenshots/5-driver-arrived.png' });
      console.log('📸 لقطة شاشة 5: تأكيد وصول السائق للعميل');

      // 12. الضغط على "ركب العميل — بدء الرحلة"
      await startBtn.click();

      // 13. انتظار الانتقال لحالة "الرحلة جارية" (ظهور زر "إنهاء الرحلة وتحصيل الأجرة")
      const completeBtn = page.locator('button:has-text("إنهاء الرحلة وتحصيل الأجرة")');
      await completeBtn.waitFor({ state: 'visible', timeout: 15000 });

      // لقطة شاشة 6: الرحلة جارية نحو الوجهة
      await page.screenshot({ path: 'e2e/screenshots/6-ride-in-progress.png' });
      console.log('📸 لقطة شاشة 6: الرحلة جارية (تأكيد عدم وجود دوائر متموجة لعلامة الوجهة)');

      // 14. الضغط على "إنهاء الرحلة وتحصيل الأجرة"
      await completeBtn.click();

      // 15. الانتظار حتى تلغى بطاقة الرحلة النشطة وتختفي
      await completeBtn.waitFor({ state: 'hidden', timeout: 15000 });
      console.log('✅ تم إكمال الرحلة وإخفاء بطاقة الرحلة النشطة');

      // لقطة شاشة 7: شاشة النجاح وتقييم العميل أو العودة للرئيسية
      await page.screenshot({ path: 'e2e/screenshots/7-ride-completed.png' });
      console.log('📸 لقطة شاشة 7: اكتمال الرحلة والعودة للحالة الطبيعية');

      // 16. الانتظار للتأكد من العودة للواجهة الرئيسية وأن السائق ما زال متصلاً
      await expect(offlineBtn).toBeVisible({ timeout: 15000 });

      // لقطة شاشة 8: العودة للواجهة الرئيسية جاهز لرحلة أخرى
      await page.screenshot({ path: 'e2e/screenshots/8-workflow-done.png' });
      console.log('📸 لقطة شاشة 8: العودة للرئيسية بنجاح واكتمال الاختبار');

    } finally {
      // تنظيف قاعدة البيانات بحذف رحلة الاختبار المعلقة أو المكتملة
      if (ride?.id) {
        const { error: delError } = await supabase.from('rides').delete().eq('id', ride.id);
        if (delError) {
          console.error(`⚠️ فشل تنظيف رحلة الاختبار: ${delError.message}`);
        } else {
          console.log(`🗑️ تم تنظيف رحلة الاختبار ${ride.id} بنجاح من قاعدة البيانات`);
        }
      }
    }
  });
});
