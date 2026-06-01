/**
 * RiderPageHeader — هيدر موحّد لصفحات القائمة الجانبية للراكب
 * مطابق لتصميم DriverPageHeader (زر رجوع + شعار + عنوان)
 */
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import logo from "@/assets/logo.png";

interface RiderPageHeaderProps {
  title: string;
  backTo?: string;
}

const RiderPageHeader = ({ title, backTo = "/rider" }: RiderPageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-[#0b1326] border-b border-[#5bdda6]/10 shadow-[0_4px_30px_rgba(91,221,166,0.05)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      dir="rtl"
    >
      <div className="relative flex items-center justify-between h-16 px-4">
        {/* يسار: زر الرجوع */}
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-1.5 bg-[#5bdda6] shadow-[0_0_20px_rgba(91,221,166,0.45)] hover:bg-[#4ecf99] active:bg-[#3dbe88] active:scale-90 transition-all rounded-xl px-3 py-2 z-10"
          aria-label="رجوع"
        >
          <ChevronLeft className="w-5 h-5 text-[#0b1326]" />
          <span className="text-sm font-bold text-[#0b1326] leading-none">رجوع</span>
        </button>

        {/* وسط: الشعار + عنوان الصفحة */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <img
            src={logo}
            alt="RAAN"
            className="w-10 h-10 rounded-xl shadow-[0_0_12px_rgba(91,221,166,0.3)]"
          />
          <span className="font-black text-white text-base tracking-wider">{title}</span>
        </div>

        {/* يمين: مساحة فارغة للموازنة */}
        <div className="w-20" aria-hidden="true" />
      </div>
    </header>
  );
};

export default RiderPageHeader;
