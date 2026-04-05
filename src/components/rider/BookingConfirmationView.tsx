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
      className="h-[100dvh] bg-background flex flex-col overflow-hidden"
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

        {/* Route quick stats under header */}
        <div className={`absolute left-0 right-0 z-40 px-4 pointer-events-none ${!isOnline ? "top-24" : "top-16"}`}>
          <div className="flex items-center justify-center">
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-card/80 backdrop-blur-xl rounded-md px-3 py-2 flex items-center gap-3 shadow-lg border border-white/10"
            >
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-bold">
                  {routeDistance ? `${routeDistance.toFixed(1)} كم` : "---"}
                </span>
              </div>
              <div className="w-px h-4 bg-border/30" />
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" style={{ color: '#2A6CD5' }} />
                <span className="text-sm font-bold">
                  {routeDuration ? `${Math.round(routeDuration)} د` : "---"}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

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
          {/* Route summary */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-card rounded-2xl p-4 border border-border/30 shadow-sm"
          >
            <div className="flex gap-3">
              <div className="flex flex-col items-center gap-0">
                <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
                <div
                  className="w-0.5 flex-1 min-h-[32px]"
                  style={{ background: 'linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--muted)), #2A6CD5)' }}
                />
                <div
                  className="w-3 h-3 rounded-full ring-4"
                  style={{ backgroundColor: '#2A6CD5', '--tw-ring-color': 'rgba(42, 108, 213, 0.2)' } as any}
                />
              </div>
              <div className="flex-1 space-y-4">
                <div className="min-h-[32px]">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-bold">موقع الانطلاق</p>
                    <button
                      onClick={() => onEditLocation("pickup")}
                      className="text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                      aria-label="تغيير موقع الانطلاق"
                    >
                      تغيير
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {buildDescriptiveAddress(pickupLocation.address || "")}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#2A6CD5' }}>الوجهة</p>
                    <button
                      onClick={() => onEditLocation("dropoff")}
                      className="text-sm font-bold hover:opacity-80 transition-opacity"
                      style={{ color: '#2A6CD5' }}
                      aria-label="تغيير الوجهة"
                    >
                      تغيير
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {buildDescriptiveAddress(dropoffLocation.address || "")}
                  </p>
                </div>
              </div>
              <button
                onClick={onSwapLocations}
                className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0"
                aria-label="عكس الاتجاه"
              >
                <ArrowUpDown className="w-5 h-5 text-primary" />
              </button>
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
          <button
            onClick={() => {
              if (isBooking) return;
              if (fareLoading) {
                toast({
                  title: "جاري حساب المسار ⏳",
                  description: "يرجى الانتظار لحظة بينما نقوم بتهيئة رحلتك",
                });
                return;
              }
              if (!fareBreakdown) {
                toast({
                  title: "عذراً، تعذر الحجز 😔",
                  description: "النقطة المحددة خارج منطقة التغطية أو المسافة بعيدة جداً",
                  variant: "destructive"
                });
                return;
              }
              onBookRide();
            }}
            className={`w-full h-14 flex items-center justify-center gap-3 bg-primary text-primary-foreground text-base font-bold active:brightness-90 transition-all shrink-0 ${
              (!fareBreakdown || isBooking) ? 'opacity-50' : 'hover:bg-primary/95'
            }`}
            style={{ borderRadius: 0 }}
          >
            {isBooking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري إنشاء الحجز...</span>
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                <span>احجز الآن</span>
                <span className="bg-black/25 px-2.5 py-0.5 rounded-lg text-sm font-semibold flex items-center gap-1">
                  {fareLoading && <Loader2 className="w-3 h-3 animate-spin opacity-70" />}
                  {fareBreakdown?.total_fare ? roundFare(fareBreakdown.total_fare).toLocaleString() : '---'} د.ع
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Bottom nav book button */}
      {bottomNavEnabled && (
        <div className="fixed bottom-16 left-0 right-0 z-50">
          <button
            onClick={() => {
              if (isBooking) return;
              if (fareLoading) {
                toast({
                  title: "جاري حساب المسار ⏳",
                  description: "يرجى الانتظار لحظة بينما نقوم بتهيئة رحلتك",
                });
                return;
              }
              if (!fareBreakdown) {
                toast({
                  title: "عذراً، تعذر الحجز 😔",
                  description: "النقطة المحددة خارج منطقة التغطية أو المسافة بعيدة جداً",
                  variant: "destructive"
                });
                return;
              }
              onBookRide();
            }}
            className={`w-full h-14 flex items-center justify-center gap-3 bg-primary text-primary-foreground text-base font-bold active:brightness-90 transition-all ${
              (!fareBreakdown || isBooking) ? 'opacity-50' : 'hover:bg-primary/95'
            }`}
            style={{ borderRadius: 0 }}
          >
            {isBooking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري إنشاء الحجز...</span>
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                <span>احجز الآن</span>
                <span className="bg-black/25 px-2.5 py-0.5 rounded-lg text-sm font-semibold flex items-center gap-1">
                  {fareLoading && <Loader2 className="w-3 h-3 animate-spin opacity-70" />}
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
