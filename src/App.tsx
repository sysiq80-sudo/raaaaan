import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";

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
                <ErrorBoundary>
                  <RiderLayout>
                    <GoPage />
                  </RiderLayout>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/schedule"
              element={
                <ErrorBoundary>
                  <RiderLayout>
                    <GoPage scheduleMode={true} />
                  </RiderLayout>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/rides"
              element={
                <ErrorBoundary>
                  <RiderLayout>
                    <RiderRidesPage />
                  </RiderLayout>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/payments"
              element={
                <ErrorBoundary>
                  <RiderLayout>
                    <RiderPaymentsPage />
                  </RiderLayout>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/wallet-topup"
              element={
                <ErrorBoundary>
                  <RiderLayout>
                    <WalletTopupPage />
                  </RiderLayout>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/saved-places"
              element={
                <ErrorBoundary>
                  <RiderLayout>
                    <RiderSavedPlacesPage />
                  </RiderLayout>
                </ErrorBoundary>
              }
            />
            <Route
              path="/rider/settings"
              element={
                <ErrorBoundary>
                  <RiderLayout>
                    <RiderSettingsPage />
                  </RiderLayout>
                </ErrorBoundary>
              }
            />

            {/* Driver Routes */}
            <Route
              path="/driver"
              element={
                <ErrorBoundary>
                  <DriverHome />
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
            <Route
              path="/driver/rides"
              element={
                <ErrorBoundary>
                  <DriverRides />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/finance"
              element={
                <ErrorBoundary>
                  <DriverFinance />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/wallet"
              element={
                <ErrorBoundary>
                  <DriverFinance />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/payments"
              element={
                <ErrorBoundary>
                  <DriverFinance />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/statistics"
              element={
                <ErrorBoundary>
                  <DriverStatistics />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/profile"
              element={
                <ErrorBoundary>
                  <DriverProfile />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/settings"
              element={
                <ErrorBoundary>
                  <DriverSettings />
                </ErrorBoundary>
              }
            />
            <Route
              path="/driver/incentives"
              element={
                <ErrorBoundary>
                  <DriverIncentives />
                </ErrorBoundary>
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
                <ErrorBoundary>
                  <AdminDashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/regions"
              element={
                <ErrorBoundary>
                  <AdminRegions />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/landmarks"
              element={
                <ErrorBoundary>
                  <AdminLandmarks />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/vehicle-types"
              element={
                <ErrorBoundary>
                  <AdminVehicleTypes />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/drivers"
              element={
                <ErrorBoundary>
                  <AdminDrivers />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/rides"
              element={
                <ErrorBoundary>
                  <AdminRides />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ErrorBoundary>
                  <AdminUsers />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/riders"
              element={
                <ErrorBoundary>
                  <AdminRiders />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ErrorBoundary>
                  <AdminSettings />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/map"
              element={
                <ErrorBoundary>
                  <AdminMap />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ErrorBoundary>
                  <AdminReports />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/cancellation"
              element={
                <ErrorBoundary>
                  <AdminCancellationSettings />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/cancellation-report"
              element={
                <ErrorBoundary>
                  <AdminCancellationReport />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/incentives"
              element={
                <ErrorBoundary>
                  <AdminIncentives />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/pending-rides"
              element={
                <ErrorBoundary>
                  <AdminPendingRides />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/drivers/:id"
              element={
                <ErrorBoundary>
                  <AdminDriverApplication />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/api-stats"
              element={
                <ErrorBoundary>
                  <AdminApiStats />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/commission-reports"
              element={
                <ErrorBoundary>
                  <AdminCommissionReports />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/fare-settings"
              element={
                <ErrorBoundary>
                  <AdminFareSettings />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/surge-pricing"
              element={
                <ErrorBoundary>
                  <AdminSurgePricing />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/subscription-plans"
              element={
                <ErrorBoundary>
                  <AdminSubscriptionPlans />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/commission-tiers"
              element={
                <ErrorBoundary>
                  <AdminCommissionTiers />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/banned-names"
              element={
                <ErrorBoundary>
                  <AdminBannedNames />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/promo-banners"
              element={
                <ErrorBoundary>
                  <AdminPromoBanners />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/rider-pages"
              element={
                <ErrorBoundary>
                  <AdminRiderPages />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/page-editor/:pageId"
              element={
                <ErrorBoundary>
                  <AdminPageEditor />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/wallet-requests"
              element={
                <ErrorBoundary>
                  <AdminWalletRequests />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/sms-logs"
              element={
                <ErrorBoundary>
                  <AdminSMSLogs />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/driver-visibility"
              element={
                <ErrorBoundary>
                  <AdminDriverVisibility />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/driver-registration-settings"
              element={
                <ErrorBoundary>
                  <DriverRegistrationSettings />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/rider-wait-settings"
              element={
                <ErrorBoundary>
                  <AdminRiderWaitSettings />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <ErrorBoundary>
                  <AdminComplaints />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/stopped-rides"
              element={
                <ErrorBoundary>
                  <AdminStoppedRides />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin/emergency-settings"
              element={
                <ErrorBoundary>
                  <AdminEmergencySettings />
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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
