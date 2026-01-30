// Edge Function: حذف حساب المستخدم مع جميع البيانات
// المسار: supabase/functions/delete-user-account/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // التحقق من المصادقة
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, userType, reason } = await req.json();

    // التحقق من أن المستخدم يحذف حسابه الخاص
    if (userId !== user.id) {
      return new Response(
        JSON.stringify({ error: "لا يمكنك حذف حساب مستخدم آخر" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🗑️ بدء حذف حساب ${userType}: ${userId}`);

    // 1. حذف البيانات حسب نوع المستخدم
    if (userType === "driver") {
      // حذف بيانات السائق
      
      // الصور من Storage
      const { data: storageFiles } = await supabaseClient.storage
        .from("driver-documents")
        .list(`${userId}`);
      
      if (storageFiles && storageFiles.length > 0) {
        const filePaths = storageFiles.map(file => `${userId}/${file.name}`);
        await supabaseClient.storage
          .from("driver-documents")
          .remove(filePaths);
      }

      // صورة Avatar
      const { data: avatarFiles } = await supabaseClient.storage
        .from("avatars")
        .list(`drivers/${userId}`);
      
      if (avatarFiles && avatarFiles.length > 0) {
        const avatarPaths = avatarFiles.map(file => `drivers/${userId}/${file.name}`);
        await supabaseClient.storage
          .from("avatars")
          .remove(avatarPaths);
      }

      // حذف سجلات السائق من الجداول
      await supabaseClient.from("driver_documents").delete().eq("driver_id", userId);
      await supabaseClient.from("driver_earnings").delete().eq("driver_id", userId);
      await supabaseClient.from("driver_stats").delete().eq("driver_id", userId);
      await supabaseClient.from("driver_edit_requests").delete().eq("driver_id", userId);
      await supabaseClient.from("delay_alerts").delete().eq("driver_id", userId);
      
      // تعيين driver_id = NULL في الرحلات القديمة (للحفاظ على السجل)
      await supabaseClient
        .from("rides")
        .update({ driver_id: null })
        .eq("driver_id", userId);

      // حذف سجل السائق الرئيسي
      await supabaseClient.from("drivers").delete().eq("id", userId);

    } else if (userType === "rider") {
      // حذف بيانات الراكب

      // صورة Avatar
      const { data: avatarFiles } = await supabaseClient.storage
        .from("avatars")
        .list(`riders/${userId}`);
      
      if (avatarFiles && avatarFiles.length > 0) {
        const avatarPaths = avatarFiles.map(file => `riders/${userId}/${file.name}`);
        await supabaseClient.storage
          .from("avatars")
          .remove(avatarPaths);
      }

      // حذف الأماكن المحفوظة
      await supabaseClient.from("saved_places").delete().eq("user_id", userId);
      
      // حذف الرحلات المجدولة
      await supabaseClient.from("scheduled_rides").delete().eq("rider_id", userId);
      
      // حذف تنبيهات التأخير
      await supabaseClient.from("delay_alerts").delete().eq("rider_id", userId);
      
      // تعيين rider_id = NULL في الرحلات القديمة
      await supabaseClient
        .from("rides")
        .update({ rider_id: null })
        .eq("rider_id", userId);
    }

    // 2. حذف البيانات المشتركة
    await supabaseClient.from("notifications").delete().eq("user_id", userId);
    await supabaseClient.from("emergency_alerts").delete().eq("user_id", userId);
    await supabaseClient.from("ride_share_links").delete().eq("created_by", userId);
    
    // حذف الملف الشخصي
    await supabaseClient.from("profiles").delete().eq("id", userId);

    // 3. تسجيل الحذف في سجل النظام
    await supabaseClient.from("account_deletions").insert({
      user_id: userId,
      user_type: userType,
      reason: reason || "لم يذكر سبب",
      deleted_at: new Date().toISOString(),
    });

    // 4. حذف المستخدم من Auth (آخر خطوة)
    const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error("خطأ في حذف Auth user:", deleteAuthError);
      throw new Error("فشل حذف المستخدم من النظام");
    }

    console.log(`✅ تم حذف حساب ${userType}: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "تم حذف الحساب بنجاح" 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("❌ خطأ في حذف الحساب:", error);
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء حذف الحساب";
    return new Response(
      JSON.stringify({ 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
