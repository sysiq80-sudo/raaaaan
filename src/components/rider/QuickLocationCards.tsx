import React from 'react';
import { Home, Briefcase } from 'lucide-react';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { motion } from 'framer-motion';

interface QuickLocationCardsProps {
  onSelectLocation: (lat: number, lng: number, address: string) => void;
}

/**
 * بطاقتا المنزل والعمل — تظهر فوق حقل البحث في شاشة اختيار الانطلاق
 * تعتمد على المواقع المحفوظة في useFavoritesStore (icon: 'home' | 'work')
 */
export default function QuickLocationCards({
  onSelectLocation,
}: QuickLocationCardsProps) {
  const favorites = useFavoritesStore((state) => state.favorites);

  const homePlace = favorites.find((f) => f.icon === 'home');
  const workPlace = favorites.find((f) => f.icon === 'work');

  // لا شيء يُعرض إذا لم يحفظ المستخدم منزل أو عمل
  if (!homePlace && !workPlace) return null;

  const cards = [
    homePlace
      ? { key: 'home', place: homePlace, icon: <Home className="w-6 h-6" />, label: 'المنزل', color: '#5bdda6' }
      : null,
    workPlace
      ? { key: 'work', place: workPlace, icon: <Briefcase className="w-6 h-6" />, label: 'العمل', color: '#5bdda6' }
      : null,
  ].filter(Boolean) as {
    key: string;
    place: typeof homePlace;
    icon: React.ReactNode;
    label: string;
    color: string;
  }[];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card, index) => (
        <motion.button
          key={card.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
          onClick={() =>
            onSelectLocation(
              card.place!.lat,
              card.place!.lng,
              card.place!.address
            )
          }
          className="relative flex flex-col items-center gap-2 py-4 px-3 rounded-2xl
            bg-[#0d1830]/80 backdrop-blur-md
            border border-[#5bdda6]/15 hover:border-[#5bdda6]/40
            shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_24px_rgba(91,221,166,0.15)]
            transition-all duration-300 active:scale-[0.97]
            group overflow-hidden"
        >

          {/* الأيقونة */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10"
            style={{
              backgroundColor: `${card.color}15`,
              border: `1px solid ${card.color}30`,
            }}
          >
            <div style={{ color: card.color }}>{card.icon}</div>
          </div>

          {/* الاسم */}
          <span className="text-sm font-bold text-white/90 relative z-10">
            {card.label}
          </span>

          {/* العنوان المختصر */}
          <span className="text-[11px] text-slate-400 relative z-10 truncate w-full text-center leading-tight">
            {card.place!.address?.split('،')[0] || ''}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
