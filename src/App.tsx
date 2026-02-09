import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/admin/AdminLogin";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import TrackRide from "./pages/TrackRide";
import About from "./pages/About";
import Help from "./pages/Help";
import ContactUs from "./pages/ContactUs";
import PaymentResult from "./pages/payment/PaymentResult";

// Rider Pages
import GoPage from "./pages/rider/GoPage";
import RiderRidesPage from "./pages/rider/RiderRidesPage";
import RiderPaymentsPage from "./pages/rider/RiderPaymentsPage";
import WalletTopupPage from "./pages/rider/WalletTopupPage";
import RiderSavedPlacesPage from "./pages/rider/RiderSavedPlacesPage";
import RiderSettingsPage from "./pages/rider/RiderSettingsPage";
import RiderLayout from "./components/rider/RiderLayout";

// Driver Pages
import DriverHome from "./pages/driver/DriverHome";
import DriverAuth from "./pages/driver/DriverAuth";
import DriverRegister from "./pages/driver/DriverRegister";
import DriverCompleteRegistration from "./pages/driver/DriverCompleteRegistration";
import DriverApplicationStatus from "./pages/driver/DriverApplicationStatus";
import DriverRides from "./pages/driver/DriverRides";
import DriverSettings from "./pages/driver/DriverSettings";
import DriverStatistics from "./pages/driver/DriverStatistics";
import DriverProfile from "./pages/driver/DriverProfile";
import DriverIncentives from "./pages/driver/DriverIncentives";
import DriverFinance from "./pages/driver/DriverFinance";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRegions from "./pages/admin/AdminRegions";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminRides from "./pages/admin/AdminRides";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminRiders from "./pages/admin/AdminRiders";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminApiStats from "./pages/admin/AdminApiStats";
import AdminMap from "./pages/admin/AdminMap";
import AdminReports from "./pages/admin/AdminReports";
import AdminLandmarks from "./pages/admin/AdminLandmarks";
import AdminCancellationSettings from "./pages/admin/AdminCancellationSettings";
import AdminCancellationReport from "./pages/admin/AdminCancellationReport";
import AdminIncentives from "./pages/admin/AdminIncentives";
import AdminDriverApplication from "./pages/admin/AdminDriverApplication";
import AdminPendingRides from "./pages/admin/AdminPendingRides";
import AdminCommissionReports from "./pages/admin/AdminCommissionReports";
import AdminVehicleTypes from "./pages/admin/AdminVehicleTypes";
import AdminSurgePricing from "./pages/admin/AdminSurgePricing";
import AdminSubscriptionPlans from "./pages/admin/AdminSubscriptionPlans";
import AdminCommissionTiers from "./pages/admin/AdminCommissionTiers";
import AdminFareSettings from "./pages/admin/AdminFareSettings";
import AdminBannedNames from "./pages/admin/AdminBannedNames";
import AdminPromoBanners from "./pages/admin/AdminPromoBanners";
import AdminRiderPages from "./pages/admin/AdminRiderPages";
import AdminPageEditor from "./pages/admin/AdminPageEditor";
import AdminWalletRequests from "./pages/admin/AdminWalletRequests";
import AdminSMSLogs from "./pages/admin/AdminSMSLogs";
import AdminDriverVisibility from "./pages/admin/AdminDriverVisibility";
import DriverRegistrationSettings from "./pages/admin/DriverRegistrationSettings";
import AdminRiderWaitSettings from "./pages/admin/AdminRiderWaitSettings";
import AdminComplaints from "./pages/admin/AdminComplaints";
import AdminStoppedRides from "./pages/admin/AdminStoppedRides";
import AdminEmergencySettings from "./pages/admin/AdminEmergencySettings";
const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ConnectionStatus />
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            {/* Public Routes */}
            <Route
              path="/"
              element={
                <ErrorBoundary>
                  <Index />
                </ErrorBoundary>
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
            <Route path="/about" element={<About />} />
            <Route path="/help" element={<Help />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route
              path="/track/:token"
              element={
                <ErrorBoundary>
                  <TrackRide />
                </ErrorBoundary>
              }
            />

            {/* Rider Auth Route */}
            <Route
              path="/rider/auth"
              element={
                <ErrorBoundary>
                  <Auth />
                </ErrorBoundary>
              }
            />

            {/* Main Rider Route - Go Page */}
            <Route
              path="/rider"
              element={
                <ProtectedRoute redirectTo="/rider/auth">
                  <ErrorBoundary>
                    <RiderLayout>
                      <GoPage />
                    </RiderLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/schedule"
              element={
                <ProtectedRoute redirectTo="/rider/auth">
                  <ErrorBoundary>
                    <RiderLayout>
                      <GoPage scheduleMode={true} />
                    </RiderLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/rides"
              element={
                <ProtectedRoute redirectTo="/rider/auth">
                  <ErrorBoundary>
                    <RiderLayout>
                      <RiderRidesPage />
                    </RiderLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/payments"
              element={
                <ProtectedRoute redirectTo="/rider/auth">
                  <ErrorBoundary>
                    <RiderLayout>
                      <RiderPaymentsPage />
                    </RiderLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/wallet-topup"
              element={
                <ProtectedRoute redirectTo="/rider/auth">
                  <ErrorBoundary>
                    <RiderLayout>
                      <WalletTopupPage />
                    </RiderLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/saved-places"
              element={
                <ProtectedRoute redirectTo="/rider/auth">
                  <ErrorBoundary>
                    <RiderLayout>
                      <RiderSavedPlacesPage />
                    </RiderLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rider/settings"
              element={
                <ProtectedRoute redirectTo="/rider/auth">
                  <ErrorBoundary>
                    <RiderLayout>
                      <RiderSettingsPage />
                    </RiderLayout>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Driver Routes */}
            <Route
              path="/driver"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverHome />
                  </ErrorBoundary>
                </ProtectedRoute>
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
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverRegister />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/complete-registration"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverCompleteRegistration />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/application-status"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverApplicationStatus />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/rides"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverRides />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/finance"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverFinance />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/wallet"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverFinance />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/payments"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverFinance />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/statistics"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverStatistics />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/profile"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverProfile />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/settings"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverSettings />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/incentives"
              element={
                <ProtectedRoute redirectTo="/driver/auth">
                  <ErrorBoundary>
                    <DriverIncentives />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/login"
              element={
                <ErrorBoundary>
                  <AdminLogin />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/regions"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminRegions />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/landmarks"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminLandmarks />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/vehicle-types"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminVehicleTypes />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/drivers"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminDrivers />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rides"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminRides />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminUsers />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/riders"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminRiders />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminSettings />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/map"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminMap />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminReports />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cancellation"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminCancellationSettings />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cancellation-report"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminCancellationReport />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/incentives"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminIncentives />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pending-rides"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminPendingRides />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/drivers/:id"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminDriverApplication />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/api-stats"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminApiStats />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/commission-reports"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminCommissionReports />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/fare-settings"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminFareSettings />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/surge-pricing"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminSurgePricing />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/subscription-plans"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminSubscriptionPlans />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/commission-tiers"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminCommissionTiers />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/banned-names"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminBannedNames />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/promo-banners"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminPromoBanners />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rider-pages"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminRiderPages />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/page-editor/:pageId"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminPageEditor />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/wallet-requests"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminWalletRequests />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sms-logs"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminSMSLogs />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/driver-visibility"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminDriverVisibility />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/driver-registration-settings"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <DriverRegistrationSettings />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rider-wait-settings"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminRiderWaitSettings />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminComplaints />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/stopped-rides"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminStoppedRides />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/emergency-settings"
              element={
                <ProtectedRoute redirectTo="/admin/login">
                  <ErrorBoundary>
                    <AdminEmergencySettings />
                  </ErrorBoundary>
                </ProtectedRoute>
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
          </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
