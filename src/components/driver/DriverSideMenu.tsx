import { Link } from "react-router-dom";
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
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[59] bg-[#060e20]/80 backdrop-blur-sm"
            onClick={onClose}
          >
            <div className="absolute bottom-10 right-10 w-64 h-64 bg-[#5bdda6]/15 rounded-full blur-[100px]" />
            <div className="absolute top-10 left-10 w-96 h-96 bg-[#3e495d]/10 rounded-full blur-[120px]" />
          </motion.div>

          {/* Drawer Panel — Mobile Style Sidebar (Full Screen) */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed inset-0 z-[60] w-full h-full flex flex-col bg-[#0b1326] drop-shadow-[-20px_0_40px_rgba(0,0,0,0.5)] overflow-hidden outline-none touch-pan-y"
            dir="rtl"
          >
            {/* Non-Scrollable Container */}
            <div className="flex-1 overflow-hidden w-full h-full flex flex-col outline-none pb-4">
        {/* ═══ Header: Profile Card ═══ */}
        <div className="flex-shrink-0 px-5 pt-8 pb-4">
          <header className="flex flex-col p-5 bg-[#131b2e] rounded-3xl relative overflow-hidden" dir="rtl">
            {/* ديكور خلفي */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#5bdda6]/10 rounded-full translate-x-12 -translate-y-12 blur-3xl" />

            {/* User mentioned this container: div.flex.items-center */}
            <div className="flex items-center gap-4 relative z-10 w-full pr-2" dir="rtl">
              {/* الصورة الشخصية */}
              <div className="relative flex-shrink-0">
                <img
                  src={driverProfileImage || logo}
                  alt="السائق"
                  className="w-20 h-20 min-w-[80px] min-h-[80px] rounded-full object-cover ring-2 ring-[#5bdda6]/20 bg-[#2d3449]"
                  onError={(e) => {
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
                  style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
                >
                  {displayName}
                </h2>

              </div>

              {/* زر الإغلاق (مدمج في نهاية الصف المعاكس للبروفايل) */}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-[#2d3449]/40 flex-shrink-0 flex items-center justify-center active:scale-90 transition-all hover:bg-[#3d4a5d] outline-none focus:outline-none select-none tap-highlight-transparent"
                aria-label="إغلاق القائمة"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <X className="w-5 h-5 text-white/90" />
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
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
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
