import React, { useRef, useEffect, useState } from 'react';
import { MapPin, Navigation, X, Search, Clock, Building2, Map as MapIcon, Target, Sparkles, CircleDot, ArrowUpDown, Crosshair, MapPinned, History } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PopularPlaces from './PopularPlaces';
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { getGeocoder } from "@/lib/googleMapService";

interface SearchResult {
  id: string;
  place_id?: string;
  type: 'landmark' | 'region' | 'address';
  name: string;
  category: string;
  lat: number;
  lng: number;
  icon: string;
  distance_km?: number;
  in_service?: boolean;
  region_name?: string;
}

interface LocationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeField: 'pickup' | 'dropoff' | 'pickup_only' | null;
  pickup: string;
  dropoff: string;
  onPickupChange: (value: string) => void;
  onDropoffChange: (value: string) => void;
  onLocationSelect: (location: { lat: number; lng: number; address: string; inService?: boolean }, type: 'pickup' | 'dropoff') => void;
  onOpenMapPicker: (type: 'pickup' | 'dropoff') => void;
  onSwapLocations?: () => void;
  userLocation?: { lat: number; lng: number } | null;
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
}

const LocationBottomSheet: React.FC<LocationBottomSheetProps> = ({
  isOpen,
  onClose,
  activeField,
  pickup,
  dropoff,
  onPickupChange,
  onDropoffChange,
  onLocationSelect,
  onOpenMapPicker,
  onSwapLocations,
  userLocation,
  pickupCoords,
  dropoffCoords
}) => {
  const [activeSearchField, setActiveSearchField] = useState<'pickup' | 'dropoff'>('dropoff');
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentLocations, setRecentLocations] = useState<SearchResult[]>([]);
  const [isSettingCurrentLocation, setIsSettingCurrentLocation] = useState(false);
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesApiReadyRef = useRef(false);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Check if we're in pickup-only mode
  const isPickupOnlyMode = activeField === 'pickup_only';

  useEffect(() => {
    if (isOpen) {
      // Focus on the active field
      setTimeout(() => {
        if (activeField === 'pickup' || activeField === 'pickup_only') {
          pickupInputRef.current?.focus();
          setActiveSearchField('pickup');
        } else {
          dropoffInputRef.current?.focus();
          setActiveSearchField('dropoff');
        }
      }, 100);
    }
  }, [isOpen, activeField]);

  // تهيئة Google Maps API - لا حاجة لـ service instances مع API الجديد
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!googleMapsApiKey) return;

    const initPlacesApi = () => {
      if (!window.google?.maps?.places?.AutocompleteSuggestion || !window.google?.maps?.places?.Place) {
        return false;
      }
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      placesApiReadyRef.current = true;
      return true;
    };

    if (!window.google) {
      loadGoogleMaps(googleMapsApiKey).then(() => initPlacesApi()).catch(err => {
        console.error("LocationBottomSheet: Google Maps load error", err);
      });
      return;
    }

    if (initPlacesApi()) return;

    // انتظار تحميل API
    let delay = 100;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryInit = () => {
      attempts++;
      if (attempts > 20) return;
      if (initPlacesApi()) return;
      delay = Math.min(delay * 1.5, 1000);
      timer = setTimeout(tryInit, delay);
    };
    timer = setTimeout(tryInit, delay);
    return () => clearTimeout(timer);
  }, [googleMapsApiKey]);

  useEffect(() => {
    // Load recent locations from localStorage
    const saved = localStorage.getItem('recent_locations');
    if (saved) {
      try {
        setRecentLocations(JSON.parse(saved).slice(0, 5));
      } catch { }
    }
  }, []);

  const searchPlaces = async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (!placesApiReadyRef.current) {
      return;
    }

    setIsLoading(true);
    try {
      const request: any = {
        input: query,
        language: "ar",
        sessionToken: sessionTokenRef.current || undefined,
        includedRegionCodes: ["iq"],
      };

      if (userLocation) {
        request.locationBias = {
          center: new google.maps.LatLng(userLocation.lat, userLocation.lng),
          radius: 50000,
        };
      }

      const { suggestions } = await google.maps.places.AutocompleteSuggestion
        .fetchAutocompleteSuggestions(request);

      setResults(
        suggestions
          .filter(s => s.placePrediction)
          .map((s) => {
            const pred = s.placePrediction!;
            return {
              id: pred.placeId,
              place_id: pred.placeId,
              type: 'address' as const,
              name: pred.mainText.text,
              category: pred.secondaryText?.text || 'مكان',
              lat: 0,
              lng: 0,
              icon: '📍',
            };
          })
      );
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickupChange = (value: string) => {
    setPickupQuery(value);
    setActiveSearchField('pickup');
    onPickupChange(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  };

  const handleDropoffChange = (value: string) => {
    setDropoffQuery(value);
    setActiveSearchField('dropoff');
    onDropoffChange(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  };

  const handleSelectResult = async (result: SearchResult, type: 'pickup' | 'dropoff') => {
    let lat = result.lat;
    let lng = result.lng;
    let address = result.name;

    if (result.place_id && placesApiReadyRef.current) {
      try {
        const place = new google.maps.places.Place({ id: result.place_id });
        await place.fetchFields({
          fields: ["formattedAddress", "location", "displayName", "id"],
        });

        if (place.location) {
          lat = place.location.lat();
          lng = place.location.lng();
          address = place.formattedAddress || place.displayName || address;
        }

        // تجديد session token بعد الاختيار
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      } catch (error) {
        console.error('Place details error:', error);
      }
    }

    const updatedResult = { ...result, lat, lng, name: address };

    // Save to recent locations
    const updated = [updatedResult, ...recentLocations.filter(r => r.id !== updatedResult.id)].slice(0, 5);
    setRecentLocations(updated);
    localStorage.setItem('recent_locations', JSON.stringify(updated));

    onLocationSelect({ lat, lng, address, inService: result.in_service }, type);
    setResults([]);

    if (type === 'pickup') {
      setPickupQuery('');
      // In pickup_only mode, close the sheet after selection
      if (isPickupOnlyMode) {
        onClose();
      } else {
        // After selecting pickup, focus on dropoff
        setTimeout(() => {
          dropoffInputRef.current?.focus();
          setActiveSearchField('dropoff');
        }, 100);
      }
    } else {
      setDropoffQuery('');
    }
  };

  const handleSetCurrentLocation = async () => {
    if (!userLocation) return;

    setIsSettingCurrentLocation(true);
    try {
      let address = 'موقعي الحالي';
      if (window.google?.maps) {
        const geocoder = await getGeocoder();
        if (geocoder) {
        const result = await geocoder.geocode({
          location: new google.maps.LatLng(userLocation.lat, userLocation.lng),
          language: 'ar'
        });
        if (result.results && result.results[0]) {
          address = result.results[0].formatted_address;
        }
        }
      }

      onLocationSelect({ lat: userLocation.lat, lng: userLocation.lng, address, inService: true }, 'pickup');

      // In pickup_only mode, close the sheet after selection
      if (isPickupOnlyMode) {
        onClose();
      } else {
        // Focus on dropoff after setting pickup
        setTimeout(() => {
          dropoffInputRef.current?.focus();
          setActiveSearchField('dropoff');
        }, 100);
      }
    } catch (error) {
      console.error('Error getting current location address:', error);
      onLocationSelect({ lat: userLocation.lat, lng: userLocation.lng, address: 'موقعي الحالي', inService: true }, 'pickup');
      if (isPickupOnlyMode) {
        onClose();
      }
    } finally {
      setIsSettingCurrentLocation(false);
    }
  };

  const renderSearchResults = (forField: 'pickup' | 'dropoff') => {
    if (isLoading) {
      return (
        <div className="py-8 text-center">
          <div
            className="w-10 h-10 rounded-full mx-auto mb-3 animate-spin"
            style={{
              background: 'conic-gradient(from 0deg, transparent, hsl(var(--primary)))',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))'
            }}
          />
          <p className="text-sm text-muted-foreground">جاري البحث...</p>
        </div>
      );
    }

    if (results.length > 0) {
      return (
        <>
          <p className="text-xs text-muted-foreground px-1 flex items-center gap-2 mb-2">
            <Search className="w-3 h-3" />
            نتائج البحث
          </p>
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectResult(result, forField)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/80 transition-all duration-200 text-right group ${result.in_service === false ? 'opacity-50' : ''
                }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${result.type === 'landmark' ? 'bg-gradient-to-br from-primary/20 to-primary/5' :
                  result.type === 'region' ? 'bg-gradient-to-br from-secondary to-secondary/50' : 'bg-muted'
                }`}>
                <span className="text-lg">{result.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate group-hover:text-primary transition-colors text-sm">{result.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${result.type === 'landmark' ? 'bg-primary/10 text-primary' :
                      result.type === 'region' ? 'bg-secondary text-secondary-foreground' : 'bg-muted'
                    }`}>
                    {result.category}
                  </span>
                  {result.distance_km && <span>{result.distance_km} كم</span>}
                  {result.in_service === false && (
                    <span className="text-amber-500">خارج الخدمة</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </>
      );
    }

    return null;
  };

  // Render pickup-only content with premium options
  const renderPickupOnlyContent = () => {
    return (
      <div className="space-y-4">
        {/* Premium pickup options grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Current Location - Primary Option */}
          <button
            onClick={handleSetCurrentLocation}
            disabled={!userLocation || isSettingCurrentLocation}
            className="relative col-span-2 flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-emerald-600/5 border border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 group disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              {isSettingCurrentLocation ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Crosshair className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="flex-1 text-right">
              <p className="font-bold text-foreground">موقعي الحالي</p>
              <p className="text-xs text-muted-foreground mt-0.5">استخدم GPS لتحديد موقعك</p>
            </div>
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 text-[10px] font-medium">
              الأسرع
            </div>
          </button>

          {/* Choose from Map */}
          <button
            onClick={() => onOpenMapPicker('pickup')}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-secondary/50 border border-border/50 hover:border-primary/30 hover:bg-secondary/80 hover:shadow-md transition-all duration-300 group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MapPinned className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-foreground">حدد على الخريطة</p>
          </button>

          {/* Pin on Map */}
          <button
            onClick={() => {
              setActiveSearchField('pickup');
              pickupInputRef.current?.focus();
            }}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-secondary/50 border border-border/50 hover:border-primary/30 hover:bg-secondary/80 hover:shadow-md transition-all duration-300 group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5 text-violet-500" />
            </div>
            <p className="text-sm font-medium text-foreground">ابحث عن موقع</p>
          </button>
        </div>

        {/* Recent Pickup Locations */}
        {recentLocations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1 flex items-center gap-2">
              <History className="w-3 h-3" /> استخدمتها مؤخراً
            </p>
            <div className="space-y-1">
              {recentLocations.slice(0, 3).map((location) => (
                <button
                  key={location.id}
                  onClick={() => {
                    handleSelectResult(location, 'pickup');
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 transition-all duration-200 text-right group"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm group-hover:text-primary transition-colors">{location.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{location.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render dropoff content with three main options
  const renderDropoffContent = () => {
    return (
      <div className="space-y-4">
        {/* Three main options for destination selection */}
        <div className="grid grid-cols-1 gap-3">
          {/* 1. Search by place name - Primary Option */}
          <button
            onClick={() => {
              setActiveSearchField('dropoff');
              dropoffInputRef.current?.focus();
            }}
            className="relative flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/15 to-blue-600/5 border border-blue-500/30 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-right">
              <p className="font-bold text-foreground">البحث عن اسم المكان</p>
              <p className="text-xs text-muted-foreground mt-0.5">أدخل اسم المكان أو المعلم</p>
            </div>
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 text-[10px] font-medium">
              الأكثر دقة
            </div>
          </button>

          {/* 2. Select from map */}
          <button
            onClick={() => onOpenMapPicker('dropoff')}
            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-500/15 to-green-600/5 border border-green-500/30 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-105 transition-transform">
              <MapPinned className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-right">
              <p className="font-bold text-foreground">الخريطة</p>
              <p className="text-xs text-muted-foreground mt-0.5">حدد موقعك بالضبط على الخريطة</p>
            </div>
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 text-[10px] font-medium">
              مرئي
            </div>
          </button>

        </div>

        {/* Saved Places Section */}
        {/* Recent Locations */}
        {recentLocations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1 flex items-center gap-2">
              <History className="w-3 h-3" /> وجهات سابقة
            </p>
            <div className="space-y-1">
              {recentLocations.slice(0, 3).map((location) => (
                <button
                  key={location.id}
                  onClick={() => {
                    handleSelectResult(location, 'dropoff');
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 transition-all duration-200 text-right group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm group-hover:text-primary transition-colors">{location.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{location.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDefaultContent = () => {
    // If in pickup-only mode, show the premium pickup interface
    if (isPickupOnlyMode) {
      return renderPickupOnlyContent();
    }

    // For dropoff mode, show premium dropoff interface
    if (activeSearchField === 'dropoff') {
      return renderDropoffContent();
    }

    // Default fallback (shouldn't normally reach here)
    return (
      <div className="py-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent mx-auto mb-3 flex items-center justify-center">
          <Building2 className="w-8 h-8 text-primary/30" />
        </div>
        <p className="text-sm text-muted-foreground">ابحث عن موقع، معلم، أو منطقة</p>
      </div>
    );
  };

  const hasPickupQuery = pickupQuery.length >= 2;
  const hasDropoffQuery = dropoffQuery.length >= 2;
  const showResults = (activeSearchField === 'pickup' && hasPickupQuery) || (activeSearchField === 'dropoff' && hasDropoffQuery);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh] bg-gradient-to-b from-card to-background border-t-2 border-primary/20">
        {/* Header */}
        <DrawerHeader className="pb-3 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between relative">
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/80 transition-all duration-200 active:scale-95" title="إغلاق">
              <X className="w-5 h-5" />
            </button>
            <DrawerTitle className="text-lg font-bold">
              {activeField === 'dropoff' ? 'إلى أين تريد الذهاب؟' : 'اختر موقع الانطلاق'}
            </DrawerTitle>
            <div className="w-9" />
          </div>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* In pickup_only mode, skip the input fields and show premium options directly */}
          {!isPickupOnlyMode && (
            <>
              {/* Location inputs with connected line */}
              <div className="relative">
                {/* Vertical connecting line */}
                <div className="absolute right-[26px] top-[44px] w-0.5 h-[calc(100%-88px)] bg-gradient-to-b from-emerald-500 via-muted to-blue-500" />

                {/* Pickup Input */}
                <div className="relative mb-3">
                  {/* Green indicator */}
                  <div
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full z-10 border-2 border-background"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #34d399)',
                      boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)'
                    }}
                  />
                  <Input
                    ref={pickupInputRef}
                    value={pickupQuery || pickup}
                    onChange={(e) => handlePickupChange(e.target.value)}
                    onFocus={() => setActiveSearchField('pickup')}
                    placeholder="من أين؟ (موقع الانطلاق)"
                    className={`pr-11 pl-12 h-12 text-sm rounded-xl bg-secondary/50 border-2 transition-all duration-300 ${activeSearchField === 'pickup'
                        ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
                        : 'border-transparent hover:border-muted'
                      }`}
                  />
                  {/* Current location button */}
                  <button
                    onClick={handleSetCurrentLocation}
                    disabled={!userLocation || isSettingCurrentLocation}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    title="استخدم موقعي الحالي"
                  >
                    {isSettingCurrentLocation ? (
                      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Target className="w-5 h-5 text-emerald-500" />
                    )}
                  </button>
                </div>

                {/* Swap Button with Animation */}
                {onSwapLocations && (pickup || dropoff) && (
                  <button
                    onClick={(e) => {
                      const button = e.currentTarget;
                      const icon = button.querySelector('svg');
                      button.classList.add('animate-swap-pulse');
                      icon?.classList.add('animate-swap-rotate');
                      onSwapLocations();
                      setPickupQuery('');
                      setDropoffQuery('');
                      setTimeout(() => {
                        button.classList.remove('animate-swap-pulse');
                        icon?.classList.remove('animate-swap-rotate');
                      }, 500);
                    }}
                    className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-card border-2 border-primary/40 flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:shadow-[0_0_20px_rgba(var(--primary)/0.4)] transition-all duration-300 active:scale-90 shadow-lg group"
                    title="تبديل الانطلاق والوجهة"
                  >
                    <ArrowUpDown className="w-5 h-5 text-primary group-hover:text-primary transition-transform duration-300" />
                  </button>
                )}

                {/* Dropoff Input - Hidden in pickup only mode */}
                {!isPickupOnlyMode && (
                  <div className="relative">
                    <div
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full z-10 border-2 border-background"
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                        boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)'
                      }}
                    />
                    <Input
                      ref={dropoffInputRef}
                      value={dropoffQuery || dropoff}
                      onChange={(e) => handleDropoffChange(e.target.value)}
                      onFocus={() => setActiveSearchField('dropoff')}
                      placeholder="إلى أين؟ (الوجهة)"
                      className={`pr-11 pl-12 h-12 text-sm rounded-xl bg-secondary/50 border-2 transition-all duration-300 ${activeSearchField === 'dropoff'
                          ? 'border-blue-500/50 ring-2 ring-blue-500/20'
                          : 'border-transparent hover:border-muted'
                        }`}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Search className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Current location quick button */}
              {!pickup && userLocation && (
                <Button
                  variant="ghost"
                  onClick={handleSetCurrentLocation}
                  disabled={isSettingCurrentLocation}
                  className="w-full h-12 gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all duration-300"
                >
                  {isSettingCurrentLocation ? (
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Target className="w-5 h-5" />
                  )}
                  <span className="font-medium">استخدم موقعي الحالي كنقطة انطلاق</span>
                </Button>
              )}
            </>
          )}

          {/* Search results or default content */}
          <div className="max-h-[50vh] overflow-y-auto space-y-1 scrollbar-thin">
            {showResults ? (
              renderSearchResults(activeSearchField)
            ) : (
              renderDefaultContent()
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default LocationBottomSheet;
