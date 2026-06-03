/**
 * ران - Layout للسائق
 * flex flex-col h-[100dvh] — No-Overlap Architecture
 * الشريط السفلي shrink-0 يدفع المحتوى للأعلى طبيعياً بدون fixed/padding hacks
 * مطابق لمعمارية RiderLayout
 *
 * الانتقالات:
 * • صفحات الـ Bottom Tabs → fade خفيف
 * • الصفحات الداخلية (profile, settings, etc.) → slide RTL مثل iOS
 */

import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import useCarMode from "@/hooks/useCarMode";
import RootLayout from "@/components/layout/RootLayout";
import { useDriverBackgroundGeolocation } from "@/hooks/useDriverBackgroundGeolocation";

/** صفحات الـ Bottom Tabs للسائق → fade (لا slide) */
const DRIVER_TAB_ROUTES = new Set([
  "/driver/rides",
  "/driver/finance",
  "/driver/statistics",
  "/driver/profile",
]);

const DRIVER_MAP_ROUTES = new Set([
  "/driver",
]);

interface DriverLayoutProps {
  children: React.ReactNode;
}

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  useDriverBackgroundGeolocation();
  const { isMaintenanceMode } = useMaintenanceMode();
  const isCarMode = useCarMode();
  const { pathname } = useLocation();

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

  const isTabRoute = DRIVER_TAB_ROUTES.has(pathname);
  const isMapRoute = DRIVER_MAP_ROUTES.has(pathname);

  return (
    <RootLayout
      className={`driver-luxury driver-page-shell ${isCarMode ? "car-mode-layout" : ""}`}
      dir="rtl"
      animationKey={isMapRoute ? undefined : pathname}
      animationMode={isMapRoute ? undefined : (isTabRoute ? "tab" : "slide")}
    >
      <div data-driver-theme="dark-luxury-geometric" className="h-full">
        {children}
      </div>
    </RootLayout>
  );
};

export default DriverLayout;
