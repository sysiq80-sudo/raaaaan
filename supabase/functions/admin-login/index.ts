import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const { email, password } = await req.json();

    // التحقق من المدخلات
    if (!email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "البريد الإلكتروني وكلمة المرور مطلوبان",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // استخدام service_role للوصول لجدول controller (محمي بـ RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // التحقق من بيانات الأدمن في جدول controller
    const { data: controller, error: queryError } = await supabase.rpc(
      "verify_controller_login",
      {
        p_email: email.toLowerCase().trim(),
        p_password: password,
      }
    );

    if (queryError) {
      console.error("Controller login query error:", queryError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "حدث خطأ في التحقق من البيانات",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!controller || controller.length === 0 || !controller[0].is_valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = controller[0];

    // ====================================================
    // مزامنة مع auth.users لضمان عمل RLS policies
    // ====================================================
    const adminEmail = email.toLowerCase().trim();
    const adminPassword = password;
    let authUserId: string | null = null;

    // محاولة إنشاء المستخدم — إذا كان موجوداً يفشل بـ duplicate
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { full_name: admin.full_name, is_controller: true },
      });

    if (!createError && newUser?.user) {
      authUserId = newUser.user.id;
    } else {
      // المستخدم موجود — نبحث عنه
      const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = allUsers?.users?.find(
        (u) => u.email === adminEmail
      );
      if (found) {
        authUserId = found.id;
        // تزامن كلمة المرور
        await supabase.auth.admin.updateUserById(authUserId, {
          password: adminPassword,
        });
      }
    }

    // تأكد من وجود دور admin في user_roles
    if (authUserId) {
      await supabase.from("user_roles").upsert(
        { user_id: authUserId, role: "admin" },
        { onConflict: "user_id,role" }
      );
    }

    // تحديث last_login_at في controller
    await supabase
      .from("controller")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", admin.id);

    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Admin login error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "حدث خطأ غير متوقع",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
