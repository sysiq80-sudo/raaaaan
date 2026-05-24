/**
 * ران — مُرسِل SMS مشترك
 * Shared SMS Sender via OTPIQ API
 *
 * يُستخدم من: sms-booking, sms-ride-updates, cron-cancel-stale-rides
 */

import { getConfig, createServiceClient } from "./config.ts";

let _otpiqKey = "";
let _keyLoaded = false;

async function ensureKey(): Promise<string> {
  if (_keyLoaded && _otpiqKey) return _otpiqKey;
  try {
    const svc = createServiceClient();
    _otpiqKey = await getConfig(svc, "OTPIQ_API_KEY");
    _keyLoaded = true;
  } catch {
    _otpiqKey = Deno.env.get("OTPIQ_API_KEY") || "";
  }
  return _otpiqKey;
}

/**
 * Format Iraqi phone number to international format (964...)
 */
export function formatIraqiPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "964" + cleaned.substring(1);
  if (!cleaned.startsWith("964")) cleaned = "964" + cleaned;
  return cleaned;
}

/**
 * Send SMS via OTPIQ
 * @returns true if sent successfully
 */
export async function sendSMS(
  phoneNumber: string,
  message: string,
  provider: "sms" | "whatsapp" = "sms"
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const apiKey = await ensureKey();
  if (!apiKey) {
    console.error("[smsSender] OTPIQ_API_KEY not configured");
    return { success: false, error: "API key missing" };
  }

  const formattedPhone = formatIraqiPhone(phoneNumber);

  try {
    const res = await fetch("https://api.otpiq.com/api/sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phoneNumber: formattedPhone,
        smsType: "otp",
        message,
        provider,
      }),
    });

    const result = await res.json();

    if (res.ok) {
      console.log(`[smsSender] ✅ Sent to ${formattedPhone} via ${provider}`);
      return { success: true, externalId: result.id || result.messageId };
    }

    // If WhatsApp failed, try SMS fallback
    if (provider === "whatsapp") {
      console.log("[smsSender] WhatsApp failed, trying SMS fallback...");
      return sendSMS(phoneNumber, message, "sms");
    }

    console.error(`[smsSender] ❌ Failed (${res.status}):`, result.message);
    return { success: false, error: result.message || "Send failed" };
  } catch (e) {
    console.error("[smsSender] Network error:", e);
    return { success: false, error: "Network error" };
  }
}
