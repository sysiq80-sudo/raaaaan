/**
 * ران - Edge Function لتحديث بيانات المستخدم (Admin Only)
 * يستخدم لتغيير كلمة المرور من لوحة التحكم
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getCorsHeaders } from "../_shared/utils.ts";
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // إنشاء Supabase Client مع صلاحيات الـ Service Role
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // التحقق من المستخدم الحالي (يجب أن يكون admin)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "غير مصرح" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "المستخدم غير موجود" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // التحقق من صلاحية admin باستخدام جدول user_roles
        const { data: roleData } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

        if (!roleData) {
            return new Response(
                JSON.stringify({ error: "غير مصرح - يتطلب صلاحية أدمن" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // الحصول على البيانات
        const { userId, password, email } = await req.json();

        if (!userId) {
            return new Response(
                JSON.stringify({ error: "userId مطلوب" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // تحديث المستخدم
        const updateData: any = {};

        if (password && password.length >= 6) {
            updateData.password = password;
        }

        if (email) {
            updateData.email = email;
        }

        if (Object.keys(updateData).length === 0) {
            return new Response(
                JSON.stringify({ error: "لا توجد بيانات للتحديث" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            updateData
        );

        if (error) {
            console.error("Error updating user:", error);
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "تم تحديث بيانات المستخدم بنجاح",
                updated: Object.keys(updateData)
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "حدث خطأ غير متوقع" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
