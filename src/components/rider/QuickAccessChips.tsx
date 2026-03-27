import React from 'react';
import { Heart } from 'lucide-react';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { cn } from '@/lib/utils';

interface QuickAccessChipsProps {
  onSelectLocation: (lat: number, lng: number, address: string) => void;
  className?: string;
}

const ICON_EMOJIS: Record<string, string> = {
  home: '🏠',
  work: '💼',
  cafe: '☕',
  gym: '💪',
  diwaniya: '🏛️',
  carwash: '🚗',
  other: '📍',
};

export default function QuickAccessChips({
  onSelectLocation,
  className = '',
}: QuickAccessChipsProps) {
  const favorites = useFavoritesStore((state) => state.favorites);

  if (favorites.length === 0) {
    return null;
  }

  return (
    // 🟢 شريط تمرير أفقي للمفضلة - متحسّن للتفاعل
    <div className={cn('overflow-x-auto py-2 px-2 pointer-events-auto scrollbar-hide', className)}>
      <div className="flex gap-2 pb-1 flex-nowrap">
        {favorites.map((favorite) => (
          <button
            key={favorite.id}
            onClick={() =>
              onSelectLocation(
                favorite.lat,
                favorite.lng,
                favorite.address
              )
            }
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full whitespace-nowrap bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-300/60 hover:border-green-400 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] pointer-events-auto flex-shrink-0"
          >
            <span className="text-lg flex-shrink-0">
              {ICON_EMOJIS[favorite.icon || 'other']}
            </span>
            <span className="text-sm font-semibold text-green-900 text-right">
              {favorite.name}
            </span>
            <Heart className="w-3.5 h-3.5 text-green-600 fill-green-600 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
