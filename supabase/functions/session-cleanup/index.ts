/**
 * ران — تنظيف الجلسات المنتهية
 * RAAN Session & Cache Cleanup — Runs periodically
 * 
 * يُستدعى بواسطة pg_cron أو CRON job كل 5 دقائق
 * ينظف: draft sessions قديمة، chat states منتهية، rate limit log
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // حماية بسيطة
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // استدعاء دالة التنظيف الشاملة
    const { data, error } = await supabase.rpc("run_all_cleanups");
    
    if (error) {
      console.error("[cleanup] RPC failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("[cleanup] ✅ Cleanup completed:", JSON.stringify(data));
    return new Response(JSON.stringify({
      success: true,
      results: data,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cleanup] CRITICAL ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
