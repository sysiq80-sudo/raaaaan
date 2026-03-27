import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAdminAuth = () => {
  const navigate = useNavigate();
  const { user, userRole, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // انتظر AuthContext فقط (cache-first = فوري)

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      navigate("/auth");
      return;
    }

    // ✅ استخدم الدور من AuthContext (cache-first) بدون طلب شبكة إضافي
    if (userRole === "admin") {
      setIsAdmin(true);
      setLoading(false);
    } else {
      // fallback: تحقق مباشر في حال AuthContext لم يكشف admin بعد
      const checkAdmin = async () => {
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
          navigate("/");
        }
        setLoading(false);
      };
      checkAdmin();
    }
  }, [user, userRole, authLoading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return { user, session: null, isAdmin, loading, handleLogout };
};
