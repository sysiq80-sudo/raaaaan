import { motion } from 'framer-motion';
import { User, Star, Phone, MessageCircle, Car, Shield, Navigation } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RideChat } from '@/components/rider/RideChat';

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  vehicle_type?: string | null;
  rating: number | null;
  profile_image_url?: string | null;
}

interface DriverInfoCardProps {
  driver: Driver | null;
  rideId: string;
  rideStatus: string;
}

const getVehicleTypeName = (type: string | null) => {
  switch (type) {
    case 'economy': return 'اقتصادي';
    case 'comfort': return 'مريح';
    case 'premium': return 'فاخر';
    case 'women_only': return 'نسائي';
    default: return 'عادي';
  }
};

const getVehicleEmoji = (type: string | null) => {
  switch (type) {
    case 'economy': return '🚗';
    case 'comfort': return '🚙';
    case 'premium': return '🚘';
    case 'women_only': return '👩';
    default: return '🚗';
  }
};

const DriverInfoCard = ({ driver, rideId, rideStatus }: DriverInfoCardProps) => {
  if (!driver || rideStatus === 'pending') {
    return (
      <div className="bg-gradient-to-br from-card to-card/80 rounded-3xl border-2 border-border/50 shadow-xl p-5 animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-muted rounded-lg w-28" />
            <div className="h-4 bg-muted rounded-lg w-44" />
            <div className="h-3 bg-muted rounded-lg w-32" />
          </div>
        </div>
      </div>
    );
  }

  const vehicleInfo = [
    driver.vehicle_model,
    driver.vehicle_color,
  ].filter(Boolean).join(' - ') || 'معلومات السيارة غير متوفرة';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-card via-card to-primary/5 rounded-3xl border-2 border-primary/20 shadow-xl overflow-hidden"
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex items-start gap-4">
          {/* Driver Avatar with Badge */}
          <div className="relative">
            <Avatar className="w-18 h-18 border-3 border-primary shadow-lg shadow-primary/20">
              {driver.profile_image_url ? (
                <AvatarImage src={driver.profile_image_url} alt={driver.full_name} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xl font-bold">
                {driver.full_name?.charAt(0) || <User className="w-8 h-8" />}
              </AvatarFallback>
            </Avatar>
            
            {/* Verified Badge */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-card">
              <Shield className="w-4 h-4 text-white" />
            </div>
            
            {/* Rating Badge */}
            <div className="absolute -top-1 -left-1 flex items-center gap-0.5 bg-amber-500 px-2 py-0.5 rounded-full shadow-lg">
              <Star className="w-3 h-3 fill-white text-white" />
              <span className="text-xs font-bold text-white">
                {driver.rating?.toFixed(1) || '5.0'}
              </span>
            </div>
          </div>
          
          {/* Driver Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-bold text-xl text-foreground truncate">
                {driver.full_name}
              </h3>
              <RideChat 
                rideId={rideId} 
                userType="rider" 
                rideStatus={rideStatus}
                driverPhone={driver.phone}
              />
            </div>
            
            {/* Vehicle Type Badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="px-3 py-1 text-sm bg-secondary/80">
                <span className="ml-1">{getVehicleEmoji(driver.vehicle_type)}</span>
                {getVehicleTypeName(driver.vehicle_type)}
              </Badge>
            </div>
            
            {/* Vehicle Info */}
            <p className="text-sm text-muted-foreground truncate">
              {vehicleInfo}
            </p>
          </div>
        </div>
      </div>
      
      {/* Vehicle Plate & Actions */}
      <div className="px-5 pb-5 pt-3 space-y-4">
        {/* Vehicle Plate - Prominent Display */}
        {driver.vehicle_plate && (
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl" />
              <div className="relative px-6 py-3 rounded-xl bg-gradient-to-r from-primary/15 to-primary/10 border-2 border-primary/30">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-primary" />
                  <span className="text-xl font-bold text-primary tracking-wider">
                    {driver.vehicle_plate}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Quick Action Buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-2 rounded-xl h-11 border-2 hover:bg-primary/10 hover:border-primary/50"
            onClick={() => window.open(`tel:${driver.phone}`)}
          >
            <Phone className="w-4 h-4 text-primary" />
            <span className="font-medium">اتصال</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-2 rounded-xl h-11 border-2 hover:bg-primary/10 hover:border-primary/50"
          >
            <Navigation className="w-4 h-4 text-primary" />
            <span className="font-medium">الموقع</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default DriverInfoCard;
