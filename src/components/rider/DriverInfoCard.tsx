import {
  User,
  Star,
  Shield,
  CheckCircle,
  Car,
  Phone,
  Navigation,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RideChat } from "@/components/rider/RideChat";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useState } from "react";
import VerifyVehicleSheet from "@/components/rider/VerifyVehicleSheet";
import { playSound } from "@/utils/sounds";

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
}

const DriverInfoCard = ({
  driver,
  rideId,
  rideStatus,
  pickupAddress,
  estimatedFare,
}: DriverInfoCardProps) => {
  const [showVerify, setShowVerify] = useState(false);
  if (!driver || rideStatus === "pending") {
    return (
      <div className="bg-card rounded-2xl border shadow-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Car className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-foreground">جاري تحميل بيانات السائق...</p>
            <p className="text-xs text-muted-foreground mt-0.5">سيظهر اسم السائق ومعلومات السيارة خلال لحظات</p>
          </div>
        </div>
      </div>
    );
  }

  const vehicleInfo =
    [driver.vehicle_model, driver.vehicle_color, driver.vehicle_plate]
      .filter(Boolean)
      .join(" • ") || "معلومات السيارة غير متوفرة";

  // Determine driver badge based on rating and rides
  // Using semantic design tokens for badges
  const getDriverBadge = () => {
    const rating = driver.rating || 5;
    const rides = driver.total_rides || 0;

    if (rating >= 4.8 && rides >= 100) {
      return {
        label: "سائق مميز",
        color: "bg-gradient-to-r from-warning to-warning/80",
        icon: Star,
      };
    } else if (rating >= 4.5 && rides >= 50) {
      return {
        label: "موثوق",
        color: "bg-gradient-to-r from-success to-success/80",
        icon: Shield,
      };
    } else if (rides >= 10) {
      return {
        label: "معتمد",
        color: "bg-gradient-to-r from-info to-info/80",
        icon: CheckCircle,
      };
    }
    return null;
  };

  const badge = getDriverBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        {/* صورة السائق + التقييم */}
        <div className="relative">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Avatar className="w-16 h-16 border-3 border-primary/30 shadow-lg ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              {driver.profile_image_url ? (
                <AvatarImage
                  src={driver.profile_image_url}
                  alt={driver.full_name}
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xl font-bold">
                {driver.full_name?.charAt(0) || <User className="w-7 h-7" />}
              </AvatarFallback>
            </Avatar>
          </motion.div>

          {/* شارة التقييم */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-gradient-to-r from-warning/20 to-warning/30 dark:from-warning/30 dark:to-warning/20 px-2 py-0.5 rounded-full border border-warning/50 shadow-sm"
          >
            <Star className="w-3.5 h-3.5 fill-warning text-warning" />
            <span className="text-xs font-bold text-warning-foreground dark:text-warning">
              {driver.rating?.toFixed(1) || "5.0"}
            </span>
          </motion.div>

          {/* شارة متصل */}
          <div className="absolute -top-1 -left-1">
            <div className="w-4 h-4 bg-success rounded-full border-2 border-background animate-pulse" />
          </div>
        </div>

        {/* معلومات السائق */}
        <div className="flex-1 min-w-0">
          {/* الاسم + الشارة + الأجرة */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="font-bold text-lg text-foreground truncate">
                {driver.full_name}
              </h3>
              {badge && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Badge
                    className={`${badge.color} text-white text-[10px] px-1.5 py-0.5 font-medium`}
                  >
                    <badge.icon className="w-2.5 h-2.5 mr-0.5" />
                    {badge.label}
                  </Badge>
                </motion.div>
              )}
            </div>
            {estimatedFare && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">الأجرة المتوقعة</p>
                <p className="text-lg font-bold text-primary">
                  {estimatedFare.toLocaleString()} د.ع
                </p>
              </div>
            )}
          </div>

          {/* معلومات السيارة */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <Car className="w-3.5 h-3.5" />
            <p className="truncate">{vehicleInfo}</p>
            {/* زر لوحة السيارة - يفتح شاشة التأكيد */}
            {driver.vehicle_plate && (
              <button
                onClick={() => {
                  setShowVerify(true);
                  playSound("tap");
                }}
                className="mr-auto bg-slate-900 text-white rounded-lg px-2.5 py-1 text-xs font-black tracking-wider font-mono hover:bg-slate-800 transition-colors active:scale-95"
                dir="ltr"
              >
                {driver.vehicle_plate}
              </button>
            )}
          </div>

          {/* أزرار التواصل */}
          <div className="flex items-center gap-2">
            <RideChat
              rideId={rideId}
              userType="rider"
              rideStatus={rideStatus}
              driverPhone={driver.phone}
              pickupAddress={pickupAddress}
            />
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success rounded-full text-xs font-medium transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                اتصال
              </a>
            )}
          </div>
        </div>
      </div>

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
