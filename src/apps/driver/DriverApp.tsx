/**
 * ران كابتن — تطبيق السائق
 * يحتوي فقط على صفحات ومسارات السائق
 */
import { Toaster as Sonner } from "@/components/ui/sonner";
import { lazy, Suspense, useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RaanThemeProvider } from "@/contexts/RaanThemeContext";
import SplashScreen from "@/components/SplashScreen";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DevInspector from "@/components/DevInspector";
import { PWAInstallPrompt } from "@/components/common/PWAInstallPrompt";

// صفحات أساسية
import NotFound from "@/pages/NotFound";
import DriverHome from "@/pages/driver/DriverHome";
import DriverAuth from "@/pages/driver/DriverAuth";
import { preloadGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";

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

const DriverApp = () => {
  return (
    <ErrorBoundary>
      <RaanThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Sonner />
            <ConnectionStatus />
            <PWAInstallPrompt />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<LoadingFallback />}>
                <DriverRoutes />
              </Suspense>
              <DevInspector />
            </BrowserRouter>
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

  // ✅ فرض دور السائق فوراً لمنع توجيه خاطئ إلى /rider
  useEffect(() => {
    localStorage.setItem("raan_current_role", "driver");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // تحميل مسبق لمفتاح Google Maps عند تسجيل الدخول
  useEffect(() => {
    if (user) {
      preloadGoogleMapsApiKey();
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      import("@/pages/driver/DriverRides");
      import("@/pages/driver/DriverProfile");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !minSplashDone) return <LoadingFallback />;

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

      <Route path="/driver" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverHome /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/register" element={<ErrorBoundary><DriverRegister /></ErrorBoundary>} />
      <Route path="/driver/complete-registration" element={<ErrorBoundary><DriverCompleteRegistration /></ErrorBoundary>} />
      <Route path="/driver/application-status" element={<ErrorBoundary><DriverApplicationStatus /></ErrorBoundary>} />
      <Route path="/driver/rides" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverRides /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/finance" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverFinance /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/wallet" element={<Navigate to="/driver/finance" replace />} />
      <Route path="/driver/payments" element={<Navigate to="/driver/finance" replace />} />
      <Route path="/driver/statistics" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverStatistics /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/profile" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverProfile /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/settings" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverSettings /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/incentives" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverIncentives /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/subscription" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverSubscription /></DriverLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/driver/guide" element={<ErrorBoundary><ProtectedRoute requiredRole="driver" redirectTo="/driver/auth"><DriverLayout><DriverGuide /></DriverLayout></ProtectedRoute></ErrorBoundary>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default DriverApp;
