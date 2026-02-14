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
  if (requiredRole) {
    // إعادة توجيه حسب الدور الفعلي إذا لا يطابق المطلوب
    if (requiredRole === "rider" && userRole === "driver") {
      return <Navigate to="/driver" replace />;
    }
    if (requiredRole === "rider" && userRole === "admin") {
      return <Navigate to="/admin" replace />;
    }
    if (requiredRole === "driver" && userRole === "rider") {
      return <Navigate to="/rider" replace />;
    }
    if (requiredRole === "driver" && userRole === "admin") {
      return <Navigate to="/admin" replace />;
    }
    if (requiredRole === "admin" && userRole !== "admin") {
      return <Navigate to="/admin/login" replace />;
    }
  }

  // 4. المستخدم مصادق والدور مطابق → عرض المحتوى
  return <>{children}</>;
};

export default ProtectedRoute;
