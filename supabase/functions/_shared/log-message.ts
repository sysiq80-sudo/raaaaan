/**
 * ران — مسجّل رسائل البوت (Edge Function version)
 * RAAN Bot Message Logger — Supabase Edge Functions
 *
 * يُستورَد من whatsapp-webhook ووظائف أخرى لتسجيل الرسائل الواردة والصادرة
 * يستخدم createClient من Supabase بدلاً من العميل الأمامي (frontend client)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════
// Supabase client — service role (لتسجيل الرسائل بدون RLS)
// ════════════════════════════════════════
let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.warn("[log-message] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
      return null;
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// ════════════════════════════════════════
// واجهة بيانات الرسالة
// ════════════════════════════════════════
export interface BotMessageData {
  botCustomerId: string;
  message: string;
  platform: "whatsapp" | "telegram" | "sms";
  messageId?: string;
  metadata?: Record<string, any>;
}

// ════════════════════════════════════════
// تسجيل رسالة واردة من العميل
// ════════════════════════════════════════
export async function logIncomingBotMessage(data: BotMessageData): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: result, error } = await supabase.rpc("log_bot_incoming_message", {
      p_bot_customer_id: data.botCustomerId,
      p_message: data.message,
      p_platform: data.platform,
      p_message_id: data.messageId || null,
      p_metadata: data.metadata || {},
    });

    if (error) {
      console.error("[log-message] Failed to log incoming bot message:", error);
      return null;
    }

    return result;
  } catch (err) {
    console.error("[log-message] Error logging incoming bot message:", err);
    return null;
  }
}

// ════════════════════════════════════════
// تسجيل رسالة صادرة من البوت
// ════════════════════════════════════════
export async function logOutgoingBotMessage(data: BotMessageData): Promise<string | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: result, error } = await supabase.rpc("log_bot_outgoing_message", {
      p_bot_customer_id: data.botCustomerId,
      p_message: data.message,
      p_platform: data.platform,
      p_message_id: data.messageId || null,
      p_metadata: data.metadata || {},
    });

    if (error) {
      console.error("[log-message] Failed to log outgoing bot message:", error);
      return null;
    }

    return result;
  } catch (err) {
    console.error("[log-message] Error logging outgoing bot message:", err);
    return null;
  }
}
