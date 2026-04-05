import {
  Star,
  Car,
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
  children?: React.ReactNode;
}

const DriverInfoCard = ({
  driver,
  rideId,
  rideStatus,
  pickupAddress,
  estimatedFare,
  currentLocation,
  children,
}: DriverInfoCardProps) => {
  const [showVerify, setShowVerify] = useState(false);

  // ── حالة التحميل ──
  if (!driver || rideStatus === "pending") {
    return (
      <div className="p-4" dir="rtl" style={{ background: '#0f1729' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: 'rgba(91,221,166,0.1)', border: '1px solid rgba(91,221,166,0.15)' }}
          >
            <Car className="w-5 h-5" style={{ color: '#5bdda6' }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-white">جاري تحميل بيانات السائق...</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
      style={{ background: '#0f1729' }}
    >
      {/* ── القسم العلوي: صورة + معلومات ── */}
      <div className="p-3 pb-2">
        <div className="flex items-start gap-3">
          {/* معلومات السائق */}
          <div className="flex-1 min-w-0">
            {/* الاسم */}
            <h3 className="font-bold text-[18px] text-white truncate mb-1">
              {driver.full_name}
            </h3>

            {/* الأجرة + أزرار */}
            <div className="flex items-center gap-2">
              {estimatedFare && (
                <div
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(91,221,166,0.12), rgba(59,130,246,0.08))',
                    border: '1px solid rgba(91,221,166,0.2)',
                    boxShadow: '0 2px 8px rgba(91,221,166,0.06)',
                  }}
                >
                  <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    الأجرة
                  </span>
                  <span className="text-[18px] font-black tracking-tight" style={{ color: '#5bdda6' }}>
                    {estimatedFare.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-bold" style={{ color: 'rgba(91,221,166,0.6)' }}>
                    د.ع
                  </span>
                </div>
              )}
              <div className="flex-1" />
              <RideShareButton rideId={rideId} />
              <EmergencyTriangleButton rideId={rideId} currentLocation={currentLocation} />
            </div>
          </div>

          {/* صورة السائق */}
          <div className="relative shrink-0">
            {/* حلقة متوهجة حول الصورة */}
            <div
              className="absolute -inset-1 rounded-2xl opacity-40"
              style={{
                background: 'linear-gradient(135deg, #5bdda6, #3b82f6)',
                filter: 'blur(6px)',
              }}
            />
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                border: '2.5px solid rgba(91,221,166,0.35)',
                boxShadow: '0 4px 20px rgba(91,221,166,0.12), inset 0 0 0 1px rgba(255,255,255,0.05)',
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #1a3a4a, #0f2433)' }}
              >
                {driver.profile_image_url ? (
                  <img 
                    src={driver.profile_image_url} 
                    alt={driver.full_name || ""} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <Car className="w-8 h-8" style={{ color: '#5bdda6' }} />
                )}
              </div>
            </div>

            {/* شارة متصل */}
            <div
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full"
              style={{
                background: '#22c55e',
                border: '2.5px solid #0f1729',
                boxShadow: '0 0 8px rgba(34,197,94,0.6), 0 0 16px rgba(34,197,94,0.2)',
              }}
            />

            {/* شارة التقييم */}
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(15,23,41,0.85)',
                border: '1px solid rgba(251,191,36,0.35)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-black text-yellow-400">
                {driver.rating?.toFixed(1) || "5.0"}
              </span>
            </div>
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
