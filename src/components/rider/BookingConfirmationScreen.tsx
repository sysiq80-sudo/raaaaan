/**
 * ران - شاشة تأكيد الحجز
 * تعرض ملخص الرحلة + اختيار المركبة + الأجرة + الدفع + زر الحجز
 * مستخرجة من GoPage.tsx لتقليل حجم الملف الأصلي
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Navigation,
  Clock,
  AlertTriangle,
  ChevronDown,
  Menu,
  ArrowUpDown,
} from "lucide-react";

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
  // زر الحجز المشترك — HTML مباشر لضمان rounded-none حقيقي
  const BookButton = (
    <button
      onClick={onBookRide}
      disabled={fareLoading}
      className="w-full h-14 flex items-center justify-center gap-3 bg-primary text-primary-foreground text-base font-bold disabled:opacity-60 active:brightness-90 transition-all"
      style={{ borderRadius: 0 }}
    >
      <Navigation className="w-5 h-5 flex-shrink-0" />
      <span>احجز الآن</span>
      {fareBreakdown?.total_fare && (
        <span className="bg-black/25 px-2.5 py-0.5 rounded-lg text-sm font-semibold">
          {roundFare(fareBreakdown.total_fare).toLocaleString()} د.ع
        </span>
      )}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen bg-background flex flex-col overflow-hidden"
      dir="rtl"
    >
      {/* مؤشر عدم الاتصال */}
      {!isOnline && (
        <div className="shrink-0 bg-destructive/90 px-4 py-2 text-center text-sm font-medium text-destructive-foreground flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>أنت بدون إنترنت</span>
        </div>
      )}

      {/* ═══ الخريطة (40% من الشاشة) ═══ */}
      <div className="relative shrink-0" style={{ height: '40%' }}>
        <div ref={bookingMapContainer} className="absolute inset-0 bg-gray-100 dark:bg-gray-800" />

        {/* رأس شفاف فوق الخريطة */}
        <div className="absolute top-3 left-0 right-0 px-3 flex items-center justify-between z-20 pointer-events-auto">
          {/* مؤشر المسافة / الوقت */}
          <div className="bg-card/85 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-2 shadow border border-white/15">
            <Navigation className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-bold">{routeDistance ? `${routeDistance.toFixed(1)} كم` : '---'}</span>
            <div className="w-px h-4 bg-border/40" />
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-sm font-bold">{routeDuration ? `${Math.round(routeDuration)} د` : '---'}</span>
          </div>

          {/* أزرار القائمة + الموقع */}
          <div className="flex items-center gap-2">
            <button
              onClick={onGeolocateBooking}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-card/90 backdrop-blur-md text-primary shadow border border-primary/20"
              title="موقعي"
              aria-label="تحديد موقعي"
            >
              <Navigation className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMenuChange(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-card/90 backdrop-blur-md shadow border border-border/30"
              aria-label="القائمة"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* شريط التقدم */}
        <div className="absolute bottom-0 left-0 right-0 flex gap-1 px-3 pb-2 pointer-events-none z-20">
          <div className="flex-1 h-1 rounded-full bg-primary" />
          <div className="flex-1 h-1 rounded-full bg-accent" />
          <div className="flex-1 h-1 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      {/* ═══ البانل السفلي (60% من الشاشة) بدون سكرول ═══ */}
      <div className="flex-1 bg-background rounded-t-2xl -mt-3 z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden min-h-0">
        {/* شريط السحب */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* المحتوى — يتوسع ليملأ المساحة المتاحة */}
        <div className="flex-1 flex flex-col px-3 gap-2 min-h-0 pb-1">

          {/* ─── ملخص المسار المضغوط ─── */}
          <div className="shrink-0 bg-card rounded-xl px-3 py-2.5 border border-border/30">
            <div className="flex items-stretch gap-3">
              {/* خط المسار */}
              <div className="flex flex-col items-center py-0.5 gap-0">
                <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/25" />
                <div className="w-px flex-1 min-h-[18px] bg-gradient-to-b from-primary via-border to-blue-500 my-0.5" />
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/25" />
              </div>

              {/* النصوص */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="min-h-0">
                  <p className="text-[9px] uppercase tracking-wider text-primary font-bold mb-0.5">الانطلاق</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {buildDescriptiveAddress(pickupLocation.address || '')}
                  </p>
                </div>
                <div className="min-h-0">
                  <p className="text-[9px] uppercase tracking-wider text-blue-500 font-bold mb-0.5">الوصول</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {buildDescriptiveAddress(dropoffLocation.address || '')}
                  </p>
                </div>
              </div>

              {/* زر العكس */}
              <button
                onClick={onSwapLocations}
                className="w-9 h-9 self-center rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors"
                aria-label="عكس الاتجاه"
              >
                <ArrowUpDown className="w-4 h-4 text-primary" />
              </button>
            </div>
          </div>

          {/* ─── المسافة + الوقت + الأجرة في صف واحد ─── */}
          <div className="shrink-0 grid grid-cols-3 gap-2">
            <div className="bg-blue-500/8 rounded-xl p-2.5 border border-blue-500/15 flex flex-col items-center">
              <span className="text-[9px] text-muted-foreground font-medium uppercase mb-0.5">المسافة</span>
              <p className="text-base font-bold text-blue-600">
                {fareBreakdown ? fareBreakdown.distance_km.toFixed(1) : routeDistance?.toFixed(1) ?? '---'}
                <span className="text-xs font-medium"> كم</span>
              </p>
            </div>
            <div className="bg-purple-500/8 rounded-xl p-2.5 border border-purple-500/15 flex flex-col items-center">
              <span className="text-[9px] text-muted-foreground font-medium uppercase mb-0.5">الوقت</span>
              <p className="text-base font-bold text-purple-600">
                {routeDuration ? Math.round(routeDuration) : fareBreakdown ? Math.ceil(fareBreakdown.distance_km * 2.5) : '---'}
                <span className="text-xs font-medium"> د</span>
              </p>
            </div>
            <div className="bg-primary/8 rounded-xl p-2.5 border border-primary/15 flex flex-col items-center">
              <span className="text-[9px] text-muted-foreground font-medium uppercase mb-0.5">الأجرة</span>
              <p className="text-base font-bold text-primary">
                {fareBreakdown ? roundFare(fareBreakdown.total_fare).toLocaleString() : '---'}
              </p>
            </div>
          </div>

          {/* ─── اختيار المركبة ─── */}
          <div className="shrink-0">
            <CompactVehicleSelector
              selectedVehicle={selectedVehicle}
              onSelect={onSelectVehicle}
              availableDrivers={availableDriversByType}
              baseFare={fareBreakdown?.total_fare}
            />
          </div>

          {/* ─── طريقة الدفع + جدولة في صف واحد ─── */}
          <div className="shrink-0 flex gap-2">
            <button
              onClick={() => onPaymentSheetChange(true)}
              className="flex-1 bg-card rounded-xl px-3 py-2 border border-border/40 hover:border-primary/40 transition-colors flex items-center gap-2"
            >
              <span className="text-lg">{PAYMENT_ICONS[paymentMethod] || '💵'}</span>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground uppercase">الدفع</p>
                <p className="font-bold text-xs">{PAYMENT_NAMES[paymentMethod] || 'نقداً'}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground mr-auto" />
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

        {/* ═══ زر الحجز — يلتصق بالأسفل حواف حادة ═══ */}
        {!bottomNavEnabled && BookButton}
      </div>

      {/* زر الحجز للـ bottomNav */}
      {bottomNavEnabled && (
        <div className="fixed bottom-16 left-0 right-0 z-50">
          {BookButton}
        </div>
      )}

      {/* ورقة طرق الدفع */}
      <PaymentMethodSheet
        open={paymentSheetOpen}
        onOpenChange={onPaymentSheetChange}
        selectedMethod={paymentMethod as any}
        onSelect={onSelectPayment as any}
      />

      {/* القائمة الجانبية */}
      <RiderSideMenu
        user={user}
        isOpen={menuOpen}
        onClose={() => onMenuChange(false)}
        onLogout={async () => {
          await supabase.auth.signOut();
          onNavigate('/auth');
        }}
      />
    </motion.div>
  );
};

export default BookingConfirmationScreen;

