/**
 * ران — لوحة تحكم الأدمن
 * يحتوي فقط على صفحات ومسارات الإدارة (ويب فقط)
 */
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DevInspector from "@/components/DevInspector";

// صفحات الأدمن
const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminRegions = lazy(() => import("@/pages/admin/AdminRegions"));
const AdminDrivers = lazy(() => import("@/pages/admin/AdminDrivers"));
const AdminRides = lazy(() => import("@/pages/admin/AdminRides"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminRiders = lazy(() => import("@/pages/admin/AdminRiders"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminApiStats = lazy(() => import("@/pages/admin/AdminApiStats"));
const AdminMap = lazy(() => import("@/pages/admin/AdminMap"));
const AdminReports = lazy(() => import("@/pages/admin/AdminReports"));
const AdminLandmarks = lazy(() => import("@/pages/admin/AdminLandmarks"));
const AdminCancellationSettings = lazy(() => import("@/pages/admin/AdminCancellationSettings"));
const AdminCancellationReport = lazy(() => import("@/pages/admin/AdminCancellationReport"));
const AdminIncentives = lazy(() => import("@/pages/admin/AdminIncentives"));
const AdminDriverDetails = lazy(() => import("@/pages/admin/AdminDriverDetails"));
const AdminDriverApplication = lazy(() => import("@/pages/admin/AdminDriverApplication"));
const AdminPendingRides = lazy(() => import("@/pages/admin/AdminPendingRides"));
const AdminCommissionReports = lazy(() => import("@/pages/admin/AdminCommissionReports"));
const AdminVehicleTypes = lazy(() => import("@/pages/admin/AdminVehicleTypes"));
const AdminSurgePricing = lazy(() => import("@/pages/admin/AdminSurgePricing"));
const AdminSubscriptionPlans = lazy(() => import("@/pages/admin/AdminSubscriptionPlans"));
const AdminCommissionTiers = lazy(() => import("@/pages/admin/AdminCommissionTiers"));
const AdminFareSettings = lazy(() => import("@/pages/admin/AdminFareSettings"));
const AdminVouchers = lazy(() => import("@/pages/admin/AdminVouchers"));
const AdminBannedNames = lazy(() => import("@/pages/admin/AdminBannedNames"));
const AdminPromoBanners = lazy(() => import("@/pages/admin/AdminPromoBanners"));
const AdminRiderPages = lazy(() => import("@/pages/admin/AdminRiderPages"));
const AdminPageEditor = lazy(() => import("@/pages/admin/AdminPageEditor"));
const AdminWorkflows = lazy(() => import("@/pages/admin/AdminWorkflows"));
const AdminDocumentation = lazy(() => import("@/pages/admin/AdminDocumentation"));
const AdminBotController = lazy(() => import("@/pages/admin/AdminBotController"));
const AdminWalletRequests = lazy(() => import("@/pages/admin/AdminWalletRequests"));
const AdminSMSLogs = lazy(() => import("@/pages/admin/AdminSMSLogs"));
const AdminDriverVisibility = lazy(() => import("@/pages/admin/AdminDriverVisibility"));
const DriverRegistrationSettings = lazy(() => import("@/pages/admin/DriverRegistrationSettings"));
const AdminRiderWaitSettings = lazy(() => import("@/pages/admin/AdminRiderWaitSettings"));
const AdminComplaints = lazy(() => import("@/pages/admin/AdminComplaints"));
const AdminStoppedRides = lazy(() => import("@/pages/admin/AdminStoppedRides"));
const AdminEmergencySettings = lazy(() => import("@/pages/admin/AdminEmergencySettings"));
const AdminBotCustomers = lazy(() => import("@/pages/admin/AdminBotCustomers"));
const AdminBotChats = lazy(() => import("@/pages/admin/AdminBotChats"));
const AdminMessengerAccounts = lazy(() => import("@/pages/admin/AdminMessengerAccounts"));
const AdminDeveloperSettings = lazy(() => import("@/pages/admin/AdminDeveloperSettings"));
const AdminSecuritySettings = lazy(() => import("@/pages/admin/AdminSecuritySettings"));
const AdminWithdrawals = lazy(() => import("@/pages/admin/AdminWithdrawals"));
const AdminFleets = lazy(() => import("@/pages/admin/AdminFleets"));
const AdminDevInspector = lazy(() => import("@/pages/admin/AdminDevInspector"));
const AdminNotifications = lazy(() => import("@/pages/admin/AdminNotifications"));
const AdminNotificationGroups = lazy(() => import("@/pages/admin/AdminNotificationGroups"));
const AdminControllerUsers = lazy(() => import("@/pages/admin/AdminControllerUsers"));
const AdminRoutingComparison = lazy(() => import("@/pages/admin/AdminRoutingComparison"));
const AdminCostControls = lazy(() => import("@/pages/admin/AdminCostControls"));
const AdminReferralCodes = lazy(() => import("@/pages/admin/AdminReferralCodes"));
const AdminFraudAlerts = lazy(() => import("@/pages/admin/AdminFraudAlerts"));
const AdminDevelopmentTasks = lazy(() => import("@/pages/admin/AdminDevelopmentTasks"));
const AdminAuditLogs = lazy(() => import("@/pages/admin/AdminAuditLogs"));
const AdminSystemCapacity = lazy(() => import("@/pages/admin/AdminSystemCapacity"));
const AdminMapCompare = lazy(() => import("@/pages/admin/AdminMapCompare"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <img src="/logo.png" alt="RAAN" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
      <p className="text-muted-foreground text-sm">جاري التحميل...</p>
    </div>
  </div>
);

const AdminApp = () => {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Sonner />
            <Toaster />
            <ConnectionStatus />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<LoadingFallback />}>
                <AdminRoutes />
              </Suspense>
              <DevInspector />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
};

const AdminRoutes = () => {
  const { user, userRole, isLoading } = useAuth();

  // ✅ الأدمن لا يحتاج شاشة ترحيبية — تحميل مباشر
  if (isLoading) return <LoadingFallback />;

  if (user && userRole === null) {
    return <LoadingFallback />;
  }

  // ✅ SECURITY FIX: المصادقة تعتمد فقط على:
  // 1. جلسة Supabase صالحة (user !== null)
  // 2. دور admin مؤكد من قاعدة البيانات (user_roles table)
  // لا نعتمد أبداً على localStorage — يمكن تزويره من console
  const isAuthenticated = user && userRole === "admin";

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    );
  }

  const AR = ({ children }: { children: React.ReactNode }) => (
    <ErrorBoundary><ProtectedRoute requiredRole="admin">{children}</ProtectedRoute></ErrorBoundary>
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AR><AdminDashboard /></AR>} />
      <Route path="/admin/regions" element={<AR><AdminRegions /></AR>} />
      <Route path="/admin/landmarks" element={<AR><AdminLandmarks /></AR>} />
      <Route path="/admin/vehicle-types" element={<AR><AdminVehicleTypes /></AR>} />
      <Route path="/admin/drivers" element={<AR><AdminDrivers /></AR>} />
      <Route path="/admin/fleets" element={<AR><AdminFleets /></AR>} />
      <Route path="/admin/rides" element={<AR><AdminRides /></AR>} />
      <Route path="/admin/users" element={<AR><AdminUsers /></AR>} />
      <Route path="/admin/riders" element={<AR><AdminRiders /></AR>} />
      <Route path="/admin/settings" element={<AR><AdminSettings /></AR>} />
      <Route path="/admin/map" element={<AR><AdminMap /></AR>} />
      <Route path="/admin/reports" element={<AR><AdminReports /></AR>} />
      <Route path="/admin/cancellation" element={<AR><AdminCancellationSettings /></AR>} />
      <Route path="/admin/cancellation-report" element={<AR><AdminCancellationReport /></AR>} />
      <Route path="/admin/incentives" element={<AR><AdminIncentives /></AR>} />
      <Route path="/admin/pending-rides" element={<AR><AdminPendingRides /></AR>} />
      <Route path="/admin/drivers/:id" element={<AR><AdminDriverDetails /></AR>} />
      <Route path="/admin/api-stats" element={<AR><AdminApiStats /></AR>} />
      <Route path="/admin/commission-reports" element={<AR><AdminCommissionReports /></AR>} />
      <Route path="/admin/fare-settings" element={<AR><AdminFareSettings /></AR>} />
      <Route path="/admin/vouchers" element={<AR><AdminVouchers /></AR>} />
      <Route path="/admin/surge-pricing" element={<AR><AdminSurgePricing /></AR>} />
      <Route path="/admin/subscription-plans" element={<AR><AdminSubscriptionPlans /></AR>} />
      <Route path="/admin/commission-tiers" element={<AR><AdminCommissionTiers /></AR>} />
      <Route path="/admin/banned-names" element={<AR><AdminBannedNames /></AR>} />
      <Route path="/admin/promo-banners" element={<AR><AdminPromoBanners /></AR>} />
      <Route path="/admin/rider-pages" element={<AR><AdminRiderPages /></AR>} />
      <Route path="/admin/page-editor/:pageId" element={<AR><AdminPageEditor /></AR>} />
      <Route path="/admin/workflows" element={<AR><AdminWorkflows /></AR>} />
      <Route path="/admin/workflows/:workflowId" element={<AR><AdminWorkflows /></AR>} />
      <Route path="/admin/documentation" element={<AR><AdminDocumentation /></AR>} />
      <Route path="/admin/bot-controller" element={<AR><AdminBotController /></AR>} />
      <Route path="/admin/bot-chats" element={<AR><AdminBotChats /></AR>} />
      <Route path="/admin/messenger-accounts" element={<AR><AdminMessengerAccounts /></AR>} />
      <Route path="/admin/wallet-requests" element={<AR><AdminWalletRequests /></AR>} />
      <Route path="/admin/sms-logs" element={<AR><AdminSMSLogs /></AR>} />
      <Route path="/admin/driver-visibility" element={<AR><AdminDriverVisibility /></AR>} />
      <Route path="/admin/driver-registration-settings" element={<AR><DriverRegistrationSettings /></AR>} />
      <Route path="/admin/rider-wait-settings" element={<AR><AdminRiderWaitSettings /></AR>} />
      <Route path="/admin/complaints" element={<AR><AdminComplaints /></AR>} />
      <Route path="/admin/stopped-rides" element={<AR><AdminStoppedRides /></AR>} />
      <Route path="/admin/emergency-settings" element={<AR><AdminEmergencySettings /></AR>} />
      <Route path="/admin/bot-customers" element={<AR><AdminBotCustomers /></AR>} />
      <Route path="/admin/developer-settings" element={<AR><AdminDeveloperSettings /></AR>} />
      <Route path="/admin/security-settings" element={<AR><AdminSecuritySettings /></AR>} />
      <Route path="/admin/withdrawals" element={<AR><AdminWithdrawals /></AR>} />
      <Route path="/admin/dev-inspector" element={<AR><AdminDevInspector /></AR>} />
      <Route path="/settings/devInspector" element={<AR><AdminDevInspector /></AR>} />
      <Route path="/admin/notifications" element={<AR><AdminNotifications /></AR>} />
      <Route path="/admin/notification-groups" element={<AR><AdminNotificationGroups /></AR>} />
      <Route path="/admin/controller-users" element={<AR><AdminControllerUsers /></AR>} />
      <Route path="/admin/routing-comparison" element={<AR><AdminRoutingComparison /></AR>} />
      <Route path="/admin/cost-controls" element={<AR><AdminCostControls /></AR>} />
      <Route path="/admin/referral-codes" element={<AR><AdminReferralCodes /></AR>} />
      <Route path="/admin/fraud-alerts" element={<AR><AdminFraudAlerts /></AR>} />
      <Route path="/admin/development-tasks" element={<AR><AdminDevelopmentTasks /></AR>} />
      <Route path="/admin/audit-logs" element={<AR><AdminAuditLogs /></AR>} />
      <Route path="/admin/system-capacity" element={<AR><AdminSystemCapacity /></AR>} />
      <Route path="/admin/map-compare" element={<AR><AdminMapCompare /></AR>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

export default AdminApp;
