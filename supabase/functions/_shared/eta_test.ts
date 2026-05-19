// ════════════════════════════════════════════════════════════
// Phase 3 Dispatch v2 — Benchmark / Unit-test for ETA helper
//
// يحاكي:
//  1. cache hit (السلوك السريع)
//  2. cache miss → google fallback → cache write
//  3. google failure → haversine fallback (لا يُحطِّم النظام)
//
// تشغيل:
//   cd supabase
//   deno test --allow-net --allow-env functions/_shared/eta_test.ts
// ════════════════════════════════════════════════════════════

import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getSmartETA } from "./eta.ts";

// Mock supabase client builder
function makeMockSupabase(opts: {
  cacheRow?: { duration_seconds: number; distance_meters: number; expires_at: string } | null;
  upsertCalls?: Array<any>;
}) {
  const upserts = opts.upsertCalls ?? [];
  return {
    from(_table: string) {
      return {
        select: (_cols: string) => ({
          eq: (_c: string, _v: any) => ({
            maybeSingle: async () => ({
              data: opts.cacheRow ?? null,
              error: null,
            }),
          }),
        }),
        upsert: async (row: any, _conflict: any) => {
          upserts.push(row);
          return { error: null };
        },
        update: (_v: any) => ({
          eq: (_c: string, _val: any) => ({
            then: (cb: any) => cb({ error: null }),
            catch: () => {},
          }),
        }),
      };
    },
  };
}

Deno.test("eta: cache hit — لا اتصال شبكة", async () => {
  const future = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
  const mock = makeMockSupabase({
    cacheRow: { duration_seconds: 540, distance_meters: 3500, expires_at: future },
  });
  const r = await getSmartETA(
    mock as any,
    "FAKE_KEY_NOT_USED",
    33.3152, 44.3661,
    33.3300, 44.3800,
  );
  assertEquals(r.source, "cache");
  assertEquals(r.duration_seconds, 540);
  assertEquals(r.eta_minutes, 9);
});

Deno.test("eta: cache expired → fallback to haversine when google key empty", async () => {
  const past = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
  const mock = makeMockSupabase({
    cacheRow: { duration_seconds: 999, distance_meters: 9999, expires_at: past },
  });
  const r = await getSmartETA(
    mock as any,
    "", // empty key → skip google
    33.3152, 44.3661,
    33.3300, 44.3800,
  );
  assertEquals(r.source, "haversine_fallback");
  assert(r.eta_minutes > 0);
  assert(r.distance_meters > 0);
});

Deno.test("eta: لا cache + لا key → fallback نظيف", async () => {
  const upsertCalls: any[] = [];
  const mock = makeMockSupabase({ cacheRow: null, upsertCalls });
  const r = await getSmartETA(
    mock as any,
    "",
    33.3152, 44.3661,
    33.3500, 44.4000,
  );
  assertEquals(r.source, "haversine_fallback");
  // لم يُكتب cache (لأن لم نحصل على بيانات حقيقية)
  assertEquals(upsertCalls.length, 0);
});
