import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAdminAuth = () => {
  // ✅ FIX: useRef لـ navigate يمنع إدراجه في deps array ويُوقف Maximum update depth
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate; // تحديث الـ ref بدون إعادة render

  const { user, userRole, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Timeout شبكة أمان: إذا تعطل AuthContext لأي سبب، نوقف التحميل بعد 6 ثواني
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 6000);

    if (authLoading) return; // انتظر AuthContext فقط (cache-first = فوري)

    clearTimeout(safetyTimer);

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      navigateRef.current("/auth"); // ✅ ref بدلاً من navigate المباشر
      return;
    }

    // ✅ استخدم الدور من AuthContext (cache-first) بدون طلب شبكة إضافي
    if (userRole === "admin") {
      setIsAdmin(true);
      setLoading(false);
    } else {
      // fallback: تحقق مباشر في حال AuthContext لم يكشف admin بعد
      const checkAdmin = async () => {
        try {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (data) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            navigateRef.current("/"); // ✅ ref بدلاً من navigate
          }
        } catch (err) {
          console.error("[useAdminAuth] Error checking admin role:", err);
          setIsAdmin(false);
        } finally {
          setLoading(false);
        }
      };
      checkAdmin();
    }

    return () => clearTimeout(safetyTimer);
    // ✅ CRITICAL: navigate خارج deps — يمنع Maximum update depth تماماً
  }, [user, userRole, authLoading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigateRef.current("/");
  };

  return { user, session: null, isAdmin, loading, handleLogout };
};
