/**
 * ران - ProtectedRoute
 * حارس المسارات المحمية - يمنع الوصول بدون مصادقة
 * يعيد توجيه المستخدمين غير المسجلين إلى صفحة تسجيل الدخول
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** مسار إعادة التوجيه عند عدم المصادقة */
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = "/auth",
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // عرض شاشة التحميل أثناء التحقق من حالة المصادقة
  if (loading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  // إذا لم يكن المستخدم مسجلاً - أعد توجيهه لصفحة المصادقة
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // المستخدم مسجل - اعرض المحتوى
  return <>{children}</>;
};

export default ProtectedRoute;
