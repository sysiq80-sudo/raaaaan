import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AdminAuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
}

export const useAdminAuth = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    session: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const checkAdminRole = async (userId: string) => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      return !error && !!data;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(async () => {
            const isAdmin = await checkAdminRole(session.user.id);
            setState({
              user: session.user,
              session,
              isAdmin,
              loading: false,
            });

            if (!isAdmin) {
              navigate("/");
            }
          }, 0);
        } else {
          setState({
            user: null,
            session: null,
            isAdmin: false,
            loading: false,
          });
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const isAdmin = await checkAdminRole(session.user.id);
        setState({
          user: session.user,
          session,
          isAdmin,
          loading: false,
        });

        if (!isAdmin) {
          navigate("/");
        }
      } else {
        setState({
          user: null,
          session: null,
          isAdmin: false,
          loading: false,
        });
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return { ...state, handleLogout };
};
