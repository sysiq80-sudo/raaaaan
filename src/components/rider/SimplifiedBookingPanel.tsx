/**
 * SimplifiedBookingPanel - لوحة حجز مبسطة مشابهة لـ Uber/Careem
 */

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBottomSheetDrag } from "@/hooks/useBottomSheetDrag";
import { 
  Navigation, 
  CreditCard, 
  Loader2,
  Clock,
  MapPin,
  Car,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CompactVehicleSelector from "./CompactVehicleSelector";
import PaymentMethodSelector from "./PaymentMethodSelector";
import DriverETABadge from "./DriverETABadge";
import { ScheduleRideDialog } from "./ScheduleRideDialog";
import type { PaymentMethod } from "@/types/savedCards";

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
}

interface FareBreakdown {
  base_fare: number;
  distance_fare: number;
  subtotal: number;
  service_fee: number;
  total_fare: number;
  vehicle_multiplier: number;
  distance_km: number;
}

interface SimplifiedBookingPanelProps {
  pickup: string;
  dropoff: string;
  pickupCoords: { lat: number; lng: number } | null;
  dropoffCoords: { lat: number; lng: number } | null;
  routeDistance: number | null;
  routeDuration: number | null;
  selectedVehicle: VehicleType;
  onVehicleSelect: (type: VehicleType) => void;
  selectedPayment: PaymentMethod;
  onPaymentSelect: (method: PaymentMethod) => void;
  fareBreakdown: FareBreakdown | null;
  fareLoading: boolean;
  nearbyDriversCount: number | null;
  availableDriversByType: Record<VehicleType, number> | undefined;
  nearbyDriverLocations: DriverLocation[];
  onBook: () => void;
  bookingLoading: boolean;
  isLoggedIn: boolean;
  onChangePickup: () => void;
  onChangeDropoff: () => void;
}

const SimplifiedBookingPanel = ({
  pickup,
  dropoff,
  pickupCoords,
  dropoffCoords,
  routeDistance,
  routeDuration,
  selectedVehicle,
  onVehicleSelect,
  selectedPayment,
  onPaymentSelect,
  fareBreakdown,
  fareLoading,
  nearbyDriversCount,
  availableDriversByType,
  nearbyDriverLocations,
  onBook,
  bookingLoading,
  isLoggedIn,
  onChangePickup,
  onChangeDropoff
}: SimplifiedBookingPanelProps) => {
  const { isExpanded, toggleExpanded, dragProps } = useBottomSheetDrag(false);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const scheduleDialogRef = useRef<{ openDialog: () => void }>(null);

  const getPaymentLabel = (method: PaymentMethod) => {
    const labels: Record<PaymentMethod, string> = {
      cash: 'نقدي',
      wallet: 'المحفظة',
      card: 'البطاقة',
    };
    return labels[method];
  };

  const getVehicleName = (type: string) => {
    switch (type) {
      case 'economy': return 'إيكونومي';
      case 'premium': return 'بريميوم';
      case 'comfort': return 'كومفورت';
      case 'women_only': return 'نسائي';
      default: return 'الرحلة';
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1, height: isExpanded ? '85dvh' : 'auto' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-[#131b2e]/90 backdrop-blur-2xl rounded-t-[2rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-t border-white/5 flex flex-col w-full max-w-4xl mx-auto pb-6"
      style={{ WebkitBackdropFilter: 'blur(20px)' }}
      {...dragProps}
    >
      {/* Drag Handle */}
      <button
        onClick={toggleExpanded}
        className="w-full pt-4 pb-2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing shrink-0"
      >
        <motion.div
          className="rounded-full"
          animate={{
            width: isExpanded ? 32 : 48,
            backgroundColor: isExpanded ? '#5bdda6' : 'rgba(255,255,255,0.2)',
          }}
          style={{ height: 5 }}
          transition={{ duration: 0.25 }}
        />
      </button>

      <div className={`px-5 pb-2 space-y-4 ${isExpanded ? 'flex-1 overflow-y-auto no-scrollbar' : ''}`}>
        
        {/* Compact Route Summary with ETA */}
        <div className="flex items-center gap-3 bg-[#171f33] p-3 rounded-2xl border border-white/5">
          {/* Route dots */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-[#5bdda6]" />
            <div className="w-0.5 h-6 bg-gradient-to-b from-[#5bdda6] to-blue-500" />
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          
          {/* Locations */}
          <div className="flex-1 min-w-0 space-y-2">
            <button onClick={onChangePickup} className="flex items-center justify-between w-full group">
              <span className="text-xs text-[#5bdda6] font-medium opacity-0 group-hover:opacity-100 transition-opacity">تغيير</span>
              <p className="text-[13px] text-white/90 truncate text-right">{pickup || 'موقع الانطلاق'}</p>
            </button>
            <div className="h-px w-full bg-white/5" />
            <button onClick={onChangeDropoff} className="flex items-center justify-between w-full group">
              <span className="text-xs text-[#5bdda6] font-medium opacity-0 group-hover:opacity-100 transition-opacity">تغيير</span>
              <p className="text-[13px] text-white font-bold truncate text-right">{dropoff || 'الوجهة'}</p>
            </button>
          </div>

          {/* Distance & Time */}
          {routeDistance && routeDuration && (
            <div className="shrink-0 text-left bg-[#2d3449]/50 px-3 py-2 rounded-xl">
              <p className="text-xs font-bold text-[#5bdda6]">{routeDistance.toFixed(1)} كم</p>
              <p className="text-[10px] text-white/50">~{Math.round(routeDuration)} د</p>
            </div>
          )}
        </div>

        {/* Driver ETA Badge */}
        <div className="flex justify-center -my-1">
          <DriverETABadge
            pickupCoords={pickupCoords}
            nearbyDriverLocations={nearbyDriverLocations}
            isLoading={fareLoading}
          />
        </div>

        {/* Vehicle Selection Header */}
        <div className="flex items-center justify-between mt-2 mb-1">
          <h2 className="text-[19px] font-bold text-white tracking-tight">اختر نوع الرحلة</h2>
          <div className="bg-[#2d3449] px-3 py-1 rounded-full text-[10px] font-bold text-[#5bdda6] uppercase tracking-widest shadow-sm">
            Velocity Mode
          </div>
        </div>

        {/* Vehicle Selection */}
        <CompactVehicleSelector
          selectedVehicle={selectedVehicle}
          onSelect={onVehicleSelect}
          baseFare={fareBreakdown?.subtotal}
          availableDrivers={availableDriversByType}
        />

        {/* Payment Method - Collapsed */}
        <button
          onClick={() => setShowPaymentSelector(!showPaymentSelector)}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#171f33] hover:bg-[#222a3d] border border-white/5 transition-colors"
        >
          <span className="text-xs text-[#5bdda6] font-bold">تغيير طرق الدفع</span>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-bold text-white">{getPaymentLabel(selectedPayment)}</span>
            <div className="w-8 h-8 rounded-full bg-[#2d3449] flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-[#5bdda6]" />
            </div>
          </div>
        </button>

        {/* Payment Selector */}
        <AnimatePresence>
          {showPaymentSelector && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <PaymentMethodSelector
                selectedMethod={selectedPayment}
                onSelect={(method) => {
                  onPaymentSelect(method);
                  setShowPaymentSelector(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Fare Details */}
        <AnimatePresence>
          {isExpanded && fareBreakdown && !fareLoading && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#171f33] rounded-2xl p-4 space-y-3 border border-white/5 overflow-hidden"
            >
              <div className="flex justify-between text-sm">
                <span className="text-white font-semibold">{fareBreakdown.base_fare.toLocaleString()} د.ع</span>
                <span className="text-white/50">سعر البداية</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white font-semibold">{fareBreakdown.distance_fare.toLocaleString()} د.ع</span>
                <span className="text-white/50">المسافة ({fareBreakdown.distance_km} كم)</span>
              </div>
              {fareBreakdown.vehicle_multiplier > 1 && (
                <div className="flex justify-between text-sm text-[#5bdda6]">
                  <span className="font-bold">×{fareBreakdown.vehicle_multiplier}</span>
                  <span>معامل السيارة</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white font-semibold">{fareBreakdown.service_fee.toLocaleString()} د.ع</span>
                <span className="text-white/50">رسوم الخدمة</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book Button + Schedule Button */}
        <div className="flex w-[calc(100%+2.5rem)] -mx-5 mt-2 shrink-0 bg-[#131b2e] pt-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)', zIndex: 10 }}>
          {/* Main Action Button */}
          <button
            className={`flex-auto h-[72px] rounded-t-xl rounded-b-none border-t flex items-center justify-center gap-3 text-[18px] font-black transition-all touch-manipulation ${
              !isLoggedIn || bookingLoading || fareLoading 
                ? "bg-[#171f33] border-white/5 text-slate-500 cursor-not-allowed shadow-none" 
                : "bg-gradient-to-r from-[#5bdda6] to-[#27b481] border-[#5bdda6]/30 text-[#003825] active:bg-[#3eba89] shadow-[0_-4px_24px_rgba(91,221,166,0.25)]"
            }`}
            disabled={!isLoggedIn || bookingLoading || fareLoading}
            onClick={onBook}
          >
            <span className="relative flex items-center justify-center gap-2">
              {bookingLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5 -rotate-90" /> // Arrow styled
              )}
              {!isLoggedIn ? (
                "سجل دخولك للحجز"
              ) : bookingLoading ? (
                "جاري الإرسال..."
              ) : (
                <>
                  <span className="tracking-tight">تأكيد رحلة {getVehicleName(selectedVehicle)}</span>
                  {fareBreakdown && (
                    <span className="bg-[#003825]/20 px-2 py-0.5 rounded-lg text-sm mr-1">
                      {fareBreakdown.total_fare.toLocaleString()} د.ع
                    </span>
                  )}
                </>
              )}
            </span>
          </button>

          {/* Advanced Schedule Button */}
          {isLoggedIn && pickupCoords && dropoffCoords && (
            <button
              className="h-[72px] w-[80px] shrink-0 flex items-center justify-center rounded-t-xl rounded-b-none border-t border-white/10 bg-[#171f33] hover:bg-[#222a3d] text-[#5bdda6] transition-all touch-manipulation ml-1"
              onClick={() => scheduleDialogRef.current?.openDialog()}
              title="احجز رحلة متقدمة με تحديد التاريخ والوقت"
            >
              <Calendar className="w-6 h-6" />
            </button>
          )}
        </div>

        {isLoggedIn && pickupCoords && dropoffCoords && (
          <ScheduleRideDialog
            ref={scheduleDialogRef}
            pickup={{ lat: pickupCoords.lat, lng: pickupCoords.lng, address: pickup }}
            dropoff={{ lat: dropoffCoords.lat, lng: dropoffCoords.lng, address: dropoff }}
            vehicleType={selectedVehicle}
            paymentMethod={selectedPayment}
            estimatedFare={fareBreakdown?.total_fare || null}
          />
        )}
      </div>
    </motion.div>
  );
};

export default SimplifiedBookingPanel;
