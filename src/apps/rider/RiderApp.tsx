/**
 * ران — تطبيق الراكب
 * يحتوي فقط على صفحات ومسارات الراكب
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
import { MapProviderContext } from "@/contexts/MapContext";
import SplashScreen from "@/components/SplashScreen";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DevInspector from "@/components/DevInspector";
import RiderNotificationBootstrap from "@/components/rider/RiderNotificationBootstrap";
import { isNativePlatform } from "@/lib/capacitorBridge";
import { capacitorStorageSync } from "@/lib/capacitorStorage";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { ForceUpdateScreen } from "@/components/ForceUpdateScreen";
import PageSkeleton from "@/components/layout/PageSkeleton";

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
const RiderProfileMigratedPage = lazy(() => import("@/pages/rider/RiderProfileMigratedPage"));
const RiderGoMigrated = lazy(() => import("@/pages/rider/RiderGoMigrated"));
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

// Layout ثابت لا يُنمَّط عند التنقل بين صفحات الراكب
const RiderProtectedLayout = () => (
  <ErrorBoundary>
    <ProtectedRoute requiredRole="rider">
      <RiderLayout>
        <Outlet />
      </RiderLayout>
    </ProtectedRoute>
  </ErrorBoundary>
);

const RiderApp = () => {
  return (
    <ErrorBoundary>
      <RaanThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MapProviderContext>
              <Sonner />
              <Toaster />
              <RiderNotificationBootstrap />
              {isNativePlatform ? (
                <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <Suspense fallback={<LoadingFallback />}>
                    <RiderRoutes />
                  </Suspense>
                  <DevInspector />
                </HashRouter>
              ) : (
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <Suspense fallback={<LoadingFallback />}>
                    <RiderRoutes />
                  </Suspense>
                  <DevInspector />
                </BrowserRouter>
              )}
            </MapProviderContext>
          </AuthProvider>
        </QueryClientProvider>
      </TooltipProvider>
      </RaanThemeProvider>
    </ErrorBoundary>
  );
};

const RiderRoutes = () => {
  const { user, isLoading, isOnboardingComplete } = useAuth();
  const [minSplashDone, setMinSplashDone] = useState(false);
  const { updateRequired, currentVersion, minVersion } = useForceUpdate();

  // ✅ فرض دور الراكب فوراً لمنع توجيه خاطئ إلى /driver
  useEffect(() => {
    capacitorStorageSync.setItem("raan_current_role", "rider");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // ⚡ Pre-load GoPage first (most likely next navigation from AIVoiceHome)
    const t1 = setTimeout(() => import("@/pages/rider/GoPage"), 500);
    const t2 = setTimeout(() => {
      import("@/pages/rider/RiderRidesPage");
      import("@/pages/rider/RiderPaymentsPage");
      import("@/pages/rider/RiderSettingsPage");
      import("@/pages/rider/RiderSavedPlacesPage");
    }, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (isLoading || !minSplashDone) return <LoadingFallback />;

  if (updateRequired) return <ForceUpdateScreen currentVersion={currentVersion} minVersion={minVersion} />;

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

      <Route path="/rider" element={<RiderProtectedLayout />}>
        {/* AIVoiceHome محمّلة لازي لكنها الشاشة الأولى — prefetch يضمن جاهزيتها */}
        <Route index element={<Suspense fallback={<PageSkeleton rows={2} showHeader={false} />}><AIVoiceHome /></Suspense>} />
        {/* صفحات lazy — كل منها Suspense خاص */}
        <Route path="go" element={<Suspense fallback={<PageSkeleton rows={2} showHeader={false} />}><GoPage /></Suspense>} />
        <Route path="schedule" element={<Suspense fallback={<PageSkeleton rows={2} showHeader={false} />}><GoPage scheduleMode={true} /></Suspense>} />
        <Route path="rides" element={<Suspense fallback={<PageSkeleton rows={4} />}><RiderRidesPage /></Suspense>} />
        <Route path="payments" element={<Suspense fallback={<PageSkeleton rows={3} />}><RiderPaymentsPage /></Suspense>} />
        <Route path="wallet-topup" element={<Suspense fallback={<PageSkeleton rows={2} />}><WalletTopupPage /></Suspense>} />
        <Route path="saved-places" element={<Suspense fallback={<PageSkeleton rows={3} />}><RiderSavedPlacesPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageSkeleton rows={3} />}><RiderSettingsPage /></Suspense>} />
        <Route path="profile-v2" element={<Suspense fallback={<PageSkeleton rows={3} />}><RiderProfileMigratedPage /></Suspense>} />
        <Route path="go-v2" element={<Suspense fallback={<PageSkeleton rows={2} showHeader={false} />}><RiderGoMigrated /></Suspense>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RiderApp;
