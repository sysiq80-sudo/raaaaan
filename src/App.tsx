import { Toaster as Sonner } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { lazy, Suspense, useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { isNativePlatform } from "@/lib/capacitorBridge";
import ErrorBoundary from "@/components/ErrorBoundary";
import DevInspector from "@/components/DevInspector";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RaanThemeProvider } from "@/contexts/RaanThemeContext";
import SplashScreen from "@/components/SplashScreen";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import * as Sentry from "@sentry/react";

// ØµÙØ­Ø§Øª Ø£Ø³Ø§Ø³ÙŠØ© (Ù…Ø­Ù…Ù„Ø© Ù…Ø¨Ø§Ø´Ø±Ø© - ÙŠØ­ØªØ§Ø¬Ù‡Ø§ Ø§Ù„Ø¬Ù…ÙŠØ¹)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// ØµÙØ­Ø§Øª Ø¹Ø§Ù…Ø© - ØªØ­Ù…ÙŠÙ„ ÙƒØ³ÙˆÙ„
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const TrackRide = lazy(() => import("./pages/TrackRide"));
const About = lazy(() => import("./pages/About"));
const HelpAndContact = lazy(() => import("./pages/HelpAndContact"));
const PaymentResult = lazy(() => import("./pages/payment/PaymentResult"));
const AIPage = lazy(() => import("./pages/marketing/AIPage"));
const FeaturesPage = lazy(() => import("./pages/marketing/FeaturesPage"));
const DriverPage = lazy(() => import("./pages/marketing/DriverPage"));
const MarketingAboutPage = lazy(() => import("./pages/marketing/AboutPage"));
const ContactPage = lazy(() => import("./pages/marketing/ContactPage"));

// ØµÙØ­Ø§Øª Ø§Ù„Ø±Ø§ÙƒØ¨ - ØªØ­Ù…ÙŠÙ„ ÙƒØ³ÙˆÙ„ (Ù„Ø§ ÙŠØ­Ù…Ù„Ù‡Ø§ Ø§Ù„Ø³Ø§Ø¦Ù‚ Ø£Ùˆ Ø§Ù„Ø£Ø¯Ù…Ù†)
const GoPage = lazy(() => import("./pages/rider/GoPage"));
const AIVoiceHome = lazy(() => import("./components/rider/AIVoiceHome"));
const RiderRidesPage = lazy(() => import("./pages/rider/RiderRidesPage"));
const RiderPaymentsPage = lazy(() => import("./pages/rider/RiderPaymentsPage"));
const WalletTopupPage = lazy(() => import("./pages/rider/WalletTopupPage"));
const RiderSavedPlacesPage = lazy(() => import("./pages/rider/RiderSavedPlacesPage"));
const RiderSettingsPage = lazy(() => import("./pages/rider/RiderSettingsPage"));
const RiderNotificationsPage = lazy(() => import("./pages/rider/RiderNotificationsPage"));

// ØµÙØ­Ø§Øª Ø§Ù„Ø³Ø§Ø¦Ù‚ - ØªØ­Ù…ÙŠÙ„ ÙƒØ³ÙˆÙ„
import DriverHome from "./pages/driver/DriverHome";
const DriverAuth = lazy(() => import("./pages/driver/DriverAuth"));
const DriverRegister = lazy(() => import("./pages/driver/DriverRegister"));
const DriverCompleteRegistration = lazy(() => import("./pages/driver/DriverCompleteRegistration"));
const DriverApplicationStatus = lazy(() => import("./pages/driver/DriverApplicationStatus"));
const DriverRides = lazy(() => import("./pages/driver/DriverRides"));
const DriverSettings = lazy(() => import("./pages/driver/DriverSettings"));
const DriverStatistics = lazy(() => import("./pages/driver/DriverStatistics"));
const DriverProfile = lazy(() => import("./pages/driver/DriverProfile"));
const DriverIncentives = lazy(() => import("./pages/driver/DriverIncentives"));
const DriverFinance = lazy(() => import("./pages/driver/DriverFinance"));
const DriverSubscription = lazy(() => import("./pages/driver/DriverSubscription"));
const DriverGuide = lazy(() => import("./pages/driver/DriverGuide"));

// Layout components
const RiderLayout = lazy(() => import("./components/rider/RiderLayout"));
const DriverLayout = lazy(() => import("./components/driver/DriverLayout"));

// ØµÙØ­Ø§Øª Ø§Ù„Ø£Ø¯Ù…Ù† - ØªØ­Ù…ÙŠÙ„ ÙƒØ³ÙˆÙ„ (Ù„Ø§ ÙŠØ­Ù…Ù„Ù‡Ø§ Ø§Ù„Ø±Ø§ÙƒØ¨ Ø£Ùˆ Ø§Ù„Ø³Ø§Ø¦Ù‚)
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRegions = lazy(() => import("./pages/admin/AdminRegions"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminRides = lazy(() => import("./pages/admin/AdminRides"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminRiders = lazy(() => import("./pages/admin/AdminRiders"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminApiStats = lazy(() => import("./pages/admin/AdminApiStats"));
const AdminMap = lazy(() => import("./pages/admin/AdminMap"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminLandmarks = lazy(() => import("./pages/admin/AdminLandmarks"));
const AdminCancellationSettings = lazy(() => import("./pages/admin/AdminCancellationSettings"));
const AdminCancellationReport = lazy(() => import("./pages/admin/AdminCancellationReport"));
const AdminIncentives = lazy(() => import("./pages/admin/AdminIncentives"));
const AdminDriverDetails = lazy(() => import("./pages/admin/AdminDriverDetails"));
const AdminDriverApplication = lazy(() => import("./pages/admin/AdminDriverApplication"));
const AdminPendingRides = lazy(() => import("./pages/admin/AdminPendingRides"));
const AdminCommissionReports = lazy(() => import("./pages/admin/AdminCommissionReports"));
const AdminVehicleTypes = lazy(() => import("./pages/admin/AdminVehicleTypes"));
const AdminSurgePricing = lazy(() => import("./pages/admin/AdminSurgePricing"));
const AdminSubscriptionPlans = lazy(() => import("./pages/admin/AdminSubscriptionPlans"));
const AdminCommissionTiers = lazy(() => import("./pages/admin/AdminCommissionTiers"));
const AdminFareSettings = lazy(() => import("./pages/admin/AdminFareSettings"));
const AdminBannedNames = lazy(() => import("./pages/admin/AdminBannedNames"));
const AdminPromoBanners = lazy(() => import("./pages/admin/AdminPromoBanners"));
const AdminRiderPages = lazy(() => import("./pages/admin/AdminRiderPages"));
const AdminPageEditor = lazy(() => import("./pages/admin/AdminPageEditor"));
const AdminWorkflows = lazy(() => import("./pages/admin/AdminWorkflows"));
const AdminDocumentation = lazy(() => import("./pages/admin/AdminDocumentation"));
const AdminBotController = lazy(() => import("./pages/admin/AdminBotController"));
const AdminWalletRequests = lazy(() => import("./pages/admin/AdminWalletRequests"));
const AdminSMSLogs = lazy(() => import("./pages/admin/AdminSMSLogs"));
const AdminDriverVisibility = lazy(() => import("./pages/admin/AdminDriverVisibility"));
const DriverRegistrationSettings = lazy(() => import("./pages/admin/DriverRegistrationSettings"));
const AdminRiderWaitSettings = lazy(() => import("./pages/admin/AdminRiderWaitSettings"));
const AdminComplaints = lazy(() => import("./pages/admin/AdminComplaints"));
const AdminStoppedRides = lazy(() => import("./pages/admin/AdminStoppedRides"));
const AdminEmergencySettings = lazy(() => import("./pages/admin/AdminEmergencySettings"));
const AdminBotCustomers = lazy(() => import("./pages/admin/AdminBotCustomers"));
const AdminBotChats = lazy(() => import("./pages/admin/AdminBotChats"));
const AdminMessengerAccounts = lazy(() => import("./pages/admin/AdminMessengerAccounts"));
const AdminDeveloperSettings = lazy(() => import("./pages/admin/AdminDeveloperSettings"));
const AdminSecuritySettings = lazy(() => import("./pages/admin/AdminSecuritySettings"));
const AdminWithdrawals = lazy(() => import("./pages/admin/AdminWithdrawals"));
const AdminFleets = lazy(() => import("./pages/admin/AdminFleets"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminNotificationGroups = lazy(() => import("./pages/admin/AdminNotificationGroups"));
const AdminDevInspector = lazy(() => import("./pages/admin/AdminDevInspector"));
const AdminReferralCodes = lazy(() => import("./pages/admin/AdminReferralCodes"));
const AdminFraudAlerts = lazy(() => import("./pages/admin/AdminFraudAlerts"));
const AdminCostControls = lazy(() => import("./pages/admin/AdminCostControls"));
const AdminDevelopmentTasks = lazy(() => import("./pages/admin/AdminDevelopmentTasks"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30 ثانية — لا يعيد الجلب إذا البيانات حديثة
      gcTime: 5 * 60_000,          // 5 دقائق — يحتفظ بالكاش
      refetchOnWindowFocus: false,  // لا يعيد الجلب عند العودة للتبويب
      retry: 1,                    // محاولة واحدة فقط بدل 3
    },
  },
});

// Ù…Ø³Ø§Ø¹Ø¯: ÙƒØ´Ù Ø§Ù„Ø¬ÙˆØ§Ù„
const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isNarrow = window.innerWidth < 768;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || ('standalone' in window.navigator && window.navigator.standalone === true);
  return isMobileUA || isNarrow || isStandalone;
};

const RouteTransitionFallback = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1326]/30 backdrop-blur-sm">
    <div className="w-10 h-10 rounded-full border-4 border-[#5bdda6]/20 border-t-[#5bdda6] animate-spin" />
  </div>
);

const LoadingFallback = () => <RouteTransitionFallback />;

const App = () => {
  return (
    <RaanThemeProvider>
      <ErrorBoundary>
        <Sentry.ErrorBoundary
          fallback={({ error, resetError }) => (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-destructive">حدث خطأ غير متوقع</h2>
                <p className="text-muted-foreground">
                  تم الإبلاغ عن هذا الخطأ تلقائياً لفريق التطوير
                </p>
                <Button onClick={resetError} variant="outline">
                  إعادة المحاولة
                </Button>
              </div>
            </div>
          )}
        >
          <TooltipProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <Sonner />
                <ConnectionStatus />
                {isNativePlatform ? (
                  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <Suspense fallback={<LoadingFallback />}>
                      <AppRoutes />
                    </Suspense>
                  </HashRouter>
                ) : (
                  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <Suspense fallback={<LoadingFallback />}>
                      <AppRoutes />
                    </Suspense>
                  </BrowserRouter>
                )}
              </AuthProvider>
            </QueryClientProvider>
          </TooltipProvider>
        </Sentry.ErrorBoundary>
      </ErrorBoundary>
    </RaanThemeProvider>
  );
};

// Separate AppRoutes component to use useAuth hook
const AppRoutes = () => {
  const { user, userRole, isLoading, isOnboardingComplete } = useAuth();

  // Minimum splash screen display (1.2 seconds — سريع على الجوال)
  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Prefetch أهم الصفحات بعد 3 ثوانٍ لتسريع التنقل
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userRole === 'driver') {
        import("./pages/driver/DriverRides");
        import("./pages/driver/DriverProfile");
      } else if (userRole === 'rider') {
        import("./pages/rider/RiderRidesPage");
        import("./pages/rider/RiderSettingsPage");
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [userRole]);

  // Show splash while auth is loading OR minimum time hasn't passed
  if (isLoading || !minSplashDone) {
  
    return <LoadingFallback />;
  }



  // No user - show public routes only (Ù…ØµØ§Ø¯Ù‚Ø© Ø¥Ù„Ø²Ø§Ù…ÙŠØ©)
  if (!user) {
    return (
      <Routes>
        {/* Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©: Ø§Ù„Ø¬ÙˆØ§Ù„ ÙŠØ°Ù‡Ø¨ Ù…Ø¨Ø§Ø´Ø±Ø© Ù„ØµÙØ­Ø© Ø§Ù„Ø¯Ø®ÙˆÙ„ */}
        <Route
          path="/"
          element={
            isMobileDevice() ? (
              <Navigate to="/auth" replace />
            ) : (
              <ErrorBoundary>
                <Index />
              </ErrorBoundary>
            )
          }
        />
        <Route
          path="/auth"
          element={
            <ErrorBoundary>
              <Auth />
            </ErrorBoundary>
          }
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/about" element={<MarketingAboutPage />} />
        <Route path="/help" element={<HelpAndContact />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/ai" element={<AIPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/drive" element={<DriverPage />} />
        <Route
          path="/track/:token"
          element={
            <ErrorBoundary>
              <TrackRide />
            </ErrorBoundary>
          }
        />
        <Route
          path="/driver/auth"
          element={
            <ErrorBoundary>
              <DriverAuth />
            </ErrorBoundary>
          }
        />
        <Route
          path="/driver/register"
          element={
            <ErrorBoundary>
              <DriverRegister />
            </ErrorBoundary>
          }
        />
        <Route
          path="/driver/complete-registration"
          element={
            <ErrorBoundary>
              <DriverCompleteRegistration />
            </ErrorBoundary>
          }
        />
        <Route
          path="/driver/application-status"
          element={
            <ErrorBoundary>
              <DriverApplicationStatus />
            </ErrorBoundary>
          }
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/payment/result"
          element={
            <ErrorBoundary>
              <PaymentResult />
            </ErrorBoundary>
          }
        />
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // User logged in AND onboarding NOT complete - show onboarding only
  if (user && !isOnboardingComplete) {
  
    return (
      <Routes>
        <Route
          path="/onboarding"
          element={
            <ErrorBoundary>
              <Onboarding />
            </ErrorBoundary>
          }
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
          <Route path="/about" element={<MarketingAboutPage />} />
        <Route path="/help" element={<HelpAndContact />} />
          <Route path="/contact" element={<ContactPage />} />
        {/* âœ… Redirect to onboarding if user tries other routes without completing it */}
        <Route path="*" element={<Navigate to="/onboarding" replace={false} />} />
      </Routes>
    );
  }

  // âœ… User logged in AND onboarding complete - show full app

  return (
    <Routes>
            {/* Redirect /onboarding to appropriate page if already completed */}
            <Route path="/onboarding" element={<Navigate to={userRole === "driver" ? "/driver" : "/rider"} replace />} />

            {/* Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©: Ø§Ù„Ø¬ÙˆØ§Ù„ â†’ /rider ØŒ Ø§Ù„Ø¯ÙŠØ³ÙƒØªÙˆØ¨ â†’ Ø­Ø³Ø¨ Ø§Ù„Ø¯ÙˆØ± */}
            <Route
              path="/"
              element={
                <Navigate to={
                  userRole === "admin" ? "/admin" :
                  userRole === "driver" ? "/driver" :
                  "/rider"
                } replace />
              }
            />
            <Route
              path="/auth"
              element={
                <Navigate to={
                  userRole === "admin" ? "/admin" :
                  userRole === "driver" ? "/driver" :
                  "/rider"
                } replace />
              }
            />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/about" element={<About />} />
            <Route path="/help" element={<HelpAndContact />} />
            <Route path="/contact" element={<HelpAndContact />} />
            <Route
              path="/track/:token"
              element={
                <ErrorBoundary>
                  <TrackRide />
                </ErrorBoundary>
              }
            />

            {/* Rider Auth Route - المستخدم مسجل بالفعل → توجيه لصفحة الراكب */}
            <Route
              path="/rider/auth"
              element={<Navigate to="/rider" replace />}
            />

            {/* Main Rider Route - AI Voice Home (الشاشة الرئيسية الصوتية) */}
            <Route
              path="/rider"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <AIVoiceHome />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />

            {/* Map Mode - Go Page (الخريطة التقليدية) */}
            <Route
              path="/rider/go"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <GoPage />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/schedule"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <GoPage scheduleMode={true} />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/notifications"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <RiderNotificationsPage />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/rides"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <RiderRidesPage />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/payments"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <RiderPaymentsPage />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/wallet-topup"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <WalletTopupPage />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/saved-places"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <RiderSavedPlacesPage />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="rider">
                    <RiderLayout>
                      <RiderSettingsPage />
                    </RiderLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />

            {/* Driver Routes */}
            <Route
              path="/driver"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverHome />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/auth"
              element={<Navigate to="/driver" replace />}
            />
            <Route
              path="/driver/register"
              element={
                <ErrorBoundary>
                  <DriverRegister />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/complete-registration"
              element={
                <ErrorBoundary>
                  <DriverCompleteRegistration />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/application-status"
              element={
                <ErrorBoundary>
                  <DriverApplicationStatus />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/rides"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverRides />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/finance"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverFinance />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            {/* /driver/wallet و /driver/payments → redirect لـ /driver/finance */}
            <Route path="/driver/wallet" element={<Navigate to="/driver/finance" replace />} />
            <Route path="/driver/payments" element={<Navigate to="/driver/finance" replace />} />
            <Route
              path="/driver/statistics"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverStatistics />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/profile"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverProfile />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverSettings />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/incentives"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverIncentives />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/subscription"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverSubscription />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/guide"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="driver">
                    <DriverLayout>
                      <DriverGuide />
                    </DriverLayout>
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
            <Route
              path="/admin"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/regions"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminRegions />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/landmarks"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminLandmarks />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/vehicle-types"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminVehicleTypes />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/drivers"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDrivers />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/fleets"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminFleets />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminNotifications />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/notification-groups"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminNotificationGroups />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/rides"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminRides />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminUsers />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/riders"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminRiders />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/map"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminMap />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminReports />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/cancellation"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminCancellationSettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/cancellation-report"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminCancellationReport />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/incentives"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminIncentives />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/referral-codes"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminReferralCodes />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/development-tasks"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDevelopmentTasks />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminAuditLogs />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/fraud-alerts"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminFraudAlerts />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/cost-controls"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminCostControls />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/pending-rides"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminPendingRides />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/drivers/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDriverDetails />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/driver-application/:id"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDriverApplication />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/api-stats"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminApiStats />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/commission-reports"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminCommissionReports />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/fare-settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminFareSettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/surge-pricing"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSurgePricing />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/subscription-plans"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSubscriptionPlans />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/commission-tiers"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminCommissionTiers />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/banned-names"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminBannedNames />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/promo-banners"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminPromoBanners />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/rider-pages"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminRiderPages />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/page-editor/:pageId"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminPageEditor />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/workflows"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminWorkflows />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/workflows/:workflowId"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminWorkflows />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/documentation"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDocumentation />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/bot-controller"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminBotController />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/bot-chats"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminBotChats />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/messenger-accounts"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminMessengerAccounts />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/wallet-requests"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminWalletRequests />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/sms-logs"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSMSLogs />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/driver-visibility"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDriverVisibility />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/driver-registration-settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <DriverRegistrationSettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/rider-wait-settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminRiderWaitSettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminComplaints />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/stopped-rides"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminStoppedRides />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/emergency-settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminEmergencySettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/bot-customers"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminBotCustomers />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/developer-settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDeveloperSettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/dev-inspector"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminDevInspector />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/security-settings"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminSecuritySettings />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/withdrawals"
              element={
                <ErrorBoundary>
                  <ProtectedRoute requiredRole="admin">
                    <AdminWithdrawals />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            />

            {/* Payment Result Route */}
            <Route
              path="/payment/result"
              element={
                <ErrorBoundary>
                  <PaymentResult />
                </ErrorBoundary>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
    );
};

export default App;
