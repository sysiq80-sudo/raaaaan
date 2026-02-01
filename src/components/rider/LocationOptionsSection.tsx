/**
 * ران - مكون خيارات تحديد الموقع
 * حقول ثابتة لاختيار نقطة الانطلاق أو الوجهة
 */

import { motion } from "framer-motion";
import { MapPin, Navigation, Map, Search, Locate, Target } from "lucide-react";
interface LocationOptionsSectionProps {
  type: 'pickup' | 'dropoff';
  title: string;
  subtitle: string;
  currentAddress?: string;
  selectedLocation?: {
    lat: number;
    lng: number;
    address: string;
  } | null;
  onUseCurrentLocation: () => void;
  onSelectFromMap: () => void;
  onSearchLocation: () => void;
}
const LocationOptionsSection = ({
  type,
  title,
  subtitle,
  currentAddress,
  selectedLocation,
  onUseCurrentLocation,
  onSelectFromMap,
  onSearchLocation
}: LocationOptionsSectionProps) => {

  // Colors based on type
  const colors = type === 'pickup' ? {
    primary: 'green',
    gradient: 'from-green-500 to-emerald-600'
  } : {
    primary: 'red',
    gradient: 'from-red-500 to-rose-600'
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
              {/* Removed Saved Places Section */}
        </motion.div>;
};
export default LocationOptionsSection;