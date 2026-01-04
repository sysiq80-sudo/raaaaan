import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, Briefcase, MapPin, Clock, TrendingUp, Sparkles, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PredictedPlace {
  id: string;
  address: string;
  location: { lat: number; lng: number };
  type: 'home' | 'work' | 'frequent' | 'recent' | 'return';
  label?: string;
  visitCount?: number;
  confidence?: number;
}

interface PredictiveDestinationsProps {
  userId?: string;
  currentLocation?: { lat: number; lng: number };
  onPlaceSelect: (place: { address: string; location: { lat: number; lng: number } }) => void;
  className?: string;
}

// حساب المسافة بين نقطتين (بالمتر)
const calculateDistance = (loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }): number => {
  const R = 6371000;
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const PredictiveDestinations: React.FC<PredictiveDestinationsProps> = ({
  userId,
  currentLocation,
  onPlaceSelect,
  className,
}) => {
  const [predictions, setPredictions] = useState<PredictedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadPredictions();
    } else {
      setLoading(false);
    }
  }, [userId, currentLocation]);

  const loadPredictions = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const currentHour = new Date().getHours();
      
      // 1. جلب الأماكن المحفوظة
      const { data: savedPlaces } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .limit(5);

      // 2. جلب الرحلة الأخيرة للعودة الذكية
      const { data: lastRide } = await supabase
        .from('rides')
        .select('pickup_address, pickup_location, dropoff_address, dropoff_location, created_at')
        .eq('rider_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 3. جلب الرحلات المتكررة
      const { data: recentRides } = await supabase
        .from('rides')
        .select('dropoff_address, dropoff_location, created_at')
        .eq('rider_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      const predictedPlaces: PredictedPlace[] = [];

      // ===== منطق العودة الذكية =====
      if (lastRide && currentLocation) {
        const lastDropoff = typeof lastRide.dropoff_location === 'string'
          ? JSON.parse(lastRide.dropoff_location)
          : lastRide.dropoff_location;
        
        const lastPickup = typeof lastRide.pickup_location === 'string'
          ? JSON.parse(lastRide.pickup_location)
          : lastRide.pickup_location;

        // إذا كان الموقع الحالي قريب من وجهة الرحلة الأخيرة
        if (lastDropoff && calculateDistance(currentLocation, lastDropoff) < 500) {
          // اقتراح العودة لنقطة الانطلاق
          predictedPlaces.push({
            id: 'return-trip',
            address: lastRide.pickup_address || 'نقطة الانطلاق السابقة',
            location: lastPickup,
            type: 'return',
            label: '🔄 العودة',
            confidence: 95,
          });
        }
      }

      // ===== منطق الوقت الذكي =====
      let homePlace: PredictedPlace | null = null;
      let workPlace: PredictedPlace | null = null;

      // إضافة الأماكن المحفوظة
      savedPlaces?.forEach(place => {
        const location = { lat: place.lat, lng: place.lng };
        const isHome = place.label?.toLowerCase() === 'home' || place.name?.includes('البيت') || place.name?.includes('المنزل');
        const isWork = place.label?.toLowerCase() === 'work' || place.name?.includes('العمل') || place.name?.includes('المكتب');
        
        const placeType = isHome ? 'home' : isWork ? 'work' : 'frequent';
        
        const predicted: PredictedPlace = {
          id: place.id,
          address: place.address,
          location: location,
          type: placeType,
          label: place.name,
          confidence: 85,
        };

        if (isHome) homePlace = predicted;
        if (isWork) workPlace = predicted;

        predictedPlaces.push(predicted);
      });

      // اقتراحات ذكية بناءً على الوقت
      if (currentLocation) {
        // صباحاً (6-10): إذا في البيت → اقتراح العمل
        if (currentHour >= 6 && currentHour <= 10 && homePlace && workPlace) {
          if (calculateDistance(currentLocation, homePlace.location) < 300) {
            // المستخدم في البيت صباحاً - رفع أولوية العمل
            const workIndex = predictedPlaces.findIndex(p => p.type === 'work');
            if (workIndex > -1) {
              predictedPlaces[workIndex].confidence = 98;
              predictedPlaces[workIndex].label = '🏢 الذهاب للعمل';
            }
          }
        }

        // مساءً (16-22): إذا في العمل → اقتراح البيت
        if (currentHour >= 16 && currentHour <= 22 && homePlace && workPlace) {
          if (calculateDistance(currentLocation, workPlace.location) < 300) {
            // المستخدم في العمل مساءً - رفع أولوية البيت
            const homeIndex = predictedPlaces.findIndex(p => p.type === 'home');
            if (homeIndex > -1) {
              predictedPlaces[homeIndex].confidence = 98;
              predictedPlaces[homeIndex].label = '🏠 العودة للبيت';
            }
          }
        }
      }

      // تحليل الرحلات المتكررة
      if (recentRides) {
        const destinationCounts: Record<string, { 
          address: string; 
          location: any; 
          count: number;
          hours: number[];
        }> = {};

        recentRides.forEach(ride => {
          if (ride.dropoff_address) {
            const key = ride.dropoff_address;
            const rideHour = new Date(ride.created_at).getHours();
            
            if (!destinationCounts[key]) {
              const location = typeof ride.dropoff_location === 'string'
                ? JSON.parse(ride.dropoff_location)
                : ride.dropoff_location;
              destinationCounts[key] = {
                address: ride.dropoff_address,
                location,
                count: 0,
                hours: [],
              };
            }
            destinationCounts[key].count++;
            destinationCounts[key].hours.push(rideHour);
          }
        });

        // إضافة الوجهات المتكررة
        const frequentDestinations = Object.values(destinationCounts)
          .filter(d => d.count >= 2)
          .sort((a, b) => {
            const aTimeMatch = a.hours.some(h => Math.abs(h - currentHour) <= 2);
            const bTimeMatch = b.hours.some(h => Math.abs(h - currentHour) <= 2);
            
            if (aTimeMatch && !bTimeMatch) return -1;
            if (!aTimeMatch && bTimeMatch) return 1;
            
            return b.count - a.count;
          })
          .slice(0, 3);

        frequentDestinations.forEach((dest, index) => {
          if (!predictedPlaces.some(p => p.address === dest.address)) {
            const timeMatch = dest.hours.some(h => Math.abs(h - currentHour) <= 2);
            predictedPlaces.push({
              id: `frequent-${index}`,
              address: dest.address,
              location: dest.location,
              type: 'frequent',
              visitCount: dest.count,
              confidence: timeMatch ? 85 : 70,
            });
          }
        });
      }

      // ترتيب حسب الثقة
      predictedPlaces.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      
      setPredictions(predictedPlaces.slice(0, 5));
    } catch (error) {
      console.error('Error loading predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: PredictedPlace['type']) => {
    switch (type) {
      case 'home':
        return <Home className="w-4 h-4" />;
      case 'work':
        return <Briefcase className="w-4 h-4" />;
      case 'frequent':
        return <TrendingUp className="w-4 h-4" />;
      case 'recent':
        return <Clock className="w-4 h-4" />;
      case 'return':
        return <RotateCcw className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: PredictedPlace['type']) => {
    switch (type) {
      case 'home':
        return 'المنزل';
      case 'work':
        return 'العمل';
      case 'frequent':
        return 'وجهة متكررة';
      case 'recent':
        return 'رحلة سابقة';
      case 'return':
        return 'رحلة عودة';
      default:
        return '';
    }
  };

  const getTypeColor = (type: PredictedPlace['type']) => {
    switch (type) {
      case 'home':
        return 'text-emerald-600 bg-emerald-500/10';
      case 'work':
        return 'text-blue-600 bg-blue-500/10';
      case 'frequent':
        return 'text-amber-600 bg-amber-500/10';
      case 'recent':
        return 'text-purple-600 bg-purple-500/10';
      case 'return':
        return 'text-cyan-600 bg-cyan-500/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (predictions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">اقتراحات ذكية</span>
      </div>

      <div className="space-y-2">
        {predictions.map((place, index) => (
          <motion.button
            key={place.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl",
              "bg-card border border-border/50 hover:border-primary/50",
              "transition-all duration-200 hover:shadow-md",
              "text-right",
              place.type === 'return' && "border-cyan-500/30 bg-cyan-500/5"
            )}
            onClick={() => onPlaceSelect({
              address: place.address,
              location: place.location,
            })}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              getTypeColor(place.type)
            )}>
              {getIcon(place.type)}
            </div>
            
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {place.label || getTypeLabel(place.type)}
                </span>
                {place.confidence && place.confidence >= 90 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    موصى به
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {place.address}
              </p>
              {place.visitCount && place.visitCount > 1 && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  زرته {place.visitCount} مرات
                </p>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default PredictiveDestinations;
