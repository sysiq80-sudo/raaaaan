import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Loader2, Clock, AlertTriangle, Menu, ChevronDown } from "lucide-react";
import RiderMapHeader from "@/components/rider/RiderMapHeader";
import RiderBottomSheet from "@/components/rider/RiderBottomSheet";
import RideRouteSummaryCard from "@/components/rider/RideRouteSummaryCard";
import VehicleOptionCard from "@/components/rider/VehicleOptionCard";
import PaymentMethodRow from "@/components/rider/PaymentMethodRow";
import PaymentMethodSheet from "@/components/rider/PaymentMethodSheet";
import VehicleTypeSheet, { VEHICLE_NAMES } from "@/components/rider/VehicleTypeSheet";
import { ScheduleRideDialog } from "@/components/rider/ScheduleRideDialog";
import MultiStopSelector from "@/components/rider/MultiStopSelector";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import { roundFare } from "@/lib/constants";
import type { FareBreakdown } from "@/hooks/useFareCalculation";
import type { PaymentMethod as PaymentMethodType } from "@/types/savedCards";
import { useToast } from "@/hooks/use-toast";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

interface IntermediateStop {
  id: string;
  address: string;
  location: { lat: number; lng: number } | null;
  estimatedTime?: number;
  distanceFromPrevious?: number;
}

export interface BookingConfirmationViewProps {
  // Route
  pickupLocation: LocationType;
  dropoffLocation: LocationType;
  routeDistance: number | null;
  routeDuration: number | null;
  // Map
  bookingMapContainerRef: React.RefCallback<HTMLDivElement> | React.RefObject<HTMLDivElement>;
  onGeolocate: () => void;
  // Fare
  fareBreakdown: FareBreakdown | null;
  fareLoading: boolean;
  // Vehicle & Payment
  selectedVehicle: VehicleType;
  onVehicleChange: (v: VehicleType) => void;
  paymentMethod: PaymentMethodType;
  onPaymentChange: (p: PaymentMethodType) => void;
  // Booking
  isBooking: boolean;
  onBookRide: () => void;
  // Navigation
  onEditLocation: (mode: "pickup" | "dropoff") => void;
  intermediateStops: IntermediateStop[];
  onStopsChange: (stops: IntermediateStop[]) => void;
  onStopSelect: (stopId: string) => void;
  onSwapLocations: () => void;
  // Schedule
  scheduleDialogRef: React.RefObject<{ openDialog: () => void }>;
  onScheduled: () => void;
  // Status
  isOnline: boolean;
  bottomNavEnabled: boolean;
  // UI Helpers
  buildDescriptiveAddress: (address: string) => string;
  availableDriversByType: Record<string, number>;
  // Side menu
  user: any;
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  onLogout: () => Promise<void>;
}

const VEHICLES: {
  type: VehicleType;
  name: string;
  desc: string;
  multiplier: number;
}[] = [
  { type: "economy",    name: "اقتصادي",  desc: "مناسب وبسعر معقول",     multiplier: 1.0 },
  { type: "comfort",    name: "مريح",      desc: "سيارة مريحة وأوسع",     multiplier: 1.3 },
  { type: "premium",    name: "فاخر",      desc: "تجربة متميزة وفاخرة",   multiplier: 1.6 },
  { type: "women_only", name: "نسائي",     desc: "سائقة متخصصة للسيدات",  multiplier: 1.2 },
];

const BookingConfirmationView: React.FC<BookingConfirmationViewProps> = ({
  pickupLocation,
  dropoffLocation,
  routeDistance,
  routeDuration,
  bookingMapContainerRef,
  onGeolocate,
  fareBreakdown,
  fareLoading,
  selectedVehicle,
  onVehicleChange,
  paymentMethod,
  onPaymentChange,
  isBooking,
  onBookRide,
  onEditLocation,
  intermediateStops,
  onStopsChange,
  onStopSelect,
  onSwapLocations,
  scheduleDialogRef,
  onScheduled,
  isOnline,
  bottomNavEnabled,
  buildDescriptiveAddress,
  availableDriversByType,
  user,
  menuOpen,
  onMenuToggle,
  onLogout,
}) => {
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<"now" | "schedule">("now");
  const { toast } = useToast();

  const handlePrimaryBookAction = () => {
    if (isBooking) return;

    if (bookingMode === "schedule") {
      scheduleDialogRef.current?.openDialog();
      return;
    }

    if (fareLoading) {
      toast({
        title: "جاري حساب المسار ⏳",
        description: "يرجى الانتظار لحظة",
      });
      return;
    }

    if (!fareBreakdown) {
      toast({
        title: "عذراً، تعذر الحجز 😔",
        description: "النقطة المحددة خارج التغطية",
        variant: "destructive",
      });
      return;
    }

    onBookRide();
  };

  const totalFare = fareBreakdown?.total_fare ? roundFare(fareBreakdown.total_fare) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative h-full w-full z-10 flex flex-col overflow-hidden overscroll-none"
      dir="rtl"
    >
      {/* Offline banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-[70] bg-[#F04438] px-4 py-2 text-center text-sm font-medium text-white flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>أنت بدون إنترنت</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen map */}
      <div className="absolute inset-0 bg-[#F7F8FA]">
        <div ref={bookingMapContainerRef} className="absolute inset-0" />

        {/* Geolocate button — above bottom sheet */}
        <button
          onClick={onGeolocate}
          className="absolute left-4 z-40 w-11 h-11 flex items-center justify-center rounded-2xl bg-white shadow-md hover:shadow-lg active:scale-95 transition-all border border-gray-100"
          style={{ bottom: "calc(55% + 16px)" }}
          aria-label="تحديد موقعي"
        >
          <Navigation className="w-4.5 h-4.5 text-[#0A2F6E]" />
        </button>
      </div>

      {/* Header */}
      <RiderMapHeader onMenuOpen={() => onMenuToggle(true)} />

      {/* Bottom Sheet */}
      <RiderBottomSheet className="!max-h-[58dvh]">
        <div className="flex-1 flex flex-col px-4 gap-3 overflow-y-auto min-h-0 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Route summary */}
          <RideRouteSummaryCard
            pickupAddress={buildDescriptiveAddress(pickupLocation.address || "")}
            dropoffAddress={buildDescriptiveAddress(dropoffLocation.address || "")}
            distance={fareBreakdown?.distance_km ?? routeDistance}
            duration={routeDuration ?? (fareBreakdown ? Math.ceil(fareBreakdown.distance_km * 2.5) : null)}
            onEditPickup={() => onEditLocation("pickup")}
            onEditDropoff={() => onEditLocation("dropoff")}
            onSwap={onSwapLocations}
          />

          {/* Multi-stop */}
          <MultiStopSelector
            pickup={{
              address: buildDescriptiveAddress(pickupLocation.address || ""),
              location: { lat: pickupLocation.lat, lng: pickupLocation.lng },
            }}
            dropoff={{
              address: buildDescriptiveAddress(dropoffLocation.address || ""),
              location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
            }}
            intermediateStops={intermediateStops}
            onStopsChange={onStopsChange}
            onStopSelect={onStopSelect}
            disabled={isBooking}
          />

          {/* Vehicle selection — inline cards */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wider px-1">اختر نوع السيارة</p>
            {VEHICLES.map((v) => {
              const driverCount = availableDriversByType?.[v.type] ?? 0;
              const fare = fareBreakdown?.total_fare ? Math.round(fareBreakdown.total_fare * v.multiplier) : null;
              return (
                <VehicleOptionCard
                  key={v.type}
                  type={v.type}
                  name={v.name}
                  description={v.desc}
                  fare={fare}
                  driverCount={availableDriversByType !== undefined ? driverCount : 1}
                  isSelected={selectedVehicle === v.type}
                  onSelect={() => onVehicleChange(v.type)}
                />
              );
            })}
          </div>

          {/* Payment + Schedule row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <PaymentMethodRow
                method={paymentMethod}
                onPress={() => setPaymentSheetOpen(true)}
              />
            </div>
            <div className="shrink-0 flex rounded-2xl bg-gray-50 p-1 gap-0.5">
              <button
                onClick={() => setBookingMode("now")}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                  bookingMode === "now"
                    ? "bg-[#0A2F6E] text-white shadow-sm"
                    : "text-[#667085] hover:text-[#101828]"
                }`}
              >
                الآن
              </button>
              <button
                onClick={() => setBookingMode("schedule")}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                  bookingMode === "schedule"
                    ? "bg-[#0A2F6E] text-white shadow-sm"
                    : "text-[#667085] hover:text-[#101828]"
                }`}
              >
                جدولة
              </button>
            </div>
          </div>
        </div>

        {/* CTA Button — always visible at bottom */}
        <div
          className="shrink-0 px-4 pt-2 bg-white border-t border-gray-100 pointer-events-auto relative z-[10]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)" }}
        >
          <motion.button
            type="button"
            onClick={handlePrimaryBookAction}
            disabled={isBooking}
            whileTap={isBooking ? {} : { scale: 0.97 }}
            className={`w-full h-[56px] rounded-2xl flex items-center justify-center gap-2.5 text-base font-bold transition-all duration-200 shadow-lg ${
              isBooking
                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                : fareLoading
                ? "bg-[#00B3B0]/70 text-white shadow-[0_8px_24px_rgba(0,179,176,0.2)]"
                : "bg-[#00B3B0] hover:bg-[#009E9B] active:bg-[#008B88] text-white shadow-[0_8px_24px_rgba(0,179,176,0.3)]"
            }`}
          >
            {isBooking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري إنشاء الحجز...</span>
              </>
            ) : fareLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري حساب المسار...</span>
              </>
            ) : (
              <>
                {bookingMode === "schedule" ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
                <span>{bookingMode === "schedule" ? "جدولة الرحلة" : "اطلب الآن"}</span>
                {totalFare && (
                  <span className="bg-white/20 px-3 py-1 rounded-xl text-sm font-bold">
                    {totalFare.toLocaleString()} د.ع
                  </span>
                )}
              </>
            )}
          </motion.button>
        </div>
      </RiderBottomSheet>

      {/* Hidden schedule dialog ref */}
      <div className="hidden">
        <ScheduleRideDialog
          ref={scheduleDialogRef}
          pickup={pickupLocation}
          dropoff={dropoffLocation}
          vehicleType={selectedVehicle}
          paymentMethod={paymentMethod}
          estimatedFare={fareBreakdown?.total_fare || null}
          onScheduled={onScheduled}
        />
      </div>

      {/* Sheets (secondary) */}
      <VehicleTypeSheet
        open={vehicleSheetOpen}
        onOpenChange={setVehicleSheetOpen}
        selectedVehicle={selectedVehicle}
        onSelect={onVehicleChange}
        baseFare={fareBreakdown?.total_fare}
        availableDrivers={availableDriversByType}
      />
      <PaymentMethodSheet
        open={paymentSheetOpen}
        onOpenChange={setPaymentSheetOpen}
        selectedMethod={paymentMethod}
        onSelect={onPaymentChange}
      />

      {/* Side Menu */}
      <RiderSideMenu
        user={user}
        isOpen={menuOpen}
        onClose={() => onMenuToggle(false)}
        onLogout={onLogout}
      />
    </motion.div>
  );
};

export default BookingConfirmationView;
