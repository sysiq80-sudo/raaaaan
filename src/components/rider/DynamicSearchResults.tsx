/**
 * ران - مكون نتائج البحث الديناميكي على الخريطة
 * يعرض نتائج البحث المباشرة عن طريق Google Places API
 * + اقتراحات من البحوثات السابقة
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Loader2, AlertCircle, ChevronRight, Clock, X } from 'lucide-react';
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
  className?: string;
  maxResults?: number;
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
  className,
  maxResults = 5,
}) => {
  // احفظ البحوثات السابقة وإخفها إذا كان هناك بحث
  const showRecent = !query && recentSearches && recentSearches.length > 0;
  const displayedResults = results.slice(0, maxResults);
  const hasMore = results.length > maxResults;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "absolute top-full left-0 right-0 mt-2 z-50",
          "bg-background border border-border rounded-lg shadow-lg",
          "max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
          className
        )}
      >
        {showRecent ? (
          // عرض البحوثات السابقة
          <div className="divide-y divide-border">
            {/* Header */}
            <div className="px-3 py-2 sticky top-0 bg-background/95 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>البحوثات الأخيرة</span>
              </div>
            </div>

            {/* Recent searches list */}
            {recentSearches.slice(0, maxResults).map((search, index) => (
              <motion.button
                key={search.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectRecent?.(search);
                }}
                className="w-full text-right p-3 hover:bg-muted/50 transition-colors flex items-start justify-between gap-3 group relative"
              >
                {/* Icon and Text */}
                <div className="flex-1 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-foreground line-clamp-1">
                      {search.mainText}
                    </p>
                    {search.secondaryText && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {search.secondaryText}
                      </p>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecent?.(search.id);
                  }}
                  className="p-1 hover:bg-destructive/20 rounded-md transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="حذف"
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </motion.button>
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
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelect(result.place_id, result.main_text)}
                    disabled={isLoadingDetails}
                    className="w-full text-right p-3 hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-start justify-between gap-3 group"
                  >
                    {/* Icon and Text */}
                    <div className="flex-1 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm text-foreground line-clamp-1">
                          {result.main_text}
                        </p>
                        {result.secondary_text && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {result.secondary_text}
                          </p>
                        )}
                      </div>
                    </div>

                    {result.distance_text && (
                      <div className="text-xs text-muted-foreground whitespace-nowrap mt-1">
                        {result.distance_text}
                      </div>
                    )}

                    {/* Chevron Icon */}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />

                    {/* Loading indicator on selection */}
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
}> = ({
  query,
  onQueryChange,
  onClear,
  isSearching,
  placeholder = "ابحث عن موقع...",
}) => {
  return (
    <div className="relative">
      <div className="relative flex items-center">
        {/* Search Icon */}
        <Search className="absolute right-3 w-4 h-4 text-muted-foreground pointer-events-none" />

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full pl-3 pr-10 py-2 rounded-lg",
            "border border-border bg-background",
            "text-sm focus:outline-none focus:ring-2 focus:ring-primary/50",
            "placeholder:text-muted-foreground",
            isSearching && "bg-primary/5"
          )}
          dir="rtl"
        />

        {/* Clear button */}
        {query && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onClear}
            className="absolute left-3 p-1 hover:bg-muted rounded-md transition-colors"
          >
            <span className="text-lg leading-none">✕</span>
          </motion.button>
        )}

        {/* Loading spinner */}
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute left-3"
          >
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </motion.div>
        )}
      </div>
    </div>
  );
};
