import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Utensils, 
  Hospital, 
  ShoppingBag, 
  Building2, 
  GraduationCap,
  Fuel,
  Car,
  MapPin,
  Landmark,
  Store
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { calculateLocalDistance } from '@/lib/mapUtils';

interface PopularPlace {
  id: string;
  name: string;
  category: string;
  address?: string;
  location: { lat: number; lng: number };
  distance?: number;
}

interface PopularPlacesProps {
  currentLocation?: { lat: number; lng: number };
  onPlaceSelect: (place: { address: string; location: { lat: number; lng: number } }) => void;
  selectedCategory?: string;
  className?: string;
  maxDistance?: number; // Maximum distance in km (default 20)
  maxPlaces?: number; // Maximum places to show (default 3)
}

const categoryConfig: Record<string, { 
  icon: React.ComponentType<any>; 
  label: string; 
  color: string;
}> = {
  restaurant: { icon: Utensils, label: 'مطاعم', color: 'text-orange-600 bg-orange-500/10' },
  hospital: { icon: Hospital, label: 'مستشفيات', color: 'text-red-600 bg-red-500/10' },
  mall: { icon: ShoppingBag, label: 'مولات', color: 'text-purple-600 bg-purple-500/10' },
  university: { icon: GraduationCap, label: 'جامعات', color: 'text-blue-600 bg-blue-500/10' },
  government: { icon: Landmark, label: 'دوائر حكومية', color: 'text-slate-600 bg-slate-500/10' },
  gas_station: { icon: Fuel, label: 'محطات وقود', color: 'text-emerald-600 bg-emerald-500/10' },
  car_service: { icon: Car, label: 'خدمات سيارات', color: 'text-amber-600 bg-amber-500/10' },
  store: { icon: Store, label: 'متاجر', color: 'text-pink-600 bg-pink-500/10' },
  office: { icon: Building2, label: 'مكاتب', color: 'text-cyan-600 bg-cyan-500/10' },
  other: { icon: MapPin, label: 'أخرى', color: 'text-muted-foreground bg-muted' },
};

const PopularPlaces: React.FC<PopularPlacesProps> = ({
  currentLocation,
  onPlaceSelect,
  selectedCategory,
  className,
  maxDistance = 20,
  maxPlaces = 3,
}) => {
  const [places, setPlaces] = useState<PopularPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlaces();
  }, [currentLocation, selectedCategory]);

  const loadPlaces = async () => {
    if (!currentLocation) {
      setPlaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('landmarks')
        .select('*')
        .eq('is_active', true);

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      const placesWithDistance = (data || []).map(place => {
        const location = typeof place.location === 'string'
          ? JSON.parse(place.location)
          : place.location;

        let distance: number | undefined;
        if (currentLocation && location?.lat && location?.lng) {
          distance = calculateLocalDistance(currentLocation, location);
        }

        return {
          id: place.id,
          name: place.name_ar,
          category: place.category || 'other',
          location,
          distance,
        };
      });

      // Filter places within maxDistance (default 20km)
      const nearbyPlaces = placesWithDistance.filter(p => 
        p.distance !== undefined && p.distance <= maxDistance
      );

      // Sort by distance and take only maxPlaces (default 3)
      nearbyPlaces.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      setPlaces(nearbyPlaces.slice(0, maxPlaces));
    } catch (error) {
      console.error('Error loading popular places:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if no nearby places
  if (!loading && places.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <MapPin className="w-3 h-3" />
        أماكن قريبة
      </p>

      {/* Places List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {places.map((place, index) => {
            const config = categoryConfig[place.category] || categoryConfig.other;
            const Icon = config.icon;

            return (
              <motion.button
                key={place.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl",
                  "bg-secondary/50 hover:bg-secondary",
                  "transition-all duration-200 hover:shadow-sm",
                  "text-right"
                )}
                onClick={() => onPlaceSelect({
                  address: place.name,
                  location: place.location,
                })}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  config.color
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{place.name}</p>
                </div>

                {place.distance !== undefined && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {place.distance < 1 
                      ? `${Math.round(place.distance * 1000)} م`
                      : `${place.distance.toFixed(1)} كم`
                    }
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PopularPlaces;
