/**
 * ران — إرسال تنبيه حرج للمديرين عبر Edge Function
 * يُستخدم عند أخطاء الدفع أو الرحلات المعلقة أو مشاكل النظام
 */
import { supabase } from "@/integrations/supabase/client";

type AlertType = "payment_failed" | "ride_stuck" | "driver_sos" | "system_error" | "security";

export async function notifyAdminCritical(
  type: AlertType,
  message: string,
  metadata?: Record<string, unknown>
) {
  try {
    await supabase.functions.invoke("notify-admin-critical", {
      body: { type, message, metadata },
    });
  } catch (err) {
    // لا نريد أن يتوقف التطبيق بسبب فشل التنبيه
    console.error("[notifyAdmin] Failed to send alert:", err);
  }
}
