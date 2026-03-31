/**
 * ران — تطبيق الراكب
 * يحتوي فقط على صفحات ومسارات الراكب
 */
import { Toaster as Sonner } from "@/components/ui/sonner";
import { lazy, Suspense, useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import SplashScreen from "@/components/SplashScreen";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DevInspector from "@/components/DevInspector";
import { PWAInstallPrompt } from "@/components/common/PWAInstallPrompt";
import RiderNotificationBootstrap from "@/components/rider/RiderNotificationBootstrap";

// صفحات أساسية
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

// صفحات عامة
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const TrackRide = lazy(() => import("@/pages/TrackRide"));
const About = lazy(() => import("@/pages/About"));
const HelpAndContact = lazy(() => import("@/pages/HelpAndContact"));
const PaymentResult = lazy(() => import("@/pages/payment/PaymentResult"));

// صفحات الراكب
const GoPage = lazy(() => import("@/pages/rider/GoPage"));
const AIVoiceHome = lazy(() => import("@/components/rider/AIVoiceHome"));
const RiderRidesPage = lazy(() => import("@/pages/rider/RiderRidesPage"));
const RiderPaymentsPage = lazy(() => import("@/pages/rider/RiderPaymentsPage"));
const WalletTopupPage = lazy(() => import("@/pages/rider/WalletTopupPage"));
const RiderSavedPlacesPage = lazy(() => import("@/pages/rider/RiderSavedPlacesPage"));
const RiderSettingsPage = lazy(() => import("@/pages/rider/RiderSettingsPage"));
const RiderLayout = lazy(() => import("@/components/rider/RiderLayout"));

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

const RiderApp = () => {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Sonner />
            <ConnectionStatus />
            <PWAInstallPrompt />
            <RiderNotificationBootstrap />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<LoadingFallback />}>
                <RiderRoutes />
              </Suspense>
              <DevInspector />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
};

const RiderRoutes = () => {
  const { user, isLoading, isOnboardingComplete } = useAuth();
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      import("@/pages/rider/RiderRidesPage");
      import("@/pages/rider/RiderSettingsPage");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !minSplashDone) return <LoadingFallback />;

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/about" element={<About />} />
        <Route path="/help" element={<HelpAndContact />} />
        <Route path="/contact" element={<HelpAndContact />} />
        <Route path="/track/:token" element={<ErrorBoundary><TrackRide /></ErrorBoundary>} />
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
      <Route path="/onboarding" element={<Navigate to="/rider" replace />} />
      <Route path="/" element={<Navigate to="/rider" replace />} />
      <Route path="/auth" element={<Navigate to="/rider" replace />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/about" element={<About />} />
      <Route path="/help" element={<HelpAndContact />} />
      <Route path="/contact" element={<HelpAndContact />} />
      <Route path="/track/:token" element={<ErrorBoundary><TrackRide /></ErrorBoundary>} />
      <Route path="/payment/result" element={<ErrorBoundary><PaymentResult /></ErrorBoundary>} />

      <Route path="/rider" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><AIVoiceHome /></ProtectedRoute></ErrorBoundary>} />
      <Route path="/rider/go" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><RiderLayout><GoPage /></RiderLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/rider/schedule" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><RiderLayout><GoPage scheduleMode={true} /></RiderLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/rider/rides" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><RiderLayout><RiderRidesPage /></RiderLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/rider/payments" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><RiderLayout><RiderPaymentsPage /></RiderLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/rider/wallet-topup" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><RiderLayout><WalletTopupPage /></RiderLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/rider/saved-places" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><RiderLayout><RiderSavedPlacesPage /></RiderLayout></ProtectedRoute></ErrorBoundary>} />
      <Route path="/rider/settings" element={<ErrorBoundary><ProtectedRoute requiredRole="rider"><RiderLayout><RiderSettingsPage /></RiderLayout></ProtectedRoute></ErrorBoundary>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RiderApp;
