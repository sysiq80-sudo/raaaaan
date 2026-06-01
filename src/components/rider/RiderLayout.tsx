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

interface RiderLayoutProps {
  children: React.ReactNode;
}

/**
 * صفحات الـ Bottom Tabs → تنتقل بـ fade خفيف (لا slide)
 * مثل سلوك native tab bar في iOS
 */
const TAB_ROUTES = new Set([
  "/rider",
  "/rider/go",
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

  return (
    <RootLayout
      className="rider-premium safe-area-inset"
      animationKey={pathname}
      animationMode={isTabRoute ? "tab" : "slide"}
    >
      {children}
    </RootLayout>
  );
};

export default RiderLayout;
