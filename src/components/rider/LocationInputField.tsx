import React, { useState } from 'react';
import { Heart, MapPin, X } from 'lucide-react';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { cn } from '@/lib/utils';
import SaveLocationModal from './SaveLocationModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LocationInputFieldProps {
  label: string;
  value: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeholder?: string;
  onClear?: () => void;
  onClick?: () => void;
  isPickup?: boolean;
  className?: string;
}

export default function LocationInputField({
  label,
  value,
  address,
  lat,
  lng,
  placeholder = 'اختر الموقع',
  onClear,
  onClick,
  isPickup = true,
  className = '',
}: LocationInputFieldProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const { toast } = useToast();
  
  const isFav = lat && lng ? isFavorite(lat, lng) : false;

  // 🟢 Reset heart icon when dragging - return to outline (unfilled)
  // because when user drags, they're setting a NEW location, not using a saved one
  // The heart fills ONLY when they explicitly save this new location

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!address || lat === undefined || lng === undefined) {
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "خطأ",
          description: "يرجى تسجيل الدخول أولاً",
          variant: "destructive"
        });
        return;
      }

      if (isFav) {
        // حذف من المفضلة
        const favorites = useFavoritesStore.getState().favorites;
        const favorite = favorites.find(
          (fav) => Math.abs(fav.lat - lat) < 0.001 && Math.abs(fav.lng - lng) < 0.001
        );
        
        if (favorite) {
          // احذف من Supabase
          const { error } = await supabase
            .from('saved_places')
            .delete()
            .eq('user_id', user.id)
            .eq('lat', lat)
            .eq('lng', lng);

          if (error) throw error;
          
          // احذف من الـ store
          removeFavorite(favorite.id);
          toast({
            title: "تم الحذف ✅",
            description: "تم إزالة المكان من المفضلة"
          });
        }
      } else {
        // عرض Modal لحفظ المكان
        setShowSaveModal(true);
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLocation = async (name: string, icon: string) => {
    if (!address || lat === undefined || lng === undefined) return;

    setIsSaving(true);
    try {
      // احصل على المستخدم الحالي
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "خطأ",
          description: "يرجى تسجيل الدخول أولاً",
          variant: "destructive"
        });
        return;
      }

      // احفظ في Supabase
      const { error } = await supabase
        .from('saved_places')
        .insert({
          user_id: user.id,
          name: name || 'بدون اسم',
          address,
          lat,
          lng,
          icon,
          label: icon
        });

      if (error) throw error;

      // أضف إلى الـ store أيضاً
      addFavorite({
        id: `${lat}-${lng}-${Date.now()}`,
        name: name || 'بدون اسم',
        address,
        lat,
        lng,
        icon: icon as 'home' | 'work' | 'cafe' | 'gym' | 'diwaniya' | 'carwash' | 'other',
        createdAt: Date.now(),
        color: '#22c55e', // green-500
      });

      toast({
        title: "تم حفظ المكان بنجاح ✅",
        description: `تم حفظ "${name || 'بدون اسم'}" في أماكنك المحفوظة"`
      });
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast({
        title: "خطأ في الحفظ",
        description: error.message || "حدث خطأ أثناء حفظ المكان",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className={cn('space-y-1', className)}>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        <div className="relative">
          {/* Heart Button - Positioned Absolutely on LEFT (RTL) - inside field */}
          {address && lat && lng && (
            <button
              onClick={handleToggleFavorite}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex-shrink-0 p-1.5 rounded-md hover:bg-red-50 transition-colors z-10"
              title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            >
              {isFav ? (
                <Heart className="w-5 h-5 text-green-600 fill-green-600" />
              ) : (
                <Heart className="w-5 h-5 text-muted-foreground hover:text-green-600 transition-colors" />
              )}
            </button>
          )}

          {/* Clear Button - Positioned Absolutely on FAR RIGHT - outside field */}
          {address && onClear && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 z-10"
              title="مسح الموقع"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* Main clickable area */}
          <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
            className="w-full flex items-center px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-right group cursor-pointer relative"
          >
            {/* Location Pin Icon - ABSOLUTE RIGHT (like search icon aligned vertically) */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Text Content - Start from RIGHT with padding to avoid Pin icon */}
            <div className="flex-1 text-right min-w-0 pr-9">
              {address ? (
                <p className="text-sm font-medium truncate">{address}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{placeholder}</p>
              )}
            </div>
          </div>

          {/* Focus Ring */}
          <div className="absolute inset-0 rounded-lg border border-transparent group-hover:border-border pointer-events-none" />
        </div>
      </div>

      {/* Save Location Modal */}
      <SaveLocationModal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        address={address || ''}
        onSave={handleSaveLocation}
      />
    </>
  );
}
