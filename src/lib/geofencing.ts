/**
 * Geofencing System for RAAN App
 * يمنع الحجز خارج العراق مع رسائل عراقية طريفة
 */

import { getGeocoder } from "@/lib/googleMapService";

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

    // إذا خارج الحدود، نستخدم Google Geocoding API لتحديد الدولة بدقة
    if (!window.google?.maps) {
      throw new Error("Google Maps API غير محملة");
    }

    const geocoder = await getGeocoder();
    if (!geocoder) throw new Error("Geocoder غير متاح");
    const result = await geocoder.geocode({ 
      location: { lat, lng },
      language: 'ar' 
    });

    if (!result.results || result.results.length === 0) {
      throw new Error("فشل التحقق من الموقع");
    }

    const data = result.results[0];

    // استخراج كود الدولة من Google Geocoding
    const countryComponent = data.address_components?.find((component: any) => 
      component.types.includes('country')
    );
    
    if (!countryComponent) {
      return {
        allowed: false,
        message: "لم نتمكن من تحديد الموقع، يرجى اختيار موقع واضح على الخريطة",
      };
    }

    const countryCode = countryComponent.short_name?.toUpperCase() || "";
    const countryName = countryComponent.long_name || "";

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
