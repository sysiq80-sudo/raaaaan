/**
 * محمّل Google Maps المركزي — يضمن تحميل السكربت مرة واحدة فقط
 * مع loading=async لأفضل أداء (خاصة على Safari/iPhone)
 *
 * الاستخدام:
 *   const google = await loadGoogleMaps(apiKey);
 *   // أو
 *   await loadGoogleMaps(apiKey);
 *   if (window.google?.maps) { ... }
 */

// كل المكتبات المطلوبة في التطبيق — نحملها مرة واحدة
const ALL_LIBRARIES = "places,geometry,geocoding,visualization";

let loadPromise: Promise<typeof google> | null = null;
let loadedApiKey: string | null = null;

/**
 * تحميل Google Maps JS API مرة واحدة فقط عبر التطبيق بالكامل
 * - إذا كان محمّل مسبقاً يرجع فوراً
 * - إذا جاري التحميل ينتظر نفس الـ Promise
 * - loading=async يمنع التحذير في Console
 */
export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  // إذا محمّل مسبقاً بنفس المفتاح — نرجع فوراً
  if (window.google?.maps?.Map && loadedApiKey === apiKey) {
    return Promise.resolve(window.google);
  }

  // إذا يوجد سكربت محمّل (من جلسة سابقة مثلاً) — ننتظره
  if (window.google?.maps?.Map) {
    loadedApiKey = apiKey;
    return Promise.resolve(window.google);
  }

  // إذا جاري التحميل — نرجع نفس Promise
  if (loadPromise && loadedApiKey === apiKey) {
    return loadPromise;
  }

  // تحقق إذا يوجد سكربت في DOM من تحميل سابق
  const existingScript = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]',
  ) as HTMLScriptElement | null;

  if (existingScript) {
    loadedApiKey = apiKey;
    loadPromise = new Promise<typeof google>((resolve, reject) => {
      // إذا محمّل لكن لم يجهز بعد
      const check = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve(window.google);
        }
      }, 50);
      const timeout = setTimeout(() => {
        clearInterval(check);
        if (window.google?.maps?.Map) {
          resolve(window.google);
        } else {
          reject(new Error("Google Maps load timeout"));
        }
      }, 15000);
    });
    return loadPromise;
  }

  // تحميل جديد
  loadedApiKey = apiKey;
  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${ALL_LIBRARIES}&language=ar&region=IQ&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // انتظار جهوزية google.maps.Map (قد يتأخر مع loading=async)
      const check = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve(window.google);
        }
      }, 50);
      const timeout = setTimeout(() => {
        clearInterval(check);
        if (window.google?.maps?.Map) {
          resolve(window.google);
        } else {
          reject(
            new Error("Google Maps API loaded but maps.Map not available"),
          );
        }
      }, 15000);
    };

    script.onerror = () => {
      loadPromise = null;
      loadedApiKey = null;
      reject(new Error("Failed to load Google Maps script"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * تحقق سريع: هل Google Maps جاهز للاستخدام؟
 */
export function isGoogleMapsReady(): boolean {
  return !!window.google?.maps?.Map;
}

/**
 * إعادة تعيين (للاختبارات فقط)
 */
export function resetGoogleMapsLoader(): void {
  loadPromise = null;
  loadedApiKey = null;
}
