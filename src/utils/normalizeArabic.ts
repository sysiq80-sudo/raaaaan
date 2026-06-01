/**
 * normalizeArabic.ts
 * ─────────────────
 * تطبيع النص العربي قبل المقارنة — يجعل البحث مرناً:
 *   قلعه  ←→  قلعة
 *   اربيل ←→  أربيل
 *   مستشفى ←→ مستشفي
 */

/**
 * يُطبّع النص العربي بإزالة الفروق الشكلية غير المعنوية
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';

  return text
    // 1. أشكال الألف (أ إ آ ٱ) → ا
    .replace(/[أإآٱ]/g, 'ا')
    // 2. التاء المربوطة → هاء
    .replace(/ة/g, 'ه')
    // 3. الألف المقصورة → ياء
    .replace(/ى/g, 'ي')
    // 4. واو الهمزة → واو
    .replace(/ؤ/g, 'و')
    // 5. ياء الهمزة → ياء
    .replace(/ئ/g, 'ي')
    // 6. الهمزة المفردة → اختياري
    // .replace(/ء/g, '')
    // 7. حذف التشكيل (الحركات والشدة والسكون)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // 8. حذف المسافات الزائدة
    .trim()
    .toLowerCase();
}

/**
 * بحث مرن — يُطبّع كلا النصين قبل المقارنة
 */
export function arabicIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return normalizeArabic(haystack).includes(normalizeArabic(needle));
}
