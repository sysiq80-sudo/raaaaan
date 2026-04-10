/**
 * ران — بوابة دفع ناس — استلام نتيجة الدفع (Callback)
 * NASS Payment Gateway — Payment Callback
 *
 * الإصلاحات الأمنية:
 * 1. التحقق من التوقيع (Signature Validation) لمنع callbacks مزيفة
 * 2. استخدام credit_wallet_safely() لمنع race condition على الرصيد
 * 3. حماية من إعادة المعالجة (Idempotency) عبر فحص الحالة + FOR UPDATE SKIP LOCKED
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfig, createServiceClient } from "../_shared/config.ts";
import { corsHeaders } from "../_shared/utils.ts";
interface NassCallbackData {
  terminal?: string;
  actionCode?: string;
  responseCode?: string;
  statusMsg?: string;
  card?: string;
  amount?: string;
  currency?: string;
  tranDate?: string;
  rrn?: string;
  intRef?: string;
  nonce?: string;
  signature?: string;
  orderId?: string;
  timestamp?: string;
}

// ════════════════════════════════════════
// التحقق من توقيع NASS (HMAC-SHA256)
// ════════════════════════════════════════

async function verifyNassSignature(
  callbackData: NassCallbackData,
  secretKey: string
): Promise<boolean> {
  if (!callbackData.signature) {
    console.warn('[nass-callback] No signature in callback data');
    return false;
  }

  try {
    // بناء النص المطلوب للتوقيع حسب وثائق NASS API v1.7
    // الحقول مرتبة أبجدياً ومفصولة بـ |
    const signatureFields = [
      callbackData.actionCode || '',
      callbackData.amount || '',
      callbackData.currency || '',
      callbackData.intRef || '',
      callbackData.nonce || '',
      callbackData.orderId || '',
      callbackData.responseCode || '',
      callbackData.rrn || '',
      callbackData.terminal || '',
      callbackData.tranDate || '',
    ].join('|');

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signatureFields)
    );

    const computedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // مقارنة آمنة زمنياً (constant-time comparison)
    if (computedSignature.length !== callbackData.signature.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ callbackData.signature.charCodeAt(i);
    }
    return result === 0;
  } catch (e) {
    console.error('[nass-callback] Signature verification error:', e);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the callback data from NASS
    let callbackData: NassCallbackData;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      callbackData = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      callbackData = Object.fromEntries(formData) as unknown as NassCallbackData;
    } else {
      // Try to parse URL parameters for GET requests
      const url = new URL(req.url);
      callbackData = Object.fromEntries(url.searchParams) as unknown as NassCallbackData;
    }

    console.log('[nass-callback] Callback received for order:', callbackData.orderId);

    // ════════════════════════════════════════
    // التحقق من التوقيع (Signature Validation)
    // ════════════════════════════════════════

    const svcClient = createServiceClient();
    const nassSecret = await getConfig(svcClient, 'NASS_SECRET_KEY');

    if (nassSecret) {
      const isValidSignature = await verifyNassSignature(callbackData, nassSecret);
      if (!isValidSignature) {
        console.error('[nass-callback] ⛔ Invalid signature! Possible forged callback.');

        // تسجيل المحاولة المشبوهة
        await supabase.from('api_usage_logs').insert({
          api_type: 'nass_payment_security',
          endpoint: '/nass-payment-callback',
          metadata: {
            orderId: callbackData.orderId,
            error: 'INVALID_SIGNATURE',
            ip: req.headers.get('x-forwarded-for') || 'unknown',
          }
        });

        return new Response(
          JSON.stringify({ success: false, error: 'Invalid signature' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
      console.log('[nass-callback] ✅ Signature verified');
    } else {
      console.warn('[nass-callback] ⚠️ NASS_SECRET_KEY not configured — skipping signature check');
    }

    // Extract fields based on NASS API v1.7 documentation
    const {
      orderId,
      actionCode,
      responseCode,
      statusMsg,
      amount,
      rrn,
      intRef,
      card,
    } = callbackData;

    // Determine if payment was successful
    // According to NASS docs: responseCode "00" and actionCode "0" means success
    const isSuccess = responseCode === '00' && actionCode === '0';
    const paymentStatus = isSuccess ? 'completed' : 'failed';

    console.log(`[nass-callback] Payment ${orderId}: ${isSuccess ? 'SUCCESS' : 'FAILED'} - ${statusMsg}`);

    // Find and update the transaction by reference_id (orderId)
    if (orderId) {
      const { data: transaction, error: fetchError } = await supabase
        .from('rider_wallet_transactions')
        .select('id, user_id, amount, status')
        .eq('reference_id', orderId)
        .single();

      if (fetchError) {
        console.error('[nass-callback] Error fetching transaction:', fetchError);
      }

      if (transaction) {
        // Only update if transaction is still pending
        if (transaction.status === 'pending') {
          // تحديث حالة المعاملة
          const { error: updateError } = await supabase
            .from('rider_wallet_transactions')
            .update({
              status: paymentStatus,
              verified_at: new Date().toISOString(),
              description: isSuccess 
                ? `شحن ناجح - RRN: ${rrn || 'N/A'} - البطاقة: ${card ? `****${card.slice(-4)}` : 'N/A'}` 
                : `فشل الدفع: ${statusMsg || 'Unknown error'}`
            })
            .eq('id', transaction.id);

          if (updateError) {
            console.error('[nass-callback] Error updating transaction:', updateError);
          }

          // إضافة الرصيد بشكل آمن عبر الدالة الذرية
          if (isSuccess && transaction.user_id) {
            const idempotencyKey = `nass_${orderId}`;
            const { data: walletResult, error: walletError } = await supabase.rpc(
              'credit_wallet_safely',
              {
                p_user_id: transaction.user_id,
                p_amount: transaction.amount,
                p_transaction_id: transaction.id,
                p_idempotency_key: idempotencyKey,
              }
            );

            if (walletError) {
              console.error('[nass-callback] Wallet credit error:', walletError);
            } else if (walletResult?.already_processed) {
              console.log(`[nass-callback] Transaction ${orderId} already credited — idempotency check passed`);
            } else if (walletResult?.success) {
              console.log(`[nass-callback] ✅ Wallet updated: ${walletResult.new_balance} IQD`);
            } else {
              console.error('[nass-callback] Wallet credit failed:', walletResult?.error);
            }
          }
        } else {
          console.log(`[nass-callback] Transaction ${orderId} already processed: ${transaction.status}`);
        }
      } else {
        console.warn(`[nass-callback] Transaction not found for order: ${orderId}`);
      }
    }

    // Log the callback for debugging and auditing
    await supabase.from('api_usage_logs').insert({
      api_type: 'nass_payment',
      endpoint: '/nass-payment-callback',
      metadata: {
        orderId,
        responseCode,
        actionCode,
        statusMsg,
        amount,
        rrn,
        intRef,
        card: card ? `****${card.slice(-4)}` : null,
        success: isSuccess
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Callback processed successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[nass-callback] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
