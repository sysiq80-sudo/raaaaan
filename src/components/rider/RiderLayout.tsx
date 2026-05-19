/**
 * ران - Layout للراكب
 * flex flex-col h-[100dvh] — No-Overlap Architecture
 * الشريط السفلي shrink-0 يدفع المحتوى للأعلى طبيعياً بدون fixed/padding hacks
 * يتحقق من وضع الصيانة من إعدادات الأدمن
 */

import React from "react";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import RootLayout from "@/components/layout/RootLayout";

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
    <RootLayout className="rider-premium safe-area-inset">
      {children}
    </RootLayout>
  );
};

export default RiderLayout;
