/**
 * ران - مكون نتائج البحث الديناميكي على الخريطة
 * يعرض نتائج البحث المباشرة عن طريق Google Places API
 * + اقتراحات من البحوثات السابقة
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Loader2, AlertCircle, ChevronRight, Clock, X, Heart, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecentSearch } from '@/hooks/useRecentSearches';

interface DynamicSearchResult {
  place_id: string;
  main_text: string;
  secondary_text?: string;
  description: string;
  distance_text?: string;
}

interface DynamicSearchResultsProps {
  query: string;
  results: DynamicSearchResult[];
  recentSearches?: RecentSearch[];
  isSearching: boolean;
  isLoadingDetails: boolean;
  onSelect: (placeId: string, mainText: string) => void;
  onSelectRecent?: (search: RecentSearch) => void;
  onRemoveRecent?: (id: string) => void;
  onClear?: () => void;
  onClose?: () => void;
  className?: string;
  maxResults?: number;
  maxRecentResults?: number;
  isOpen?: boolean;
}

export const DynamicSearchResults: React.FC<DynamicSearchResultsProps> = ({
  query,
  results,
  recentSearches = [],
  isSearching,
  isLoadingDetails,
  onSelect,
  onSelectRecent,
  onRemoveRecent,
  onClear,
  onClose,
  className,
  maxResults = 5,
  maxRecentResults = 3,
  isOpen = true,
}) => {
  const showRecent = !query && recentSearches && recentSearches.length > 0;
  const displayedResults = results.slice(0, maxResults);
  const hasMore = results.length > maxResults;

  // لا نعرض شيئاً إذا لم تكن القائمة مفتوحة
  if (!isOpen) return null;
  // لا نعرض شيئاً إذا لا يوجد محتوى
  if (!showRecent && !query) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "absolute bottom-full left-0 right-0 mb-2 z-50",
          "bg-background border border-border rounded-xl shadow-xl",
          className
        )}
        dir="rtl"
      >
        {showRecent ? (
          // عرض البحوثات السابقة
          <div className="divide-y divide-border">
            {/* Header: عنوان + زر إغلاق */}
            <div className="px-3 py-2.5 sticky top-0 bg-background/98 backdrop-blur-sm border-b border-border/50">
              <div className="flex items-center justify-between ">
                {/* زر الإغلاق على اليسار */}
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-muted/80 transition-colors"
                    aria-label="إغلاق القائمة"
                    title="إغلاق"
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
                {/* النص على اليمين */}
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span>آخر الأماكن المحددة</span>
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Recent searches list */}
            {recentSearches.slice(0, maxRecentResults).map((search, index) => (
              <div key={search.id} className="relative group divide-y divide-border">
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectRecent?.(search);
                  }}
                  className="w-full p-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                >
                  {/* أيقونة الساعة */}
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  {/* النص */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate text-right">
                      {search.mainText}
                    </p>
                    {search.secondaryText && (
                      <p className="text-xs text-muted-foreground truncate text-right">
                        {search.secondaryText}
                      </p>
                    )}
                  </div>
                  {/* مسافة فارغة لزر الحذف */}
                  <div className="w-7 flex-shrink-0" />
                </motion.button>

                {/* زر الحذف — خارج motion.button لتجنب button داخل button */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecent?.(search.id);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') onRemoveRecent?.(search.id); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-destructive/20 rounded-md transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="حذف"
                  aria-label="حذف من القائمة"
                >
                  <X className="w-3.5 h-3.5 text-destructive" />
                </div>
              </div>
            ))}
          </div>

        ) : query ? (
          // عرض نتائج البحث
          <>
            {isSearching ? (
              // Loading state
              <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">جاري البحث...</span>
              </div>
            ) : displayedResults.length === 0 ? (
              // No results state
              <div className="p-4 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">لا توجد نتائج</p>
                <p className="text-xs text-muted-foreground">
                  جرّب البحث بكلمات مختلفة أو تأكد من تفعيل Places API
                </p>
              </div>
            ) : (
              // Results list
              <div className="divide-y divide-border">
                {displayedResults.map((result, index) => (
                  <motion.button
                    key={result.place_id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelect(result.place_id, result.main_text)}
                    disabled={isLoadingDetails}
                    className="w-full p-3 hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center gap-3 group relative"
                  >
                    {/* أيقونة الموقع */}
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>

                    {/* النص - يأخذ المساحة المتبقية */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate text-right">
                        {result.main_text}
                      </p>
                      {result.secondary_text && (
                        <p className="text-xs text-muted-foreground truncate text-right">
                          {result.secondary_text}
                        </p>
                      )}
                    </div>

                    {/* المسافة */}
                    {result.distance_text && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {result.distance_text}
                      </span>
                    )}

                    {/* سهم على اليسار */}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 rotate-180" />

                    {isLoadingDetails && (
                      <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </motion.button>
                ))}

                {/* Show more indicator */}
                {hasMore && (
                  <div className="p-3 text-center border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      و {results.length - maxResults} نتائج أخرى
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

// Header component for the search input
export const DynamicSearchHeader: React.FC<{
  query: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  isSearching: boolean;
  placeholder?: string;
  onFocus?: () => void;
  // ─── أيقونات إضافية اختيارية ───
  onCurrentLocation?: () => void;
  onSaveLocation?: () => void;
  isFavorite?: boolean;
  showAddress?: string;
  onClearAddress?: () => void; // حذف الموقع المحدد
}> = ({
  query,
  onQueryChange,
  onClear,
  isSearching,
  placeholder = "ابحث عن موقع...",
  onFocus,
  onCurrentLocation,
  onSaveLocation,
  isFavorite = false,
  showAddress,
  onClearAddress,
}) => {

  return (
    <div className="relative" dir="rtl">
      {/* ─── حاوية الحقل الرئيسية ─── */}
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-2xl px-4 py-0",
          "bg-[#0d1f17] border transition-all duration-300",
          isSearching
            ? "border-emerald-500/60 shadow-[0_0_0_3px_rgba(52,211,153,0.12),0_4px_20px_rgba(0,0,0,0.4)]"
            : "border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:border-emerald-500/30"
        )}
      >
        {/* ── أيقونة البحث (يمين في RTL) ── */}
        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10">
          {isSearching ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-5 h-5 text-emerald-400" />
            </motion.div>
          ) : (
            <Search className={cn(
              "w-5 h-5 transition-colors duration-200",
              query ? "text-emerald-400" : "text-slate-500"
            )} />
          )}
        </div>

        {/* ── Input أو عرض العنوان ── */}
        <div className="flex-1 relative min-w-0">
          {/* عرض العنوان المختار — يبدأ من أقصى اليمين */}
          {showAddress && !query && (
            <div className="absolute inset-0 flex items-center justify-end pointer-events-none">
              <p className="text-sm text-white/90 font-semibold truncate text-right w-full">{showAddress}</p>
            </div>
          )}

          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={onFocus}
            placeholder={showAddress && !query ? '' : placeholder}
            className={cn(
              "w-full bg-transparent text-right text-sm py-3.5",
              "text-white placeholder:text-slate-500",
              "focus:outline-none caret-emerald-400",
              showAddress && !query ? "opacity-0" : "opacity-100"
            )}
            dir="rtl"
          />
        </div>

        {/* ── أيقونات اليسار ── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* مسح العنوان المختار */}
          {!query && showAddress && onClearAddress && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              whileTap={{ scale: 0.85 }}
              onClick={onClearAddress}
              className="w-9 h-9 rounded-full bg-red-500/15 hover:bg-red-500/25 flex items-center justify-center transition-colors"
              aria-label="حذف الموقع"
              title="حذف الموقع المحدد"
            >
              <X className="w-5 h-5 text-red-400" />
            </motion.button>
          )}

          {/* مسح نص البحث */}
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              whileTap={{ scale: 0.85 }}
              onClick={onClear}
              className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
              aria-label="مسح البحث"
            >
              <X className="w-5 h-5 text-slate-400" />
            </motion.button>
          )}

          {/* ❤️ حفظ المفضلة */}
          {onSaveLocation && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onSaveLocation}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                isFavorite
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30"
                  : "bg-white/8 hover:bg-white/15"
              )}
              title={isFavorite ? 'إزالة من المفضلة' : 'حفظ الموقع'}
              aria-label={isFavorite ? 'إزالة من المفضلة' : 'حفظ الموقع'}
            >
              <Heart
                className={cn(
                  'w-5 h-5 transition-all',
                  isFavorite
                    ? 'text-emerald-400 fill-emerald-400'
                    : 'text-slate-500 hover:text-emerald-400'
                )}
              />
            </motion.button>
          )}

          {/* 📍 موقعي الحالي */}
          {onCurrentLocation && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onCurrentLocation}
              className="w-9 h-9 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 flex items-center justify-center transition-colors"
              title="موقعي الحالي"
              aria-label="تحديد موقعي الحالي"
            >
              <Navigation className="w-5 h-5 text-emerald-400" />
            </motion.button>
          )}
        </div>
      </div>

      {/* ─── خط توهج سفلي عند التركيز ─── */}
      {isSearching && (
        <motion.div
          className="absolute -bottom-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ scaleX: 0, opacity: 0 }}
          transition={{ duration: 0.4 }}
        />
      )}
    </div>
  );
};

