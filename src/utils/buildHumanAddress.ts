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
 * 5. المدينة وحدها
 * 6. الإحداثيات كآخر حل
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

  // ── 6. المدينة فقط ───────────────────────────────────────────
  if (town) return town;

  // ── 7. formatted_address مع تنظيف ───────────────────────────
  if (formattedAddress) {
    const plusCodeRegex = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;
    const cleaned = formattedAddress
      .split(/[،,]/)
      .map((p) => p.trim())
      .filter(
        (p) =>
          p.length > 0 &&
          !plusCodeRegex.test(p) &&
          p !== "العراق" &&
          p !== "Iraq" &&
          p !== "العراق كامل" &&
          !isGenericRoad(p)
      );
    if (cleaned.length > 0) return cleaned.slice(0, 3).join("، ");
  }

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
