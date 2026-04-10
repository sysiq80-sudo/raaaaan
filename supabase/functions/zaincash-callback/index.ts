/**
 * ران — بوابة دفع زين كاش — استلام نتيجة الدفع (Callback)
 * ZainCash Payment Gateway — Payment Callback
 *
 * التدفق:
 * 1. بعد دفع المستخدم، ZainCash يحوّل المتصفح لهذا الرابط مع ?token=JWT
 * 2. نفك تشفير الـ JWT بمفتاح التاجر
 * 3. نتحقق من حالة الدفع (success/failed)
 * 4. نحدّث المعاملة في قاعدة البيانات
 * 5. إذا نجح الدفع → نضيف الرصيد للمحفظة
 * 6. نحوّل المستخدم لصفحة النتيجة في التطبيق
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

// ════════════════════════════════════════
// إعدادات ديناميكية
// ════════════════════════════════════════

let zaincashSecret = "";
let siteUrl = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["ZAINCASH_SECRET", "SITE_URL"]);
    zaincashSecret = cfg["ZAINCASH_SECRET"] || Deno.env.get("ZAINCASH_SECRET") || "";
    siteUrl = cfg["SITE_URL"] || Deno.env.get("SITE_URL") || "https://raan.app";
    _configLoaded = true;
    console.log("[zaincash-callback] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[zaincash-callback] ⚠️ Config load failed:", e);
    zaincashSecret = Deno.env.get("ZAINCASH_SECRET") || "";
    siteUrl = Deno.env.get("SITE_URL") || "https://raan.app";
  }
}

// ════════════════════════════════════════
// إنشاء مفتاح HMAC للتحقق
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
// واجهة بيانات نتيجة ZainCash
// ════════════════════════════════════════

interface ZainCashResult {
  status: string; // "success" | "failed" | "pending"
  orderId: string;
  id: string; // transaction ID
  amount?: number;
  msisdn?: string;
  serviceType?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

serve(async (req) => {
  await loadDynamicConfig();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // استخراج الـ token من URL أو body
    let resultToken: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      resultToken = url.searchParams.get("token");
    } else if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json();
        resultToken = body.token;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        resultToken = formData.get("token") as string;
      } else {
        // محاولة قراءة النص مباشرة
        const text = await req.text();
        const params = new URLSearchParams(text);
        resultToken = params.get("token");
      }
    }

    if (!resultToken) {
      console.error("[zaincash-callback] No token received");
      // تحويل للتطبيق مع خطأ
      return Response.redirect(
        `${siteUrl}/payment/result?status=error&error_message=no_token`,
        302
      );
    }

    if (!zaincashSecret) {
      console.error("[zaincash-callback] ZainCash secret not configured");
      return Response.redirect(
        `${siteUrl}/payment/result?status=error&error_message=config_error`,
        302
      );
    }

    // ════════════════════════════════════════
    // فك تشفير والتحقق من JWT
    // ════════════════════════════════════════

    console.log("[zaincash-callback] Verifying callback JWT...");

    let paymentResult: ZainCashResult;
    try {
      const key = await createHmacKey(zaincashSecret);
      paymentResult = (await verify(resultToken, key)) as unknown as ZainCashResult;
    } catch (jwtError) {
      console.error("[zaincash-callback] JWT verification failed:", jwtError);
      return Response.redirect(
        `${siteUrl}/payment/result?status=error&error_message=invalid_signature`,
        302
      );
    }

    console.log("[zaincash-callback] Payment result:", JSON.stringify({
      status: paymentResult.status,
      orderId: paymentResult.orderId,
      amount: paymentResult.amount,
    }));

    // ════════════════════════════════════════
    // التحقق من انتهاء صلاحية الـ JWT (منع إعادة الاستخدام)
    // ════════════════════════════════════════

    if (paymentResult.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (now > paymentResult.exp) {
        console.error("[zaincash-callback] ⛔ JWT expired — possible replay attack");
        await supabase.from("api_usage_logs").insert({
          api_type: "zaincash_security",
          endpoint: "/zaincash-callback",
          metadata: {
            orderId: paymentResult.orderId,
            error: "JWT_EXPIRED_REPLAY",
            exp: paymentResult.exp,
            now,
          },
        });
        return Response.redirect(
          `${siteUrl}/payment/result?status=error&error_message=expired_token`,
          302
        );
      }
    }

    const isSuccess = paymentResult.status === "success";
    const orderId = paymentResult.orderId;
    const transactionId = paymentResult.id;

    if (!orderId) {
      console.error("[zaincash-callback] No orderId in result");
      return Response.redirect(
        `${siteUrl}/payment/result?status=error&error_message=missing_order_id`,
        302
      );
    }

    // ════════════════════════════════════════
    // تحديث المعاملة في قاعدة البيانات
    // ════════════════════════════════════════

    const paymentStatus = isSuccess ? "completed" : "failed";

    const { data: transaction, error: fetchError } = await supabase
      .from("rider_wallet_transactions")
      .select("id, user_id, amount, status")
      .eq("reference_id", orderId)
      .single();

    if (fetchError) {
      console.error("[zaincash-callback] Transaction fetch error:", fetchError);
    }

    if (transaction && transaction.status === "pending") {
      // تحديث حالة المعاملة
      const { error: updateError } = await supabase
        .from("rider_wallet_transactions")
        .update({
          status: paymentStatus,
          description: isSuccess
            ? `شحن ناجح عبر زين كاش - TX: ${transactionId}`
            : `فشل الدفع عبر زين كاش: ${paymentResult.status}`,
        })
        .eq("id", transaction.id);

      if (updateError) {
        console.error("[zaincash-callback] Transaction update error:", updateError);
      }

      // إذا نجح الدفع → إضافة الرصيد بشكل آمن
      if (isSuccess && transaction.user_id) {
        const idempotencyKey = `zaincash_${orderId}`;
        const { data: walletResult, error: walletRpcError } = await supabase.rpc(
          'credit_wallet_safely',
          {
            p_user_id: transaction.user_id,
            p_amount: transaction.amount,
            p_transaction_id: transaction.id,
            p_idempotency_key: idempotencyKey,
          }
        );

        if (walletRpcError) {
          console.error("[zaincash-callback] Wallet credit RPC error:", walletRpcError);
        } else if (walletResult?.already_processed) {
          console.log(
            `[zaincash-callback] Transaction ${orderId} already credited — idempotency guard`
          );
        } else if (walletResult?.success) {
          console.log(
            `[zaincash-callback] ✅ Wallet updated for ${transaction.user_id}: ${walletResult.new_balance} IQD`
          );
        } else {
          console.error("[zaincash-callback] Wallet credit failed:", walletResult?.error);
        }
      }
    } else if (transaction) {
      console.log(
        `[zaincash-callback] Transaction ${orderId} already processed: ${transaction.status}`
      );
    } else {
      console.warn(`[zaincash-callback] Transaction not found for order: ${orderId}`);
    }

    // تسجيل الـ callback
    await supabase.from("api_usage_logs").insert({
      api_type: "zaincash_payment",
      endpoint: "/zaincash-callback",
      metadata: {
        orderId,
        transactionId,
        status: paymentResult.status,
        amount: paymentResult.amount,
        success: isSuccess,
      },
    });

    // ════════════════════════════════════════
    // تحويل المستخدم لصفحة النتيجة
    // ════════════════════════════════════════

    const redirectParams = new URLSearchParams({
      status: isSuccess ? "success" : "failed",
      order_id: orderId,
      amount: String(paymentResult.amount || transaction?.amount || 0),
    });

    if (!isSuccess) {
      redirectParams.set("error_message", paymentResult.status || "payment_failed");
    }

    return Response.redirect(
      `${siteUrl}/payment/result?${redirectParams.toString()}`,
      302
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[zaincash-callback] Error:", error);

    return Response.redirect(
      `${siteUrl}/payment/result?status=error&error_message=${encodeURIComponent(errorMessage)}`,
      302
    );
  }
});
