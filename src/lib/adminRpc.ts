/**
 * ران — Admin RPC Proxy Client
 * دالة مساعدة لاستدعاء RPCs الحساسة عبر Edge Function بدل .rpc() مباشرة
 *
 * الاستخدام:
 *   const { data, error } = await adminRpc('delete_ride_cascade', { ride_id_param: '...' });
 */

import { supabase } from "@/integrations/supabase/client";

interface AdminRpcResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export async function adminRpc<T = unknown>(
  rpc: string,
  params: Record<string, unknown> = {}
): Promise<AdminRpcResult<T>> {
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      "admin-rpc-proxy",
      { body: { rpc, params } }
    );

    if (fnError) {
      // Edge Function invocation error
      let errorMsg = "حدث خطأ في الاتصال بالخادم";
      try {
        const ctx = (fnError as any)?.context;
        if (ctx && typeof ctx.json === "function") {
          const errBody = await ctx.json();
          if (errBody?.error) errorMsg = errBody.error;
        }
      } catch { /* ignore */ }
      return { data: null, error: { message: errorMsg } };
    }

    // Edge Function returned an error response
    if (fnData?.error) {
      return { data: null, error: { message: fnData.error, code: fnData.code } };
    }

    return { data: (fnData?.data ?? fnData) as T, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || "خطأ غير متوقع" } };
  }
}
