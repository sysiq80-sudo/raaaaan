import React from 'react';
import { Home, Briefcase, Coffee, Dumbbell, Landmark, Car, MapPin, Heart } from 'lucide-react';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface QuickAccessChipsProps {
  onSelectLocation: (lat: number, lng: number, address: string) => void;
  className?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  home: <Home className="w-6 h-6" />,
  work: <Briefcase className="w-6 h-6" />,
  cafe: <Coffee className="w-6 h-6" />,
  gym: <Dumbbell className="w-6 h-6" />,
  diwaniya: <Landmark className="w-6 h-6" />,
  carwash: <Car className="w-6 h-6" />,
  other: <MapPin className="w-6 h-6" />,
};

const ICON_COLORS: Record<string, string> = {
  home: '#5bdda6',
  work: '#5bdda6',
  cafe: '#f59e0b',
  gym: '#ef4444',
  diwaniya: '#a78bfa',
  carwash: '#38bdf8',
  other: '#5bdda6',
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
    <div className={cn('pointer-events-auto', className)}>
      {/* بطاقات المواقع المحفوظة - تصميم بطاقات أنيقة مثل الصورة */}
      <div className="grid grid-cols-2 gap-3 px-1">
        {favorites.slice(0, 4).map((favorite, index) => {
          const iconColor = ICON_COLORS[favorite.icon || 'other'];
          return (
            <motion.button
              key={favorite.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
              onClick={() =>
                onSelectLocation(
                  favorite.lat,
                  favorite.lng,
                  favorite.address
                )
              }
              className={cn(
                "relative flex flex-col items-center gap-2.5 p-4 rounded-2xl",
                "bg-[#0d1830]/80 backdrop-blur-md",
                "border border-[#5bdda6]/15 hover:border-[#5bdda6]/40",
                "shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_24px_rgba(91,221,166,0.15)]",
                "transition-all duration-300 active:scale-[0.97]",
                "group overflow-hidden"
              )}
            >
              {/* توهج خلفي خفيف */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                style={{
                  background: `radial-gradient(circle at center, ${iconColor}08 0%, transparent 70%)`,
                }}
              />

              {/* الأيقونة */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10"
                style={{
                  backgroundColor: `${iconColor}15`,
                  border: `1px solid ${iconColor}30`,
                }}
              >
                <div style={{ color: iconColor }}>
                  {ICON_MAP[favorite.icon || 'other']}
                </div>
              </div>

              {/* الاسم */}
              <span className="text-sm font-bold text-white/90 relative z-10 truncate w-full text-center">
                {favorite.name}
              </span>

              {/* العنوان المختصر */}
              <span className="text-[11px] text-slate-400 relative z-10 truncate w-full text-center leading-tight">
                {favorite.address?.split('،')[0] || ''}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* شريط التمرير الأفقي للبقية إذا كانت أكثر من 4 */}
      {favorites.length > 4 && (
        <div className="overflow-x-auto mt-3 scrollbar-hide">
          <div className="flex gap-2 pb-1 flex-nowrap px-1">
            {favorites.slice(4).map((favorite) => (
              <button
                key={favorite.id}
                onClick={() =>
                  onSelectLocation(
                    favorite.lat,
                    favorite.lng,
                    favorite.address
                  )
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap bg-[#0d1830]/80 border border-[#5bdda6]/15 hover:border-[#5bdda6]/35 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.97] flex-shrink-0"
              >
                <span className="text-lg flex-shrink-0" style={{ color: ICON_COLORS[favorite.icon || 'other'] }}>
                  {ICON_MAP[favorite.icon || 'other']}
                </span>
                <span className="text-sm font-semibold text-white/80">
                  {favorite.name}
                </span>
                <Heart className="w-3.5 h-3.5 text-[#5bdda6] fill-[#5bdda6] flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
