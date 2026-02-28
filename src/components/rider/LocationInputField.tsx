import React, { useState, useRef } from 'react';
import { Heart, MapPin, X, Navigation } from 'lucide-react';
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
  onCurrentLocationClick?: () => void;
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
  onCurrentLocationClick,
  isPickup = true,
  className = '',
}: LocationInputFieldProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const { toast } = useToast();
  const favoriteUpdateRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  
  const isFav = lat && lng ? isFavorite(lat, lng) : false;

  // 🟢 استخدام الموقع الحالي - سريع وفعال
  const handleUseCurrentLocation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isLoadingCurrent) return;
    
    setIsLoadingCurrent(true);
    try {
      if (!navigator.geolocation) {
        toast({
          title: "خطأ",
          description: "متصفحك لا يدعم تحديد الموقع",
          variant: "destructive"
        });
        setIsLoadingCurrent(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // استدعاء callback من GoPage مع تمرير الموقع الحالي الحقيقي
          if (onCurrentLocationClick) {
            // تأكد من أن الموقع الحالي يتم تمريره بشكل صحيح
            // سيتم استدعاء manualGeolocateMain في GoPage الذي يحدث المكان
            onCurrentLocationClick();
          }
          
          toast({
            title: "تم تحديد موقعك ✅",
            description: "موقعك الحالي محدد - انقر تأكيد",
            duration: 2000
          });
          
          setIsLoadingCurrent(false);
        },
        (error) => {
          const errorMsg = error.code === 1
            ? "يرجى منح صلاحية الوصول للموقع"
            : "فشل تحديد الموقع - حاول مجدداً";
          toast({
            title: "خطأ",
            description: errorMsg,
            variant: "destructive"
          });
          setIsLoadingCurrent(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (error: any) {
      console.error('Error getting current location:', error);
      toast({
        title: "خطأ",
        description: "فشل الحصول على الموقع الحالي",
        variant: "destructive"
      });
      setIsLoadingCurrent(false);
    }
  };

  // 🟢 حفظ سريع وفوري للمفضلة - بدون تأخير
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!address || lat === undefined || lng === undefined) {
      return;
    }

    // منع النقرات المتكررة على نفس الموقع
    if (favoriteUpdateRef.current) {
      const timeSinceLastUpdate = Date.now() - favoriteUpdateRef.current.timestamp;
      if (favoriteUpdateRef.current.lat === lat && 
          favoriteUpdateRef.current.lng === lng && 
          timeSinceLastUpdate < 500) {
        return;
      }
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

      favoriteUpdateRef.current = { lat, lng, timestamp: Date.now() };

      if (isFav) {
        // حذف من المفضلة - سريع
        const favorites = useFavoritesStore.getState().favorites;
        const favorite = favorites.find(
          (fav) => Math.abs(fav.lat - lat) < 0.001 && Math.abs(fav.lng - lng) < 0.001
        );
        
        if (favorite) {
          // احذف من Supabase بدون انتظار طويل
          const { error } = await supabase
            .from('saved_places')
            .delete()
            .eq('user_id', user.id)
            .eq('lat', lat)
            .eq('lng', lng);

          if (error) throw error;
          
          // احذف من الـ store فوراً
          removeFavorite(favorite.id);
          toast({
            title: "تم الحذف ✅",
            description: "تم إزالة المكان من المفضلة",
            duration: 1500
          });
        }
      } else {
        // هل يريد حفظ سريع أم إضافة بتفاصيل؟
        // إذا كان لديه اسم قديم، استخدمه مباشرة
        // وإلا عرض النموذج للحصول على اسم
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

      // احفظ في Supabase بدون تأخير
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

      // أضف إلى الـ store أيضاً فوراً
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
        title: "تم حفظ المكان ✅",
        description: `تم حفظ "${name || 'بدون اسم'}" في المفضلة`,
        duration: 1500
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
              disabled={isSaving}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex-shrink-0 p-1.5 rounded-md hover:bg-red-50 transition-colors z-10 disabled:opacity-50"
              title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            >
              {isFav ? (
                <Heart className="w-5 h-5 text-green-600 fill-green-600" />
              ) : (
                <Heart className="w-5 h-5 text-muted-foreground hover:text-green-600 transition-colors" />
              )}
            </button>
          )}

          {/* Current Location + Clear Buttons - Positioned on RIGHT side */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
            {/* Use Current Location Button - appears when in pickup mode */}
            {isPickup && onCurrentLocationClick && (
              <button
                onClick={handleUseCurrentLocation}
                disabled={isLoadingCurrent}
                className="p-1.5 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50"
                title="استخدم الموقع الحالي"
              >
                {isLoadingCurrent ? (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4 text-blue-600" />
                )}
              </button>
            )}

            {/* Pin Icon/Clear Button - Clear button always visible when address exists */}
            {address && onClear ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="p-1 rounded-md hover:bg-muted transition-colors z-10"
                title="مسح الموقع"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
              </button>
            ) : (
              <MapPin className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          {/* Main clickable area */}
          <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
            className="w-full flex items-center px-4 py-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-right group cursor-pointer relative"
          >
            {/* Text Content - Start from RIGHT with padding to avoid buttons */}
            <div className="flex-1 text-right min-w-0 pr-20">
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
