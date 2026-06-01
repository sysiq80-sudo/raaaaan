/**
 * ران - مكونات البحث الديناميكي — الإصدار المحسّن
 * 
 * ✨ DynamicSearchHeader: شريط بحث فاخر مع:
 *   - بحث صوتي (Web Speech API)
 *   - اتجاه إدخال تلقائي (auto-detect RTL/LTR)
 *   - أنيميشنات premium
 *   - فلاتر تصنيف سريعة
 *   - مؤشر أوفلاين
 * 
 * ✨ DynamicSearchResults: نتائج بحث موحدة مع:
 *   - دمج كل المصادر (Google + محلي + محفوظ + أخير)
 *   - شارات (محفوظ ❤️، زرته مؤخراً 🕐)
 *   - أيقونات حسب التصنيف
 *   - Skeleton loading
 *   - Smart Zero-State (اقتراحات ذكية + أماكن محفوظة + أقرب معالم)
 *   - فلاتر التصنيفات السريعة
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Loader2, AlertCircle, ChevronRight, Clock, X, Heart,
  Navigation, Mic, MicOff, WifiOff, Search,
  Utensils, Hospital, ShoppingBag, GraduationCap, Fuel, Landmark,
  Home, Briefcase, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecentSearch } from '@/hooks/useRecentSearches';
import type { UnifiedSearchResult, SmartSuggestion } from '@/hooks/useUnifiedSearch';

// ─── أنواع ───

interface DynamicSearchResult {
  place_id: string;
  main_text: string;
  secondary_text?: string;
  description: string;
  distance_text?: string;
}

// فلاتر التصنيفات
export interface CategoryFilter {
  id: string;
  label: string;
  icon: React.ReactNode;
  keyword: string;
}

export const SEARCH_CATEGORIES: CategoryFilter[] = [
  { id: 'government', label: 'دوائر حكومية', icon: <Landmark className="w-3.5 h-3.5" />, keyword: 'دائرة' },
  { id: 'restaurant', label: 'مطاعم', icon: <Utensils className="w-3.5 h-3.5" />, keyword: 'مطعم' },
  { id: 'hospital', label: 'مستشفيات', icon: <Hospital className="w-3.5 h-3.5" />, keyword: 'مستشفى' },
  { id: 'university', label: 'جامعات', icon: <GraduationCap className="w-3.5 h-3.5" />, keyword: 'جامعة' },
  { id: 'gas_station', label: 'محطات وقود', icon: <Fuel className="w-3.5 h-3.5" />, keyword: 'محطة وقود' },
  { id: 'mall', label: 'مولات', icon: <ShoppingBag className="w-3.5 h-3.5" />, keyword: 'مول' },
];

// ─── مساعدات الأيقونات ───

const getCategoryIcon = (iconType?: string): React.ReactNode => {
  switch (iconType) {
    case 'restaurant': return <Utensils className="w-4 h-4" />;
    case 'hospital': return <Hospital className="w-4 h-4" />;
    case 'university': case 'education': return <GraduationCap className="w-4 h-4" />;
    case 'gas_station': case 'fuel': return <Fuel className="w-4 h-4" />;
    case 'mall': case 'shopping': return <ShoppingBag className="w-4 h-4" />;
    case 'government': return <Landmark className="w-4 h-4" />;
    case 'home': return <Home className="w-4 h-4" />;
    case 'briefcase': case 'work': return <Briefcase className="w-4 h-4" />;
    case 'heart': return <Heart className="w-4 h-4" />;
    case 'star': return <Star className="w-4 h-4" />;
    case 'clock': return <Clock className="w-4 h-4" />;
    default: return <MapPin className="w-4 h-4 text-[#5bdda6] drop-shadow-[0_0_6px_rgba(91,221,166,0.8)] filter" />;
  }
};

const getCategoryColor = (iconType?: string): string => {
  switch (iconType) {
    case 'restaurant': return 'text-orange-500 bg-orange-500/10';
    case 'hospital': return 'text-red-500 bg-red-500/10';
    case 'university': case 'education': return 'text-blue-500 bg-blue-500/10';
    case 'gas_station': case 'fuel': return 'text-emerald-500 bg-emerald-500/10';
    case 'mall': case 'shopping': return 'text-purple-500 bg-purple-500/10';
    case 'government': return 'text-slate-400 bg-slate-500/10';
    case 'home': return 'text-sky-500 bg-sky-500/10';
    case 'briefcase': case 'work': return 'text-amber-500 bg-amber-500/10';
    case 'heart': return 'text-pink-500 bg-pink-500/10';
    case 'star': return 'text-yellow-500 bg-yellow-500/10';
    case 'clock': return 'text-muted-foreground bg-muted';
    default: return 'text-ring bg-ring/10';
  }
};



const getPlaceSideLabel = (text?: string): string | undefined => {
  if (!text) return undefined;
  const firstPart = text.split('،')[0]?.split(',')[0]?.trim();
  return firstPart || undefined;
};

// ─── Skeleton Loading ───

const ResultSkeleton: React.FC = () => (
  <div className="p-3 flex items-center gap-3 animate-pulse">
    <div className="w-8 h-8 rounded-lg bg-muted/50" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3.5 bg-muted/50 rounded w-3/4" />
      <div className="h-2.5 bg-muted/30 rounded w-1/2" />
    </div>
    <div className="h-3 bg-muted/30 rounded w-10" />
  </div>
);

// ═══════════════════════════════════════════════════════
// DynamicSearchResults — نتائج البحث الموحدة
// ═══════════════════════════════════════════════════════

interface DynamicSearchResultsProps {
  query: string;
  results: DynamicSearchResult[];
  unifiedResults?: UnifiedSearchResult[];
  recentSearches?: RecentSearch[];
  smartSuggestions?: SmartSuggestion[];
  nearbyLandmarks?: UnifiedSearchResult[];
  savedPlaces?: Array<{ id: string; name: string; address: string; lat: number; lng: number; icon: string; label: string }>;
  isSearching: boolean;
  isLoadingDetails: boolean;
  isOffline?: boolean;
  onSelect: (placeId: string, mainText: string) => void;
  onSelectUnified?: (result: UnifiedSearchResult) => void;
  onSelectRecent?: (search: RecentSearch) => void;
  onSelectSmart?: (suggestion: SmartSuggestion) => void;
  onSelectSavedPlace?: (place: { name: string; address: string; lat: number; lng: number }) => void;
  onRemoveRecent?: (id: string) => void;
  onClearRecent?: () => void;
  onClear?: () => void;
  onClose?: () => void;
  onCategorySelect?: (category: CategoryFilter) => void;
  activeCategory?: string | null;
  className?: string;
  maxResults?: number;
  maxRecentResults?: number;
  isOpen?: boolean;
  onToggleFavorite?: (result: UnifiedSearchResult) => void;
}

export const DynamicSearchResults: React.FC<DynamicSearchResultsProps> = ({
  query,
  results,
  unifiedResults,
  recentSearches = [],
  smartSuggestions = [],
  nearbyLandmarks = [],
  savedPlaces = [],
  isSearching,
  isLoadingDetails,
  isOffline = false,
  onSelect,
  onSelectUnified,
  onSelectRecent,
  onSelectSmart,
  onSelectSavedPlace,
  onRemoveRecent,
  onClearRecent,
  onClear,
  onClose,
  onCategorySelect,
  activeCategory,
  className,
  maxResults = 6,
  maxRecentResults = 3,
  isOpen = true,
  onToggleFavorite,
}) => {
  const showRecent = !query && recentSearches && recentSearches.length > 0;
  const showZeroState = !query;
  
  // النتائج النهائية المعروضة
  const displayResults = useMemo(() => {
    if (unifiedResults && unifiedResults.length > 0) {
      return unifiedResults.slice(0, maxResults);
    }
    return results.slice(0, maxResults);
  }, [unifiedResults, results, maxResults]);
  
  const totalResults = unifiedResults?.length || results.length;
  const hasMore = totalResults > maxResults;

  const isItemSaved = (item: UnifiedSearchResult) => {
    return savedPlaces.some(
      (place) =>
        (item.place_id && place.id === item.place_id) ||
        (item.lat && item.lng && Math.abs(place.lat - item.lat) < 0.0001 && Math.abs(place.lng - item.lng) < 0.0001) ||
        place.address === item.description ||
        place.name === item.main_text
    );
  };

  if (!isOpen) return null;
  if (!showZeroState && !query) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "relative left-0 right-0 mt-2 z-[100]",
          "bg-card border border-border/30 rounded-2xl shadow-xl",
          "max-h-[78vh] overflow-y-auto scrollbar-thin",
          className
        )}
        dir="rtl"
      >
        {/* ─── مؤشر أوفلاين ─── */}
        {isOffline && (
          <div className="px-3 py-2 flex items-center gap-2 border-b border-border/30 bg-amber-500/10">
            <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-600/80 dark:text-amber-400/80">بحث محلي فقط — لا يوجد اتصال</span>
          </div>
        )}

        {/* ─── فلاتر التصنيفات ─── */}
        {onCategorySelect && (
          <div className="px-3 py-2 border-b border-border/35">
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
              {SEARCH_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategorySelect(cat)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0",
                    activeCategory === cat.id
                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400 dark:bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary/90 hover:text-foreground border border-border/20"
                  )}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showZeroState && !query ? (
          // ═══ Zero-State: اقتراحات ذكية + محفوظ + أخير + معالم ═══
          <div>


            {/* الأماكن المحفوظة */}
            {savedPlaces.length > 0 && (
              <div className="border-b border-border/20">
                <div className="px-3 py-2 flex items-center justify-center gap-2 bg-[#5bdda6]/10 mt-1">
                  <Heart className="w-4.5 h-4.5 text-pink-500" />
                  <span className="text-[13px] font-extrabold text-foreground uppercase tracking-wider">الأماكن المحفوظة</span>
                </div>
                <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-none" dir="ltr">
                  {savedPlaces.map((place) => (
                    <motion.button
                      key={place.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onSelectSavedPlace?.(place)}
                      className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors min-w-[72px] shrink-0"
                    >
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center",
                        getCategoryColor(place.icon || 'heart')
                      )}>
                        {getCategoryIcon(place.icon || 'heart')}
                      </div>
                      <span className="text-[10px] font-semibold text-foreground truncate max-w-[64px]">
                        {place.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* البحوثات السابقة */}
            {showRecent && (
              <div className="border-b border-border/20">
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4.5 h-4.5 text-muted-foreground" />
                    <span className="text-[13px] font-extrabold text-foreground uppercase tracking-wider">بحث سابق</span>
                  </div>
                  {onClearRecent && (
                    <button
                      onClick={onClearRecent}
                      className="p-1 rounded-md bg-[#5bdda6] text-[#0b1326] shadow-[0_0_12px_rgba(91,221,166,0.5)] border border-[#5bdda6]/30 hover:bg-[#4ecf99] active:scale-95 transition-all"
                      aria-label="مسح البحوثات السابقة"
                      title="مسح البحوثات السابقة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {recentSearches.slice(0, maxRecentResults).map((search, index) => (
                  <motion.div
                    key={search.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors flex items-center gap-3 group"
                  >
                    {/* أيقونة الساعة */}
                    <div
                      className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0 cursor-pointer"
                      onClick={() => onSelectRecent?.(search)}
                    >
                      <Clock className="w-4 h-4 text-muted-foreground/60" />
                    </div>

                    {/* النص */}
                    <div
                      className="flex-1 min-w-0 text-right cursor-pointer"
                      onClick={() => onSelectRecent?.(search)}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{search.mainText}</p>
                      {search.secondaryText && (
                        <p className="text-[11px] text-muted-foreground truncate">{search.secondaryText}</p>
                      )}
                    </div>

                    {/* ── الأزرار: مفضلة + حذف ── */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* زر المفضلة */}
                      {onToggleFavorite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const asFav: UnifiedSearchResult = {
                              id: search.id,
                              source: 'recent',
                              place_id: search.id,
                              main_text: search.mainText,
                              secondary_text: search.secondaryText,
                              description: search.secondaryText || search.address || '',
                              lat: search.lat,
                              lng: search.lng,
                              score: 0,
                            };
                            onToggleFavorite(asFav);
                          }}
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200",
                            savedPlaces.some(p => p.name === search.mainText || (search.lat && search.lng && Math.abs(p.lat - (search.lat || 0)) < 0.0001 && Math.abs(p.lng - (search.lng || 0)) < 0.0001))
                              ? "bg-pink-500/15 text-pink-500"
                              : "text-muted-foreground/40 hover:bg-pink-500/10 hover:text-pink-500"
                          )}
                          aria-label="إضافة للمفضلة"
                          title="إضافة للمفضلة"
                        >
                          <Heart className={cn("w-3.5 h-3.5",
                            savedPlaces.some(p => p.name === search.mainText) ? "fill-pink-500" : ""
                          )} />
                        </button>
                      )}
                      {/* زر الحذف */}
                      {onRemoveRecent && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveRecent(search.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:bg-destructive/15 hover:text-destructive transition-all"
                          aria-label="حذف"
                          title="حذف من البحوثات السابقة"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* أقرب المعالم */}
            {nearbyLandmarks.length > 0 && (
              <div>
                <div className="px-3 py-2 flex items-center justify-center gap-2 bg-[#5bdda6]/10 mt-1">
                  <MapPin className="w-4.5 h-4.5 text-[#5bdda6] drop-shadow-[0_0_8px_rgba(91,221,166,0.9)] filter" />
                  <span className="text-[13px] font-extrabold text-foreground uppercase tracking-wider">أماكن قريبة</span>
                </div>
                {nearbyLandmarks.slice(0, 3).map((lm, index) => (
                  <motion.button
                    key={lm.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    onClick={() => onSelectUnified?.(lm)}
                    className="w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors flex items-center gap-3"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite?.(lm);
                      }}
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 group/fav cursor-pointer",
                        isItemSaved(lm)
                          ? "bg-pink-500/10 border-pink-500/30 text-pink-500"
                          : "bg-secondary/80 border-border/10 text-muted-foreground hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-500"
                      )}
                      title={isItemSaved(lm) ? "حذف من المفضلة" : "إضافة للمفضلة"}
                    >
                      <Heart className={cn("w-4 h-4 transition-all duration-200", 
                        isItemSaved(lm) ? "fill-pink-500 scale-110" : "scale-100 group-hover/fav:scale-110"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-medium text-foreground truncate">{lm.main_text}</p>
                      {lm.secondary_text && (
                        <p className="text-[11px] text-muted-foreground truncate">{lm.secondary_text}</p>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

        ) : query ? (
          // ═══ نتائج البحث ═══
          <>
            {isSearching && displayResults.length === 0 ? (
              // Skeleton loading
              <div>
                <ResultSkeleton />
                <ResultSkeleton />
                <ResultSkeleton />
              </div>
            ) : displayResults.length === 0 && !isSearching ? (
              // لا توجد نتائج
              <div className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-muted-foreground/50" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-bold text-foreground">لا توجد نتائج</p>
                  <p className="text-xs text-muted-foreground">جرّب البحث بكلمات مختلفة</p>
                </div>
              </div>
            ) : (
              // قائمة النتائج
              <div>
                {/* مؤشر البحث الجاري (أعلى النتائج المخزنة) */}
                {isSearching && displayResults.length > 0 && (
                  <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border/20">
                    <Loader2 className="w-3 h-3 animate-spin text-ring/70" />
                    <span className="text-[10px] text-ring/50">جاري التحديث...</span>
                  </div>
                )}

                {displayResults.map((result, index) => {
                  // هل هي نتيجة موحدة؟
                  const unified = unifiedResults?.[index];
                  const iconType = unified?.icon_type;
                  const badge = unified?.badge;
                  const source = unified?.source;
                  const placeName = unified?.main_text || (result as any).main_text;
                  const placeSubtitle = unified?.secondary_text || (result as any).secondary_text;
                  const placeSideLabel = getPlaceSideLabel(
                    unified?.secondary_text ||
                    (result as any).secondary_text ||
                    unified?.description ||
                    (result as any).description
                  );

                  return (
                    <motion.button
                      key={unified?.id || (result as any).place_id || index}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => {
                        if (unified && onSelectUnified) {
                          onSelectUnified(unified);
                        } else {
                          onSelect((result as any).place_id || unified?.place_id || '', (result as any).main_text || unified?.main_text || '');
                        }
                      }}
                      disabled={isLoadingDetails}
                      className="w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50 flex items-center gap-3 group relative"
                    >
                      {/* زر الحفظ للمفضلة بدلاً من الأيقونة */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          const itemForFav: UnifiedSearchResult = unified || {
                            id: (result as any).place_id || index.toString(),
                            source: 'google',
                            place_id: (result as any).place_id,
                            main_text: (result as any).main_text,
                            secondary_text: (result as any).secondary_text,
                            description: (result as any).description || '',
                            score: 0,
                          };
                          onToggleFavorite?.(itemForFav);
                        }}
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 group/fav cursor-pointer",
                          isItemSaved(unified || {
                            id: (result as any).place_id || index.toString(),
                            source: 'google',
                            place_id: (result as any).place_id,
                            main_text: (result as any).main_text,
                            secondary_text: (result as any).secondary_text,
                            description: (result as any).description || '',
                            score: 0,
                          })
                            ? "bg-pink-500/10 border-pink-500/30 text-pink-500"
                            : "bg-secondary/80 border-border/10 text-muted-foreground hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-500"
                        )}
                        title={unified && isItemSaved(unified) ? "حذف من المفضلة" : "إضافة للمفضلة"}
                      >
                        <Heart className={cn("w-4 h-4 transition-all duration-200", 
                          isItemSaved(unified || {
                            id: (result as any).place_id || index.toString(),
                            source: 'google',
                            place_id: (result as any).place_id,
                            main_text: (result as any).main_text,
                            secondary_text: (result as any).secondary_text,
                            description: (result as any).description || '',
                            score: 0,
                          }) ? "fill-pink-500 scale-110" : "scale-100 group-hover/fav:scale-110"
                        )} />
                      </div>

                      {/* النص */}
                      <div className="flex-1 min-w-0 text-right">
                        <p className="font-bold text-sm text-foreground truncate">{placeName}</p>

                        {(badge === 'saved' || badge === 'recent' || source === 'landmark') && (
                          <div className="mt-1 flex items-center gap-1.5 justify-end">
                            {/* شارات */}
                            {badge === 'saved' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-pink-500/10 text-[9px] font-bold text-pink-500">محفوظ</span>
                            )}
                            {badge === 'recent' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-secondary text-[9px] font-bold text-muted-foreground">سابق</span>
                            )}
                            {source === 'landmark' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-ring/10 text-[9px] font-bold text-ring">محلي</span>
                            )}
                          </div>
                        )}

                        {placeSubtitle && !placeName?.includes(placeSideLabel || '') && (
                          <p className="text-[11px] text-muted-foreground truncate">{placeSubtitle}</p>
                        )}
                      </div>


                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-ring/60 transition-colors shrink-0" />

                      {isLoadingDetails && (
                        <div className="absolute inset-0 bg-card/75 rounded-lg flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-ring" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}

                {hasMore && (
                  <div className="p-2.5 text-center border-t border-border/20">
                    <p className="text-[10px] text-muted-foreground/40">
                      و {totalResults - maxResults} نتائج أخرى
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════
// DynamicSearchHeader — شريط البحث الفاخر المحسّن
// ═══════════════════════════════════════════════════════

export const DynamicSearchHeader: React.FC<{
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  isSearching: boolean;
  isOffline?: boolean;
  placeholder?: string;
  onFocus?: () => void;
  onCurrentLocation?: () => void;
  onSaveLocation?: () => void;
  isFavorite?: boolean;
  showAddress?: string;
  onClearAddress?: () => void;
  onShowSavedPlaces?: () => void;
  // ─── بحث صوتي ───
  voiceSupported?: boolean;
  voiceState?: 'idle' | 'listening' | 'processing' | 'error';
  onVoiceToggle?: () => void;
  voiceTranscript?: string;
  headerLabel?: React.ReactNode;
  onAddressClick?: () => void;
}> = ({
  query,
  onQueryChange,
  onClear,
  isSearching,
  isOffline = false,
  placeholder = "ابحث عن موقع...",
  onFocus,
  onCurrentLocation,
  onSaveLocation,
  isFavorite = false,
  showAddress,
  onClearAddress,
  voiceSupported = false,
  voiceState = 'idle',
  onVoiceToggle,
  voiceTranscript,
  headerLabel,
  onAddressClick,
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const isListening = voiceState === 'listening';

  return (
    <div className="relative" dir="rtl">
      {/* ─── حاوية الشريط الرئيسية — Premium Search Bar ─── */}
      <div
        className={cn(
          "relative flex flex-col gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300",
          "bg-white dark:bg-card",
          isListening
            ? "shadow-[0_0_20px_rgba(239,68,68,0.2),0_8px_32px_rgba(0,0,0,0.6)] border border-destructive/40"
            : isFocused || isSearching
              ? "shadow-[0_0_20px_hsl(var(--ring)/0.15),0_8px_32px_rgba(0,0,0,0.6)] border border-ring/30"
              : "shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-border/30 hover:border-border/50"
        )}
      >
        {/* السطر صفر: علامة الانطلاق/الوجهة منفصلة فوق الجميع */}
        {headerLabel && (
          <div className="w-full flex justify-center mb-1">
            {headerLabel}
          </div>
        )}

        {/* سطر البحث الرئيسي: يدمج الأيقونة والمدخلات وزر المسح في صف واحد متناسق */}
        <div className="flex items-center gap-3 w-full">
          {/* ── أيقونة البحث / حذف العنوان / أوفلاين ── */}
          {isOffline ? (
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-inner">
              <WifiOff className="w-4.5 h-4.5 text-amber-500 drop-shadow-sm" />
            </div>
          ) : (
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
              isListening
                ? "bg-destructive/10 border-destructive/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                : "bg-emerald-950/80 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
            )}>
              {isSearching ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-5 h-5 text-emerald-400" />
                </motion.div>
              ) : isListening ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Mic className="w-5 h-5 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                </motion.div>
              ) : (
                <Search className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              )}
            </div>
          )}

          {/* ── حقل النص / عرض العنوان ── */}
          <div className="flex-1 relative min-w-0 py-1.5" dir="rtl">
            {/* عرض النص الصوتي الحي */}
            {isListening && voiceTranscript && (
              <div className="pointer-events-none">
                <p className="text-[10px] text-destructive/70 font-semibold tracking-wide leading-tight mb-0.5">جاري الاستماع...</p>
                <p className="text-[14px] text-foreground font-bold truncate leading-tight">{voiceTranscript}</p>
              </div>
            )}

            {/* عرض العنوان المحدد — يختفي عند التركيز */}
            {!isListening && showAddress && !query && !isFocused && (
              <motion.div 
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onAddressClick}
                className={`flex flex-col justify-center h-full ${onAddressClick ? 'pointer-events-auto cursor-pointer active:scale-95 transition-transform' : 'pointer-events-none'}`}
              >
                <p className="text-[15px] font-bold truncate leading-tight pr-1" style={{ color: '#000000' }}>{showAddress}</p>
              </motion.div>
            )}

            {/* Placeholder الافتراضي — يختفي عند التركيز */}
            {!isListening && !query && !showAddress && !isFocused && (
              <div className="pointer-events-none">
                <p className="text-[15px] text-muted-foreground/60 font-bold leading-tight py-1">
                  {placeholder || "إلى أين؟"}
                </p>
              </div>
            )}

            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => {
                setIsFocused(true);
                onFocus?.();
              }}
              onBlur={() => setIsFocused(false)}
              placeholder={isFocused ? placeholder : ''}
              className={cn(
                "w-full bg-transparent text-[15px] font-bold",
                "placeholder:text-gray-400",
                "focus:outline-none caret-emerald-500",
                (query || isFocused) && !isListening ? "relative opacity-100 py-1" : "absolute inset-0 opacity-0 py-1 z-10 cursor-text"
              )}
              style={{ color: '#000000', direction: 'rtl', textAlign: 'right', unicodeBidi: 'plaintext' }}
            />
          </div>

          {/* ── زر مسح النص البحثي (Clear) ── */}
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                whileTap={{ scale: 0.85 }}
                onClick={onClear}
                className="w-8 h-8 rounded-lg bg-secondary/80 border border-border/30 hover:bg-secondary flex items-center justify-center transition-all shrink-0 group"
                aria-label="مسح البحث"
              >
                <X className="w-4.5 h-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── خط توهج سفلي ─── */}
      <AnimatePresence>
        {(isSearching || isFocused || isListening) && (
          <motion.div
            className={cn(
              "absolute -bottom-px left-6 right-6 h-[2px] rounded-full",
              isListening
                ? "bg-gradient-to-r from-transparent via-destructive/50 to-transparent"
                : "bg-gradient-to-r from-transparent via-ring/50 to-transparent"
            )}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};


