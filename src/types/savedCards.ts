/**
 * ران - أنواع البطاقات المحفوظة
 * saved_cards table types + payment mapping
 */

// ===== أنواع البطاقات المحفوظة =====
export interface SavedCard {
  id: string;
  user_id: string;
  provider: string; // مزود الدفع (nass, etc.)
  card_token: string; // رمز البطاقة المشفر
  last4: string; // آخر 4 أرقام
  brand: string; // نوع البطاقة (Visa, Mastercard, etc.)
  is_default: boolean;
  created_at: string;
}

export type SavedCardInsert = Omit<SavedCard, "id" | "created_at">;

// ===== أنواع الدفع الموحدة =====
// الأنواع الثلاثة الأساسية في واجهة الراكب
export type PaymentMethod = "cash" | "wallet" | "card";

// أنواع قاعدة البيانات (DB enum)
export type DbPaymentMethod =
  | "cash"
  | "zain_cash"
  | "asia_hawala"
  | "qi_card"
  | "nas_wallet"
  | "nass";

/**
 * تحويل طريقة الدفع من الواجهة إلى قاعدة البيانات
 * wallet → nas_wallet (رصيد المحفظة الداخلية)
 * card → cash (البطاقات البنكية وبوابات الدفع معطلة حالياً)
 * cash → cash (نقدي)
 */
export const mapPaymentToDb = (method: PaymentMethod): DbPaymentMethod => {
  switch (method) {
    case "wallet":
      return "nas_wallet";
    case "card":
      return "cash";
    case "cash":
    default:
      return "cash";
  }
};

/**
 * تحويل طريقة الدفع من قاعدة البيانات إلى الواجهة
 */
export const mapDbToPayment = (dbMethod: DbPaymentMethod | string | null): PaymentMethod => {
  switch (dbMethod) {
    case "nas_wallet":
      return "wallet";
    case "cash":
    case "nass":
    case "qi_card":
    case "zain_cash":
    case "asia_hawala":
    default:
      return "cash";
  }
};
