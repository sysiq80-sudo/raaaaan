/**
 * ران - Layout للسائق
 * Wrapper component لجميع صفحات السائق مع شريط التنقل السفلي
 * يتحقق من وضع الصيانة من إعدادات الأدمن
 */

import React from "react";
import DriverBottomNav from "./DriverBottomNav";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

interface DriverLayoutProps {
  children: React.ReactNode;
}

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  const { isMaintenanceMode } = useMaintenanceMode();

  // عرض شاشة الصيانة إذا كان وضع الصيانة مفعّل
  if (isMaintenanceMode) {
    return <MaintenanceScreen />;
  }

  return (
    <>
      {children}
      {/* <DriverBottomNav /> — مخفية مؤقتاً */}
    </>
  );
};

export default DriverLayout;
