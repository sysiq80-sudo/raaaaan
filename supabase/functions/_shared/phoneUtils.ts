/**
 * ران — أدوات توحيد أرقام الهواتف العراقية
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
 * - wa_9647812345678 → +9647812345678 (واتساب)
 */
export function normalizeToE164(phone: string): string {
  // إزالة البادئات الخاصة بالبوت
  let cleaned = phone.replace(/^(wa_|tg_)/, "");

  // إزالة كل شيء ما عدا الأرقام و +
  cleaned = cleaned.replace(/[^\d+]/g, "");

  // إزالة + مؤقتاً للمعالجة
  const hasPlus = cleaned.startsWith("+");
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

/**
 * إنشاء قائمة بجميع الصيغ الممكنة لرقم هاتف عراقي
 * تُستخدم للبحث في قاعدة البيانات (لأن المستخدمين القدامى قد يكون رقمهم محفوظ بأي صيغة)
 *
 * مثال: normalizeToE164("9647812345678") → "+9647812345678"
 * generatePhoneVariants("+9647812345678") → ["+9647812345678", "9647812345678", "07812345678", "7812345678", "wa_9647812345678"]
 */
export function generatePhoneVariants(e164Phone: string): string[] {
  const digits = e164Phone.replace(/\D/g, "");

  // استخراج الرقم المحلي (بدون رمز البلد)
  let localNumber: string;
  if (digits.startsWith("964")) {
    localNumber = digits.substring(3);
  } else if (digits.startsWith("0")) {
    localNumber = digits.substring(1);
  } else {
    localNumber = digits;
  }

  return [
    `+964${localNumber}`,        // E.164 مع +
    `964${localNumber}`,          // E.164 بدون +
    `0${localNumber}`,            // محلي مع 0
    localNumber,                  // محلي بدون 0
    `wa_964${localNumber}`,       // صيغة واتساب القديمة
  ];
}
