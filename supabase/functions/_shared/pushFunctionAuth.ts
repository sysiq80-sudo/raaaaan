import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PushAuthResult = { ok: true } | { ok: false; status: number; error: string };

/** إجراءات تستدعيها قاعدة البيانات عبر pg_net بمفتاح anon (سلوك قديم — يُفضّل لاحقاً إضافة x-internal-secret في الهجرات) */
const ANON_LEGACY_DB_ACTIONS = new Set([
  "notify_new_ride",
  "notify_rider",
  "notify_driver",
  "notify_driver_status_change",
]);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = atob(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * send-push-notification: يقبل
 * - X-Internal-Secret = INTERNAL_EDGE_SECRET
 * - Authorization: Bearer service_role (استدعاء من دوال حافة أخرى)
 * - Authorization: Bearer anon + إجراء legacy من DB triggers
 * - JWT مستخدم: subscribe/unsubscribe (ملكية)، notification_opened، send_campaign/notify_topic (أدمن)
 */
export async function authorizeSendPushRequest(
  req: Request,
  body: Record<string, unknown>,
  supabaseUrl: string,
  anonKey: string,
): Promise<PushAuthResult> {
  const internalSecret = Deno.env.get("INTERNAL_EDGE_SECRET");
  const headerSecret = req.headers.get("x-internal-secret");
  if (internalSecret && headerSecret === internalSecret) {
    return { ok: true };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "missing_authorization" };
  }
  const bearer = authHeader.slice(7);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && bearer === serviceKey) {
    return { ok: true };
  }

  // Also allow standard Supabase JWT service_role tokens.
  const jwtPayload = decodeJwtPayload(bearer);
  if (jwtPayload?.role === "service_role") {
    return { ok: true };
  }

  const action = body.action as string | undefined;
  if (action && ANON_LEGACY_DB_ACTIONS.has(action)) {
    if (bearer === anonKey) {
      return { ok: true };
    }

    // Backward compatibility for SQL triggers that still send an older anon JWT.
    // Restrict this bypass to the legacy internal actions only.
    if (jwtPayload?.role === "anon") {
      return { ok: true };
    }
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error } = await authClient.auth.getUser(bearer);
  if (error || !user) {
    return { ok: false, status: 401, error: "invalid_token" };
  }

  // Use service role for server-side authorization checks so RLS does not hide
  // the caller's roles/owned records after the JWT itself has been validated.
  const adminClient = serviceKey
    ? createClient(supabaseUrl, serviceKey)
    : authClient;

  if (action === "subscribe" || action === "unsubscribe") {
    const sub = body.subscription as { driver_id?: string; user_id?: string } | undefined;
    if (!sub) return { ok: false, status: 400, error: "missing_subscription" };
    if (sub.user_id && sub.user_id !== user.id) {
      return { ok: false, status: 403, error: "forbidden" };
    }
    if (sub.driver_id) {
      const { data: row } = await adminClient
        .from("drivers")
        .select("id")
        .eq("id", sub.driver_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row) return { ok: false, status: 403, error: "forbidden" };
    }
    return { ok: true };
  }

  if (action === "notification_opened") {
    return { ok: true };
  }

  if (action === "send_campaign" || action === "notify_topic") {
    const { data: role } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (role) return { ok: true };
    return { ok: false, status: 403, error: "admin_only" };
  }

  return { ok: false, status: 403, error: "forbidden_or_set_internal_edge_secret" };
}
