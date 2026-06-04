/**
 * ران — buildHumanAddress
 *
 * دالة مركزية لبناء عنوان بشري مقروء من مكونات Geocoding.
 * تُستخدم في: useLocationPicker, GoPage, NominatimAdapter, MapLocationPicker.
 *
 * الأولوية (من الأعلى للأدنى):
 * 1. اسم معلم قريب (POI): مسجد، مستشفى، مدرسة، متجر...
 * 2. حي/منطقة: neighborhood, sublocality, suburb, quarter
 * 3. اسم منطقة الخدمة من قاعدة البيانات (serviceRegionName)
 * 4. شارع حقيقي ذو اسم + حي/مدينة (مع فلترة "Unnamed Road" والأرقام فقط)
 * 5. formatted_address بعد تنظيفه إذا كان أدق من المدينة
 * 6. المدينة وحدها
 * 7. الإحداثيات كآخر حل
 */

// ─── أنماط العناوين الرديئة ──────────────────────────────────────
const BAD_ADDRESS_PATTERNS: RegExp[] = [
  // إنجليزي
  /unnamed\s*road/i,
  /^road\s*\d/i,
  /^highway/i,
  /^[A-Z]{1,3}\s*\d+$/i,         // مثل "M1", "RD7"
  /^\d+$/,                        // أرقام فقط
  // عربي — حالات "بدون اسم" الأكثر شيوعاً في العراق
  /طريق\s*بدون\s*اسم/i,
  /شارع\s*بدون\s*اسم/i,
  /طريق\s*مجهول/i,
  /بلا\s*اسم/i,
  /غير\s*مسم[ىا]/i,
  /^طريق\s*(رقم)?\s*\d/i,
  /^شارع\s*(رقم)?\s*\d+$/i,
  /^جادة\s*(رقم)?\s*\d/i,
  /^طريق\s*سريع/i,
  // عناوين جغرافية شاملة تُعاد من Google عندما لا يجد نتيجة دقيقة
  /^العراق\s*كامل/i,
  /^Iraq$/i,
];

const BROAD_CITY_NAMES = new Set([
  "erbil",
  "اربيل",
  "أربيل",
  "إربيل",
  "هەولێر",
  "hawler",
  "hewler",
  "محافظه اربيل",
  "محافظة اربيل",
]);

const POI_NAME_HINTS: RegExp[] = [
  /مسجد|جامع|حسينية|كنيسة/i,
  /مدرسة|ثانوية|جامعة|كلية|معهد|روضة/i,
  /مستشفى|عيادة|صيدلية|مختبر|طبيب/i,
  /مول|سوق|ماركت|متجر|مطعم|كافيه|مقهى|مخبز/i,
  /محطة|كراج|موقف|بنك|مصرف|فندق|قاعة|ملعب|حديقة/i,
  /mosque|school|university|hospital|pharmacy|mall|market|restaurant|cafe|bank|hotel|park|station/i,
];

const normalizeToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");

const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/i;

const isCountryOrServiceLabel = (value: string): boolean => {
  const normalized = normalizeToken(value);
  return (
    normalized === "العراق" ||
    normalized === "iraq" ||
    normalized === "العراق كامل" ||
    normalized === "كردستان العراق" ||
    normalized === "kurdistan region"
  );
};

export const isBroadCityName = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = normalizeToken(value);
  return BROAD_CITY_NAMES.has(normalized);
};

const getCleanFormattedParts = (formattedAddress?: string | null): string[] => {
  if (!formattedAddress) return [];

  return formattedAddress
    .split(/[،,]/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !plusCodeRegex.test(part) &&
        !isCountryOrServiceLabel(part) &&
        !isGenericRoad(part)
    );
};

const sameToken = (a?: string | null, b?: string | null): boolean => {
  if (!a || !b) return false;
  return normalizeToken(a) === normalizeToken(b);
};

/**
 * هل الشارع اسمه حقيقي أم مجرد رقم/unnamed?
 */
export const isGenericRoad = (street: string): boolean => {
  if (!street || street.trim().length < 3) return true;
  return BAD_ADDRESS_PATTERNS.some((p) => p.test(street.trim()));
};

/**
 * هل العنوان يحتوي على معلومات مفيدة؟
 * (يُستخدم للتحقق قبل الاستخدام)
 */
export const isUselessAddress = (address: string): boolean => {
  if (!address || address.trim().length === 0) return true;
  if (address.includes("جاري تحديد العنوان")) return true;
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(address.trim())) return true; // إحداثيات خام
  return BAD_ADDRESS_PATTERNS.some((p) => p.test(address.trim()));
};

/**
 * درجة جودة تقريبية للعنوان: تُستخدم لمنع نتيجة عامة مثل "Erbil"
 * من الكتابة فوق نتيجة أدق من Nominatim أو landmarks.
 */
export const getHumanAddressQuality = (address: string): number => {
  if (isUselessAddress(address)) return 0;

  const parts = getCleanFormattedParts(address);
  if (parts.length === 0) return 0;

  if (parts.length === 1) {
    if (POI_NAME_HINTS.some((pattern) => pattern.test(parts[0]))) return 6;
    return isBroadCityName(parts[0]) ? 1 : 2;
  }

  const hasSpecificFirstPart = !isBroadCityName(parts[0]);
  return hasSpecificFirstPart ? Math.min(7, 3 + parts.length) : Math.min(4, parts.length);
};

// ─── المدخلات ────────────────────────────────────────────────────

export interface HumanAddressInput {
  /** اسم معلم قريب (مسجد، مستشفى، مدرسة...) */
  poiName?: string | null;
  /** حي/منطقة: neighborhood, sublocality, suburb, quarter */
  neighborhood?: string | null;
  /** اسم الشارع/الطريق */
  street?: string | null;
  /** المدينة أو التابعية الإدارية */
  city?: string | null;
  /** اسم منطقة الخدمة من قاعدة البيانات (serviceCheck.region.name_ar) */
  serviceRegionName?: string | null;
  /** الإحداثيات — fallback أخير */
  lat?: number | null;
  lng?: number | null;
  /** formatted_address من Google — fallback قبل الإحداثيات */
  formattedAddress?: string | null;
}

// ─── الدالة الرئيسية ─────────────────────────────────────────────

/**
 * بناء عنوان بشري مقروء من مكونات متعددة.
 *
 * @example
 * buildHumanAddress({ poiName: "مسجد الرحمن", neighborhood: "حي الإصلاح", city: "الرمادي" })
 * // → "مسجد الرحمن، حي الإصلاح"
 *
 * buildHumanAddress({ street: "طريق رقم 7", neighborhood: "حي التأميم", city: "الرمادي" })
 * // → "حي التأميم، الرمادي"   (الشارع مُفلتَر لأنه رقم فقط)
 *
 * buildHumanAddress({ street: "شارع الرشيد", neighborhood: "حي التأميم", city: "الرمادي" })
 * // → "شارع الرشيد، حي التأميم"   (الشارع حقيقي)
 */
export const buildHumanAddress = ({
  poiName,
  neighborhood,
  street,
  city,
  serviceRegionName,
  lat,
  lng,
  formattedAddress,
}: HumanAddressInput): string => {

  const poi = poiName?.trim() || null;
  const area = neighborhood?.trim() || null;
  const road = street?.trim() || null;
  const town = city?.trim() || null;
  const region = serviceRegionName?.trim() || null;
  const formattedParts = getCleanFormattedParts(formattedAddress);

  // ── 1. معلم قريب ─────────────────────────────────────────────
  if (poi && !isGenericRoad(poi)) {
    // أضف سياق (حي أو مدينة) بعد اسم المعلم
    const context = area || (road && !isGenericRoad(road) ? road : null) || town;
    if (context && context !== poi) return `${poi}، ${context}`;
    return poi;
  }

  // ── 2. حي/منطقة بدون شارع حقيقي ────────────────────────────
  if (area && (!road || isGenericRoad(road))) {
    const suffix = town && town !== area ? `، ${town}` : "";
    return `${area}${suffix}`;
  }

  // ── 3. شارع حقيقي + حي (اختياري) ───────────────────────────
  if (road && !isGenericRoad(road)) {
    const parts = [road, area, town].filter(
      (p, i, arr) => p && arr.indexOf(p) === i
    ) as string[];
    return parts.slice(0, 3).join("، ");
  }

  // ── 4. حي/منطقة فقط (لا يوجد شارع) ─────────────────────────
  if (area) {
    const suffix = town && town !== area ? `، ${town}` : "";
    return `${area}${suffix}`;
  }

  // ── 5. منطقة الخدمة من قاعدة البيانات (فقط إذا كانت مفيدة) ────
  if (region && !isGenericRoad(region)) {
    const suffix = town && town !== region ? `، ${town}` : "";
    return `${region}${suffix}`;
  }

  // ── 6. formatted_address مع تنظيف — قبل المدينة إذا كان أدق ─────
  if (formattedParts.length > 0) {
    const specificParts = formattedParts.filter(
      (part) => !sameToken(part, town) && !sameToken(part, region) && !isBroadCityName(part)
    );

    if (specificParts.length > 0) {
      const context = town && !sameToken(specificParts[0], town) ? town : null;
      return [specificParts[0], context].filter(Boolean).join("، ");
    }

    if (!town) {
      const nonBroadParts = formattedParts.filter((part) => !isBroadCityName(part));
      const fallbackParts = nonBroadParts.length > 0 ? nonBroadParts : formattedParts;
      return fallbackParts.slice(0, 3).join("، ");
    }
  }

  // ── 7. المدينة فقط ───────────────────────────────────────────
  if (town) return town;

  // ── 8. إحداثيات كآخر حل ─────────────────────────────────────
  if (lat != null && lng != null) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  return "";
};

// ─── مساعد: استخراج مكونات من Google address_components ────────

export interface GoogleAddressComponents {
  poiName: string | null;
  neighborhood: string | null;
  street: string | null;
  city: string | null;
}

/**
 * استخراج مكونات العنوان من Google address_components array.
 * مُعاد استخدامها في useLocationPicker و GoPage.
 */
export const extractGoogleComponents = (
  components: Array<{ types: string[]; long_name: string }>,
  poiFromResults?: string | null
): GoogleAddressComponents => {
  const get = (type: string): string | null =>
    components.find((c) => c.types.includes(type))?.long_name ?? null;

  const route = get("route");
  const streetNum = get("street_number");
  const street = [route, streetNum].filter(Boolean).join(" ").trim() || null;

  const neighborhood =
    get("neighborhood") ||
    get("sublocality_level_1") ||
    get("sublocality") ||
    get("administrative_area_level_4") ||
    get("administrative_area_level_3") ||
    null;

  const city =
    get("locality") ||
    get("administrative_area_level_2") ||
    get("administrative_area_level_1") ||
    null;

  return {
    poiName: poiFromResults || null,
    neighborhood,
    street,
    city,
  };
};

// ─── مساعد: استخراج مكونات من Nominatim address ─────────────────

export interface NominatimAddressComponents {
  poiName: string | null;
  neighborhood: string | null;
  street: string | null;
  city: string | null;
}

/**
 * استخراج مكونات العنوان من Nominatim address object.
 * يُستخدم في NominatimGeocodingAdapter.
 */
export const extractNominatimComponents = (
  placeName: string | null,
  addr: Record<string, string>
): NominatimAddressComponents => {
  const poiName =
    placeName ||
    addr.amenity ||
    addr.shop ||
    addr.building ||
    addr.tourism ||
    addr.leisure ||
    addr.office ||
    addr.craft ||
    addr.healthcare ||
    addr.historic ||
    null;

  const neighborhood =
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.residential ||
    null;

  const street =
    addr.road ||
    addr.pedestrian ||
    addr.path ||
    null;

  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.county ||
    null;

  return { poiName, neighborhood, street, city };
};
