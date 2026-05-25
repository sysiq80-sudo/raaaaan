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
  Home, Briefcase, Star, Sparkles,
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
  { id: 'restaurant', label: 'مطاعم', icon: <Utensils className="w-3.5 h-3.5" />, keyword: 'مطعم' },
  { id: 'hospital', label: 'مستشفيات', icon: <Hospital className="w-3.5 h-3.5" />, keyword: 'مستشفى' },
  { id: 'university', label: 'جامعات', icon: <GraduationCap className="w-3.5 h-3.5" />, keyword: 'جامعة' },
  { id: 'gas_station', label: 'محطات وقود', icon: <Fuel className="w-3.5 h-3.5" />, keyword: 'محطة وقود' },
  { id: 'mall', label: 'مولات', icon: <ShoppingBag className="w-3.5 h-3.5" />, keyword: 'مول' },
  { id: 'government', label: 'دوائر حكومية', icon: <Landmark className="w-3.5 h-3.5" />, keyword: 'دائرة' },
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
    default: return <MapPin className="w-4 h-4" />;
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

const getSmartSuggestionIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'home': return <Home className="w-4 h-4" />;
    case 'work': return <Briefcase className="w-4 h-4" />;
    case 'lunch': return <Utensils className="w-4 h-4" />;
    case 'shopping': return <ShoppingBag className="w-4 h-4" />;
    default: return <Sparkles className="w-4 h-4" />;
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
  onClear?: () => void;
  onClose?: () => void;
  onCategorySelect?: (category: CategoryFilter) => void;
  activeCategory?: string | null;
  className?: string;
  maxResults?: number;
  maxRecentResults?: number;
  isOpen?: boolean;
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
  onClear,
  onClose,
  onCategorySelect,
  activeCategory,
  className,
  maxResults = 6,
  maxRecentResults = 3,
  isOpen = true,
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
          "max-h-[60vh] overflow-y-auto scrollbar-thin",
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
          <div className="px-3 py-2 border-b border-border/30">
            <div className="flex flex-row-reverse gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {SEARCH_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategorySelect(cat)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                    activeCategory === cat.id
                      ? "bg-ring/20 text-ring border border-ring/30"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground border border-transparent"
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
            {/* اقتراحات ذكية */}
            {smartSuggestions.length > 0 && (
              <div className="border-b border-border/20">
                <div className="px-3 py-2 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-ring/70" />
                  <span className="text-[10px] font-bold text-ring/60 uppercase tracking-wider">اقتراحات لك</span>
                </div>
                {smartSuggestions.slice(0, 2).map((suggestion, index) => (
                  <motion.button
                    key={suggestion.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelectSmart?.(suggestion)}
                    className="w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors flex items-center gap-3"
                  >
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      suggestion.type === 'home' ? 'bg-sky-500/10 text-sky-400' :
                      suggestion.type === 'work' ? 'bg-amber-500/10 text-amber-400' :
                      suggestion.type === 'lunch' ? 'bg-orange-500/10 text-orange-400' :
                      'bg-purple-500/10 text-purple-400'
                    )}>
                      {getSmartSuggestionIcon(suggestion.type)}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-bold text-foreground truncate">{suggestion.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{suggestion.subtitle || suggestion.reason}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                  </motion.button>
                ))}
              </div>
            )}

            {/* الأماكن المحفوظة */}
            {savedPlaces.length > 0 && (
              <div className="border-b border-border/20">
                <div className="px-3 py-2 flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-pink-500/70" />
                  <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">الأماكن المحفوظة</span>
                </div>
                <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto scrollbar-none">
                  {savedPlaces.slice(0, 4).map((place) => (
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
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">بحث سابق</span>
                  </div>
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="p-1 rounded-md hover:bg-secondary transition-colors"
                      aria-label="إغلاق"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-foreground" />
                    </button>
                  )}
                </div>
                {recentSearches.slice(0, maxRecentResults).map((search, index) => (
                  <div key={search.id} className="relative group">
                    <motion.button
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => onSelectRecent?.(search)}
                      className="w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-muted-foreground/60" />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium text-foreground truncate">{search.mainText}</p>
                        {search.secondaryText && (
                          <p className="text-[11px] text-muted-foreground truncate">{search.secondaryText}</p>
                        )}
                      </div>
                      <div className="w-7 shrink-0" />
                    </motion.button>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onRemoveRecent?.(search.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') onRemoveRecent?.(search.id); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-10"
                      aria-label="حذف"
                    >
                      <X className="w-3 h-3 text-destructive/80" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* أقرب المعالم */}
            {nearbyLandmarks.length > 0 && (
              <div>
                <div className="px-3 py-2 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">أماكن قريبة</span>
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
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      getCategoryColor(lm.icon_type)
                    )}>
                      {getCategoryIcon(lm.icon_type)}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-medium text-foreground truncate">{lm.main_text}</p>
                      {lm.secondary_text && (
                        <p className="text-[11px] text-muted-foreground truncate">{lm.secondary_text}</p>
                      )}
                    </div>
                    {getPlaceSideLabel(lm.secondary_text || lm.description) && (
                      <span className="text-[10px] text-ring/80 whitespace-nowrap shrink-0 max-w-[96px] truncate">
                        {getPlaceSideLabel(lm.secondary_text || lm.description)}
                      </span>
                    )}
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
                      {/* أيقونة حسب التصنيف */}
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                        getCategoryColor(iconType)
                      )}>
                        {getCategoryIcon(iconType)}
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

                        {placeSubtitle && (
                          <p className="text-[11px] text-muted-foreground truncate">{placeSubtitle}</p>
                        )}
                      </div>

                      {/* اسم المكان المختصر (بدل المسافة) */}
                      {placeSideLabel && (
                        <span className="text-[10px] text-ring/80 whitespace-nowrap shrink-0 max-w-[110px] truncate">
                          {placeSideLabel}
                        </span>
                      )}

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
          "bg-gradient-to-l from-card to-card/85",
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

        {/* السطر الأول الداخلي: أيقونات الإجراءات السريعة */}
        <div className="flex items-center justify-end w-full">
          {/* ── أيقونات الإجراءات ── */}
          <div className="flex items-center gap-2.5 shrink-0 pl-1">
            {/* مسح نص البحث */}
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={onClear}
                  className="w-12 h-12 rounded-xl bg-secondary/80 border border-border/30 hover:bg-secondary flex items-center justify-center transition-all group"
                  aria-label="مسح البحث"
                >
                  <X className="w-5.5 h-5.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* ❤️ حفظ المفضلة */}
            {onSaveLocation && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onSaveLocation}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all border shadow-[0_0_15px_rgba(244,63,94,0.15)]",
                  isFavorite
                    ? "bg-pink-500/20 hover:bg-pink-500/30 border-pink-500/50 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                    : "bg-secondary hover:bg-secondary/80 border-border/30"
                )}
                title={isFavorite ? 'إزالة من المفضلة' : 'حفظ الموقع'}
                aria-label={isFavorite ? 'إزالة من المفضلة' : 'حفظ الموقع'}
              >
                <Heart
                  className={cn(
                    'w-5.5 h-5.5 transition-all drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]',
                    isFavorite
                      ? 'text-pink-500 fill-pink-500'
                      : 'text-muted-foreground'
                  )}
                />
              </motion.button>
            )}

            {/* 📍 موقعي الحالي */}
            {onCurrentLocation && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onCurrentLocation}
                className="w-12 h-12 rounded-xl bg-ring/10 border border-ring/30 hover:bg-ring/25 flex items-center justify-center transition-all group shadow-[0_0_15px_hsl(var(--ring)/0.15)]"
                title="موقعي الحالي"
                aria-label="تحديد موقعي الحالي"
              >
                <Navigation className="w-5.5 h-5.5 text-ring drop-shadow-[0_0_8px_hsl(var(--ring)/0.5)] group-hover:scale-110 transition-transform" />
              </motion.button>
            )}
          </div>
        </div>

        {/* السطر السفلي: أيقونة البحث / أوفلاين + حقل النص */}
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300 w-full",
          showAddress && !query && !isFocused
            ? "bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 rounded-xl px-3 py-2 shadow-[0_2px_10px_rgba(16,185,129,0.08)]"
            : ""
        )}>
          {/* ── أيقونة البحث / حذف العنوان / أوفلاين ── */}
          {isOffline ? (
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-inner">
              <WifiOff className="w-4.5 h-4.5 text-amber-500 drop-shadow-sm" />
            </div>
          ) : !query && showAddress && onClearAddress ? (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              whileTap={{ scale: 0.85 }}
              onClick={onClearAddress}
              className="w-10 h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground border border-destructive/20 flex items-center justify-center transition-all shrink-0 shadow-md group"
              aria-label="حذف الموقع"
              title="حذف الموقع المحدد"
            >
              <X className="w-4.5 h-4.5 drop-shadow-md group-hover:scale-110 transition-transform" />
            </motion.button>
          ) : (
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner transition-colors",
              isListening ? "bg-destructive/10 border-destructive/20" : "bg-ring/5 border-ring/15"
            )}>
              {isSearching ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-5 h-5 text-ring" />
                </motion.div>
              ) : isListening ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Mic className="w-5 h-5 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                </motion.div>
              ) : (
                <Search className="w-5 h-5 text-ring/70 drop-shadow-[0_0_8px_hsl(var(--ring)/0.2)]" />
              )}
            </div>
          )}

          {/* ── حقل النص / عرض العنوان ── */}
          <div className="flex-1 relative min-w-0 py-1" dir="rtl">
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
                <p className="text-[15px] text-foreground font-bold truncate leading-tight pr-1 drop-shadow-sm">{showAddress}</p>
              </motion.div>
            )}

            {/* Placeholder الافتراضي — يختفي عند التركيز */}
            {!isListening && !query && !showAddress && !isFocused && (
              <div className="pointer-events-none">
                <p className="text-[15px] text-muted-foreground/60 font-bold leading-tight py-1.5">
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
                "w-full bg-transparent text-[15px] font-bold text-right",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none caret-ring",
                (query || isFocused) && !isListening ? "relative opacity-100 py-2.5" : "absolute inset-0 opacity-0 py-2.5 z-10 cursor-text"
              )}
              dir="rtl"
            />
          </div>
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


