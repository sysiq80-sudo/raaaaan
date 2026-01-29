/**
 * Geofencing System for RAAN App
 * يمنع الحجز خارج العراق مع رسائل عراقية طريفة
 */

// حدود العراق التقريبية
const IRAQ_BOUNDS = {
  minLat: 29.0, // جنوب العراق
  maxLat: 37.4, // شمال العراق (كردستان)
  minLng: 38.8, // غرب العراق
  maxLng: 48.8, // شرق العراق
};

// الدول المجاورة للعراق
const NEIGHBOR_COUNTRIES = {
  TR: "تركيا",
  SA: "السعودية",
  KW: "الكويت",
  SY: "سوريا",
  JO: "الأردن",
  IR: "إيران",
};

// جزر بعيدة
const ISLANDS = [
  "CY", // قبرص
  "BH", // البحرين
  "MV", // المالديف
  "ID", // بالي (إندونيسيا)
  "TH", // تايلاند
  "MY", // ماليزيا
  "GR", // اليونان
  "MT", // مالطا
];

export interface GeofenceResult {
  allowed: boolean;
  message: string;
  country?: string;
  countryCode?: string;
  isNeighbor?: boolean;
  isIran?: boolean;
  isFar?: boolean;
  isIsland?: boolean;
}

/**
 * فحص سريع للحدود بدون استدعاء API
 * يعود true إذا كان الموقع داخل حدود العراق التقريبية
 */
export function quickGeofenceCheck(lat: number, lng: number): boolean {
  return (
    lat >= IRAQ_BOUNDS.minLat &&
    lat <= IRAQ_BOUNDS.maxLat &&
    lng >= IRAQ_BOUNDS.minLng &&
    lng <= IRAQ_BOUNDS.maxLng
  );
}

/**
 * فحص الموقع باستخدام Mapbox Reverse Geocoding
 * يستخدم Edge Function لتجنب تسريب API Key
 */
export async function checkDestinationGeofence(
  lat: number,
  lng: number,
  mapToken?: string
): Promise<GeofenceResult> {
  try {
    // فحص سريع أولاً
    if (quickGeofenceCheck(lat, lng)) {
      return {
        allowed: true,
        message: "الموقع داخل العراق ✅",
        country: "العراق",
        countryCode: "IQ",
      };
    }

    // إذا خارج الحدود، نستخدم API لتحديد الدولة بدقة
    // إذا كان mapToken متوفر، استخدمه مباشرة
    let response;
    if (mapToken) {
      response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&access_token=${mapToken}`
      );
    } else {
      // استخدم Edge Function
      response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=country-check&lat=${lat}&lng=${lng}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!response.ok) {
      throw new Error("فشل التحقق من الموقع");
    }

    const data = await response.json();

    // استخراج كود الدولة
    const countryFeature = data.features?.[0];
    if (!countryFeature) {
      return {
        allowed: false,
        message: "لم نتمكن من تحديد الموقع، يرجى اختيار موقع واضح على الخريطة",
      };
    }

    const countryCode = countryFeature.properties?.short_code?.toUpperCase() || "";
    const countryName = countryFeature.place_name || countryFeature.text || "";

    // العراق
    if (countryCode === "IQ") {
      return {
        allowed: true,
        message: "الموقع داخل العراق ✅",
        country: "العراق",
        countryCode: "IQ",
      };
    }

    // الدول المجاورة (ليست إيران)
    if (countryCode in NEIGHBOR_COUNTRIES && countryCode !== "IR") {
      const arabicName = NEIGHBOR_COUNTRIES[countryCode as keyof typeof NEIGHBOR_COUNTRIES];
      return {
        allowed: false,
        message: `لحد هسة ما عبرنا الحدود العراقية، إن شاء الله قريباً تلكانة بـ ${arabicName} 🚗✨`,
        country: arabicName,
        countryCode,
        isNeighbor: true,
      };
    }

    // إيران (رسالة خاصة)
    if (countryCode === "IR") {
      return {
        allowed: false,
        message: "نعتذر، لا نعمل في هذا المكان حالياً 🙏",
        country: "إيران",
        countryCode,
        isIran: true,
      };
    }

    // جزر بعيدة
    if (ISLANDS.includes(countryCode)) {
      return {
        allowed: false,
        message: "عيني هاي يحتاجلهة طيارة وسفن، واحنة بس عدنا سيارة، خليك بالعراق هسة ✈️🚢",
        country: countryName,
        countryCode,
        isIsland: true,
      };
    }

    // دول بعيدة
    return {
      allowed: false,
      message: `يابة إلى الآن ما امتلكنا طيارة، إن شاء الله قريباً نأخذك لـ ${countryName} ✈️`,
      country: countryName,
      countryCode,
      isFar: true,
    };
  } catch (error) {
    console.error("خطأ في فحص الموقع:", error);
    // في حالة الخطأ، نسمح بالحجز (للحفاظ على تجربة المستخدم)
    return {
      allowed: true,
      message: "",
    };
  }
}
