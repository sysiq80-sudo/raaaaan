/**
 * ران - Layout للراكب
 * flex flex-col h-[100dvh] — No-Overlap Architecture
 * الشريط السفلي shrink-0 يدفع المحتوى للأعلى طبيعياً بدون fixed/padding hacks
 * يتحقق من وضع الصيانة من إعدادات الأدمن
 */

import React from "react";
import RiderBottomNav from "./RiderBottomNav";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

interface RiderLayoutProps {
  children: React.ReactNode;
}

const RiderLayout: React.FC<RiderLayoutProps> = ({ children }) => {
  const { isMaintenanceMode } = useMaintenanceMode();

  // عرض شاشة الصيانة إذا كان وضع الصيانة مفعّل
  if (isMaintenanceMode) {
    return <MaintenanceScreen />;
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* المحتوى الرئيسي — يملأ المساحة المتبقية ويدعم السكرول */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>

      {/* شريط التنقل — shrink-0 يدفع المحتوى للأعلى بدون تراكب */}
      <RiderBottomNav />
    </div>
  );
};

export default RiderLayout;
