import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initAnalytics } from "@/lib/analytics";

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

// Rider Pages
import RiderHome from "./pages/rider/RiderHome";
import RiderHomeClassic from "./pages/rider/RiderHomeClassic";
import RiderHomeCustom from "./pages/rider/RiderHomeCustom";
import RiderHomeMap from "./pages/rider/RiderHomeMap";
import RiderAuth from "./pages/rider/RiderAuth";
import RiderRides from "./pages/rider/RiderRides";
import RiderPayments from "./pages/rider/RiderPayments";
import RiderSettings from "./pages/rider/RiderSettings";
import RiderSavedPlaces from "./pages/rider/RiderSavedPlaces";
import RiderReferrals from "./pages/rider/RiderReferrals";

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
const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize analytics if enabled
    if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
      initAnalytics();
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ConnectionStatus />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
            <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/about" element={<About />} />
            <Route path="/help" element={<Help />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/track/:token" element={<ErrorBoundary><TrackRide /></ErrorBoundary>} />

            {/* Rider Routes */}
            <Route path="/rider" element={<ErrorBoundary><RiderHomeCustom /></ErrorBoundary>} />
            <Route path="/rider2" element={<ErrorBoundary><RiderHomeClassic /></ErrorBoundary>} />
            <Route path="/rider-1custom" element={<ErrorBoundary><RiderHomeCustom /></ErrorBoundary>} />
            <Route path="/rider11" element={<ErrorBoundary><RiderHomeCustom /></ErrorBoundary>} />
            <Route path="/rider-map" element={<ErrorBoundary><RiderHomeMap /></ErrorBoundary>} />
            <Route path="/rider/auth" element={<ErrorBoundary><RiderAuth /></ErrorBoundary>} />
            <Route path="/rider/rides" element={<ErrorBoundary><RiderRides /></ErrorBoundary>} />
            <Route path="/rider/payments" element={<ErrorBoundary><RiderPayments /></ErrorBoundary>} />
            <Route path="/rider/settings" element={<ErrorBoundary><RiderSettings /></ErrorBoundary>} />
            <Route path="/rider/saved-places" element={<ErrorBoundary><RiderSavedPlaces /></ErrorBoundary>} />
            <Route path="/rider/referrals" element={<ErrorBoundary><RiderReferrals /></ErrorBoundary>} />

            {/* Driver Routes */}
            <Route path="/driver" element={<ErrorBoundary><DriverHome /></ErrorBoundary>} />
            <Route path="/driver/auth" element={<ErrorBoundary><DriverAuth /></ErrorBoundary>} />
            <Route path="/driver/register" element={<ErrorBoundary><DriverRegister /></ErrorBoundary>} />
            <Route path="/driver/complete-registration" element={<ErrorBoundary><DriverCompleteRegistration /></ErrorBoundary>} />
            <Route path="/driver/application-status" element={<ErrorBoundary><DriverApplicationStatus /></ErrorBoundary>} />
            <Route path="/driver/rides" element={<ErrorBoundary><DriverRides /></ErrorBoundary>} />
            <Route path="/driver/finance" element={<ErrorBoundary><DriverFinance /></ErrorBoundary>} />
            <Route path="/driver/wallet" element={<ErrorBoundary><DriverFinance /></ErrorBoundary>} />
            <Route path="/driver/payments" element={<ErrorBoundary><DriverFinance /></ErrorBoundary>} />
            <Route path="/driver/statistics" element={<ErrorBoundary><DriverStatistics /></ErrorBoundary>} />
            <Route path="/driver/profile" element={<ErrorBoundary><DriverProfile /></ErrorBoundary>} />
            <Route path="/driver/settings" element={<ErrorBoundary><DriverSettings /></ErrorBoundary>} />
            <Route path="/driver/incentives" element={<ErrorBoundary><DriverIncentives /></ErrorBoundary>} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<ErrorBoundary><AdminLogin /></ErrorBoundary>} />
            <Route path="/admin" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
            <Route path="/admin/regions" element={<ErrorBoundary><AdminRegions /></ErrorBoundary>} />
            <Route path="/admin/landmarks" element={<ErrorBoundary><AdminLandmarks /></ErrorBoundary>} />
            <Route path="/admin/vehicle-types" element={<ErrorBoundary><AdminVehicleTypes /></ErrorBoundary>} />
            <Route path="/admin/drivers" element={<ErrorBoundary><AdminDrivers /></ErrorBoundary>} />
            <Route path="/admin/rides" element={<ErrorBoundary><AdminRides /></ErrorBoundary>} />
            <Route path="/admin/users" element={<ErrorBoundary><AdminUsers /></ErrorBoundary>} />
            <Route path="/admin/riders" element={<ErrorBoundary><AdminRiders /></ErrorBoundary>} />
            <Route path="/admin/settings" element={<ErrorBoundary><AdminSettings /></ErrorBoundary>} />
            <Route path="/admin/map" element={<ErrorBoundary><AdminMap /></ErrorBoundary>} />
            <Route path="/admin/reports" element={<ErrorBoundary><AdminReports /></ErrorBoundary>} />
            <Route path="/admin/cancellation" element={<ErrorBoundary><AdminCancellationSettings /></ErrorBoundary>} />
            <Route path="/admin/cancellation-report" element={<ErrorBoundary><AdminCancellationReport /></ErrorBoundary>} />
            <Route path="/admin/incentives" element={<ErrorBoundary><AdminIncentives /></ErrorBoundary>} />
            <Route path="/admin/pending-rides" element={<ErrorBoundary><AdminPendingRides /></ErrorBoundary>} />
            <Route path="/admin/drivers/:id" element={<ErrorBoundary><AdminDriverApplication /></ErrorBoundary>} />
            <Route path="/admin/api-stats" element={<ErrorBoundary><AdminApiStats /></ErrorBoundary>} />
            <Route path="/admin/commission-reports" element={<ErrorBoundary><AdminCommissionReports /></ErrorBoundary>} />
            <Route path="/admin/fare-settings" element={<ErrorBoundary><AdminFareSettings /></ErrorBoundary>} />
            <Route path="/admin/surge-pricing" element={<ErrorBoundary><AdminSurgePricing /></ErrorBoundary>} />
            <Route path="/admin/subscription-plans" element={<ErrorBoundary><AdminSubscriptionPlans /></ErrorBoundary>} />
            <Route path="/admin/commission-tiers" element={<ErrorBoundary><AdminCommissionTiers /></ErrorBoundary>} />
            <Route path="/admin/banned-names" element={<ErrorBoundary><AdminBannedNames /></ErrorBoundary>} />
            <Route path="/admin/promo-banners" element={<ErrorBoundary><AdminPromoBanners /></ErrorBoundary>} />
            <Route path="/admin/rider-pages" element={<ErrorBoundary><AdminRiderPages /></ErrorBoundary>} />
            <Route path="/admin/page-editor/:pageId" element={<ErrorBoundary><AdminPageEditor /></ErrorBoundary>} />
            <Route path="/admin/wallet-requests" element={<ErrorBoundary><AdminWalletRequests /></ErrorBoundary>} />
            <Route path="/admin/sms-logs" element={<ErrorBoundary><AdminSMSLogs /></ErrorBoundary>} />
            <Route path="/admin/driver-visibility" element={<ErrorBoundary><AdminDriverVisibility /></ErrorBoundary>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
