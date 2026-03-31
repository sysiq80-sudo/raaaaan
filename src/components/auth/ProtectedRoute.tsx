/**
 * ران - مكون حماية المسارات (ProtectedRoute)
 * يتحقق من جلسة المستخدم قبل عرض أي صفحة محمية
 * 
 * المنطق:
 * - إذا جاري التحميل → عرض شاشة البداية (SplashScreen)
 * - إذا لا يوجد مستخدم → إعادة توجيه لصفحة الدخول
 * - إذا يوجد مستخدم → عرض المحتوى المحمي
 * 
 * يدعم تحديد الدور المطلوب (rider/driver/admin)
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import SplashScreen from "@/components/SplashScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** الدور المطلوب للوصول (اختياري - إذا لم يُحدد يكفي تسجيل الدخول) */
  requiredRole?: "rider" | "driver" | "admin";
  /** مسار إعادة التوجيه عند عدم المصادقة (افتراضي: /auth) */
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  redirectTo = "/auth",
}) => {
  const { user, userRole, isLoading } = useAuth();
  const location = useLocation();

  // 1. جاري التحميل → عرض SplashScreen
  if (isLoading) {
    return <SplashScreen />;
  }

  // 2. لا يوجد مستخدم → إعادة توجيه لصفحة الدخول
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // 3. تحقق من الدور المطلوب (إذا حُدّد)
  // ✅ في التطبيقات المستقلة (APK) لا نعيد توجيه لتطبيق آخر
  const appMode = typeof __APP_MODE__ !== 'undefined' ? __APP_MODE__ : null;
  // ✅ إذا كان redirectTo محدداً كـ /driver/auth، نحن في تطبيق السائق — لا نوجه لـ /rider
  const isDriverApp = redirectTo === "/driver/auth" || appMode === "driver";

  if (requiredRole && !appMode) {
    // إعادة توجيه حسب الدور الفعلي إذا لا يطابق المطلوب
    if (requiredRole === "rider" && userRole === "driver") {
      return <Navigate to="/driver" replace />;
    }
    if (requiredRole === "rider" && userRole === "admin") {
      return <Navigate to="/admin" replace />;
    }
    if (requiredRole === "driver" && userRole === "rider" && !isDriverApp) {
      return <Navigate to="/rider" replace />;
    }
    if (requiredRole === "driver" && userRole === "admin") {
      return <Navigate to="/admin" replace />;
    }
    if (requiredRole === "admin" && userRole !== "admin") {
      // توجيه المستخدم غير المدير لصفحته الرئيسية بدلاً من /admin/login لمنع حلقة إعادة التوجيه
      const redirectPath = userRole === "driver" ? "/driver" : "/rider";
      return <Navigate to={redirectPath} replace />;
    }
  }

  // 4. المستخدم مصادق والدور مطابق → عرض المحتوى
  return <>{children}</>;
};

export default ProtectedRoute;
