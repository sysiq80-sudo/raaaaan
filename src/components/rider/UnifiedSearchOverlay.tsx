/**
 * UnifiedSearchOverlay - شريط بحث موحد فوق الخريطة
 * مستوحى من تصميم Uber/Careem
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Star, Clock, Home, Briefcase, X, Loader2, Navigation, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateLocalDistance, estimateArrivalMinutes } from "@/lib/mapUtils";

interface SearchResult {
  id: string;
  type: 'landmark' | 'region' | 'address';
  name: string;
  category: string;
  lat: number;
  lng: number;
  icon: string;
  distance_km?: number;
}

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  label: string;
}

interface RecentPlace {
  id: string;
  address: string;
  lat: number;
  lng: number;
}

interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
}

interface UnifiedSearchOverlayProps {
  userId: string | null;
  userLocation: { lat: number; lng: number } | null;
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  onOpenMapPicker: () => void;
  placeholder?: string;
  nearbyDriversCount?: number;
  nearbyDriverLocations?: DriverLocation[];
}

const UnifiedSearchOverlay = ({
  userId,
  userLocation,
  onLocationSelect,
  onOpenMapPicker,
  placeholder = "إلى أين؟",
  nearbyDriversCount = 0,
  nearbyDriverLocations = []
}: UnifiedSearchOverlayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch saved and recent places
  useEffect(() => {
    const fetchPlaces = async () => {
      if (!userId) return;
      
      try {
        const { data: saved } = await supabase
          .from('saved_places')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (saved) setSavedPlaces(saved);

        const { data: rides } = await supabase
          .from('rides')
          .select('id, dropoff_address, dropoff_location')
          .eq('rider_id', userId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(3);

        if (rides) {
          const recent = rides
            .filter(r => r.dropoff_address && r.dropoff_location)
            .map(r => ({
              id: r.id,
              address: r.dropoff_address!,
              lat: (r.dropoff_location as any).lat,
              lng: (r.dropoff_location as any).lng
            }));
          setRecentPlaces(recent);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
      }
    };

    fetchPlaces();
  }, [userId]);

  // Search places
  const searchPlaces = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: searchQuery, limit: '6' });
      if (userLocation) {
        params.append('lng', userLocation.lng.toString());
        params.append('lat', userLocation.lat.toString());
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-places?${params}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 200);
  };

  const handleSelectResult = (result: SearchResult) => {
    onLocationSelect({ lat: result.lat, lng: result.lng, address: result.name });
    setQuery("");
    setSearchResults([]);
    setIsExpanded(false);
  };

  const handleSelectSaved = (place: SavedPlace) => {
    onLocationSelect({ lat: place.lat, lng: place.lng, address: place.address });
    setIsExpanded(false);
  };

  const handleSelectRecent = (place: RecentPlace) => {
    onLocationSelect({ lat: place.lat, lng: place.lng, address: place.address });
    setIsExpanded(false);
  };

  const handleFocus = () => {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const getPlaceIcon = (label: string) => {
    switch (label) {
      case 'home': return <Home className="w-4 h-4" />;
      case 'work': return <Briefcase className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const homePlace = savedPlaces.find(p => p.label === 'home');
  const workPlace = savedPlaces.find(p => p.label === 'work');

  // Calculate nearest driver ETA
  const nearestDriverETA = useMemo(() => {
    if (!userLocation || nearbyDriverLocations.length === 0) return null;

    let minDistance = Infinity;
    for (const driver of nearbyDriverLocations) {
      const distance = calculateLocalDistance(
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: driver.lat, lng: driver.lng }
      );
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    // Estimate arrival time (average city speed ~25 km/h)
    const eta = estimateArrivalMinutes(
      { lat: userLocation.lat, lng: userLocation.lng },
      { lat: userLocation.lat + (minDistance / 111), lng: userLocation.lng },
      25
    );

    return Math.max(1, Math.round(minDistance * 3)); // ~3 min per km in city
  }, [userLocation, nearbyDriverLocations]);

  return (
    <>
      {/* Collapsed Search Bar */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-4 right-4 z-30"
          >
            {/* Driver Availability Badge */}
            {nearbyDriversCount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center mb-2"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 backdrop-blur-md rounded-full border border-primary/30">
                  <Car className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    {nearbyDriversCount} سائق متاح
                    {nearestDriverETA && ` • أقرب سائق ${nearestDriverETA} د`}
                  </span>
                </div>
              </motion.div>
            )}

            <button
              onClick={handleFocus}
              className="w-full bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border/50 p-4 flex items-center gap-3 hover:border-primary/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <span className="flex-1 text-right text-muted-foreground font-medium">
                {placeholder}
              </span>
            </button>

            {/* Quick Saved Places */}
            {(homePlace || workPlace) && (
              <div className="flex gap-2 mt-3">
                {homePlace && (
                  <button
                    onClick={() => handleSelectSaved(homePlace)}
                    className="flex-1 bg-card/90 backdrop-blur-md rounded-xl p-3 flex items-center gap-2 border border-border/50 hover:border-primary/30 transition-all"
                  >
                    <Home className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium truncate">البيت</span>
                  </button>
                )}
                {workPlace && (
                  <button
                    onClick={() => handleSelectSaved(workPlace)}
                    className="flex-1 bg-card/90 backdrop-blur-md rounded-xl p-3 flex items-center gap-2 border border-border/50 hover:border-primary/30 transition-all"
                  >
                    <Briefcase className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium truncate">العمل</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Search Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md"
          >
            {/* Header */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsExpanded(false);
                    setQuery("");
                    setSearchResults([]);
                  }}
                  className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="ابحث عن حي، شارع، معلم..."
                    className="w-full bg-secondary rounded-xl py-3 pr-11 pl-4 text-right outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-80px)]">
              {/* Loading */}
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}

              {/* Search Results */}
              {!isSearching && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelectResult(result)}
                      className="w-full p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:border-primary/30 transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 text-right min-w-0">
                        <p className="font-medium truncate">{result.name}</p>
                        <p className="text-xs text-muted-foreground">{result.category}</p>
                      </div>
                      {result.distance_km && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {result.distance_km.toFixed(1)} كم
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* No query - show saved and recent */}
              {!isSearching && query.length < 2 && (
                <>
                  {/* Select from Map */}
                  <button
                    onClick={() => {
                      setIsExpanded(false);
                      onOpenMapPicker();
                    }}
                    className="w-full p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-3 hover:bg-primary/20 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                      <Navigation className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-medium text-primary">اختر من الخريطة</span>
                  </button>

                  {/* Saved Places */}
                  {savedPlaces.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2 text-right">الأماكن المحفوظة</h3>
                      <div className="space-y-2">
                        {savedPlaces.map((place) => (
                          <button
                            key={place.id}
                            onClick={() => handleSelectSaved(place)}
                            className="w-full p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:border-primary/30 transition-all"
                          >
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                              {getPlaceIcon(place.label)}
                            </div>
                            <div className="flex-1 text-right min-w-0">
                              <p className="font-medium">{place.name || place.label}</p>
                              <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Places */}
                  {recentPlaces.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2 text-right">الرحلات الأخيرة</h3>
                      <div className="space-y-2">
                        {recentPlaces.map((place) => (
                          <button
                            key={place.id}
                            onClick={() => handleSelectRecent(place)}
                            className="w-full p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:border-primary/30 transition-all"
                          >
                            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                              <Clock className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <p className="flex-1 text-right text-sm truncate">{place.address}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default UnifiedSearchOverlay;
