import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Briefcase, Star, Plus, MapPin, Heart, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SavedPlace {
  id: string;
  label: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon?: string;
}

interface SavedPlacesQuickIconsProps {
  userId: string | null;
  onSelect: (place: {
    lat: number;
    lng: number;
    address: string;
  }) => void;
  onAddNew?: () => void;
  className?: string;
}

const placeConfig: Record<string, {
  icon: typeof Home;
  emoji: string;
  label: string;
  gradient: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
}> = {
  home: {
    icon: Home,
    emoji: '🏠',
    label: 'المنزل',
    gradient: 'from-blue-500 to-blue-600',
    bgGradient: 'from-blue-500/15 to-blue-600/10',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-600 dark:text-blue-400'
  },
  work: {
    icon: Briefcase,
    emoji: '💼',
    label: 'العمل',
    gradient: 'from-amber-500 to-orange-600',
    bgGradient: 'from-amber-500/15 to-amber-600/10',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-600 dark:text-amber-400'
  },
  favorite: {
    icon: Star,
    emoji: '⭐',
    label: 'مفضل',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-500/15 to-violet-600/10',
    borderColor: 'border-violet-500/40',
    textColor: 'text-violet-600 dark:text-violet-400'
  },
  default: {
    icon: Heart,
    emoji: '❤️',
    label: 'مكان',
    gradient: 'from-rose-500 to-pink-600',
    bgGradient: 'from-rose-500/15 to-rose-600/10',
    borderColor: 'border-rose-500/40',
    textColor: 'text-rose-600 dark:text-rose-400'
  }
};

const SavedPlacesQuickIcons: React.FC<SavedPlacesQuickIconsProps> = ({
  userId,
  onSelect,
  onAddNew,
  className
}) => {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchSavedPlaces();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchSavedPlaces = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(4);
      
      if (error) throw error;
      setPlaces(data || []);
    } catch (error) {
      console.error('Error fetching saved places:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfig = (label: string) => {
    const key = label.toLowerCase();
    if (key === 'home' || key === 'المنزل') return placeConfig.home;
    if (key === 'work' || key === 'العمل') return placeConfig.work;
    if (key === 'favorite' || key === 'مفضل') return placeConfig.favorite;
    return placeConfig.default;
  };

  const getDisplayName = (place: SavedPlace) => {
    const config = getConfig(place.label);
    if (config !== placeConfig.default) return config.label;
    return place.name.length > 6 ? place.name.substring(0, 6) + '...' : place.name;
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-5 h-5 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">الأماكن المفضلة</span>
        </div>
        {onAddNew && places.length > 0 && (
          <button
            onClick={onAddNew}
            className="text-xs font-medium text-primary hover:underline"
          >
            إدارة
          </button>
        )}
      </div>

      {/* Places Row */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <AnimatePresence>
          {places.map((place, index) => {
            const config = getConfig(place.label);
            
            return (
              <motion.button
                key={place.id}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelect({
                  lat: place.lat,
                  lng: place.lng,
                  address: place.address
                })}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-2xl shrink-0 transition-all duration-300",
                  "min-w-[90px] w-[90px]",
                  `bg-gradient-to-br ${config.bgGradient}`,
                  "border-2",
                  config.borderColor,
                  "hover:shadow-lg"
                )}
              >
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shadow-md",
                  `bg-gradient-to-br ${config.gradient}`
                )}>
                  <span className="text-xl">{config.emoji}</span>
                </div>
                <span className={cn("text-xs font-bold", config.textColor)}>
                  {getDisplayName(place)}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
        
        {/* Add new place button */}
        {onAddNew && places.length < 4 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: places.length * 0.05 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={onAddNew}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl shrink-0 min-w-[90px] w-[90px] border-2 border-dashed border-muted-foreground/30 bg-secondary/30 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-secondary/50 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
              إضافة
            </span>
          </motion.button>
        )}
        
        {/* Empty state */}
        {places.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/30 text-muted-foreground"
          >
            <MapPin className="w-4 h-4" />
            <span className="text-sm">أضف أماكنك المفضلة للوصول السريع</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SavedPlacesQuickIcons;
