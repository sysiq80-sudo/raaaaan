/**
 * ران - Layout للسائق
 * Wrapper component لجميع صفحات السائق مع شريط التنقل السفلي
 * يتحقق من وضع الصيانة من إعدادات الأدمن
 */

import React from "react";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

interface DriverLayoutProps {
  children: React.ReactNode;
}

import { motion } from "framer-motion";

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  const { isMaintenanceMode } = useMaintenanceMode();

  // عرض شاشة الصيانة إذا كان وضع الصيانة مفعّل
  if (isMaintenanceMode) {
    return <MaintenanceScreen />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20, scale: 0.99 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="driver-luxury driver-page-shell w-full h-full" 
      data-driver-theme="dark-luxury-geometric"
    >
      {children}
      {/* <DriverBottomNav /> — مخفية مؤقتاً */}
    </motion.div>
  );
};

export default DriverLayout;
