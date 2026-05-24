import { Bookmark, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface SavedPlaceChip {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
  label: string;
}

interface SavedPlacesStripProps {
  open: boolean;
  loading: boolean;
  places: SavedPlaceChip[];
  onSelect: (place: SavedPlaceChip) => void;
}

const ICON_MAP: Record<string, string> = {
  "🏠": "🏠",
  "💼": "💼",
  "⭐": "⭐",
  "❤️": "❤️",
  "🎓": "🎓",
  "💪": "💪",
  "🍽️": "🍽️",
  "🏥": "🏥",
  "🛍️": "🛍️",
  "🏢": "🏢",
  "📍": "📍",
  home: "🏠",
  work: "💼",
  cafe: "☕",
  gym: "🏋️",
  diwaniya: "🏛️",
  carwash: "🚗",
  other: "📍",
  favorite: "⭐",
  loved: "❤️",
  school: "🎓",
  restaurant: "🍽️",
  hospital: "🏥",
  shopping: "🛍️",
  office: "🏢",
};

const getDisplayIcon = (place: SavedPlaceChip) => (
  ICON_MAP[place.icon ?? ""] || ICON_MAP[place.label ?? ""] || "📍"
);

const SavedPlacesStrip = ({ open, loading, places, onSelect }: SavedPlacesStripProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="rounded-[20px] border border-white/10 bg-white/[0.025] overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#5bdda6]" />
            <span className="text-xs text-slate-400">جاري التحميل...</span>
          </div>
        ) : places.length === 0 ? (
          <div className="flex items-center justify-center py-4 gap-2">
            <Bookmark className="w-4 h-4 text-[#5bdda6]/30" />
            <span className="text-xs text-slate-500">لا توجد أماكن محفوظة</span>
          </div>
        ) : (
          <div
            className="flex gap-2.5 overflow-x-auto px-4 py-3 scrollbar-none"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            {places.map((place) => (
              <motion.button
                key={place.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => onSelect(place)}
                className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#151f30] border border-slate-700/50 hover:border-[#5bdda6]/30 hover:bg-[#5bdda6]/5 active:bg-[#5bdda6]/15 transition-all"
              >
                <span className="text-lg leading-none">{getDisplayIcon(place)}</span>
                <div className="text-right min-w-0 max-w-[120px]">
                  <p className="text-[13px] font-bold text-slate-200 truncate leading-tight">{place.name}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    )}
  </AnimatePresence>
);

export default SavedPlacesStrip;
