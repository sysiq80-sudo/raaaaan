/**
 * أدوات تنظيف وتنسيق العناوين العربية
 * Address Cleaning and Formatting Utilities for Arabic Users
 * 
 * يوفر دوال لتنظيف العناوين التي ترجعها Google Maps API
 * لإزالة الأجزاء الإنجليزية والاحتفاظ بالنصوص العربية فقط
 */

/**
 * تنظيف العنوان من النصوص الإنجليزية والاحتفاظ بالنصوص العربية فقط
 * Cleans address by removing English text and keeping Arabic only
 * 
 * @param address - العنوان الكامل من Google Maps (قد يحتوي على نصوص مختلطة)
 * @returns عنوان نظيف يحتوي على النصوص العربية فقط
 * 
 * @example
 * cleanArabicAddress("حي التعايش، التأميم، Al-Ramadi Central Subdistrict، العراق")
 * // Returns: "حي التعايش، التأميم"
 */
export const cleanArabicAddress = (address: string): string => {
  if (!address) return address;
  
  // تقسيم العنوان بالفواصل (عربي وإنجليزي)
  const parts = address.split(/[،,]/).map(part => part.trim());
  
  // تصفية الأجزاء: الاحتفاظ بالأجزاء العربية فقط
  const arabicParts = parts.filter(part => {
    // تحقق إذا كان الجزء يحتوي على حروف عربية
    const hasArabic = /[\u0600-\u06FF]/.test(part);
    // تحقق إذا كان الجزء يحتوي على حروف إنجليزية
    const hasEnglish = /[a-zA-Z]/.test(part);
    
    // احتفظ بالجزء إذا كان يحتوي على عربي ولا يحتوي على إنجليزي
    if (hasArabic && !hasEnglish) return true;
    
    // إذا كان يحتوي على الاثنين، احتفظ به فقط إذا كان العربي هو الأغلب
    if (hasArabic && hasEnglish) {
      const arabicChars = (part.match(/[\u0600-\u06FF]/g) || []).length;
      const englishChars = (part.match(/[a-zA-Z]/g) || []).length;
      return arabicChars > englishChars;
    }
    
    return false;
  });
  
  // إزالة "العراق" أو "Iraq" إذا وجدت (معلومة بديهية للمستخدم العراقي)
  const filteredParts = arabicParts.filter(
    part => !part.match(/^(العراق|Iraq)$/i)
  );
  
  // إرجاع العنوان النظيف (أول 3 أجزاء فقط للإيجاز)
  // أو العنوان الأصلي إذا لم يتبقَ شيء بعد التنظيف
  return filteredParts.length > 0 
    ? filteredParts.slice(0, 3).join('، ')
    : address;
};

/**
 * تقصير العنوان لعرض مختصر
 * Shortens address for compact display
 * 
 * @param address - العنوان الكامل
 * @param maxLength - الحد الأقصى لطول العنوان (افتراضي: 40)
 * @returns عنوان مقصر مع "..." إذا كان طويلاً
 * 
 * @example
 * shortenAddress("حي التعايش، التأميم، الرمادي", 20)
 * // Returns: "حي التعايش، التأ..."
 */
export const shortenAddress = (address: string, maxLength: number = 40): string => {
  if (!address) return address;
  if (address.length <= maxLength) return address;
  return address.substring(0, maxLength) + '...';
};

/**
 * استخراج اسم الحي أو المنطقة الرئيسية من العنوان
 * Extracts the main neighborhood/district name from address
 * 
 * @param address - العنوان الكامل
 * @returns اسم الحي أو أول جزء من العنوان
 * 
 * @example
 * getMainArea("حي التعايش، التأميم، الرمادي")
 * // Returns: "حي التعايش"
 */
export const getMainArea = (address: string): string => {
  if (!address) return address;
  
  // تنظيف العنوان أولاً
  const cleaned = cleanArabicAddress(address);
  
  // استخراج أول جزء (عادةً يكون الحي أو المنطقة)
  const firstPart = cleaned.split(/[،,]/)[0]?.trim();
  
  return firstPart || cleaned;
};

/**
 * تنسيق العنوان لعرض قصير وجميل
 * Formats address for short, beautiful display
 * 
 * @param address - العنوان الكامل
 * @param maxParts - عدد الأجزاء المطلوب عرضها (افتراضي: 2)
 * @returns عنوان منسق
 * 
 * @example
 * formatAddressShort("حي التعايش، التأميم، الرمادي، العراق", 2)
 * // Returns: "حي التعايش، التأميم"
 */
export const formatAddressShort = (address: string, maxParts: number = 2): string => {
  if (!address) return address;
  
  // تنظيف العنوان
  const cleaned = cleanArabicAddress(address);
  
  // تقسيم وأخذ العدد المطلوب من الأجزاء
  const parts = cleaned.split(/[،,]/).map(p => p.trim()).slice(0, maxParts);
  
  return parts.join('، ');
};
