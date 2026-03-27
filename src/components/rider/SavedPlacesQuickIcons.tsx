import React, { useState, useEffect } from 'react';
import { Home, Briefcase, Star, Plus, MapPin } from 'lucide-react';
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
      const {
        data,
        error
      } = await supabase.from('saved_places').select('*').eq('user_id', userId).order('created_at', {
        ascending: true
      }).limit(4);
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
      // Return emoji if it's a custom icon
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
        return <Star className="w-4 h-4" />;
    }
  };
  const getDisplayName = (place: SavedPlace) => {
    // Show short name
    if (place.label === 'home' || place.label === 'المنزل') return 'المنزل';
    if (place.label === 'work' || place.label === 'العمل') return 'العمل';
    return place.name.length > 8 ? place.name.substring(0, 8) + '...' : place.name;
  };
  const getIconColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home':
      case 'المنزل':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'work':
      case 'العمل':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default:
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    }
  };
  if (loading) {
    return <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-24 rounded-full shrink-0" />)}
      </div>;
  }
  if (!userId) {
    return null;
  }
  return <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
      {places.map(place => <button key={place.id} onClick={() => onSelect({
      lat: place.lat,
      lng: place.lng,
      address: place.address
    })} className={`flex items-center gap-2 px-4 py-2.5 rounded-full border shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 ${getIconColor(place.label)}`}>
          {getIcon(place.label, place.icon)}
          <span className="text-sm whitespace-nowrap font-bold">{getDisplayName(place)}</span>
        </button>)}
      
      {/* Add new place button */}
      {onAddNew && places.length < 4 && <button onClick={onAddNew} className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground shrink-0 transition-all duration-200 hover:border-primary hover:text-primary hover:bg-primary/5">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium whitespace-nowrap">إضافة</span>
        </button>}
      
      {/* Show placeholder if no places */}
      {places.length === 0 && !onAddNew && <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary/50 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">لا توجد أماكن محفوظة</span>
        </div>}
    </div>;
};
export default SavedPlacesQuickIcons;