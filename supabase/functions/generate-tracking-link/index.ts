/**
 * ران — Edge Function: إنشاء رابط تتبع الرحلة
 * Generate Tracking Link for Ride
 * 
 * يُستدعى من البوتات (Telegram/WhatsApp) لإنشاء رابط تتبع عام للرحلة
 * 
 * Input: { ride_id: UUID }
 * Output: { success: true, tracking_url: string, token: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// رابط الموقع الرئيسي
const SITE_URL = Deno.env.get("SITE_URL") || "https://rfrfrde.netlify.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ride_id } = await req.json();

    if (!ride_id) {
      return new Response(
        JSON.stringify({ success: false, error: "ride_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // استخدام الدالة المخزنة لإنشاء أو جلب التوكن
    const { data: token, error: rpcError } = await supabase
      .rpc("generate_ride_tracking_token", { p_ride_id: ride_id });

    if (rpcError) {
      console.error("[GenerateTrackingLink] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ success: false, error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tracking_url = `${SITE_URL}/track/${token}`;

    console.log(`[GenerateTrackingLink] Generated for ride ${ride_id}: ${tracking_url}`);

    return new Response(
      JSON.stringify({ success: true, tracking_url, token }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[GenerateTrackingLink] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
