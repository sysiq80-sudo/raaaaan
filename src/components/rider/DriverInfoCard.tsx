import { User, Star, Shield, CheckCircle, Car, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RideChat } from '@/components/rider/RideChat';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

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
}

const DriverInfoCard = ({ driver, rideId, rideStatus }: DriverInfoCardProps) => {
  if (!driver || rideStatus === 'pending') {
    return (
      <div className="bg-card rounded-2xl border shadow-lg p-4 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded w-24" />
            <div className="h-4 bg-muted rounded w-40" />
            <div className="h-3 bg-muted rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  const vehicleInfo = [
    driver.vehicle_model,
    driver.vehicle_color,
    driver.vehicle_plate
  ].filter(Boolean).join(' • ') || 'معلومات السيارة غير متوفرة';

  // Determine driver badge based on rating and rides
  const getDriverBadge = () => {
    const rating = driver.rating || 5;
    const rides = driver.total_rides || 0;
    
    if (rating >= 4.8 && rides >= 100) {
      return { label: "سائق مميز", color: "bg-gradient-to-r from-amber-400 to-amber-600", icon: Star };
    } else if (rating >= 4.5 && rides >= 50) {
      return { label: "موثوق", color: "bg-gradient-to-r from-green-400 to-green-600", icon: Shield };
    } else if (rides >= 10) {
      return { label: "معتمد", color: "bg-gradient-to-r from-blue-400 to-blue-600", icon: CheckCircle };
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
                <AvatarImage src={driver.profile_image_url} alt={driver.full_name} />
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
            className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/70 dark:to-amber-800/70 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-600 shadow-sm"
          >
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
              {driver.rating?.toFixed(1) || '5.0'}
            </span>
          </motion.div>

          {/* شارة متصل */}
          <div className="absolute -top-1 -left-1">
            <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
          </div>
        </div>
        
        {/* معلومات السائق */}
        <div className="flex-1 min-w-0">
          {/* الاسم + الشارة */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg text-foreground truncate">
              {driver.full_name}
            </h3>
            {badge && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Badge className={`${badge.color} text-white text-[10px] px-1.5 py-0.5 font-medium`}>
                  <badge.icon className="w-2.5 h-2.5 mr-0.5" />
                  {badge.label}
                </Badge>
              </motion.div>
            )}
          </div>
          
          {/* معلومات السيارة */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <Car className="w-3.5 h-3.5" />
            <p className="truncate">{vehicleInfo}</p>
          </div>

          {/* أزرار التواصل */}
          <div className="flex items-center gap-2">
            <RideChat 
              rideId={rideId} 
              userType="rider" 
              rideStatus={rideStatus}
              driverPhone={driver.phone}
            />
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full text-xs font-medium transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                اتصال
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DriverInfoCard;
