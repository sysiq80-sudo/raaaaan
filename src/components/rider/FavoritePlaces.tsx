import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface FavoritePlace {
  id: string;
  user_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  label: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

interface FavoritePlacesProps {
  userId: string | undefined;
  onSelectLocation: (location: { lat: number; lng: number; address: string }) => void;
  onClose?: () => void;
}

export const FavoritePlaces: React.FC<FavoritePlacesProps> = ({
  userId,
  onSelectLocation,
  onClose
}) => {
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadFavoritePlaces();
    }
  }, [userId]);

  const loadFavoritePlaces = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setFavorites((data || []) as FavoritePlace[]);
    } catch (error) {
      console.error('Error loading favorite places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlace = async (place: FavoritePlace) => {
    onSelectLocation({
      lat: place.lat,
      lng: place.lng,
      address: place.address
    });
    onClose?.();
  };

  const handleDeletePlace = async (placeId: string) => {
    try {
      const { error } = await supabase
        .from('saved_places')
        .delete()
        .eq('id', placeId);

      if (error) throw error;

      setFavorites(prev => prev.filter(p => p.id !== placeId));
      toast({
        title: "تم الحذف",
        description: "تم حذف المكان المحفوظ بنجاح",
      });
    } catch (error) {
      console.error('Error deleting place:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف المكان",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">لا توجد أماكن محفوظة</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {favorites.map((place) => (
        <div
          key={place.id}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer group"
          onClick={() => handleSelectPlace(place)}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{place.name}</p>
            <p className="text-xs text-muted-foreground truncate">{place.address}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePlace(place.id);
            }}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export default FavoritePlaces;
