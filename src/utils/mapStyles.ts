/**
 * ران - أنماط خريطة مخصصة
 * أنماط Google Maps مخصصة للوضع الليلي/النهاري
 * مع ألوان تتناسب مع هوية التطبيق
 */

// نمط خريطة النهار - ألوان ناعمة مع تبسيط العناصر
export const lightMapStyle: google.maps.MapTypeStyle[] = [
  // لون الماء
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9e7f5" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5b8cb0" }],
  },
  // المناطق السكنية
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }],
  },
  // الطرق الرئيسية
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0e0e0" }],
  },
  // الطرق الفرعية
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.local",
    elementType: "geometry.stroke",
    stylers: [{ color: "#eeeeee" }],
  },
  // الطرق الرئيسية
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#fafafa" }],
  },
  // المتنزهات والمساحات الخضراء
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#d4edda" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3a7d44" }],
  },
  // ✅ عرض POI (مجمعات، مطاعم، مستشفيات، محلات) — مرئية بشكل كامل
  {
    featureType: "poi",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#444444" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }, { weight: 2 }],
  },
  // العبور
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
];

// نمط خريطة الليل - داكن أنيق
export const darkMapStyle: google.maps.MapTypeStyle[] = [
  // خلفية عامة
  {
    elementType: "geometry",
    stylers: [{ color: "#1a1a2e" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#a0aec0" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1a1a2e" }, { weight: 2 }],
  },
  // الإدارية
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4a5568" }, { visibility: "on" }],
  },
  // المناطق السكنية
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#16213e" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#1a1a3a" }],
  },
  // الماء
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0a1628" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4a6fa5" }],
  },
  // الطرق الرئيسية
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2d3a5c" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#394b73" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8fa5c7" }],
  },
  // الطرق الشريانية
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#253354" }],
  },
  // الطرق المحلية
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#1e2d4a" }],
  },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "simplified" }],
  },
  // المتنزهات
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1a2e24" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#48bb78" }],
  },
  // ✅ عرض POI في الوضع الليلي — مرئية بشكل كامل
  {
    featureType: "poi",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8fa5c7" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1a1a2e" }, { weight: 2 }],
  },
  // العبور
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  // المباني في الليل
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#2d3748" }],
  },
];

/**
 * الحصول على نمط الخريطة المناسب حسب وضع الثيم
 * يتحقق من تفضيل المستخدم أو وضع النظام
 */
export const getMapStyle = (): google.maps.MapTypeStyle[] => {
  // التحقق من dark mode في DOM
  const isDark =
    document.documentElement.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return isDark ? darkMapStyle : lightMapStyle;
};

/**
 * تطبيق نمط الخريطة تلقائياً
 * يُستخدم عند تهيئة الخريطة أو تغيير الثيم
 */
export const applyMapStyle = (map: google.maps.Map): void => {
  const style = getMapStyle();
  map.setOptions({ styles: style });
};

/**
 * مراقبة تغيير الثيم وتحديث الخريطة تلقائياً
 */
export const watchThemeChanges = (
  map: google.maps.Map,
  onStyleChange?: (isDark: boolean) => void,
): (() => void) => {
  const observer = new MutationObserver(() => {
    const isDark = document.documentElement.classList.contains("dark");
    const style = isDark ? darkMapStyle : lightMapStyle;
    map.setOptions({ styles: style });
    onStyleChange?.(isDark);
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // أيضاً مراقبة تفضيل النظام
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (e: MediaQueryListEvent) => {
    const style = e.matches ? darkMapStyle : lightMapStyle;
    map.setOptions({ styles: style });
    onStyleChange?.(e.matches);
  };
  mediaQuery.addEventListener("change", handleChange);

  // دالة التنظيف
  return () => {
    observer.disconnect();
    mediaQuery.removeEventListener("change", handleChange);
  };
};

export default {
  lightMapStyle,
  darkMapStyle,
  getMapStyle,
  applyMapStyle,
  watchThemeChanges,
};
