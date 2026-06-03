/**
 * ران - Layout للراكب
 * flex flex-col h-[100dvh] — No-Overlap Architecture
 * الشريط السفلي shrink-0 يدفع المحتوى للأعلى طبيعياً بدون fixed/padding hacks
 * يتحقق من وضع الصيانة من إعدادات الأدمن
 *
 * الانتقالات:
 * • صفحات الـ Bottom Tabs (الرئيسية) → fade خفيف
 * • الصفحات الداخلية → slide RTL مثل iOS
 */

import React from "react";
import { useLocation } from "react-router-dom";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import RootLayout from "@/components/layout/RootLayout";
import RiderGradientBottomNav from "@/components/rider/RiderGradientBottomNav";

interface RiderLayoutProps {
  children: React.ReactNode;
}

/**
 * صفحات الـ Bottom Tabs → تنتقل بـ fade خفيف (لا slide)
 * مثل سلوك native tab bar في iOS
 */
const TAB_ROUTES = new Set([
  "/rider",
  "/rider/rides",
  "/rider/payments",
  "/rider/saved-places",
  "/rider/settings",
]);

const MAP_ROUTES = new Set([
  "/rider/go",
  "/rider/schedule",
]);

// صفحات تُظهر الشريط السفلي (Tab Bar)
const NAV_ROUTES = new Set([
  "/rider/rides",
  "/rider/payments",
  "/rider/saved-places",
  "/rider/settings",
]);

const RiderLayout: React.FC<RiderLayoutProps> = ({ children }) => {
  const { isMaintenanceMode } = useMaintenanceMode();
  const { pathname } = useLocation();

  // عرض شاشة الصيانة إذا كان وضع الصيانة مفعّل
  if (isMaintenanceMode) {
    return <MaintenanceScreen />;
  }

  const isTabRoute = TAB_ROUTES.has(pathname);
  const isMapRoute = MAP_ROUTES.has(pathname);
  const showBottomNav = NAV_ROUTES.has(pathname);

  return (
    <RootLayout
      className="rider-premium"
      animationKey={isMapRoute ? undefined : pathname}
      animationMode={isMapRoute ? undefined : (isTabRoute ? "tab" : "slide")}
      bottom={showBottomNav ? <RiderGradientBottomNav /> : undefined}
    >
      {children}
    </RootLayout>
  );
};

export default RiderLayout;
