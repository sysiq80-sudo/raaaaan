/**
 * ران — أدوات توحيد أرقام الهواتف العراقية (Frontend)
 * RAAN Phone Number Normalization Utilities
 *
 * القاعدة الأساسية: جميع الأرقام تُحفظ بصيغة E.164 الدولية (+964XXXXXXXXX)
 * هذا يضمن توحيد الحسابات بين التطبيق والبوت (Omnichannel Sync)
 */

/**
 * تحويل أي رقم هاتف عراقي إلى صيغة E.164 الدولية: +964XXXXXXXXX
 *
 * يدعم الصيغ التالية:
 * - 07812345678    → +9647812345678
 * - 7812345678     → +9647812345678
 * - 9647812345678  → +9647812345678
 * - +9647812345678 → +9647812345678
 */
export function normalizeIraqiPhoneToE164(phone: string): string {
  // إزالة كل شيء ما عدا الأرقام و +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // إزالة + مؤقتاً للمعالجة
  const digits = cleaned.replace(/\+/g, "");

  // إذا يبدأ بـ 964 (رمز العراق)
  if (digits.startsWith("964")) {
    return `+${digits}`;
  }

  // إذا يبدأ بـ 0 (رقم محلي عراقي)
  if (digits.startsWith("0")) {
    return `+964${digits.substring(1)}`;
  }

  // إذا يبدأ بـ 7 (رقم عراقي بدون 0)
  if (digits.startsWith("7") && digits.length >= 10) {
    return `+964${digits}`;
  }

  // افتراضي: إضافة +964
  return `+964${digits}`;
}
