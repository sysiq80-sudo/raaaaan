/**
 * RiderPageHeader — هيدر موحّد لجميع صفحات الراكب — Dark Luxury / Light Mode
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
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
      {/* الشريط العلوي */}
      <header
        className="fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300"
        style={{
          background: 'var(--raan-bg)',
          borderBottom: '1px solid var(--raan-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
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
              className="p-1.5 rounded-xl active:scale-90 transition-all"
              style={{
                background: 'var(--raan-accent-dim)',
                border: '1px solid var(--raan-accent-glow)',
              }}
              aria-label="رجوع"
            >
              <ArrowRight className="w-4 h-4" style={{ color: 'var(--raan-accent)' }} />
            </button>
            <img
              src={logo}
              alt="RAAN"
              className="w-8 h-8 rounded-xl shadow-[0_0_10px_rgba(91,221,166,0.25)]"
            />
            <span className="font-bold text-sm" style={{ color: 'var(--raan-text)' }}>{title}</span>
          </div>

          {/* يمين: زر القائمة */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="backdrop-blur-md p-2.5 rounded-xl active:scale-95 transition-transform"
            style={{
              background: 'var(--raan-accent-dim)',
              border: '1px solid var(--raan-border)',
            }}
            aria-label="القائمة"
          >
            {menuOpen ? (
              <X className="w-5 h-5" style={{ color: 'var(--raan-accent)' }} />
            ) : (
              <Menu className="w-5 h-5" style={{ color: 'var(--raan-text-sub)' }} />
            )}
          </button>
        </div>
      </header>

      {/* القائمة الجانبية */}
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
