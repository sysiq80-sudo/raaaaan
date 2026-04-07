import React, { useState } from "react";
import { motion } from "framer-motion";
import { Navigation, Loader2, Clock, ChevronDown, AlertTriangle, Menu, ArrowUpDown } from "lucide-react";
import CompactVehicleSelector from "@/components/rider/CompactVehicleSelector";
import PaymentMethodSheet from "@/components/rider/PaymentMethodSheet";
import VehicleTypeSheet, { VEHICLE_NAMES } from "@/components/rider/VehicleTypeSheet";
import { ScheduleRideDialog } from "@/components/rider/ScheduleRideDialog";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import logo from "@/assets/logo.png";
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

export interface BookingConfirmationViewProps {
  // Route
  pickupLocation: LocationType;
  dropoffLocation: LocationType;
  routeDistance: number | null;
  routeDuration: number | null;
  // Map
  bookingMapContainerRef: React.RefCallback<HTMLDivElement> | React.RefObject<HTMLDivElement | null>;
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
  onSwapLocations: () => void;
  // Schedule
  scheduleDialogRef: React.RefObject<{ openDialog: () => void } | null>;
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
  const { toast } = useToast();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden touch-none overscroll-none"
    >
      {/* Offline status indicator */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-destructive/90 backdrop-blur-md px-4 py-2 text-center text-sm font-medium text-destructive-foreground flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>أنت بدون إنترنت - بعض الميزات قد لا تعمل</span>
        </div>
      )}

      {/* Progress indicator */}
      <div className={`absolute left-0 right-0 z-50 px-4 pointer-events-none ${!isOnline ? "pt-14" : "pt-2"}`}>
        <div className="flex gap-2">
          <div className="flex-1 h-1 rounded-full bg-primary" />
          <div className="flex-1 h-1 rounded-full bg-accent" />
          <div className="flex-1 h-1 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      {/* Header */}
        {/* Header - موحد مع GoPage */}
        <header
          className="absolute top-0 left-0 right-0 z-40 pt-[env(safe-area-inset-top)] transition-colors duration-300"
          style={{
            background: 'rgba(11, 19, 38, 0.38)',
            borderBottom: '1px solid rgba(91, 221, 166, 0.18)',
            backdropFilter: 'blur(20px)',
          }}
          dir="rtl"
        >
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-2.5">
              <div className="w-11" aria-hidden="true" />
            </div>

            <div className="flex items-center gap-2">
              <div className="pointer-events-none">
                <img
                  src={logo}
                  alt="RAAN"
                  className="w-9 h-9 rounded-xl shadow-[0_0_12px_rgba(91,221,166,0.3)]"
                />
              </div>
            </div>

            <button
              onClick={() => onMenuToggle(true)}
              className="backdrop-blur-md p-2.5 rounded-xl active:scale-95 transition-transform"
              style={{
                background: 'var(--raan-accent-dim)',
                border: '1px solid var(--raan-border)',
              }}
              aria-label="القائمة"
            >
              <Menu className="w-5 h-5" style={{ color: 'var(--raan-text-sub)' }} />
            </button>
          </div>
        </header>

      {/* Map - Top 40% */}
      <div className="h-[40%] relative bg-[#1a1a1a]">
        <div ref={bookingMapContainerRef} className="absolute inset-0 bg-[#212121]" />
        <div className="absolute top-2 right-4 z-40 safe-area-top pointer-events-auto">
          <button
            onClick={onGeolocate}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-background/90 text-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 border border-primary/20"
            title="تحديد موقعي"
            aria-label="تحديد موقعي"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Details - Bottom 60% */}
      <div className="flex-1 bg-background rounded-t-2xl -mt-3 relative z-10 flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.12)] overflow-hidden min-h-0">
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="flex-1 flex flex-col px-3 gap-2 min-h-0 pb-1 overflow-y-auto">
          {/* Route summary — Premium Dark Luxury Design */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative bg-[#101a2c]/80 backdrop-blur-xl rounded-2xl p-4 border border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* الخلفية المضيئة بلمسة خفيفة */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#5bdda6]/5 rounded-full blur-[40px] -z-10 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#0ea5e9]/5 rounded-full blur-[40px] -z-10 translate-y-1/2 -translate-x-1/2" />

            <div className="flex gap-3 w-full items-center">
              {/* الخط العمودي والدوائر الزرقاء/الخضراء */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="w-3.5 h-3.5 rounded-full bg-[#5bdda6] shadow-[0_0_12px_rgba(91,221,166,0.6)] border-[2.5px] border-[#0b1326] relative z-10">
                  <div className="absolute inset-0 rounded-full animate-ping opacity-40 bg-[#5bdda6]" style={{ animationDuration: '2.5s' }} />
                </div>
                <div className="w-[2px] h-9 bg-gradient-to-b from-[#5bdda6]/60 via-slate-600/30 to-[#0ea5e9]/60 rounded-full my-0.5" />
                <div className="w-3.5 h-3.5 rounded-full bg-[#0ea5e9] shadow-[0_0_12px_rgba(14,165,233,0.6)] border-[2.5px] border-[#0b1326] relative z-10" />
              </div>

              {/* تفاصيل المواقع */}
              <div className="flex-1 space-y-4 min-w-0 pr-1">
                {/* الانطلاق */}
                <div className="relative group">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] uppercase tracking-widest text-[#5bdda6]/80 font-bold">موقع الانطلاق</p>
                    <button
                      onClick={() => onEditLocation("pickup")}
                      className="px-2.5 py-1 text-[9px] font-bold tracking-wider rounded-lg bg-white/[0.04] hover:bg-[#5bdda6]/10 text-white/50 hover:text-[#5bdda6] transition-colors border border-white/[0.06] hover:border-[#5bdda6]/20 shadow-sm"
                      aria-label="تغيير موقع الانطلاق"
                    >
                      تغيير
                    </button>
                  </div>
                  <p className="text-[14px] font-bold text-white/95 line-clamp-1 leading-snug drop-shadow-sm pr-1">
                    {buildDescriptiveAddress(pickupLocation.address || "")}
                  </p>
                </div>
                
                {/* الوجهة */}
                <div className="relative group">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] uppercase tracking-widest text-[#0ea5e9]/80 font-bold">الوجهة</p>
                    <button
                      onClick={() => onEditLocation("dropoff")}
                      className="px-2.5 py-1 text-[9px] font-bold tracking-wider rounded-lg bg-white/[0.04] hover:bg-[#0ea5e9]/10 text-white/50 hover:text-[#0ea5e9] transition-colors border border-white/[0.06] hover:border-[#0ea5e9]/20 shadow-sm"
                      aria-label="تغيير الوجهة"
                    >
                      تغيير
                    </button>
                  </div>
                  <p className="text-[14px] font-bold text-white/95 line-clamp-1 leading-snug drop-shadow-sm pr-1">
                    {buildDescriptiveAddress(dropoffLocation.address || "")}
                  </p>
                </div>
              </div>

              {/* زر العكس */}
              <div className="shrink-0 flex items-center justify-center pl-1">
                <button
                  onClick={onSwapLocations}
                  className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] flex items-center justify-center transition-all duration-200 active:scale-95 group shadow-inner"
                  aria-label="عكس الاتجاه"
                >
                  <ArrowUpDown className="w-4.5 h-4.5 text-white/40 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Trip Info Grid */}
          <div className="shrink-0 grid grid-cols-3 gap-2">
            <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">المسافة</span>
              <p className="text-base sm:text-lg font-bold text-blue-600 leading-none">
                {fareBreakdown ? fareBreakdown.distance_km.toFixed(1) : routeDistance?.toFixed(1) ?? '---'}
                <span className="text-xs font-medium"> كم</span>
              </p>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">الوقت</span>
              <p className="text-base sm:text-lg font-bold text-purple-600 leading-none">
                {routeDuration ? Math.ceil(routeDuration) : fareBreakdown ? Math.ceil(fareBreakdown.distance_km * 2.5) : '---'}
                <span className="text-xs font-medium"> د</span>
              </p>
            </div>
            <div className="bg-primary/10 rounded-xl p-3 border border-primary/20 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">الأجرة</span>
              <p className="text-base sm:text-lg font-bold text-primary leading-none">
                {fareBreakdown ? roundFare(fareBreakdown.total_fare).toLocaleString() : '---'}
              </p>
            </div>
          </div>

          {/* Vehicle + Payment + Schedule */}
          <div className="shrink-0 flex gap-2">
            <button
              onClick={() => setVehicleSheetOpen(true)}
              className="flex-1 bg-card rounded-xl px-3 py-2 border border-border/40 hover:border-primary/40 transition-colors flex items-center gap-2"
            >
              <div className="text-right flex-1">
                <p className="text-[9px] text-muted-foreground uppercase">السيارة</p>
                <p className="font-bold text-xs">{VEHICLE_NAMES[selectedVehicle] || 'اقتصادي'}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setPaymentSheetOpen(true)}
              className="flex-1 bg-card rounded-xl px-3 py-2 border border-border/40 hover:border-primary/40 transition-colors flex items-center gap-2"
            >
              <div className="text-right flex-1">
                <p className="text-[9px] text-muted-foreground uppercase">الدفع</p>
                <p className="font-bold text-xs">
                  {{ cash: 'نقداً', wallet: 'المحفظة', card: 'البطاقة', zain_cash: 'زين كاش', super_key: 'سوبر كي', nas_wallet: 'ناس ولت' }[paymentMethod] || 'نقداً'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <div className="flex-1">
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
          </div>
        </div>

        {/* Book button */}
        {!bottomNavEnabled && (
          <div className="flex w-full mt-auto shrink-0 z-[100] bg-[#163d30]" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 32px), 32px)" }}>
            <button
              onClick={() => {
                if (isBooking) return;
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
                    variant: "destructive"
                  });
                  return;
                }
                onBookRide();
              }}
              disabled={(!fareBreakdown || isBooking)}
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
              className={`flex-auto h-[72px] rounded-none flex items-center justify-center gap-2 text-lg font-black touch-manipulation active:scale-[0.98] transition-colors disabled:opacity-50 border-t border-[#34d399]/30 text-[#064e3b] bg-[#34d399] hover:bg-[#2dd392] active:bg-[#10b981]`}
            >
              {isBooking ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#064e3b]" />
                  <span>جاري إنشاء الحجز...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5 ml-1" />
                  <span>احجز الآن</span>
                  <span className="bg-[#0b1326]/10 border border-[#0b1326]/10 px-3 py-1 rounded-xl text-base font-black flex items-center gap-1 shadow-sm mr-2">
                    {fareLoading && <Loader2 className="w-4 h-4 animate-spin opacity-70" />}
                    {fareBreakdown?.total_fare ? roundFare(fareBreakdown.total_fare).toLocaleString() : '---'} د.ع
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav book button */}
      {bottomNavEnabled && (
        <div className="absolute bottom-0 left-0 right-0 w-full flex z-[100] bg-[#163d30]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)' }}>
          <button
            onClick={() => {
              if (isBooking) return;
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
                  variant: "destructive"
                });
                return;
              }
              onBookRide();
            }}
            disabled={(!fareBreakdown || isBooking)}
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
            className={`flex-auto h-[72px] rounded-none flex items-center justify-center gap-2 text-lg font-black touch-manipulation active:scale-[0.98] transition-colors disabled:opacity-50 border-t border-[#34d399]/30 text-[#064e3b] bg-[#34d399] hover:bg-[#2dd392] active:bg-[#10b981]`}
          >
            {isBooking ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-[#064e3b]" />
                <span>جاري إنشاء الحجز...</span>
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5 ml-1" />
                <span>احجز الآن</span>
                <span className="bg-[#0b1326]/10 border border-[#0b1326]/10 px-3 py-1 rounded-xl text-base font-black flex items-center gap-1 shadow-sm mr-2">
                  {fareLoading && <Loader2 className="w-4 h-4 animate-spin opacity-70" />}
                  {fareBreakdown?.total_fare ? roundFare(fareBreakdown.total_fare).toLocaleString() : '---'} د.ع
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Sheets */}
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
