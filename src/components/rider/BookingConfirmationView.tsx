import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Loader2, Clock, AlertTriangle, Menu, ChevronDown, Search } from "lucide-react";
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
import { calculateDistanceMeters } from "@/lib/mapUtils";

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
  snappedLat?: number;
  snappedLng?: number;
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
  /** رسالة خطأ من حساب الأجرة (مثل: نقطة الوصول قريبة جداً) */
  fareError?: string | null;
  // UI Helpers
  buildDescriptiveAddress: (address: string) => string;
  availableDriversByType: Record<string, number>;
  // Side menu
  user: any;
  menuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
  onLogout: () => Promise<void>;
  /** رجوع من شاشة تأكيد الحجز */
  onGoBack?: () => void;
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
  fareError,
  buildDescriptiveAddress,
  availableDriversByType,
  user,
  menuOpen,
  onMenuToggle,
  onLogout,
  onGoBack,
}) => {
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<"now" | "schedule">("now");
  const { toast } = useToast();



  // Force selected vehicle to 'economy' temporarily as per user request (one type for all)
  useEffect(() => {
    if (selectedVehicle !== "economy" && onVehicleChange) {
      onVehicleChange("economy");
    }
  }, [selectedVehicle, onVehicleChange]);

  useEffect(() => {
    if (paymentMethod !== "cash" && paymentMethod !== "wallet") {
      onPaymentChange("cash");
    }
  }, [paymentMethod, onPaymentChange]);

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
        description: fareError || "تعذر حساب الأجرة، يرجى المحاولة مجدداً",
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
      className="relative h-full w-full z-10 flex flex-col overflow-hidden overscroll-none max-w-[480px] mx-auto"
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
      <div className="absolute inset-0 bg-background">
        <div ref={bookingMapContainerRef} className="absolute inset-0" />


      </div>

      {/* Header */}
      <RiderMapHeader
        onMenuOpen={() => onMenuToggle(true)}
        onGoBack={onGoBack}
        stepLabel="تأكيد الحجز"
      />

      {/* Bottom Sheet */}
      <RiderBottomSheet className="!max-h-[55dvh]">
        <div className="flex-1 flex flex-col px-4 gap-3 overflow-y-auto min-h-0 pb-2 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
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



          {/* Vehicle selection — inline cards (Temporarily disabled and hidden) */}
          {/*
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">اختر نوع السيارة</p>
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
          */}

          {/* Driver availability — contextual message */}
          {(() => {
            const totalDrivers = Object.values(availableDriversByType || {}).reduce((a, b) => a + b, 0);
            if (totalDrivers === 0) {
              return (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-primary text-sm">جار البحث عن أقرب السائقين</p>
                    <p className="text-muted-foreground text-xs mt-0.5">سنبحث لك تلقائياً عند الطلب</p>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Payment + Schedule row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <PaymentMethodRow
                method={paymentMethod}
                onPress={() => setPaymentSheetOpen(true)}
              />
            </div>
            {/* ── الجدولة معطلة مؤقتاً — سيتم تفعيلها في إصدار مستقبلي ── */}
            {/*
            <div className="shrink-0 flex rounded-2xl bg-secondary border border-border/30 p-1 gap-0.5">
              <button
                onClick={() => setBookingMode("now")}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                  bookingMode === "now"
                    ? "bg-ring text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الآن
              </button>
              <button
                onClick={() => setBookingMode("schedule")}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                  bookingMode === "schedule"
                    ? "bg-ring text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                جدولة
              </button>
            </div>
            */}
          </div>
        </div>

        {/* CTA Button — ملاصق للأسفل */}
        <div
          className="shrink-0 w-full pointer-events-auto bg-card border-t border-white/[0.06] relative z-[10]"
          style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}
        >
          <div className="flex items-stretch">
            <motion.button
              type="button"
              onClick={handlePrimaryBookAction}
              disabled={isBooking}
              whileTap={isBooking ? {} : { scale: 0.98 }}
              style={{ fontFamily: "Cairo, sans-serif" }}
              className={`flex-1 h-[72px] flex items-center justify-center gap-2 text-lg font-black touch-manipulation pointer-events-auto active:scale-[0.98] transition-all rounded-none ${
                isBooking
                  ? "text-white/40 bg-[#0a111c] border-t border-white/[0.07] cursor-not-allowed"
                  : fareLoading
                  ? "text-white/60 bg-[#0a111c] border-t border-white/[0.07] cursor-wait"
                  : "text-[#070b13] bg-[#5bdda6] shadow-[0_-4px_20px_rgba(91,221,166,0.2)] hover:bg-[#4ecf99] active:bg-[#34d399] border-t border-[#5bdda6]/30"
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
                    <span className="bg-[#070b13]/20 px-3 py-1 rounded-xl text-sm font-bold">
                      {totalFare.toLocaleString('en-US')} د.ع
                    </span>
                  )}
                </>
              )}
            </motion.button>
          </div>
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
        isOpen={menuOpen}
        onClose={() => onMenuToggle(false)}
        onLogout={onLogout}
      />
    </motion.div>
  );
};

export default BookingConfirmationView;
