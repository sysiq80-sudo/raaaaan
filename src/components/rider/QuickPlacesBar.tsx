import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Home, Briefcase, Star, Loader2, MapPin, Heart, Plus } from "lucide-react";
import { SavedPlace } from "./SavedPlaces";
import { cn } from "@/lib/utils";

interface QuickPlacesBarProps {
  userId: string | null;
  onSelect: (place: SavedPlace) => void;
  onAddNew?: () => void;
  className?: string;
}

const placeConfig = {
  home: {
    icon: Home,
    label: "المنزل",
    emoji: "🏠",
    gradient: "from-blue-500 to-blue-600",
    bgGradient: "from-blue-500/15 to-blue-600/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-600 dark:text-blue-400"
  },
  work: {
    icon: Briefcase,
    label: "العمل",
    emoji: "💼",
    gradient: "from-amber-500 to-orange-600",
    bgGradient: "from-amber-500/15 to-amber-600/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-600 dark:text-amber-400"
  },
  favorite: {
    icon: Star,
    label: "مفضل",
    emoji: "⭐",
    gradient: "from-violet-500 to-purple-600",
    bgGradient: "from-violet-500/15 to-violet-600/10",
    borderColor: "border-violet-500/30",
    textColor: "text-violet-600 dark:text-violet-400"
  }
};

export const QuickPlacesBar = ({ userId, onSelect, onAddNew, className }: QuickPlacesBarProps) => {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchQuickPlaces();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchQuickPlaces = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .in('label', ['home', 'work', 'favorite'])
        .order('created_at', { ascending: true })
        .limit(3);

      if (error) throw error;
      setPlaces(data || []);
    } catch (error) {
      console.error('Error fetching quick places:', error);
    } finally {
      setLoading(false);
    }
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

  // Always show the bar, even if no places
  const homePlace = places.find(p => p.label === 'home');
  const workPlace = places.find(p => p.label === 'work');
  const favoritePlace = places.find(p => p.label === 'favorite');

  const PlaceButton = ({ place, config }: { place: SavedPlace | undefined; config: typeof placeConfig.home }) => {
    const Icon = config.icon;
    
    if (!place) {
      // Show add button placeholder
      return (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onAddNew}
          className="flex-1 min-w-[100px] flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary/30 border-2 border-dashed border-border/50 hover:border-primary/30 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center group-hover:bg-secondary transition-colors">
            <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground">إضافة {config.label}</p>
          </div>
        </motion.button>
      );
    }

    return (
      <motion.button
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onSelect(place)}
        className={cn(
          "flex-1 min-w-[100px] flex flex-col items-center gap-2 p-4 rounded-2xl transition-all",
          `bg-gradient-to-br ${config.bgGradient}`,
          "border-2",
          config.borderColor,
          "hover:shadow-lg"
        )}
      >
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg",
          `bg-gradient-to-br ${config.gradient}`
        )}>
          <span className="text-xl">{config.emoji}</span>
        </div>
        <div className="text-center w-full">
          <p className={cn("text-sm font-bold", config.textColor)}>{config.label}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[90px] mx-auto mt-0.5">
            {place.address.split(',')[0]}
          </p>
        </div>
      </motion.button>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">أماكنك المفضلة</span>
        </div>
        {onAddNew && places.length > 0 && (
          <button
            onClick={onAddNew}
            className="text-xs font-medium text-primary hover:underline"
          >
            إدارة الأماكن
          </button>
        )}
      </div>

      {/* Places Grid */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <AnimatePresence>
          <PlaceButton place={homePlace} config={placeConfig.home} />
          <PlaceButton place={workPlace} config={placeConfig.work} />
          {(favoritePlace || places.length >= 2) && (
            <PlaceButton place={favoritePlace} config={placeConfig.favorite} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuickPlacesBar;