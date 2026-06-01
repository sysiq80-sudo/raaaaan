/**
 * ران — cron-dispatch: إعادة dispatch للرحلات المعلّقة
 * يُشغَّل كل دقيقة عبر pg_cron
 * يبحث عن rides WHERE status='pending' AND dispatch_next_retry_at <= NOW()
 * ويستدعي match-ride لكل واحدة عبر INTERNAL_EDGE_SECRET
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { corsHeaders, getCorsHeaders } from "../_shared/utils.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // الحماية: يقبل فقط x-internal-secret
  // الـ anon key عام ومكشوف في العميل — لا يصلح كحماية لهذه الدالة
  const internalHeader = req.headers.get("x-internal-secret") || "";
  const internalSecret = Deno.env.get("INTERNAL_EDGE_SECRET") || "";

  if (!internalSecret || internalHeader !== internalSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createServiceClient();

  try {
    // 1. جلب ذري مع FOR UPDATE SKIP LOCKED — يمنع المعالجة المزدوجة
    //    يُنفَّذ في RPC واحد: SELECT + UPDATE في نفس الـ transaction
    const { data: ridesToRetry, error: fetchError } = await supabase
      .rpc("claim_dispatch_retry_jobs", { p_limit: 10 });

    if (fetchError) throw fetchError;

    if (!ridesToRetry?.length) {
      console.log("[cron-dispatch] ✅ لا توجد رحلات تحتاج retry");
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`[cron-dispatch] 🔍 وجدت ${ridesToRetry.length} رحلة للمعالجة`);

    // 2. استدعاء match-ride لكل رحلة
    const results = await Promise.allSettled(
      ridesToRetry.map((ride: any) =>
        supabase.functions.invoke("match-ride", {
          body: { rideId: ride.ride_id, re_match: true },
          headers: { "x-internal-secret": internalSecret },
        })
      ),
    );

    // 3. حساب النتائج — fulfilled لا تعني نجاح دائماً
    //    supabase.functions.invoke يُرجع { data, error } حتى عند HTTP 4xx/5xx
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        // خطأ شبكي أو استثناء غير متوقع
        failed++;
        errors.push(result.reason?.message || "network error");
      } else if (result.value?.error) {
        // الدالة استُدعيت لكن أرجعت error (4xx/5xx)
        failed++;
        errors.push(result.value.error.message || "function returned error");
      } else {
        succeeded++;
      }
    }

    if (errors.length > 0) {
      console.error(`[cron-dispatch] ❌ أخطاء:`, errors);
    }

    console.log(`[cron-dispatch] ✅ ${succeeded} نجح, ❌ ${failed} فشل`);

    // ─── Phase 6B: log to system_events on total batch failure ───
    if (failed > 0 && succeeded === 0) {
      await supabase.rpc("log_system_event", {
        p_event_type: "cron_batch_all_failed",
        p_severity: "error",
        p_message: `cron-dispatch: all ${failed} rides failed`,
        p_metadata: { failed, errors: errors.slice(0, 5) },
      }).catch(() => {}); // fire-and-forget — never block the response
    } else if (failed > 0) {
      await supabase.rpc("log_system_event", {
        p_event_type: "cron_batch_partial_failure",
        p_severity: "warn",
        p_message: `cron-dispatch: ${failed}/${ridesToRetry.length} rides failed`,
        p_metadata: { succeeded, failed, errors: errors.slice(0, 5) },
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ processed: ridesToRetry.length, succeeded, failed }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ غير معروف";
    console.error("[cron-dispatch] ❌ خطأ:", msg);
    // ─── Phase 6B: log unexpected crash ───
    await supabase.rpc("log_system_event", {
      p_event_type: "cron_dispatch_crash",
      p_severity: "error",
      p_message: `cron-dispatch crashed: ${msg}`,
      p_metadata: null,
    }).catch(() => {});
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
