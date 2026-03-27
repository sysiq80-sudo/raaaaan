import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Clock, Star, Building2, Loader2, ChevronDown, Home, Briefcase, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { SavedPlace } from './SavedPlaces';

interface SearchResult {
  id: string;
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

interface DirectSearchInputProps {
  userId: string | null;
  userLocation: { lat: number; lng: number } | null;
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  placeholder?: string;
}

const DirectSearchInput: React.FC<DirectSearchInputProps> = ({
  userId,
  userLocation,
  onLocationSelect,
  placeholder = "إلى أين؟ ابحث عن مكان..."
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentLocations, setRecentLocations] = useState<SearchResult[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved places
  useEffect(() => {
    if (userId) {
      fetchSavedPlaces();
    }
    // Load recent locations
    const saved = localStorage.getItem('recent_locations');
    if (saved) {
      try {
        setRecentLocations(JSON.parse(saved).slice(0, 5));
      } catch {}
    }
  }, [userId]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setShowSavedDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSavedPlaces = async () => {
    if (!userId) return;
    setLoadingSaved(true);
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSavedPlaces(data || []);
    } catch (error) {
      console.error('Error fetching saved places:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const searchPlaces = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q: searchQuery, limit: '8' });
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
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setShowSavedDropdown(false);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 250);
  };

  const handleSelectResult = (result: SearchResult) => {
    // Save to recent locations
    const updated = [result, ...recentLocations.filter(r => r.id !== result.id)].slice(0, 5);
    setRecentLocations(updated);
    localStorage.setItem('recent_locations', JSON.stringify(updated));

    onLocationSelect({ lat: result.lat, lng: result.lng, address: result.name });
    setQuery('');
    setResults([]);
    setIsFocused(false);
  };

  const handleSelectSavedPlace = (place: SavedPlace) => {
    onLocationSelect({ lat: place.lat, lng: place.lng, address: place.address });
    setShowSavedDropdown(false);
    setQuery('');
  };

  const getIconForLabel = (label: string) => {
    switch (label) {
      case 'home': return <Home className="w-4 h-4" />;
      case 'work': return <Briefcase className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const getColorForLabel = (label: string) => {
    switch (label) {
      case 'home': return 'bg-blue-500/20 text-blue-500';
      case 'work': return 'bg-amber-500/20 text-amber-500';
      default: return 'bg-primary/20 text-primary';
    }
  };

  const showResults = query.length >= 2 && (results.length > 0 || isLoading);
  const showRecentOnFocus = isFocused && query.length < 2 && recentLocations.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Main search input */}
      <div className="relative">
        <div 
          className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full z-10"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)'
          }}
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className={`pr-11 pl-12 h-14 text-base rounded-2xl bg-card border-2 transition-all duration-300 ${
            isFocused 
              ? 'border-blue-500/50 ring-2 ring-blue-500/20 shadow-lg' 
              : 'border-border/50 hover:border-border'
          }`}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          ) : query.length > 0 ? (
            <button 
              onClick={() => { setQuery(''); setResults([]); }}
              className="p-1 hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <Search className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Saved places button */}
      {savedPlaces.length > 0 && (
        <button
          onClick={() => {
            setShowSavedDropdown(!showSavedDropdown);
            setIsFocused(false);
          }}
          className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/50 transition-all duration-200 text-sm"
        >
          <Star className="w-4 h-4 text-primary" />
          <span className="font-medium">الأماكن المحفوظة</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showSavedDropdown ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Search results dropdown */}
      {showResults && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="max-h-80 overflow-y-auto p-2">
            {isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">جاري البحث...</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground px-3 py-2 flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  نتائج البحث
                </p>
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/80 transition-all duration-200 text-right group ${
                      result.in_service === false ? 'opacity-50' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${
                      result.type === 'landmark' ? 'bg-gradient-to-br from-primary/20 to-primary/5' : 
                      result.type === 'region' ? 'bg-gradient-to-br from-secondary to-secondary/50' : 'bg-muted'
                    }`}>
                      <span className="text-lg">{result.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:text-primary transition-colors text-sm">{result.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                          result.type === 'landmark' ? 'bg-primary/10 text-primary' :
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
            )}
          </div>
        </div>
      )}

      {/* Recent locations dropdown (when focused but no query) */}
      {showRecentOnFocus && !showSavedDropdown && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="max-h-80 overflow-y-auto p-2">
            <p className="text-xs text-muted-foreground px-3 py-2 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              الأماكن الأخيرة
            </p>
            {recentLocations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleSelectResult(location)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/80 transition-all duration-200 text-right group"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center group-hover:bg-secondary transition-colors">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors text-sm">{location.name}</p>
                  <p className="text-xs text-muted-foreground">{location.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved places dropdown */}
      {showSavedDropdown && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="max-h-80 overflow-y-auto p-2">
            {loadingSaved ? (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">جاري التحميل...</p>
              </div>
            ) : savedPlaces.length === 0 ? (
              <div className="py-8 text-center">
                <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد أماكن محفوظة</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground px-3 py-2 flex items-center gap-2">
                  <Star className="w-3 h-3" />
                  الأماكن المحفوظة
                </p>
                {savedPlaces.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => handleSelectSavedPlace(place)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/80 transition-all duration-200 text-right group"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getColorForLabel(place.label)}`}>
                      {getIconForLabel(place.label)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:text-primary transition-colors">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectSearchInput;
