import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/utils.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const respond = (body: unknown, status = 200) => jsonResponse(body, status, corsHeaders);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return respond({ success: false, error: 'UNAUTHORIZED_ADMIN' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return respond({ success: false, error: 'UNAUTHORIZED_ADMIN' }, 401);
    }

    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole) {
      return respond({ success: false, error: 'UNAUTHORIZED_ADMIN' }, 403);
    }

    const { action, request_id, admin_notes } = await req.json();

    console.log(`Processing wallet topup action: ${action} for request: ${request_id}`);

    if (action !== 'approve' && action !== 'reject') {
      return respond({ success: false, error: 'Invalid action' }, 400);
    }

    if (!request_id) {
      return respond({ success: false, error: 'Missing request_id' }, 400);
    }

    const rpcClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const rpcName = action === 'approve' ? 'approve_topup_request' : 'reject_topup_request';
    const { data, error: rpcError } = await rpcClient.rpc(rpcName, {
      p_request_id: request_id,
      p_admin_notes: admin_notes ?? null,
    });

    if (rpcError) {
      console.error(`Error executing ${rpcName}:`, rpcError);
      if (rpcError.code === '42501' || rpcError.message?.includes('UNAUTHORIZED_ADMIN')) {
        return respond({ success: false, error: 'UNAUTHORIZED_ADMIN' }, 403);
      }
      throw rpcError;
    }

    console.log(`Successfully processed topup request ${request_id} with action ${action}`);

    return respond(data ?? { success: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing wallet topup:', errorMessage);
    return respond({ success: false, error: errorMessage }, 500);
  }
});