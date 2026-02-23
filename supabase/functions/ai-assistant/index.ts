// DeepSeek AI Proxy - Edge Function
// يتواصل مع DeepSeek API لمساعد الأدمن الذكي

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

let DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["DEEPSEEK_API_KEY"]);
    DEEPSEEK_API_KEY = cfg["DEEPSEEK_API_KEY"] || DEEPSEEK_API_KEY;
    _configLoaded = true;
    console.log("[ai-assistant] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[ai-assistant] ⚠️ Config load failed, using env fallback:", e);
  }
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompt للمساعد الذكي
const SYSTEM_PROMPT = `أنت مساعد ذكي لتطبيق "ران RAAN" - تطبيق تاكسي عراقي.

معلومات عن النظام:
- تطبيق لطلب سيارات الأجرة في العراق (بغداد حالياً)
- يدعم 4 أنواع سيارات: اقتصادي، مريح، فاخر، نسائي فقط
- التسعير: أجرة أساسية + (المسافة × سعر الكيلومتر) + (الانتظار × سعر الدقيقة)
- العمولة: 15% من كل رحلة
- طرق الدفع: نقد، زين كاش، آسيا حوالة، كي كارد

حالات الرحلة:
1. pending - في انتظار سائق
2. accepted - سائق قبل الطلب ومتجه للعميل
3. arrived - السائق وصل لموقع العميل
4. in_progress - الرحلة جارية
5. completed - اكتملت الرحلة
6. cancelled - ملغاة

أنت تساعد مدير النظام في:
- فهم البيانات والإحصائيات
- حل المشاكل التقنية
- اتخاذ القرارات الصحيحة
- شرح كيفية استخدام لوحة التحكم

أجب بلغة عربية واضحة ومختصرة. إذا أُعطيت بيانات، حللها وأعطِ توصيات.`;

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    await loadDynamicConfig();

    try {
        // Verify authentication
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "غير مصرح" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify the user is an admin
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "غير مصرح" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if user is admin
        const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .single();

        if (!roles) {
            return new Response(
                JSON.stringify({ error: "هذه الميزة للمدراء فقط" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request
        const { messages, includeStats } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: "الرسائل مطلوبة" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Optionally fetch system stats for context
        let statsContext = "";
        if (includeStats) {
            const stats = await fetchSystemStats(supabase);
            statsContext = `\n\nإحصائيات النظام الحالية:\n${stats}`;
        }

        // Prepare messages for DeepSeek
        const apiMessages = [
            { role: "system", content: SYSTEM_PROMPT + statsContext },
            ...messages
        ];

        // Check API key
        if (!DEEPSEEK_API_KEY) {
            return new Response(
                JSON.stringify({
                    error: "لم يتم تكوين مفتاح DeepSeek API",
                    assistant_message: "عذراً، لم يتم إعداد الذكاء الاصطناعي بعد. يرجى إضافة DEEPSEEK_API_KEY في إعدادات Supabase."
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Call DeepSeek API
        const response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("DeepSeek API error:", errorData);
            return new Response(
                JSON.stringify({
                    error: "خطأ في الاتصال بالذكاء الاصطناعي",
                    details: errorData
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await response.json();
        const assistantMessage = data.choices?.[0]?.message?.content || "لم أتمكن من فهم السؤال";

        return new Response(
            JSON.stringify({
                assistant_message: assistantMessage,
                usage: data.usage
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: "حدث خطأ غير متوقع" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// Fetch system statistics for AI context
async function fetchSystemStats(supabase: any): Promise<string> {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Get today's rides
        const { count: todayRides } = await supabase
            .from("rides")
            .select("*", { count: "exact", head: true })
            .gte("created_at", today);

        // Get active drivers
        const { count: activeDrivers } = await supabase
            .from("drivers")
            .select("*", { count: "exact", head: true })
            .eq("status", "approved")
            .eq("is_online", true);

        // Get total drivers
        const { count: totalDrivers } = await supabase
            .from("drivers")
            .select("*", { count: "exact", head: true })
            .eq("status", "approved");

        // Get pending rides
        const { count: pendingRides } = await supabase
            .from("rides")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending");

        // Get today's earnings
        const { data: todayEarnings } = await supabase
            .from("rides")
            .select("final_fare")
            .eq("status", "completed")
            .gte("created_at", today);

        const totalEarnings = todayEarnings?.reduce((sum: number, ride: any) => sum + (ride.final_fare || 0), 0) || 0;

        return `- رحلات اليوم: ${todayRides || 0}
- الرحلات المعلقة: ${pendingRides || 0}
- السائقين المتصلين: ${activeDrivers || 0} من ${totalDrivers || 0}
- إيرادات اليوم: ${totalEarnings.toLocaleString()} د.ع`;
    } catch (error) {
        console.error("Error fetching stats:", error);
        return "تعذر جلب الإحصائيات";
    }
}
