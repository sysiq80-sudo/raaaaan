import {
  Star,
  Car,
  Phone,
} from "lucide-react";
import { motion } from "framer-motion";
import React, { useState } from "react";
import VerifyVehicleSheet from "@/components/rider/VerifyVehicleSheet";
import { playSound } from "@/utils/sounds";
import { RideShareButton } from "@/components/rider/RideShareButton";
import { EmergencyTriangleButton } from "@/components/rider/EmergencyTriangleButton";

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  rating: number | null;
  profile_image_url?: string | null;
  total_rides?: number | null;
}

interface DriverInfoCardProps {
  driver: Driver | null;
  rideId: string;
  rideStatus: string;
  pickupAddress?: string;
  estimatedFare?: number;
  currentLocation?: { lat: number; lng: number };
  driverPhone?: string;
  children?: React.ReactNode;
}

const DriverInfoCard = ({
  driver,
  rideId,
  rideStatus,
  pickupAddress,
  estimatedFare,
  currentLocation,
  driverPhone,
  children,
}: DriverInfoCardProps) => {
  const [showVerify, setShowVerify] = useState(false);



  // ── حالة التحميل ──
  if (!driver || rideStatus === "pending") {
    return (
      <div className="p-4" dir="rtl" style={{ background: 'transparent' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: 'rgba(91,221,166,0.1)', border: '1px solid rgba(91,221,166,0.15)' }}
          >
            <Car className="w-5 h-5" style={{ color: '#5bdda6' }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-[14px] text-white">جاري تحميل بيانات السائق...</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              سيظهر اسم السائق ومعلومات السيارة خلال لحظات
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      dir="rtl"
      className="bg-transparent"
    >
      {/* ── معلومات الكابتن والسيارة ── */}
      <div className="p-4 pb-0 flex flex-col gap-3">
        {/* صورة + اسم + سيارة */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 bg-slate-800">
                {driver.profile_image_url && (driver.profile_image_url.startsWith('http') || driver.profile_image_url.startsWith('data:')) ? (
                  <img src={driver.profile_image_url} alt={driver.full_name || ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car className="w-6 h-6 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 bg-slate-900 px-1.5 py-0.5 rounded-full border border-white/10">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                <span className="text-[9px] font-bold text-white tabular-nums">{driver.rating?.toFixed(1) || "5.0"}</span>
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <h3 className="font-bold text-[15px] text-white truncate max-w-[130px]">{driver.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Car className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-[11px] text-slate-300 truncate">
                  {[driver.vehicle_color, driver.vehicle_model].filter(Boolean).join(" ") || "مركبة"}
                </span>
                {driver.vehicle_plate && (
                  <div className="bg-white/10 backdrop-blur px-1.5 py-0.5 rounded border border-white/10 shrink-0">
                    <span className="font-black text-[10px] tracking-wider text-white leading-none">{driver.vehicle_plate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {driverPhone && (
              <a href={`tel:${driverPhone}`} className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full transition-all active:scale-95 bg-white/10 text-white border border-white/10">
                <Phone className="h-4.5 w-4.5" />
              </a>
            )}
          </div>
        </div>

        {/* الأجرة + أزرار */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          {estimatedFare ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] text-slate-500">الأجرة</span>
              <span className="text-[20px] font-black text-white">{estimatedFare.toLocaleString('en-US')}</span>
              <span className="text-[11px] font-bold text-slate-400">د.ع</span>
            </div>
          ) : <div className="flex-1" />}

          <div className="flex items-center gap-2">
            <RideShareButton rideId={rideId} />
            <EmergencyTriangleButton rideId={rideId} currentLocation={currentLocation} />
          </div>
        </div>
      </div>

      {/* ── محتوى إضافي (أزرار الإجراءات) ── */}
      {children}

      {/* شاشة تأكيد لوحة السيارة */}
      {driver && (
        <VerifyVehicleSheet
          open={showVerify}
          onOpenChange={setShowVerify}
          driver={{
            name: driver.full_name,
            phone: driver.phone,
            rating: driver.rating || undefined,
            totalRides: driver.total_rides || undefined,
            vehicleColor: driver.vehicle_color || undefined,
            vehicleModel: driver.vehicle_model || undefined,
            vehiclePlate: driver.vehicle_plate || undefined,
            avatarUrl: driver.profile_image_url || undefined,
          }}
          onConfirm={() => {
            setShowVerify(false);
            playSound("success");
          }}
        />
      )}
    </motion.div>
  );
};

export default DriverInfoCard;

