/**
 * RiderPageHeader — هيدر موحّد لجميع صفحات الراكب
 * نفس تصميم DriverPageHeader بألوان الراكب
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Menu, X, Bell } from "lucide-react";
import logo from "@/assets/logo.png";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import RiderNotificationsBell from "@/components/rider/RiderNotificationsBell";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface RiderPageHeaderProps {
  title: string;
  backTo?: string;
}

const RiderPageHeader = ({ title, backTo = "/rider" }: RiderPageHeaderProps) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, []);

  return (
    <>
      {/* ── الشريط العلوي ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14 px-4">

          {/* يسار: جرس الإشعارات */}
          <div className="flex items-center gap-2.5">
            {user && (
              <RiderNotificationsBell userId={user.id} />
            )}
          </div>

          {/* وسط: سهم رجوع + شعار + عنوان */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(backTo)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
              aria-label="رجوع"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
            <img src={logo} alt="RAAN" className="w-6 h-6 rounded-md" />
            <span className="font-bold text-white text-sm">{title}</span>
          </div>

          {/* يمين: زر القائمة */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="bg-white/10 backdrop-blur-md p-2.5 rounded-full border border-white/10 active:scale-95 transition-transform"
            aria-label="القائمة"
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </header>

      {/* ── القائمة الجانبية ── */}
      {menuOpen && (
        <RiderSideMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
};

export default RiderPageHeader;
