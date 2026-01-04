import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, Briefcase, Star, Plus, MapPin, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

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
}

const SavedPlacesQuickIcons: React.FC<SavedPlacesQuickIconsProps> = ({
  userId,
  onSelect,
  onAddNew
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

  const getIcon = (label: string, customIcon?: string) => {
    if (customIcon) {
      return <span className="text-lg">{customIcon}</span>;
    }
    switch (label.toLowerCase()) {
      case 'home':
      case 'المنزل':
        return <Home className="w-4 h-4" />;
      case 'work':
      case 'العمل':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <Heart className="w-4 h-4" />;
    }
  };

  const getDisplayName = (place: SavedPlace) => {
    if (place.label === 'home' || place.label === 'المنزل') return 'المنزل';
    if (place.label === 'work' || place.label === 'العمل') return 'العمل';
    return place.name.length > 8 ? place.name.substring(0, 8) + '...' : place.name;
  };

  const getIconStyle = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home':
      case 'المنزل':
        return {
          bg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5',
          border: 'border-emerald-500/30',
          text: 'text-emerald-600',
          hover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/20'
        };
      case 'work':
      case 'العمل':
        return {
          bg: 'bg-gradient-to-br from-blue-500/20 to-blue-500/5',
          border: 'border-blue-500/30',
          text: 'text-blue-600',
          hover: 'hover:border-blue-500/50 hover:shadow-blue-500/20'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-amber-500/20 to-amber-500/5',
          border: 'border-amber-500/30',
          text: 'text-amber-600',
          hover: 'hover:border-amber-500/50 hover:shadow-amber-500/20'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto py-2 scrollbar-hide">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 w-28 rounded-2xl shrink-0" />
        ))}
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="flex gap-3 overflow-x-auto py-2 scrollbar-hide">
      {places.map((place, index) => {
        const style = getIconStyle(place.label);
        
        return (
          <motion.button
            key={place.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect({
              lat: place.lat,
              lng: place.lng,
              address: place.address
            })}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shrink-0 transition-all duration-300 shadow-sm hover:shadow-md ${style.bg} ${style.border} ${style.text} ${style.hover}`}
          >
            <div className="w-8 h-8 rounded-xl bg-white/50 flex items-center justify-center">
              {getIcon(place.label, place.icon)}
            </div>
            <span className="text-sm font-bold whitespace-nowrap">{getDisplayName(place)}</span>
          </motion.button>
        );
      })}
      
      {/* Add new place button */}
      {onAddNew && places.length < 4 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: places.length * 0.05 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddNew}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground shrink-0 transition-all duration-300 hover:border-primary hover:text-primary hover:bg-primary/5"
        >
          <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">إضافة مكان</span>
        </motion.button>
      )}
      
      {/* Show placeholder if no places */}
      {places.length === 0 && !onAddNew && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary/50 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">لا توجد أماكن محفوظة</span>
        </div>
      )}
    </div>
  );
};

export default SavedPlacesQuickIcons;
