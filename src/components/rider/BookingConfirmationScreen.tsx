/**
 * ران - شاشة تأكيد الحجز
 * تعرض ملخص الرحلة + اختيار المركبة + الأجرة + الدفع + زر الحجز
 * مستخرجة من GoPage.tsx لتقليل حجم الملف الأصلي
 */

import React, { useRef } from "react";
import { motion } from "framer-motion";
import {
  Navigation,
  Clock,
  AlertTriangle,
  ChevronDown,
  Zap,
  Menu,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import CompactVehicleSelector from "@/components/rider/CompactVehicleSelector";
import PaymentMethodSheet from "@/components/rider/PaymentMethodSheet";
import { ScheduleRideDialog } from "@/components/rider/ScheduleRideDialog";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import { roundFare } from "@/lib/constants";
import type { User } from "@supabase/supabase-js";

// أنواع البيانات
interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

type VehicleType = "economy" | "comfort" | "premium" | "women_only";
type PaymentMethodType =
  | "cash"
  | "wallet"
  | "card"
  | "zain_cash"
  | "super_key"
  | "nas_wallet";

interface FareBreakdown {
  total_fare: number;
  distance_km: number;
  base_fare: number;
  region_name: string;
  [key: string]: any;
}

interface BookingConfirmationScreenProps {
  // المواقع
  pickupLocation: LocationType;
  dropoffLocation: LocationType;
  routeDistance: number | null;
  routeDuration: number | null;

  // اختيار المركبة والدفع
  selectedVehicle: VehicleType;
  onSelectVehicle: (v: VehicleType) => void;
  paymentMethod: PaymentMethodType;
  onSelectPayment: (p: PaymentMethodType) => void;
  paymentSheetOpen: boolean;
  onPaymentSheetChange: (open: boolean) => void;

  // الأجرة
  fareBreakdown: FareBreakdown | null;
  fareLoading: boolean;
  availableDriversByType: Record<string, number>;

  // الخريطة
  bookingMapContainer: React.RefObject<HTMLDivElement>;
  onGeolocateBooking: () => void;

  // الحالة
  isOnline: boolean;
  bottomNavEnabled: boolean;

  // القائمة الجانبية
  menuOpen: boolean;
  onMenuChange: (open: boolean) => void;
  user: User | null;
  onNavigate: (path: string) => void;

  // الإجراءات
  onBookRide: () => void;
  onResetBooking: () => void;
  onScheduled: () => void;
  buildDescriptiveAddress: (address: string) => string;

  // تبديل الاتجاه
  onSwapLocations: () => void;

  // مرجع الجدولة
  scheduleDialogRef?: React.RefObject<{ openDialog: () => void }>;
}

// خريطة أسماء طرق الدفع
const PAYMENT_NAMES: Record<string, string> = {
  cash: "نقداً",
  wallet: "المحفظة",
  card: "البطاقة",
  zain_cash: "زين كاش",
  super_key: "سوبر كي",
  nas_wallet: "ناس ولت",
};

const PAYMENT_ICONS: Record<string, string> = {
  cash: "💵",
  wallet: "👛",
  card: "💳",
  zain_cash: "📱",
  super_key: "🔑",
  nas_wallet: "💼",
};

const BookingConfirmationScreen: React.FC<BookingConfirmationScreenProps> = ({
  pickupLocation,
  dropoffLocation,
  routeDistance,
  routeDuration,
  selectedVehicle,
  onSelectVehicle,
  paymentMethod,
  onSelectPayment,
  paymentSheetOpen,
  onPaymentSheetChange,
  fareBreakdown,
  fareLoading,
  availableDriversByType,
  bookingMapContainer,
  onGeolocateBooking,
  isOnline,
  bottomNavEnabled,
  menuOpen,
  onMenuChange,
  user,
  onNavigate,
  onBookRide,
  onResetBooking,
  onScheduled,
  buildDescriptiveAddress,
  onSwapLocations,
  scheduleDialogRef,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen bg-background flex flex-col overflow-hidden"
    >
      {/* مؤشر عدم الاتصال */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-destructive/90 backdrop-blur-md px-4 py-2 text-center text-sm font-medium text-destructive-foreground flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>أنت بدون إنترنت - بعض الميزات قد لا تعمل</span>
        </div>
      )}

      {/* مؤشر التقدم */}
      <div
        className={`absolute left-0 right-0 z-50 px-4 pointer-events-none ${!isOnline ? "pt-14" : "pt-2"}`}
      >
        <div className="flex gap-2">
          <div className="flex-1 h-1 rounded-full bg-primary" />
          <div className="flex-1 h-1 rounded-full bg-accent" />
          <div className="flex-1 h-1 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      {/* الرأس */}
      <div
        className={`absolute left-0 right-0 z-40 px-4 pointer-events-auto ${!isOnline ? "top-20" : "top-4"}`}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Left spacer */}
          <div className="w-11" />

          <div className="flex-1 flex items-center justify-center gap-2">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-card/70 backdrop-blur-xl rounded-md px-3 py-2 flex items-center gap-3 shadow-lg border border-white/10"
            >
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-bold">
                  {routeDistance ? `${routeDistance.toFixed(1)} كم` : "---"}
                </span>
              </div>
              <div className="w-px h-4 bg-border/30" />
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" style={{ color: "#2A6CD5" }} />
                <span className="text-sm font-bold">
                  {routeDuration ? `${Math.round(routeDuration)} د` : "---"}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Menu button on the RIGHT for RTL */}
          <button
            onClick={() => onMenuChange(true)}
            className="w-11 h-11 flex items-center justify-center rounded-md bg-card/90 backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 flex-shrink-0"
            aria-label="القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* الخريطة - النصف العلوي */}
      <div className="h-[45%] relative bg-gray-200">
        <div
          ref={bookingMapContainer}
          className="absolute inset-0 bg-gray-100"
        />
        <div className="absolute top-14 sm:top-4 left-4 z-50 safe-area-top pointer-events-auto">
          <button
            onClick={onGeolocateBooking}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-background/90 text-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 border border-primary/20"
            title="تحديد موقعي"
            aria-label="تحديد موقعي"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* التفاصيل - النصف السفلي */}
      <div className="h-[55%] bg-background rounded-t-3xl -mt-4 relative z-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.15)]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>

        <div
          className={`flex-1 overflow-y-auto px-4 space-y-3 ${bottomNavEnabled ? "pb-40" : "pb-6"}`}
        >
          {/* ملخص المسار */}
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
                  style={{
                    background:
                      "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--muted)), #2A6CD5)",
                  }}
                />
                <div
                  className="w-3 h-3 rounded-full ring-4"
                  style={
                    {
                      backgroundColor: "#2A6CD5",
                      "--tw-ring-color": "rgba(42, 108, 213, 0.2)",
                    } as any
                  }
                />
              </div>

              <div className="flex-1 space-y-4">
                <div className="min-h-[32px]">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5">
                    موقع الانطلاق
                  </p>
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {buildDescriptiveAddress(pickupLocation.address || "")}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] uppercase tracking-wider font-bold mb-0.5"
                    style={{ color: "#2A6CD5" }}
                  >
                    الوجهة
                  </p>
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

          {/* معلومات الرحلة */}
          {fareBreakdown && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-2"
            >
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    المسافة
                  </span>
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {fareBreakdown.distance_km.toFixed(1)}{" "}
                  <span className="text-xs font-medium">كم</span>
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-purple-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    الوقت
                  </span>
                </div>
                <p className="text-lg font-bold text-purple-600">
                  {Math.ceil(fareBreakdown.distance_km * 2.5)}{" "}
                  <span className="text-xs font-medium">دقيقة</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* اختيار المركبة */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <CompactVehicleSelector
              selectedVehicle={selectedVehicle}
              onSelect={onSelectVehicle}
              availableDrivers={availableDriversByType}
              baseFare={fareBreakdown?.total_fare}
            />
          </motion.div>

          {/* الأجرة وطريقة الدفع */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-primary/5 via-primary/8 to-primary/10 rounded-2xl p-4 border border-primary/20 shadow-lg"
          >
            {fareBreakdown && (
              <div className="mb-3 pb-3 border-b border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                        الأجرة المتوقعة
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {fareBreakdown.region_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-primary">
                      {roundFare(fareBreakdown.total_fare).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">دينار عراقي</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => onPaymentSheetChange(true)}
              className="w-full bg-card/50 rounded-xl px-4 py-3 border border-border/40 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 active:scale-[0.98] flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                  {PAYMENT_ICONS[paymentMethod] || "💵"}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    طريقة الدفع
                  </p>
                  <p className="font-bold text-sm">
                    {PAYMENT_NAMES[paymentMethod] || "نقداً"}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </motion.div>

          {/* خيار الجدولة */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="px-1"
          >
            <ScheduleRideDialog
              ref={scheduleDialogRef}
              pickup={pickupLocation}
              dropoff={dropoffLocation}
              vehicleType={selectedVehicle}
              paymentMethod={paymentMethod}
              estimatedFare={fareBreakdown?.total_fare || null}
              onScheduled={onScheduled}
            />
          </motion.div>
        </div>

        {/* زر الحجز */}
        {!bottomNavEnabled && (
          <div className="px-4 pb-6">
            <div className="max-w-lg mx-auto">
              <Button
                onClick={onBookRide}
                disabled={fareLoading}
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-primary via-primary to-primary/90 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 active:scale-[0.98] text-primary-foreground"
              >
                <span className="flex items-center gap-3 justify-center">
                  <Navigation className="w-5 h-5" />
                  <span>احجز الآن</span>
                  <span className="bg-black/20 px-2.5 py-0.5 rounded-lg text-sm">
                    {fareBreakdown?.total_fare
                      ? roundFare(fareBreakdown.total_fare).toLocaleString()
                      : "---"}{" "}
                    د.ع
                  </span>
                </span>
              </Button>
            </div>
          </div>
        )}

        {bottomNavEnabled && (
          <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/98 backdrop-blur-md border-t border-border/20 z-40">
            <div className="max-w-lg mx-auto">
              <Button
                onClick={onBookRide}
                disabled={fareLoading}
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-primary via-primary to-primary/90 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 active:scale-[0.98] text-primary-foreground"
              >
                <span className="flex items-center gap-3 justify-center">
                  <Navigation className="w-5 h-5" />
                  <span>احجز الآن</span>
                  <span className="bg-black/20 px-2.5 py-0.5 rounded-lg text-sm">
                    {fareBreakdown?.total_fare
                      ? roundFare(fareBreakdown.total_fare).toLocaleString()
                      : "---"}{" "}
                    د.ع
                  </span>
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ورقة طرق الدفع */}
      <PaymentMethodSheet
        open={paymentSheetOpen}
        onOpenChange={onPaymentSheetChange}
        selectedMethod={paymentMethod}
        onSelect={onSelectPayment}
      />

      {/* القائمة الجانبية */}
      <RiderSideMenu
        user={user}
        isOpen={menuOpen}
        onClose={() => onMenuChange(false)}
        onLogout={async () => {
          await supabase.auth.signOut();
          onNavigate("/auth");
        }}
      />
    </motion.div>
  );
};

export default BookingConfirmationScreen;
