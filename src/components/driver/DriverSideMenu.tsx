import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@supabase/supabase-js";
import {
  X,
  LogOut,
  History,
  Settings,
  Wallet,
  Gift,
  BarChart3,
  UserCircle,
  FileSearch,
  Phone,
  Star,
  BookOpen,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { getDriverDocumentUrl } from "@/utils/driverDocumentUrl";
import { preloadDriverRoute } from "@/lib/driverRoutePreload";

interface DriverSideMenuProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  driverName: string | null;
  driverPhone: string | null;
  driverProfileImage: string | null;
  driverStatus: string | null;
  vehicleType: string | null;
  rating: number;
  driverId?: string | null;
}

const DriverSideMenu = ({
  user,
  isOpen,
  onClose,
  onLogout,
  driverName,
  driverPhone,
  driverProfileImage,
  driverStatus,
  vehicleType,
  rating,
  driverId,
}: DriverSideMenuProps) => {

  const getStatusLabel = () => {
    switch (driverStatus) {
      case "approved":
        return "معتمد";
      case "pending":
        return "قيد المراجعة";
      case "rejected":
        return "مرفوض";
      case "suspended":
        return "موقوف";
      default:
        return "غير معروف";
    }
  };



  const displayName =
    driverName?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    driverPhone ||
    "كابتن";

  const [avatarUrl, setAvatarUrl] = useState<string>(logo);
  const [avatarFallbacks, setAvatarFallbacks] = useState<string[]>([]);

  // تحميل صورة السائق — يدعم المسارات النسبية + URLs القديمة (getPublicUrl)
  useEffect(() => {
    if (!isOpen || !driverProfileImage) {
      setAvatarUrl(logo);
      setAvatarFallbacks([]);
      return;
    }
    let cancelled = false;

    const resolveAvatar = async () => {
      try {
        const candidates: string[] = [];
        const signed = await getDriverDocumentUrl(driverProfileImage, 3600);
        if (signed) candidates.push(signed);

        if (!driverProfileImage.startsWith("http") && !driverProfileImage.startsWith("data:")) {
          const { data: publicData } = supabase
            .storage
            .from("driver-documents")
            .getPublicUrl(driverProfileImage);
          if (publicData?.publicUrl) candidates.push(publicData.publicUrl);
        } else {
          candidates.push(driverProfileImage);
        }

        const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));
        if (!cancelled) {
          if (uniqueCandidates.length > 0) {
            setAvatarUrl(uniqueCandidates[0]);
            setAvatarFallbacks(uniqueCandidates.slice(1));
          } else {
            setAvatarUrl(logo);
            setAvatarFallbacks([]);
          }
        }
      } catch (err) {
        console.error("Error resolving driver profile image:", err);
        if (!cancelled) {
          setAvatarUrl(logo);
          setAvatarFallbacks([]);
        }
      }
    };

    resolveAvatar();

    return () => {
      cancelled = true;
    };
  }, [driverProfileImage, isOpen]);

  // بناء قائمة العناصر مع الحفاظ على جميع الروابط الأصلية
  const gridItems = [
    { icon: <Wallet className="w-5 h-5" />, label: "الأرباح", href: "/driver/payments" },
    { icon: <Gift className="w-5 h-5" />, label: "المكافآت", href: "/driver/incentives" },
    { icon: <History className="w-5 h-5" />, label: "سجل الرحلات", href: "/driver/rides" },
    { icon: <BarChart3 className="w-5 h-5" />, label: "الإحصائيات", href: "/driver/statistics" },
    { icon: <Settings className="w-5 h-5" />, label: "الإعدادات", href: "/driver/settings" },
    { icon: <Phone className="w-5 h-5" />, label: "الدعم الفني", href: "/help" },
    ...(driverStatus !== "approved"
      ? [{ icon: <FileSearch className="w-5 h-5" />, label: "حالة الطلب", href: "/driver/application-status" }]
      : []),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "tween", duration: 0.14, ease: "easeOut" }}
            className="fixed inset-0 z-[59] bg-[#060e20]/80"
            onClick={onClose}
          />

          {/* Drawer Panel — Mobile Style Sidebar (Full Screen) */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-[60] w-full h-full flex flex-col bg-[#0b1326] shadow-lg overflow-hidden outline-none touch-pan-y"
            style={{ willChange: "transform" }}
            dir="rtl"
          >
            {/* Non-Scrollable Container */}
            <div className="flex-1 overflow-hidden w-full h-full flex flex-col outline-none pb-4">
        {/* ═══ Header: Profile Card ═══ */}
        <div className="flex-shrink-0 px-5 pt-8 pb-4">
          <header className="flex flex-col p-5 bg-[#131b2e] rounded-3xl relative overflow-hidden" dir="rtl">
            {/* User mentioned this container: div.flex.items-center */}
            <div className="flex items-center gap-4 relative z-10 w-full pr-2" dir="rtl">
              {/* الصورة الشخصية */}
              <div className="relative flex-shrink-0">
                <img
                  src={avatarUrl}
                  alt="السائق"
                  className="w-20 h-20 min-w-[80px] min-h-[80px] rounded-full object-cover ring-2 ring-[#5bdda6]/20 bg-[#2d3449]"
                  onError={(e) => {
                    if (avatarFallbacks.length > 0) {
                      const [nextAvatar, ...rest] = avatarFallbacks;
                      setAvatarUrl(nextAvatar);
                      setAvatarFallbacks(rest);
                      e.currentTarget.src = nextAvatar;
                      return;
                    }
                    e.currentTarget.src = logo;
                  }}
                />
                {driverStatus === "approved" && (
                  <span className="absolute bottom-0 right-0 w-5 h-5 bg-[#5bdda6] border-[3px] border-[#131b2e] rounded-full" />
                )}
              </div>

              {/* الاسم + التقييم */}
              <div className="flex flex-col min-w-0 flex-1 items-start text-right">
                <h2
                  className="text-lg font-bold text-white tracking-tight truncate w-full"
                  style={{ fontFamily: "Cairo, sans-serif" }}
                >
                  {displayName}
                </h2>

              </div>

              {/* زر الإغلاق (مدمج في نهاية الصف المعاكس للبروفايل) */}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/35 flex-shrink-0 flex items-center justify-center active:scale-90 transition-all hover:bg-red-500/30 text-red-400 outline-none focus:outline-none select-none tap-highlight-transparent"
                aria-label="إغلاق القائمة"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

          </header>
        </div>

        {/* ═══ Navigation Grid (Bento Style) ═══ */}
        <nav className="flex-[2] flex flex-col justify-center px-5 min-h-0">
          <div className="grid grid-cols-2 gap-2 h-full max-h-[85vh]">
            {/* ملفي الشخصي — Full Width بتدرج أخضر */}
            <Link
              to="/driver/profile"
              onClick={onClose}
              onPointerDown={() => preloadDriverRoute("/driver/profile")}
              onMouseEnter={() => preloadDriverRoute("/driver/profile")}
              className="col-span-2 flex items-center gap-4 p-4 bg-gradient-to-br from-[#5bdda6] to-[#27b481] text-[#0b1326] rounded-2xl transition-all duration-300 ease-out active:scale-[0.97] shadow-[0_0_15px_rgba(91,221,166,0.3)] outline-none focus:outline-none select-none tap-highlight-transparent"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="p-2 bg-[#0b1326]/10 rounded-xl">
                <UserCircle className="w-6 h-6" />
              </div>
              <span className="font-bold text-base">ملفي الشخصي</span>
            </Link>

            {/* Grid Items — Bento Cards */}
            {gridItems.map(({ icon, label, href }) => (
              <Link
                key={href}
                to={href}
                onClick={onClose}
                onPointerDown={() => preloadDriverRoute(href)}
                onMouseEnter={() => preloadDriverRoute(href)}
                className="flex flex-col gap-2 p-3 bg-[#171f33] rounded-2xl hover:bg-[#222a3d] transition-colors group active:scale-[0.97] duration-150 outline-none focus:outline-none select-none tap-highlight-transparent justify-center items-center text-center"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-[#2d3449] rounded-xl group-hover:bg-[#5bdda6]/20 transition-colors">
                  <span className="text-[#5bdda6]">{icon}</span>
                </div>
                <span className="text-sm font-semibold text-white/90">{label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* ═══ Footer: Logout ═══ */}
        <footer
          className="mt-auto border-t border-white/5 pt-4 flex-shrink-0"
          style={{ paddingBottom: "calc(var(--safe-area-bottom, 0px) + 16px)" }}
        >
          <button
            onClick={() => {
              onClose();
              setTimeout(() => onLogout(), 50);
            }}
            className="w-[calc(100%-2.5rem)] mx-5 flex items-center justify-center gap-3 py-4 bg-[#93000a] text-[#ffdad6] rounded-2xl font-bold transition-all hover:brightness-110 active:scale-[0.98] outline-none focus:outline-none select-none tap-highlight-transparent"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </button>


        </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DriverSideMenu;
