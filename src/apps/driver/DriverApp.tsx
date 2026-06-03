/**
 * ران كابتن — تطبيق السائق
 * يحتوي فقط على صفحات ومسارات السائق
 */
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense, useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RaanThemeProvider } from "@/contexts/RaanThemeContext";
import SplashScreen from "@/components/SplashScreen";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DevInspector from "@/components/DevInspector";
import { isNativePlatform } from "@/lib/capacitorBridge";
import { capacitorStorageSync } from "@/lib/capacitorStorage";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { ForceUpdateScreen } from "@/components/ForceUpdateScreen";
import PageSkeleton from "@/components/layout/PageSkeleton";

// صفحات أساسية
import NotFound from "@/pages/NotFound";
import DriverHome from "@/pages/driver/DriverHome";
import DriverAuth from "@/pages/driver/DriverAuth";

// صفحات عامة
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const About = lazy(() => import("@/pages/About"));
const HelpAndContact = lazy(() => import("@/pages/HelpAndContact"));
const PaymentResult = lazy(() => import("@/pages/payment/PaymentResult"));

// صفحات السائق
const DriverRegister = lazy(() => import("@/pages/driver/DriverRegister"));
const DriverCompleteRegistration = lazy(() => import("@/pages/driver/DriverCompleteRegistration"));
const DriverApplicationStatus = lazy(() => import("@/pages/driver/DriverApplicationStatus"));
const DriverRides = lazy(() => import("@/pages/driver/DriverRides"));
const DriverSettings = lazy(() => import("@/pages/driver/DriverSettings"));
const DriverStatistics = lazy(() => import("@/pages/driver/DriverStatistics"));
const DriverProfile = lazy(() => import("@/pages/driver/DriverProfile"));
const DriverIncentives = lazy(() => import("@/pages/driver/DriverIncentives"));
const DriverFinance = lazy(() => import("@/pages/driver/DriverFinance"));
const DriverSubscription = lazy(() => import("@/pages/driver/DriverSubscription"));
const DriverGuide = lazy(() => import("@/pages/driver/DriverGuide"));
const DriverDashboardMigrated = lazy(() => import("@/pages/driver/DriverDashboardMigrated"));
const DriverLayout = lazy(() => import("@/components/driver/DriverLayout"));

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

const LoadingFallback = () => <SplashScreen />;

const DriverProtectedLayout = () => (
  <ErrorBoundary>
    <ProtectedRoute requiredRole="driver" redirectTo="/driver/auth">
      <DriverLayout>
        <Outlet />
      </DriverLayout>
    </ProtectedRoute>
  </ErrorBoundary>
);

const DriverApp = () => {
  return (
    <ErrorBoundary>
      <RaanThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Sonner />
            <Toaster />
            <ConnectionStatus />
            {isNativePlatform ? (
              <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<LoadingFallback />}>
                  <DriverRoutes />
                </Suspense>
                <DevInspector />
              </HashRouter>
            ) : (
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<LoadingFallback />}>
                  <DriverRoutes />
                </Suspense>
                <DevInspector />
              </BrowserRouter>
            )}
          </AuthProvider>
        </QueryClientProvider>
      </TooltipProvider>
      </RaanThemeProvider>
    </ErrorBoundary>
  );
};

const DriverRoutes = () => {
  const { user, isLoading, isOnboardingComplete } = useAuth();
  const [minSplashDone, setMinSplashDone] = useState(false);
  const { updateRequired, currentVersion, minVersion } = useForceUpdate();

  // ✅ فرض دور السائق فوراً لمنع توجيه خاطئ إلى /rider
  useEffect(() => {
    capacitorStorageSync.setItem("raan_current_role", "driver");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !minSplashDone) return <LoadingFallback />;

  if (updateRequired) return <ForceUpdateScreen currentVersion={currentVersion} minVersion={minVersion} />;

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/driver/auth" replace />} />
        <Route path="/auth" element={<Navigate to="/driver/auth" replace />} />
        <Route path="/driver/auth" element={<ErrorBoundary><DriverAuth /></ErrorBoundary>} />
        <Route path="/driver/register" element={<ErrorBoundary><DriverRegister /></ErrorBoundary>} />
        <Route path="/driver/complete-registration" element={<ErrorBoundary><DriverCompleteRegistration /></ErrorBoundary>} />
        <Route path="/driver/application-status" element={<ErrorBoundary><DriverApplicationStatus /></ErrorBoundary>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/about" element={<About />} />
        <Route path="/help" element={<HelpAndContact />} />
        <Route path="/contact" element={<HelpAndContact />} />
        <Route path="/payment/result" element={<ErrorBoundary><PaymentResult /></ErrorBoundary>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!isOnboardingComplete) {
    return (
      <Routes>
        <Route path="/onboarding" element={<ErrorBoundary><Onboarding /></ErrorBoundary>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/onboarding" replace={false} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<Navigate to="/driver" replace />} />
      <Route path="/" element={<Navigate to="/driver" replace />} />
      <Route path="/auth" element={<Navigate to="/driver" replace />} />
      <Route path="/driver/auth" element={<Navigate to="/driver" replace />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/about" element={<About />} />
      <Route path="/help" element={<HelpAndContact />} />
      <Route path="/contact" element={<HelpAndContact />} />
      <Route path="/payment/result" element={<ErrorBoundary><PaymentResult /></ErrorBoundary>} />

      <Route path="/driver/register" element={<ErrorBoundary><DriverRegister /></ErrorBoundary>} />
      <Route path="/driver/complete-registration" element={<ErrorBoundary><DriverCompleteRegistration /></ErrorBoundary>} />
      <Route path="/driver/application-status" element={<ErrorBoundary><DriverApplicationStatus /></ErrorBoundary>} />
      <Route path="/driver" element={<DriverProtectedLayout />}>
        {/* DriverHome محمّل مباشرة — أول شاشة يراها السائق، لا lazy */}
        <Route index element={<DriverHome />} />
        {/* صفحات lazy — كل منها Suspense خاص بها لمنع SplashScreen عند التنقل */}
        <Route path="rides" element={<Suspense fallback={<PageSkeleton layout="list" rows={4} />}><DriverRides /></Suspense>} />
        <Route path="finance" element={<Suspense fallback={<PageSkeleton layout="list" rows={3} />}><DriverFinance /></Suspense>} />
        <Route path="wallet" element={<Navigate to="/driver/finance" replace />} />
        <Route path="payments" element={<Navigate to="/driver/finance" replace />} />
        <Route path="statistics" element={<Suspense fallback={<PageSkeleton layout="list" rows={4} />}><DriverStatistics /></Suspense>} />
        <Route path="profile" element={<Suspense fallback={<PageSkeleton layout="list" rows={3} />}><DriverProfile /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageSkeleton layout="list" rows={3} />}><DriverSettings /></Suspense>} />
        <Route path="incentives" element={<Suspense fallback={<PageSkeleton layout="list" rows={2} />}><DriverIncentives /></Suspense>} />
        <Route path="subscription" element={<Suspense fallback={<PageSkeleton layout="list" rows={2} />}><DriverSubscription /></Suspense>} />
        <Route path="guide" element={<Suspense fallback={<PageSkeleton layout="list" rows={3} />}><DriverGuide /></Suspense>} />
        <Route path="dashboard-v2" element={<Suspense fallback={<PageSkeleton layout="map" showHeader={false} />}><DriverDashboardMigrated /></Suspense>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default DriverApp;
