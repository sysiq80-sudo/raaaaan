/**
 * SimplifiedBookingPanel - لوحة حجز مبسطة مشابهة لـ Uber/Careem
 */

import { useRef } from "react";
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

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1, height: isExpanded ? '85dvh' : 'auto' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-card/95 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-border/50 flex flex-col"
      {...dragProps}
    >
      {/* Glow Line */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

      {/* Drag Handle */}
      <button
        onClick={toggleExpanded}
        className="w-full pt-3 pb-2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing shrink-0"
      >
        <motion.div
          className="rounded-full"
          animate={{
            width: isExpanded ? 32 : 48,
            backgroundColor: isExpanded ? 'rgb(91,221,166)' : 'rgb(71,85,105)',
          }}
          style={{ height: 6 }}
          transition={{ duration: 0.25 }}
        />
        <span className="text-[10px] text-muted-foreground">
          {isExpanded ? 'اضغط للتصغير' : 'اسحب للتوسيع'}
        </span>
      </button>

      <div className={`px-4 pb-4 space-y-4 ${isExpanded ? 'flex-1 overflow-y-auto' : ''}`}>
        {/* Compact Route Summary with ETA */}
        <div className="flex items-center gap-3">
          {/* Route dots */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="w-0.5 h-5 bg-gradient-to-b from-primary to-blue-500" />
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          
          {/* Locations */}
          <div className="flex-1 min-w-0 space-y-1">
            <button onClick={onChangePickup} className="flex items-center justify-between w-full group">
              <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">تغيير</span>
              <p className="text-sm truncate text-right">{pickup || 'موقع الانطلاق'}</p>
            </button>
            <button onClick={onChangeDropoff} className="flex items-center justify-between w-full group">
              <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">تغيير</span>
              <p className="text-sm truncate text-right font-medium">{dropoff || 'الوجهة'}</p>
            </button>
          </div>

          {/* Distance & Time */}
          {routeDistance && routeDuration && (
            <div className="shrink-0 text-left bg-secondary/50 px-2 py-1 rounded-lg">
              <p className="text-xs font-bold text-primary">{routeDistance.toFixed(1)} كم</p>
              <p className="text-[10px] text-muted-foreground">~{Math.round(routeDuration)} د</p>
            </div>
          )}
        </div>

        {/* Driver ETA Badge */}
        <div className="flex justify-center">
          <DriverETABadge
            pickupCoords={pickupCoords}
            nearbyDriverLocations={nearbyDriverLocations}
            isLoading={fareLoading}
          />
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
          className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
        >
          <span className="text-xs text-primary font-medium">تغيير</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{getPaymentLabel(selectedPayment)}</span>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>

        {/* Payment Selector */}
        <AnimatePresence>
          {showPaymentSelector && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
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
              className="bg-secondary/30 rounded-xl p-3 space-y-2"
            >
              <div className="flex justify-between text-sm">
                <span>{fareBreakdown.base_fare.toLocaleString()} د.ع</span>
                <span className="text-muted-foreground">سعر البداية</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{fareBreakdown.distance_fare.toLocaleString()} د.ع</span>
                <span className="text-muted-foreground">المسافة ({fareBreakdown.distance_km} كم)</span>
              </div>
              {fareBreakdown.vehicle_multiplier > 1 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>×{fareBreakdown.vehicle_multiplier}</span>
                  <span>معامل السيارة</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>{fareBreakdown.service_fee.toLocaleString()} د.ع</span>
                <span className="text-muted-foreground">رسوم الخدمة</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book Button + Schedule Button */}
        <div className="flex gap-2">
          <Button
            className="flex-1 h-14 text-lg font-bold shadow-lg relative overflow-hidden group"
            disabled={!isLoggedIn || bookingLoading || fareLoading}
            onClick={onBook}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 group-hover:from-primary/90 group-hover:to-primary transition-all" />
            <span className="relative flex items-center justify-center gap-2">
              {bookingLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
              {!isLoggedIn ? (
                "سجل دخولك للحجز"
              ) : bookingLoading ? (
                "جاري الإرسال..."
              ) : (
                <>
                  <span>احجز الآن</span>
                  {fareBreakdown && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">
                      {fareBreakdown.total_fare.toLocaleString()} د.ع
                    </span>
                  )}
                </>
              )}
            </span>
          </Button>

          {/* Advanced Schedule Button */}
          {isLoggedIn && pickupCoords && dropoffCoords && (
            <Button
              className="h-14 px-4 bg-primary/10 hover:bg-primary/20 text-primary font-bold shadow-lg border border-primary/30 transition-all"
              onClick={() => scheduleDialogRef.current?.openDialog()}
              title="احجز رحلة متقدمة مع تحديد التاريخ والوقت"
            >
              <Calendar className="w-5 h-5" />
            </Button>
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
