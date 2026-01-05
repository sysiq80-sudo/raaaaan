/**
 * SmartSearchBar - شريط بحث ذكي للانطلاق والوصول
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Search, X, Loader2, Map, Clock, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LocationResult {
  id: string;
  type: 'landmark' | 'region' | 'address' | 'current';
  name: string;
  name_secondary?: string;
  category?: string;
  lat: number;
  lng: number;
  full_address?: string;
  icon?: string;
  distance_km?: number;
  in_service?: boolean;
  region_name?: string;
}

interface SmartSearchBarProps {
  type: 'pickup' | 'dropoff';
  value: string;
  placeholder?: string;
  userLocation: { lat: number; lng: number } | null;
  onLocationSelect: (location: LocationResult) => void;
  onGPSClick?: () => void;
  onMapClick?: () => void;
  isLocating?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SmartSearchBar = ({
  type,
  value,
  placeholder,
  userLocation,
  onLocationSelect,
  onGPSClick,
  onMapClick,
  isLocating = false,
  disabled = false,
  className
}: SmartSearchBarProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // تحديث القيمة من الخارج
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // إغلاق النتائج عند النقر خارج المكون
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // البحث عن الأماكن
  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        lat: String(userLocation?.lat || 33.4262),
        lng: String(userLocation?.lng || 43.2954),
        limit: '8'
      });

      const { data, error } = await supabase.functions.invoke('search-places', {
        body: null,
        headers: { 'Content-Type': 'application/json' },
      });

      // استخدام GET مع query params
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/search-places?${params}`,
        {
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo`
          }
        }
      );
      
      const result = await response.json();
      
      if (result.results) {
        setResults(result.results);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error searching places:', error);
    } finally {
      setIsSearching(false);
    }
  }, [userLocation]);

  // البحث مع تأخير (debounce)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(newQuery);
    }, 300);
  };

  // اختيار نتيجة
  const handleSelectResult = (result: LocationResult) => {
    setQuery(result.name);
    setShowResults(false);
    onLocationSelect(result);
  };

  // مسح البحث
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  // استخدام GPS
  const handleGPSClick = () => {
    if (onGPSClick) {
      onGPSClick();
    }
  };

  const isPickup = type === 'pickup';
  const gradientClass = isPickup 
    ? 'from-emerald-500 to-green-600' 
    : 'from-blue-500 to-indigo-600';

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* شريط البحث */}
      <motion.div
        className={cn(
          "relative flex items-center gap-2 rounded-2xl border-2 bg-background/95 backdrop-blur-sm p-1 transition-all duration-300",
          isFocused ? "border-primary shadow-lg shadow-primary/20" : "border-border/50",
          disabled && "opacity-50 pointer-events-none"
        )}
        animate={{ scale: isFocused ? 1.02 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* زر GPS للانطلاق */}
        {isPickup && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGPSClick}
            disabled={isLocating}
            className={cn(
              "h-10 w-10 rounded-xl shrink-0 transition-all duration-300",
              isLocating && "animate-pulse"
            )}
          >
            {isLocating ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Navigation className={cn(
                  "h-5 w-5",
                  `text-emerald-500`
                )} />
              </motion.div>
            )}
          </Button>
        )}

        {/* أيقونة الوجهة */}
        {!isPickup && (
          <div className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
            <MapPin className="h-5 w-5 text-blue-500" />
          </div>
        )}

        {/* حقل الإدخال */}
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
              if (results.length > 0) setShowResults(true);
            }}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || (isPickup ? "ابحث عن مكان الانطلاق..." : "ابحث عن مكان الوصول...")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/60"
            dir="rtl"
          />
          
          {/* مؤشر البحث */}
          {isSearching && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* زر المسح */}
        {query && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-8 w-8 rounded-full shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </motion.div>
        )}

        {/* زر الخريطة */}
        {onMapClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMapClick}
            className="h-10 w-10 rounded-xl shrink-0"
          >
            <Map className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </motion.div>

      {/* نتائج البحث */}
      <AnimatePresence>
        {showResults && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-background/98 backdrop-blur-xl rounded-2xl border border-border/50 shadow-xl overflow-hidden max-h-80 overflow-y-auto"
          >
            {results.map((result, index) => (
              <motion.button
                key={result.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelectResult(result)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-right transition-colors",
                  "hover:bg-muted/50 active:bg-muted",
                  !result.in_service && "opacity-60"
                )}
              >
                {/* أيقونة المكان */}
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-lg",
                  result.in_service 
                    ? "bg-gradient-to-br from-primary/20 to-primary/10" 
                    : "bg-muted"
                )}>
                  {result.icon || '📍'}
                </div>

                {/* معلومات المكان */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {result.name}
                    </span>
                    {result.in_service && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                        متاح
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">{result.category}</span>
                    {result.distance_km !== undefined && (
                      <>
                        <span>•</span>
                        <span>{result.distance_km} كم</span>
                      </>
                    )}
                  </div>
                </div>

                {/* المسافة */}
                <div className="text-sm text-muted-foreground shrink-0">
                  {result.distance_km !== undefined && (
                    <span className="text-xs">{result.distance_km} كم</span>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartSearchBar;
