/**
 * ران — بوابة دفع زين كاش — بدء المعاملة
 * ZainCash Payment Gateway — Init Transaction
 *
 * التدفق:
 * 1. المستخدم يختار المبلغ ويضغط "شحن"
 * 2. هذه الدالة تنشئ JWT مع بيانات المعاملة وترسلها لـ ZainCash API
 * 3. ZainCash يرجع transaction_id
 * 4. نرجع رابط الدفع للمستخدم للتحويل
 * 5. بعد الدفع ZainCash يحوّل المستخدم لـ redirect URL مع نتيجة JWT
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders, getCorsHeaders } from "../_shared/utils.ts";

// ════════════════════════════════════════
// إعدادات ديناميكية
// ════════════════════════════════════════

let zaincashMerchantId = "";
let zaincashSecret = "";
let zaincashMsisdn = "";
let zaincashBaseUrl = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "ZAINCASH_MERCHANT_ID",
      "ZAINCASH_SECRET",
      "ZAINCASH_MSISDN",
      "ZAINCASH_BASE_URL",
    ]);
    zaincashMerchantId = cfg["ZAINCASH_MERCHANT_ID"] || Deno.env.get("ZAINCASH_MERCHANT_ID") || "";
    zaincashSecret = cfg["ZAINCASH_SECRET"] || Deno.env.get("ZAINCASH_SECRET") || "";
    zaincashMsisdn = cfg["ZAINCASH_MSISDN"] || Deno.env.get("ZAINCASH_MSISDN") || "";
    zaincashBaseUrl = cfg["ZAINCASH_BASE_URL"] || Deno.env.get("ZAINCASH_BASE_URL") || "https://api.zaincash.iq";
    _configLoaded = true;
    console.log("[zaincash-init] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[zaincash-init] ⚠️ Config load failed, using env fallbacks:", e);
    zaincashMerchantId = Deno.env.get("ZAINCASH_MERCHANT_ID") || "";
    zaincashSecret = Deno.env.get("ZAINCASH_SECRET") || "";
    zaincashMsisdn = Deno.env.get("ZAINCASH_MSISDN") || "";
    zaincashBaseUrl = Deno.env.get("ZAINCASH_BASE_URL") || "https://api.zaincash.iq";
  }
}
// ════════════════════════════════════════
// إنشاء مفتاح HMAC للتوقيع
// ════════════════════════════════════════

async function createHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// ════════════════════════════════════════
// نقطة الدخول
// ════════════════════════════════════════

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const externalGatewaysEnabled = Deno.env.get("ENABLE_EXTERNAL_PAYMENT_GATEWAYS") === "true";
  if (!externalGatewaysEnabled) {
    return new Response(
      JSON.stringify({
        success: false,
        code: "PAYMENT_GATEWAYS_DISABLED",
        error: "بوابات الدفع الخارجية معطلة حالياً. الشحن متاح عبر كروت RAAN الداخلية فقط.",
      }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await loadDynamicConfig();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // التحقق من الإعدادات
    if (!zaincashMerchantId || !zaincashSecret || !zaincashMsisdn) {
      console.error("[zaincash-init] Missing ZainCash credentials");
      return new Response(
        JSON.stringify({ success: false, error: "ZainCash credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // مصادقة المستخدم
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // تحليل الطلب
    const body = await req.json();
    const { amount, serviceType = "شحن محفظة رعان" } = body as {
      amount: number;
      serviceType?: string;
    };

    if (!amount || amount < 250 || amount > 5000000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "المبلغ يجب أن يكون بين 250 و 5,000,000 دينار عراقي",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[zaincash-init] Initiating payment for user ${userId}, amount: ${amount} IQD`);

    // إنشاء orderId فريد
    const orderId = `RAAN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // رابط الإرجاع بعد الدفع
    const callbackUrl = `${supabaseUrl}/functions/v1/zaincash-callback`;

    // ════════════════════════════════════════
    // الخطوة 1: إنشاء JWT مع بيانات المعاملة
    // ════════════════════════════════════════

    const key = await createHmacKey(zaincashSecret);

    const jwtPayload = {
      amount: amount,
      serviceType: serviceType,
      msisdn: zaincashMsisdn,
      orderId: orderId,
      redirectUrl: callbackUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // ساعة واحدة
    };

    const token = await create({ alg: "HS256", typ: "JWT" }, jwtPayload, key);

    // ════════════════════════════════════════
    // الخطوة 2: إرسال الطلب لـ ZainCash API
    // ════════════════════════════════════════

    console.log("[zaincash-init] Sending init request to ZainCash...");

    const initResponse = await fetch(`${zaincashBaseUrl}/transaction/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: token,
        merchantId: zaincashMerchantId,
        lang: "ar",
      }),
    });

    const responseText = await initResponse.text();
    console.log("[zaincash-init] ZainCash response status:", initResponse.status);
    console.log("[zaincash-init] ZainCash response:", responseText);

    if (!initResponse.ok) {
      console.error("[zaincash-init] ZainCash init failed:", initResponse.status, responseText);
      return new Response(
        JSON.stringify({ success: false, error: "فشل الاتصال ببوابة زين كاش" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let initData: { id?: string; error?: string };
    try {
      initData = JSON.parse(responseText);
    } catch {
      // ZainCash قد يرجع الـ ID كنص مباشر
      initData = { id: responseText.trim().replace(/"/g, "") };
    }

    if (!initData.id || initData.error) {
      console.error("[zaincash-init] Invalid response:", initData);
      return new Response(
        JSON.stringify({
          success: false,
          error: initData.error || "استجابة غير صالحة من زين كاش",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transactionId = initData.id;
    const paymentUrl = `${zaincashBaseUrl}/transaction/pay?id=${transactionId}`;

    // ════════════════════════════════════════
    // الخطوة 3: حفظ المعاملة المعلقة
    // ════════════════════════════════════════

    const { error: insertError } = await supabase
      .from("rider_wallet_transactions")
      .insert({
        user_id: userId,
        amount: amount,
        type: "topup",
        status: "pending",
        payment_method: "zain_cash",
        description: serviceType,
        reference_id: orderId,
      });

    if (insertError) {
      console.error("[zaincash-init] Error saving transaction:", insertError);
      // نستمر — الدفع يمكن أن يعمل حتى لو فشل الحفظ
    }

    // حفظ mapping بين transaction_id و orderId للـ callback
    const { error: logError } = await supabase.from("api_usage_logs").insert({
      api_type: "zaincash_payment",
      endpoint: "/zaincash-init",
      metadata: {
        orderId,
        transactionId,
        userId,
        amount,
        status: "initiated",
      },
    });

    if (logError) {
      console.warn("[zaincash-init] Log insert failed:", logError);
    }

    console.log(`[zaincash-init] ✅ Payment initiated. Order: ${orderId}, TX: ${transactionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          orderId,
          transactionId,
          paymentUrl,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[zaincash-init] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
