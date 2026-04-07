/**
 * ران - Layout للراكب
 * flex flex-col h-[100dvh] — No-Overlap Architecture
 * الشريط السفلي shrink-0 يدفع المحتوى للأعلى طبيعياً بدون fixed/padding hacks
 * يتحقق من وضع الصيانة من إعدادات الأدمن
 */

import React from "react";
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
    <div className="rider-premium flex flex-col h-[100dvh] overflow-hidden safe-area-inset">
      {/* المحتوى الرئيسي — يملأ المساحة المتبقية ويدعم السكرول */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};

export default RiderLayout;
