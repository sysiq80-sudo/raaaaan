/**
 * ران - مكون خيارات تحديد الموقع
 * حقول ثابتة لاختيار نقطة الانطلاق أو الوجهة
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Navigation, Map, Search, Locate, Home, Briefcase, Star, ChevronDown, Target } from "lucide-react";
interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  label: string;
}
interface LocationOptionsSectionProps {
  type: 'pickup' | 'dropoff';
  title: string;
  subtitle: string;
  userId?: string | null;
  currentAddress?: string;
  selectedLocation?: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  onUseCurrentLocation: () => void;
  onSelectFromMap: () => void;
  onSearchLocation: () => void;
  onSelectSavedPlace?: (place: {
    lat: number;
    lng: number;
    address: string;
  }) => void;
}
const LocationOptionsSection = ({
  type,
  title,
  subtitle,
  userId,
  currentAddress,
  selectedLocation,
  onUseCurrentLocation,
  onSelectFromMap,
  onSearchLocation,
  onSelectSavedPlace
}: LocationOptionsSectionProps) => {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);

  // Colors based on type
  const colors = type === 'pickup' ? {
    primary: 'green',
    gradient: 'from-green-500 to-emerald-600'
  } : {
    primary: 'red',
    gradient: 'from-red-500 to-rose-600'
  };

  // Load saved places
  useEffect(() => {
    const fetchSavedPlaces = async () => {
      if (!userId) return;
      const {
        data
      } = await supabase.from('saved_places').select('*').eq('user_id', userId).limit(5);
      if (data) {
        setSavedPlaces(data);
      }
    };
    fetchSavedPlaces();
  }, [userId]);
  const getIconForLabel = (label: string) => {
    switch (label) {
      case 'home':
        return <Home className="w-4 h-4 text-blue-600" />;
      case 'work':
        return <Briefcase className="w-4 h-4 text-amber-600" />;
      default:
        return <Star className="w-4 h-4 text-purple-600" />;
    }
  };
  return <motion.div initial={{
    opacity: 0,
    y: 20
  }} animate={{
    opacity: 1,
    y: 0
  }} className="space-y-3">
            {/* Title Section */}
            <div className="flex items-center gap-3">
                
                <div>
                    <h2 className="text-lg font-bold text-foreground">{title}</h2>
                    
                </div>
            </div>

            {/* Selected Location Display */}
            {selectedLocation && <motion.div initial={{
      opacity: 0,
      scale: 0.95
    }} animate={{
      opacity: 1,
      scale: 1
    }} className={`p-3 rounded-xl bg-${colors.primary}-500/10 border border-${colors.primary}-500/30`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-${colors.primary}-500 flex items-center justify-center`}>
                            <MapPin className="w-3 h-3 text-white" />
                        </div>
                        <p className="text-sm font-medium text-foreground truncate flex-1">
                            {selectedLocation.address}
                        </p>
                        <span className={`text-xs text-${colors.primary}-600`}>✓</span>
                    </div>
                </motion.div>}

            {/* Options Grid */}
            <div className="grid grid-cols-3 gap-2">
                {/* Current Location */}
                <motion.button whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }} onClick={onUseCurrentLocation} className="items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-green-500/50 hover:bg-green-500/5 transition-all flex flex-row">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Locate className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-xs font-medium text-foreground text-center">موقعي الحالي</span>
                </motion.button>

                {/* Select from Map */}
                <motion.button whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }} onClick={onSelectFromMap} className="items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex flex-row">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Map className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-foreground text-center">من الخريطة</span>
                </motion.button>

                {/* Search by Name */}
                <motion.button whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }} onClick={onSearchLocation} className="items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex flex-row">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Search className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-xs font-medium text-foreground text-center">ابحث بالاسم</span>
                </motion.button>
            </div>

            {/* Saved Places Section */}
            {savedPlaces.length > 0 && <div className="space-y-2">
                    

                    <AnimatePresence>
                        {showSavedPlaces && <motion.div initial={{
          opacity: 0,
          height: 0
        }} animate={{
          opacity: 1,
          height: 'auto'
        }} exit={{
          opacity: 0,
          height: 0
        }} className="overflow-hidden space-y-1">
                                {savedPlaces.map(place => <motion.button key={place.id} whileHover={{
            x: 5
          }} whileTap={{
            scale: 0.98
          }} onClick={() => {
            if (onSelectSavedPlace) {
              onSelectSavedPlace({
                lat: place.lat,
                lng: place.lng,
                address: place.address || place.name
              });
            }
          }} className="w-full flex items-center gap-2 p-2 rounded-lg bg-card border border-border/30 hover:border-primary/30 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                            {getIconForLabel(place.label)}
                                        </div>
                                        <div className="text-right flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{place.address}</p>
                                        </div>
                                    </motion.button>)}
                            </motion.div>}
                    </AnimatePresence>
                </div>}
        </motion.div>;
};
export default LocationOptionsSection;