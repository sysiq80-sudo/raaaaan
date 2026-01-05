import { User, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RideChat } from '@/components/rider/RideChat';

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  rating: number | null;
  profile_image_url?: string | null;
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
          <div className="w-14 h-14 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded w-24" />
            <div className="h-4 bg-muted rounded w-40" />
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

  return (
    <div className="bg-card rounded-2xl border shadow-lg p-4">
      <div className="flex items-start gap-3">
        {/* صورة السائق + التقييم */}
        <div className="relative">
          <Avatar className="w-14 h-14 border-2 border-primary shadow-md">
            {driver.profile_image_url ? (
              <AvatarImage src={driver.profile_image_url} alt={driver.full_name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {driver.full_name?.charAt(0) || <User className="w-6 h-6" />}
            </AvatarFallback>
          </Avatar>
          {/* شارة التقييم */}
          <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {driver.rating?.toFixed(1) || '5.0'}
            </span>
          </div>
        </div>
        
        {/* معلومات السائق */}
        <div className="flex-1 min-w-0">
          {/* الاسم + زر المحادثة */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-lg text-foreground truncate">
              {driver.full_name}
            </h3>
            <RideChat 
              rideId={rideId} 
              userType="rider" 
              rideStatus={rideStatus}
              driverPhone={driver.phone}
            />
          </div>
          
          {/* معلومات السيارة */}
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {vehicleInfo}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DriverInfoCard;
