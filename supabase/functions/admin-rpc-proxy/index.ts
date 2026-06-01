/**
 * ران — Admin RPC Proxy
 * Edge Function تعمل كـ proxy للـ RPCs الحساسة المحمية بـ service_role
 *
 * المشكلة: migration سحبت EXECUTE من authenticated لـ RPCs مالية/حساسة
 * لكن الواجهة الأمامية تستدعيها مباشرة بـ authenticated JWT
 *
 * الحل: هذا الـ proxy يتحقق من:
 * 1. JWT صالح (المستخدم مسجل دخول)
 * 2. المستخدم لديه role = admin في user_roles
 * 3. الـ RPC المطلوب ضمن القائمة المسموحة
 * ثم يستدعي الـ RPC بـ service_role
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getAuthUser, corsPreflightResponse } from "../_shared/utils.ts";

// ════════════════════════════════════════════════════════════
// RPCs المسموح استدعاؤها عبر هذا الـ proxy
// ════════════════════════════════════════════════════════════

const ALLOWED_RPCS: Record<string, {
  description: string;
  requiredRole: string[];
}> = {
  delete_ride_cascade: {
    description: "حذف رحلة مع كل البيانات المرتبطة",
    requiredRole: ["admin"],
  },
  admin_delete_landmarks_by_governorate: {
    description: "حذف معالم محافظة كاملة",
    requiredRole: ["admin"],
  },
  admin_complete_withdrawal: {
    description: "إتمام طلب سحب للسائق",
    requiredRole: ["admin"],
  },
};

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return corsPreflightResponse(headers);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. التحقق من JWT ──
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED: invalid or missing token" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ── 2. قراءة الطلب ──
    const body = await req.json();
    const { rpc, params } = body;

    if (!rpc || typeof rpc !== "string") {
      return new Response(
        JSON.stringify({ error: "BAD_REQUEST: 'rpc' field is required" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ── 3. التحقق من أن الـ RPC مسموح ──
    const rpcConfig = ALLOWED_RPCS[rpc];
    if (!rpcConfig) {
      return new Response(
        JSON.stringify({ error: `FORBIDDEN: RPC '${rpc}' is not allowed via proxy` }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ── 4. التحقق من الدور في قاعدة البيانات ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.id)
      .in("role", rpcConfig.requiredRole)
      .maybeSingle();

    if (roleError || !roleData) {
      console.error(`[admin-rpc-proxy] Role check failed for ${authUser.id}:`, roleError);
      return new Response(
        JSON.stringify({ error: "FORBIDDEN: insufficient permissions" }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ── 5. استدعاء الـ RPC بـ service_role ──
    console.log(`[admin-rpc-proxy] ${authUser.email || authUser.id} → ${rpc}(${JSON.stringify(params || {})?.substring(0, 200)})`);

    const { data, error } = await adminClient.rpc(rpc, params || {});

    if (error) {
      console.error(`[admin-rpc-proxy] RPC error:`, error);
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // ── 6. تسجيل العملية في سجل التدقيق ──
    try {
      await adminClient.from("admin_audit_logs").insert({
        admin_id: authUser.id,
        action_type: `rpc_proxy:${rpc}`,
        entity_id: params?.ride_id_param || params?.p_driver_id || params?.p_request_id || params?.governorate_id_param || null,
        old_data: null,
        new_data: { rpc, params: params || {}, result_preview: JSON.stringify(data)?.substring(0, 500) },
      });
    } catch (auditErr) {
      // لا نفشل العملية بسبب فشل التدقيق — نسجل التحذير فقط
      console.warn("[admin-rpc-proxy] Audit log failed:", auditErr);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[admin-rpc-proxy] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
