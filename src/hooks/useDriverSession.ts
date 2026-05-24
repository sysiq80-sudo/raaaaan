/**
 * useDriverSession — Hook مشترك لجلب بيانات السائق مع كاش في الذاكرة
 *
 * - يستخدم getSession() مرة واحدة بدلاً من onAuthStateChange في الصفحات الفرعية
 * - يُخزّن النتيجة في module-level cache تبقى طوال عمر الجلسة
 * - يُلغي الطلب تلقائياً عند مغادرة الصفحة (AbortController)
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface DriverSessionData {
  driverId: string;
  userId: string;
  name: string | null;
  phone: string | null;
  profileImage: string | null;
  status: string | null;
  vehicleType: string | null;
  rating: number;
}

// ── كاش على مستوى الوحدة يبقى طوال عمر الجلسة ──
let _cache: DriverSessionData | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق

export function clearDriverSessionCache() {
  _cache = null;
  _cacheTime = 0;
}

interface UseDriverSessionOptions {
  redirectTo?: string; // مسار الإعادة عند عدم الجلسة — default: /driver/auth
}

interface UseDriverSessionResult {
  driver: DriverSessionData | null;
  loading: boolean;
  error: string | null;
}

export function useDriverSession(
  options: UseDriverSessionOptions = {}
): UseDriverSessionResult {
  const { redirectTo = "/driver/auth" } = options;
  const navigate = useNavigate();

  const [driver, setDriver] = useState<DriverSessionData | null>(_cache);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // إذا الكاش صالح → لا نحتاج طلباً
    if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) {
      setDriver(_cache);
      setLoading(false);
      return;
    }

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const load = async () => {
      try {
        // 1) جلب الجلسة الحالية (لا subscription)
        const { data: { session } } = await supabase.auth.getSession();
        if (signal.aborted) return;

        if (!session?.user) {
          navigate(redirectTo, { replace: true });
          return;
        }

        // 2) جلب بيانات السائق
        const { data: d, error: dErr } = await supabase
          .from("drivers")
          .select("id, full_name, phone, profile_image_url, status, vehicle_type, rating")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (signal.aborted) return;
        if (dErr) throw dErr;

        if (!d) {
          navigate(redirectTo, { replace: true });
          return;
        }

        const result: DriverSessionData = {
          driverId:     (d as any).id,
          userId:       session.user.id,
          name:         (d as any).full_name,
          phone:        (d as any).phone,
          profileImage: (d as any).profile_image_url,
          status:       (d as any).status,
          vehicleType:  (d as any).vehicle_type,
          rating:       (d as any).rating ?? 5.0,
        };

        // تخزين في الكاش
        _cache = result;
        _cacheTime = Date.now();

        setDriver(result);
      } catch (err: any) {
        if (!signal.aborted) {
          console.error("[useDriverSession]", err);
          setError(err?.message ?? "خطأ في تحميل البيانات");
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    load();

    return () => {
      abortRef.current?.abort();
    };
  }, [navigate, redirectTo]);

  return { driver, loading, error };
}
