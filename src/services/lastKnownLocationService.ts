/**
 * خدمة حفظ واسترجاع آخر موقع معروف
 * تُستخدم لعرض الخريطة فوراً عند فتح التطبيق بدون إنترنت
 * أو عند ضعف الاتصال
 */

const STORAGE_KEY = 'raan_last_known_location';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 ساعة — أقدم موقع مقبول

interface CachedLocation {
  lat: number;
  lng: number;
  timestamp: number;
  address?: string;
}

/**
 * حفظ آخر موقع معروف (يُستدعى عند كل تحديث GPS ناجح)
 */
export const saveLastKnownLocation = (
  lat: number,
  lng: number,
  address?: string
): void => {
  try {
    const data: CachedLocation = {
      lat,
      lng,
      timestamp: Date.now(),
      address,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage ممتلئ أو غير متاح — تجاهل بصمت
  }
};

/**
 * استرجاع آخر موقع معروف
 * يُرجع null إذا لم يوجد موقع محفوظ أو انتهت صلاحيته (> 24 ساعة)
 */
export const getLastKnownLocation = (): CachedLocation | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data: CachedLocation = JSON.parse(raw);
    
    // تحقق من الصلاحية
    if (Date.now() - data.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // تحقق أساسي من صحة الإحداثيات
    if (!data.lat || !data.lng || isNaN(data.lat) || isNaN(data.lng)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
};

/**
 * حذف الموقع المخزن
 */
export const clearLastKnownLocation = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
