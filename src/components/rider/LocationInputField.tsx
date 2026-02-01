import React, { useState } from 'react';
import { Heart, MapPin, X } from 'lucide-react';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { cn } from '@/lib/utils';
import SaveLocationModal from './SaveLocationModal';

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
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  
  const isFav = lat && lng ? isFavorite(lat, lng) : false;

  // 🟢 Reset heart icon when dragging - return to outline (unfilled)
  // because when user drags, they're setting a NEW location, not using a saved one
  // The heart fills ONLY when they explicitly save this new location

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!address || lat === undefined || lng === undefined) {
      return;
    }

    if (isFav) {
      // حذف من المفضلة
      const favorites = useFavoritesStore.getState().favorites;
      const favorite = favorites.find(
        (fav) => Math.abs(fav.lat - lat) < 0.001 && Math.abs(fav.lng - lng) < 0.001
      );
      if (favorite) {
        removeFavorite(favorite.id);
      }
    } else {
      // عرض Modal لحفظ المكان
      setShowSaveModal(true);
    }
  };

  const handleSaveLocation = (name: string, icon: string) => {
    if (!address || lat === undefined || lng === undefined) return;

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
  };

  return (
    <>
      <div className={cn('space-y-1', className)}>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        <div className="relative">
          <button
            onClick={onClick}
            className="w-full flex items-center gap-2 px-3 py-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-right group"
          >
            {/* 🟢 Heart Button - Fixed FAR LEFT (RTL Priority) - جاهز للمفضلة */}
            {address && lat && lng && (
              <button
                onClick={handleToggleFavorite}
                className="absolute left-3 flex-shrink-0 p-1.5 rounded-md hover:bg-red-50 transition-colors pointer-events-auto"
                title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
              >
                {isFav ? (
                  <Heart className="w-5 h-5 text-green-600 fill-green-600" />
                ) : (
                  <Heart className="w-5 h-5 text-muted-foreground hover:text-green-600 transition-colors" />
                )}
              </button>
            )}

            {/* Text Content - Right Aligned (RTL) */}
            <div className={`flex-1 text-right min-w-0 ${address && lat && lng ? 'pr-6' : ''}`}>
              {address ? (
                <p className="text-sm font-medium truncate">{address}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{placeholder}</p>
              )}
            </div>

            {/* Location Pin Icon + Clear Button Row */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              
              {/* Clear Button */}
              {address && onClear && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 pointer-events-auto"
                  title="مسح الموقع"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </button>

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
