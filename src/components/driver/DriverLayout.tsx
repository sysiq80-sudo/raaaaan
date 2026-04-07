/**
 * ران - Layout للسائق
 * flex flex-col h-[100dvh] — No-Overlap Architecture
 * الشريط السفلي shrink-0 يدفع المحتوى للأعلى طبيعياً بدون fixed/padding hacks
 * مطابق لمعمارية RiderLayout
 */

import React, { useEffect } from "react";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import useCarMode from "@/hooks/useCarMode";
import CarModeQuickDock from "@/components/driver/CarModeQuickDock";


interface DriverLayoutProps {
  children: React.ReactNode;
}

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  const { isMaintenanceMode } = useMaintenanceMode();
  const isCarMode = useCarMode();

  useEffect(() => {
    document.body.classList.toggle("car-mode", isCarMode);
    return () => {
      document.body.classList.remove("car-mode");
    };
  }, [isCarMode]);

  // عرض شاشة الصيانة إذا كان وضع الصيانة مفعّل
  if (isMaintenanceMode) {
    return <MaintenanceScreen />;
  }

  return (
    <div
      className={`driver-luxury driver-page-shell pb-[env(safe-area-inset-bottom)] flex flex-col h-[100dvh] overflow-hidden ${isCarMode ? "car-mode-layout" : ""}`}
      data-driver-theme="dark-luxury-geometric"
      dir="rtl"
    >
      {/* المحتوى الرئيسي — يملأ المساحة المتبقية */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {isCarMode && <CarModeQuickDock />}
    </div>
  );
};

export default DriverLayout;
