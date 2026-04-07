import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Navigation,
  Loader2,
  Building2,
  Map,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Home,
  Briefcase,
  Star,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "landmark" | "region" | "address";
  name: string;
  name_secondary?: string;
  category: string;
  lat: number;
  lng: number;
  full_address?: string;
  icon: string;
  distance_km?: number;
  in_service?: boolean;
  region_name?: string;
}

interface SavedPlace {
  id: string;
  user_id: string;
  name: string;
  label: "home" | "work" | "favorite" | "other";
  address: string;
  lat: number;
  lng: number;
  icon: string;
  created_at: string;
}

interface LocationSearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
  }) => void;
  onFocus?: () => void;
  type: "pickup" | "dropoff";
  userLocation?: { lat: number; lng: number } | null;
  userId?: string | null;
  className?: string;
}

export interface LocationSearchInputRef {
  focus: () => void;
  clear: () => void;
}

const LocationSearchInput = forwardRef<
  LocationSearchInputRef,
  LocationSearchInputProps
>(
  (
    {
      placeholder,
      value,
      onChange,
      onLocationSelect,
      onFocus,
      type,
      userLocation,
      userId,
      className = "",
    },
    ref
  ) => {
    const { toast } = useToast();
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
    const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
    const [nearestServiceRegion, setNearestServiceRegion] = useState<{
      name: string;
      distance_km: number;
    } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        setQuery("");
        onChange("");
        setResults([]);
      },
    }));

    useEffect(() => {
      setQuery(value);
    }, [value]);

    // Load saved places
    useEffect(() => {
      console.log("LocationSearchInput - userId:", userId);
      if (userId) {
        fetchSavedPlaces();
      }
    }, [userId]);

    // Load recent searches from localStorage
    useEffect(() => {
      const saved = localStorage.getItem(`raan_recent_searches_${type}`);
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved).slice(0, 3));
        } catch (e) {
          console.error("Failed to parse recent searches:", e);
        }
      }
    }, [type]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setShowResults(false);
          setIsFocused(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const searchPlaces = async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          limit: "10",
        });

        if (userLocation) {
          params.append("lng", userLocation.lng.toString());
          params.append("lat", userLocation.lat.toString());
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-places?${params}`,
          { headers: { "Content-Type": "application/json" } }
        );

        const data = await response.json();
        setResults(data.results || []);
        setNearestServiceRegion(data.nearest_service_region || null);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setQuery(newValue);
      onChange(newValue);
      setShowResults(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchPlaces(newValue);
      }, 300);
    };

    const handleSelectResult = (result: SearchResult) => {
      const address = result.full_address || result.name;
      setQuery(address);
      onChange(address);
      onLocationSelect({
        lat: result.lat,
        lng: result.lng,
        address: address,
        inService: result.in_service,
      });
      setShowResults(false);

      // Save to recent searches
      saveToRecentSearches(result);
    };

    const handleUseCurrentLocation = () => {
      if (userLocation) {
        reverseGeocode(userLocation.lat, userLocation.lng);
      }
    };

    const reverseGeocode = async (lat: number, lng: number) => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
          { headers: { "Content-Type": "application/json" } }
        );

        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const address =
            data.features[0].place_name ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setQuery(address);
          onChange(address);

          // Check service area
          const serviceCheck = await checkServiceArea(lat, lng);
          onLocationSelect({
            lat,
            lng,
            address,
            inService: serviceCheck?.in_service,
          });
        }
      } catch (error) {
        console.error("Reverse geocode error:", error);
        const fallbackAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setQuery(fallbackAddress);
        onChange(fallbackAddress);
        onLocationSelect({ lat, lng, address: fallbackAddress });
      } finally {
        setIsLoading(false);
        setShowResults(false);
      }
    };

    const checkServiceArea = async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-service-area?lat=${lat}&lng=${lng}`
        );
        return await response.json();
      } catch {
        return null;
      }
    };

    // Fetch saved places
    const fetchSavedPlaces = async () => {
      if (!userId) {
        console.log("fetchSavedPlaces: No userId provided");
        return;
      }

      console.log("fetchSavedPlaces: Fetching for userId:", userId);

      try {
        const { data, error } = await supabase
          .from("saved_places")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) {
          console.error("fetchSavedPlaces: Supabase error:", error);
          throw error;
        }

        console.log(
          "fetchSavedPlaces: Success, found",
          data?.length || 0,
          "places"
        );
        setSavedPlaces((data || []) as any);
      } catch (error) {
        console.error("fetchSavedPlaces: Error:", error);
        toast({
          title: "خطأ في تحميل الأماكن",
          description: "تعذر تحميل أماكنك المحفوظة",
          variant: "destructive",
        });
      }
    };

    // Save to recent searches
    const saveToRecentSearches = (result: SearchResult) => {
      const key = `raan_recent_searches_${type}`;
      const existing = localStorage.getItem(key);
      let searches: SearchResult[] = existing ? JSON.parse(existing) : [];

      // Remove if already exists
      searches = searches.filter((s) => s.id !== result.id);

      // Add to beginning
      searches.unshift(result);

      // Keep only last 5
      searches = searches.slice(0, 5);

      localStorage.setItem(key, JSON.stringify(searches));
      setRecentSearches(searches.slice(0, 3));
    };

    // Toggle save place
    const toggleSavePlace = async (
      result: SearchResult,
      e: React.MouseEvent
    ) => {
      e.stopPropagation();

      console.log("===== toggleSavePlace START =====");
      console.log("userId:", userId);
      console.log("result:", JSON.stringify(result, null, 2));

      if (!userId) {
        console.log("No userId - showing login toast");
        toast({
          title: "تسجيل الدخول مطلوب",
          description: "سجل دخول لحفظ الأماكن",
          variant: "destructive",
        });
        return;
      }

      setSavingPlaceId(result.id);
      console.log("Set savingPlaceId to:", result.id);

      try {
        // Check if already saved
        console.log("Checking if place already exists...");
        const { data: existing, error: checkError } = await supabase
          .from("saved_places")
          .select("id")
          .eq("user_id", userId)
          .eq("lat", result.lat)
          .eq("lng", result.lng)
          .maybeSingle();

        console.log("Check existing result:", existing);
        console.log("Check error:", checkError);

        if (checkError && checkError.code !== "PGRST116") {
          console.error("Error checking existing place:", checkError);
          throw checkError;
        }

        if (existing) {
          // Delete
          console.log("Deleting existing place:", existing.id);
          const { error: deleteError } = await supabase
            .from("saved_places")
            .delete()
            .eq("id", existing.id);

          if (deleteError) {
            console.error("Delete error:", deleteError);
            throw deleteError;
          }

          console.log("Delete successful");
          toast({
            title: "تم الإلغاء",
            description: "تم إلغاء حفظ المكان",
          });
        } else {
          // Insert
          console.log("Inserting new place...");
          const placeToInsert = {
            user_id: userId,
            name: result.name,
            label: "favorite",
            address: result.full_address || result.name,
            lat: result.lat,
            lng: result.lng,
            icon: getIconForType(result.type),
          };
          console.log("Place data:", JSON.stringify(placeToInsert, null, 2));

          const { data: inserted, error: insertError } = await supabase
            .from("saved_places")
            .insert(placeToInsert)
            .select();

          if (insertError) {
            console.error("Insert error:", insertError);
            throw insertError;
          }

          console.log("Insert successful:", inserted);
          toast({
            title: "تم الحفظ ✨",
            description: "تم حفظ المكان في مفضلتك",
          });
        }

        // Refresh saved places
        console.log("Refreshing saved places...");
        await fetchSavedPlaces();
        console.log("===== toggleSavePlace END (SUCCESS) =====");
      } catch (error) {
        console.error("===== toggleSavePlace ERROR =====", error);
        toast({
          title: "خطأ",
          description:
            error instanceof Error ? error.message : "حدث خطأ أثناء الحفظ",
          variant: "destructive",
        });
      } finally {
        setSavingPlaceId(null);
        console.log("Cleared savingPlaceId");
      }
    };

    // Check if a place is already saved
    const isPlaceSaved = (result: SearchResult): boolean => {
      return savedPlaces.some(
        (p) => p.lat === result.lat && p.lng === result.lng
      );
    };

    // Get icon for result type
    const getIconForType = (resultType: string) => {
      switch (resultType) {
        case "landmark":
          return "🏛️";
        case "region":
          return "🗺️";
        default:
          return "📍";
      }
    };

    // Get icon component for saved place label
    const getSavedPlaceIcon = (label: string) => {
      switch (label) {
        case "home":
          return <Home className="w-5 h-5" />;
        case "work":
          return <Briefcase className="w-5 h-5" />;
        case "favorite":
          return <Heart className="w-5 h-5" />;
        default:
          return <MapPin className="w-5 h-5" />;
      }
    };

    const handleClear = () => {
      setQuery("");
      onChange("");
      setResults([]);
      inputRef.current?.focus();
    };

    const getTypeIcon = (resultType: string) => {
      switch (resultType) {
        case "landmark":
          return <Building2 className="w-4 h-4 text-primary" />;
        case "region":
          return <Map className="w-4 h-4 text-secondary-foreground" />;
        default:
          return <MapPin className="w-4 h-4 text-muted-foreground" />;
      }
    };

    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />

          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
              setShowResults(true);
              onFocus?.();
            }}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "w-full h-14 pr-12 pl-20 text-lg rounded-2xl",
              "border-2 transition-all duration-200",
              isFocused
                ? "border-primary shadow-lg shadow-primary/20"
                : "border-border",
              "bg-background/95 backdrop-blur-sm"
            )}
            autoComplete="off"
          />

          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Clear button */}
            <AnimatePresence>
              {query.length > 0 && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 hover:bg-muted rounded-full transition-colors"
                  aria-label="مسح البحث"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            )}

            {/* Current location button */}
            {type === "pickup" && userLocation && !query && !isLoading && (
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                title="استخدم موقعي الحالي"
              >
                <Navigation className="w-5 h-5 text-primary" />
              </button>
            )}
          </div>
        </div>

        {/* Results Dropdown - Fullscreen overlay */}
        <AnimatePresence>
          {showResults && (isFocused || showResults) && (
            <>
              {/* Background overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                onClick={() => setShowResults(false)}
              />

              {/* Search Results Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed top-20 left-4 right-4 bottom-20 md:left-1/4 md:right-1/4 bg-card/98 backdrop-blur-xl border-2 border-border rounded-3xl shadow-2xl overflow-hidden z-[101]"
              >
                {/* Scrollable content */}
                <div className="h-full overflow-y-auto pt-16 pb-6">
                  {/* Current Location Button */}
                  {type === "pickup" && userLocation && !query && (
                    <button
                      onClick={handleUseCurrentLocation}
                      className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors border-b border-border/50"
                    >
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Navigation className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-semibold text-base">
                          استخدم موقعي الحالي
                        </p>
                        <p className="text-sm text-muted-foreground">
                          تحديد موقعك الحالي تلقائياً
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Saved Places */}
                  {savedPlaces.length > 0 && query.length === 0 && (
                    <div className="border-b border-border/50">
                      <div className="px-4 py-3 bg-muted/30">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          أماكني المحفوظة
                        </p>
                      </div>
                      {savedPlaces.map((place) => (
                        <button
                          key={place.id}
                          onClick={() => {
                            setQuery(place.name);
                            onChange(place.name);
                            setShowResults(false);
                            onLocationSelect({
                              lat: place.lat,
                              lng: place.lng,
                              address: place.address,
                              inService: true,
                            });
                          }}
                          className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                            {getSavedPlaceIcon(place.label)}
                          </div>
                          <div className="flex-1 text-right">
                            <p className="font-semibold text-base">
                              {place.name}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {place.address}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Recent Searches */}
                  {recentSearches.length > 0 &&
                    query.length === 0 &&
                    savedPlaces.length === 0 && (
                      <div className="border-b border-border/50">
                        <div className="px-4 py-3 bg-muted/30">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            عمليات بحث حديثة
                          </p>
                        </div>
                        {recentSearches.map((recent) => (
                          <button
                            key={recent.id}
                            onClick={() => handleSelectResult(recent)}
                            className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                              {getTypeIcon(recent.type)}
                            </div>
                            <div className="flex-1 text-right">
                              <p className="font-semibold text-base">
                                {recent.name}
                              </p>
                              {recent.full_address && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {recent.full_address}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                  {/* Search Results */}
                  {query.length >= 2 && results.length > 0 && (
                    <div>
                      <div className="px-4 py-3 bg-muted/30">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          نتائج البحث ({results.length})
                        </p>
                      </div>
                      {results.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectResult(result)}
                          className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors group"
                        >
                          <div
                            className={cn(
                              "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                              result.in_service
                                ? "bg-primary/10"
                                : "bg-orange-500/10"
                            )}
                          >
                            <span className="text-lg">{result.icon}</span>
                          </div>

                          <div className="flex-1 text-right min-w-0">
                            <div className="flex items-center gap-2 justify-end">
                              <p className="font-semibold text-base truncate">
                                {result.name}
                              </p>
                              {result.in_service ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                              )}
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                              {result.full_address && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {result.full_address}
                                </p>
                              )}
                              {result.distance_km !== undefined && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {result.distance_km.toFixed(1)} كم
                                </span>
                              )}
                            </div>

                            {!result.in_service && result.region_name && (
                              <p className="text-xs text-orange-600 mt-1">
                                أقرب منطقة: {result.region_name}
                              </p>
                            )}
                          </div>

                          {/* Save/Unsave button */}
                          {userId && (
                            <button
                              onClick={(e) => toggleSavePlace(result, e)}
                              disabled={savingPlaceId === result.id}
                              className={cn(
                                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                "hover:bg-amber-500/20 active:scale-95",
                                "opacity-0 group-hover:opacity-100"
                              )}
                            >
                              {savingPlaceId === result.id ? (
                                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                              ) : (
                                <Star
                                  className={cn(
                                    "w-5 h-5 transition-all",
                                    isPlaceSaved(result)
                                      ? "text-amber-500 fill-amber-500"
                                      : "text-muted-foreground"
                                  )}
                                />
                              )}
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Empty State */}
                  {query.length >= 2 && results.length === 0 && !isLoading && (
                    <div className="p-8 text-center">
                      <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="font-semibold text-base mb-1">
                        لم يتم العثور على نتائج
                      </p>
                      <p className="text-sm text-muted-foreground">
                        جرب البحث بكلمات مختلفة
                      </p>
                    </div>
                  )}

                  {/* Loading State */}
                  {isLoading && query.length >= 2 && results.length === 0 && (
                    <div className="p-8 text-center">
                      <Loader2 className="w-12 h-12 text-primary mx-auto mb-3 animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        جاري البحث...
                      </p>
                    </div>
                  )}

                  {/* Empty prompt */}
                  {!query &&
                    results.length === 0 &&
                    savedPlaces.length === 0 &&
                    recentSearches.length === 0 &&
                    type !== "pickup" && (
                      <div className="p-8 text-center">
                        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">
                          ابحث عن موقع، منطقة، أو معلم
                        </p>
                      </div>
                    )}

                  {/* Warning for out-of-service results */}
                  {!isLoading &&
                    results.length > 0 &&
                    results.every((r) => r.in_service === false) &&
                    nearestServiceRegion && (
                      <div className="px-4 py-3 bg-amber-500/10 border-t border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">
                              جميع النتائج خارج منطقة الخدمة
                            </p>
                            <p className="text-xs">
                              أقرب منطقة خدمة: {nearestServiceRegion.name} (
                              {nearestServiceRegion.distance_km} كم)
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

LocationSearchInput.displayName = "LocationSearchInput";

export default LocationSearchInput;
