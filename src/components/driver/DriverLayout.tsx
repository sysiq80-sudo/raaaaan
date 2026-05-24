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
import RootLayout from "@/components/layout/RootLayout";


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
    <RootLayout
      className={`driver-luxury driver-page-shell ${isCarMode ? "car-mode-layout" : ""}`}
      mainClassName="pb-[env(safe-area-inset-bottom)]"
      dir="rtl"
    >
      <div data-driver-theme="dark-luxury-geometric" className="h-full">
        {children}
      </div>
    </RootLayout>
  );
};

export default DriverLayout;
