import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Loader2, Building2, Map, Search, X, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'landmark' | 'region' | 'address';
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

interface LocationSearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: { lat: number; lng: number; address: string; inService?: boolean }) => void;
  onFocus?: () => void;
  type: 'pickup' | 'dropoff';
  userLocation?: { lat: number; lng: number } | null;
  className?: string;
}

export interface LocationSearchInputRef {
  focus: () => void;
  clear: () => void;
}

const LocationSearchInput = forwardRef<LocationSearchInputRef, LocationSearchInputProps>(({
  placeholder,
  value,
  onChange,
  onLocationSelect,
  onFocus,
  type,
  userLocation,
  className = ''
}, ref) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [nearestServiceRegion, setNearestServiceRegion] = useState<{ name: string; distance_km: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      setQuery('');
      onChange('');
      setResults([]);
    },
  }));

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        limit: '10'
      });
      
      if (userLocation) {
        params.append('lng', userLocation.lng.toString());
        params.append('lat', userLocation.lat.toString());
      }

      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/search-places?${params}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const data = await response.json();
      setResults(data.results || []);
      setNearestServiceRegion(data.nearest_service_region || null);
    } catch (error) {
      console.error('Search error:', error);
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
      inService: result.in_service
    });
    setShowResults(false);
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
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const address = data.features[0].place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setQuery(address);
        onChange(address);
        
        // Check service area
        const serviceCheck = await checkServiceArea(lat, lng);
        onLocationSelect({ lat, lng, address, inService: serviceCheck?.in_service });
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
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
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/check-service-area?lat=${lat}&lng=${lng}`
      );
      return await response.json();
    } catch {
      return null;
    }
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setResults([]);
    inputRef.current?.focus();
  };

  const getTypeIcon = (resultType: string) => {
    switch (resultType) {
      case 'landmark':
        return <Building2 className="w-4 h-4 text-primary" />;
      case 'region':
        return <Map className="w-4 h-4 text-secondary-foreground" />;
      default:
        return <MapPin className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${
          type === 'pickup' ? 'bg-primary' : 'bg-destructive'
        }`} />
        
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
          className="pr-10 pl-20"
          autoComplete="off"
        />

        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading ? (
            <div className="p-1.5">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : null}
          
          {type === 'pickup' && userLocation && (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              title="استخدم موقعي الحالي"
            >
              <Navigation className="w-4 h-4 text-primary" />
            </button>
          )}
        </div>
      </div>

      {showResults && isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
          {type === 'pickup' && userLocation && !query && (
            <button
              onClick={handleUseCurrentLocation}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-right border-b border-border"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">موقعي الحالي</p>
                <p className="text-xs text-muted-foreground">استخدم GPS</p>
              </div>
            </button>
          )}

          {!query && results.length === 0 && (
            <div className="px-4 py-6 text-center">
              <Search className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">ابحث عن موقع، منطقة، أو معلم</p>
            </div>
          )}

          {isLoading && query && (
            <div className="px-4 py-6 text-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">جاري البحث...</p>
            </div>
          )}

          {!isLoading && results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectResult(result)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-right border-b border-border/50 last:border-0 ${
                result.in_service === false ? 'opacity-70' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                result.type === 'landmark' 
                  ? 'bg-primary/10' 
                  : result.type === 'region' 
                    ? 'bg-secondary' 
                    : 'bg-muted'
              }`}>
                <span className="text-lg">{result.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{result.name}</p>
                  {result.in_service !== undefined && (
                    result.in_service ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`px-1.5 py-0.5 rounded ${
                    result.type === 'landmark' 
                      ? 'bg-primary/10 text-primary' 
                      : result.type === 'region' 
                        ? 'bg-secondary text-secondary-foreground' 
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {result.category}
                  </span>
                  {result.distance_km !== undefined && (
                    <span>{result.distance_km} كم</span>
                  )}
                  {result.in_service === false && (
                    <span className="text-amber-500">خارج الخدمة</span>
                  )}
                  {result.in_service && result.region_name && (
                    <span className="text-primary">{result.region_name}</span>
                  )}
                </div>
              </div>
              {getTypeIcon(result.type)}
            </button>
          ))}

          {/* Warning for out-of-service results */}
          {!isLoading && results.length > 0 && results.every(r => r.in_service === false) && nearestServiceRegion && (
            <div className="px-4 py-3 bg-amber-500/10 border-t border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">جميع النتائج خارج منطقة الخدمة</p>
                  <p className="text-xs">
                    أقرب منطقة خدمة: {nearestServiceRegion.name} ({nearestServiceRegion.distance_km} كم)
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isLoading && query && results.length === 0 && (
            <div className="px-4 py-6 text-center">
              <MapPin className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لم يتم العثور على نتائج</p>
              <p className="text-xs text-muted-foreground mt-1">حاول البحث بكلمات أخرى</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

LocationSearchInput.displayName = 'LocationSearchInput';

export default LocationSearchInput;
