import React, { useRef, useEffect, useState } from 'react';
import { MapPin, Navigation, X, Search, Clock, Star, Building2, Map as MapIcon, Target, Sparkles, CircleDot, ArrowUpDown, Crosshair, MapPinned, Home, Briefcase, Heart, History } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SavedPlaces from './SavedPlaces';
import PopularPlaces from './PopularPlaces';
import PredictiveDestinations from './PredictiveDestinations';
import { supabase } from '@/integrations/supabase/client';
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
interface LocationBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeField: 'pickup' | 'dropoff' | 'pickup_only' | null;
  pickup: string;
  dropoff: string;
  onPickupChange: (value: string) => void;
  onDropoffChange: (value: string) => void;
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
  }, type: 'pickup' | 'dropoff') => void;
  onOpenMapPicker: (type: 'pickup' | 'dropoff') => void;
  onSwapLocations?: () => void;
  userLocation?: {
    lat: number;
    lng: number;
  } | null;
  pickupCoords?: {
    lat: number;
    lng: number;
  } | null;
  dropoffCoords?: {
    lat: number;
    lng: number;
  } | null;
  userId?: string | null;
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
  dropoffCoords,
  userId
}) => {
  const [activeSearchField, setActiveSearchField] = useState<'pickup' | 'dropoff'>('dropoff');
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentLocations, setRecentLocations] = useState<SearchResult[]>([]);
  const [isSettingCurrentLocation, setIsSettingCurrentLocation] = useState(false);
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
  useEffect(() => {
    // Load recent locations from localStorage
    const saved = localStorage.getItem('recent_locations');
    if (saved) {
      try {
        setRecentLocations(JSON.parse(saved).slice(0, 5));
      } catch {}
    }
  }, []);
  const searchPlaces = async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '10'
      });
      if (userLocation) {
        params.append('lng', userLocation.lng.toString());
        params.append('lat', userLocation.lat.toString());
      }
      const response = await fetch(`https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/search-places?${params}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setResults(data.results || []);
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
  const handleSelectResult = (result: SearchResult, type: 'pickup' | 'dropoff') => {
    const address = result.name;

    // Save to recent locations
    const updated = [result, ...recentLocations.filter(r => r.id !== result.id)].slice(0, 5);
    setRecentLocations(updated);
    localStorage.setItem('recent_locations', JSON.stringify(updated));
    onLocationSelect({
      lat: result.lat,
      lng: result.lng,
      address,
      inService: result.in_service
    }, type);
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
      // Reverse geocode the current location
      const {
        data,
        error
      } = await supabase.functions.invoke('mapbox-proxy', {
        body: {
          action: 'reverse-geocode',
          lat: userLocation.lat,
          lng: userLocation.lng
        }
      });
      const address = data?.address || 'موقعي الحالي';
      onLocationSelect({
        lat: userLocation.lat,
        lng: userLocation.lng,
        address,
        inService: true
      }, 'pickup');

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
      onLocationSelect({
        lat: userLocation.lat,
        lng: userLocation.lng,
        address: 'موقعي الحالي',
        inService: true
      }, 'pickup');
      if (isPickupOnlyMode) {
        onClose();
      }
    } finally {
      setIsSettingCurrentLocation(false);
    }
  };
  const renderSearchResults = (forField: 'pickup' | 'dropoff') => {
    if (isLoading) {
      return <div className="py-8 text-center">
          <div className="w-10 h-10 rounded-full mx-auto mb-3 animate-spin" style={{
          background: 'conic-gradient(from 0deg, transparent, hsl(var(--primary)))',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))'
        }} />
          <p className="text-sm text-muted-foreground">جاري البحث...</p>
        </div>;
    }
    if (results.length > 0) {
      return <>
          <p className="text-xs text-muted-foreground px-1 flex items-center gap-2 mb-2">
            <Search className="w-3 h-3" />
            نتائج البحث
          </p>
          {results.map(result => <button key={result.id} onClick={() => handleSelectResult(result, forField)} className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/80 transition-all duration-200 text-right group ${result.in_service === false ? 'opacity-50' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${result.type === 'landmark' ? 'bg-gradient-to-br from-primary/20 to-primary/5' : result.type === 'region' ? 'bg-gradient-to-br from-secondary to-secondary/50' : 'bg-muted'}`}>
                <span className="text-lg">{result.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate group-hover:text-primary transition-colors text-sm">{result.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${result.type === 'landmark' ? 'bg-primary/10 text-primary' : result.type === 'region' ? 'bg-secondary text-secondary-foreground' : 'bg-muted'}`}>
                    {result.category}
                  </span>
                  {result.distance_km && <span>{result.distance_km} كم</span>}
                  {result.in_service === false && <span className="text-amber-500">خارج الخدمة</span>}
                </div>
              </div>
            </button>)}
        </>;
    }
    return null;
  };

  // Render pickup-only content - Full screen layout
  const renderPickupOnlyContent = () => {
    return <div className="flex flex-col h-full">
        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-3 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold">اختر موقع الانطلاق</h2>
          
        </div>

        {/* Single line: GPS + Search + Map */}
        <div className="flex items-center gap-3 mb-6">
          {/* GPS Button */}
          <button onClick={handleSetCurrentLocation} disabled={!userLocation || isSettingCurrentLocation} className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 transition-transform disabled:opacity-50">
            {isSettingCurrentLocation ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Crosshair className="w-6 h-6 text-white" />}
          </button>

          {/* Search Input */}
          <div className="flex-1 relative">
            <Input ref={pickupInputRef} value={pickupQuery} onChange={e => handlePickupChange(e.target.value)} placeholder="ابحث عن موقع الانطلاق..." className="h-14 pr-12 pl-4 rounded-2xl border-2 border-border/50 bg-secondary/30 focus:bg-background focus:border-primary/50 text-right text-base" />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          </div>

          {/* Map Picker Button */}
          <button onClick={() => onOpenMapPicker('pickup')} className="flex-shrink-0 w-14 h-14 rounded-2xl bg-secondary/50 border-2 border-border/50 flex items-center justify-center hover:bg-secondary/80 hover:border-primary/30 transition-all">
            <MapPinned className="w-6 h-6 text-primary" />
          </button>
        </div>

        {/* Search Results */}
        {results.length > 0 && <div className="mb-4">
            {renderSearchResults('pickup')}
          </div>}

        {/* Saved Places Section */}
        {userId && results.length === 0 && <div className="mb-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Heart className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">الأماكن المحفوظة</span>
            </div>
            <SavedPlaces userId={userId} onSelect={place => {
          onLocationSelect({
            lat: place.lat,
            lng: place.lng,
            address: place.address,
            inService: true
          }, 'pickup');
          onClose();
        }} showAddButton={false} />
          </div>}

        {/* Recent Locations Section */}
        {recentLocations.length > 0 && results.length === 0 && <div className="flex-1">
            <div className="flex items-center gap-2 mb-3 px-1">
              <History className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">استخدمتها مؤخراً</span>
            </div>
            <div className="space-y-2">
              {recentLocations.slice(0, 5).map(location => <button key={location.id} onClick={() => handleSelectResult(location, 'pickup')} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/60 transition-all duration-200 text-right group">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">{location.name}</p>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{location.category}</p>
                  </div>
                </button>)}
            </div>
          </div>}

        {/* Empty State */}
        {recentLocations.length === 0 && !userId && results.length === 0 && <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent mx-auto mb-4 flex items-center justify-center">
                <Navigation className="w-10 h-10 text-primary/30" />
              </div>
              <p className="text-muted-foreground">ابحث عن موقع أو استخدم موقعك الحالي</p>
            </div>
          </div>}
      </div>;
  };
  const renderDefaultContent = () => {
    // If in pickup-only mode, show the premium pickup interface
    if (isPickupOnlyMode) {
      return renderPickupOnlyContent();
    }
    return <>
        {/* Predictive Destinations - Smart suggestions */}
        {userId && userLocation && activeSearchField === 'dropoff' && <div className="mb-4">
            <PredictiveDestinations userId={userId} currentLocation={userLocation} onPlaceSelect={place => {
          onLocationSelect({
            lat: place.location.lat,
            lng: place.location.lng,
            address: place.address,
            inService: true
          }, 'dropoff');
        }} className="py-0" />
          </div>}

        {/* Popular Places - Nearby landmarks */}
        {userLocation && activeSearchField === 'dropoff' && <div className="mb-4">
            <PopularPlaces currentLocation={userLocation} onPlaceSelect={place => {
          onLocationSelect({
            lat: place.location.lat,
            lng: place.location.lng,
            address: place.address,
            inService: true
          }, 'dropoff');
        }} maxDistance={20} maxPlaces={5} />
          </div>}

        {/* Saved places */}
        {userId && <SavedPlaces userId={userId} onSelect={place => {
        onLocationSelect({
          lat: place.lat,
          lng: place.lng,
          address: place.address,
          inService: true
        }, activeSearchField);
        if (activeSearchField === 'pickup') {
          setTimeout(() => {
            dropoffInputRef.current?.focus();
            setActiveSearchField('dropoff');
          }, 100);
        }
      }} showAddButton={false} />}

        {/* Recent locations */}
        {recentLocations.length > 0 && <>
            <p className="text-xs text-muted-foreground px-1 flex items-center gap-2 mt-3">
              <Clock className="w-3 h-3" /> الأماكن الأخيرة
            </p>
            {recentLocations.map(location => <button key={location.id} onClick={() => handleSelectResult(location, activeSearchField)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/80 transition-all duration-200 text-right group">
                <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center group-hover:bg-secondary transition-colors">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors text-sm">{location.name}</p>
                  <p className="text-xs text-muted-foreground">{location.category}</p>
                </div>
              </button>)}
          </>}

        {/* Hint */}
        {recentLocations.length === 0 && !userId && <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent mx-auto mb-3 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary/30" />
            </div>
            <p className="text-sm text-muted-foreground">ابحث عن موقع، معلم، أو منطقة</p>
          </div>}
      </>;
  };
  const hasPickupQuery = pickupQuery.length >= 2;
  const hasDropoffQuery = dropoffQuery.length >= 2;
  const showResults = activeSearchField === 'pickup' && hasPickupQuery || activeSearchField === 'dropoff' && hasDropoffQuery;
  return <Drawer open={isOpen} onOpenChange={open => !open && onClose()}>
      <DrawerContent className={`${isPickupOnlyMode ? 'h-[100dvh] max-h-[100dvh]' : 'max-h-[90vh]'} bg-gradient-to-b from-card to-background border-t-2 border-primary/20`}>
        {/* Header */}
        <DrawerHeader className="pb-3 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between relative">
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/80 transition-all duration-200 active:scale-95">
              <X className="w-5 h-5" />
            </button>
            <DrawerTitle className="text-lg font-bold">
              اختر موقع الانطلاق
            </DrawerTitle>
            <div className="w-9" />
          </div>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* In pickup_only mode, skip the input fields and show premium options directly */}
          {!isPickupOnlyMode && <>
              {/* Location inputs with connected line */}
              <div className="relative">
                {/* Vertical connecting line */}
                <div className="absolute right-[26px] top-[44px] w-0.5 h-[calc(100%-88px)] bg-gradient-to-b from-emerald-500 via-muted to-blue-500" />

                {/* Pickup Input */}
                <div className="relative mb-3">
                  {/* Green indicator */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full z-10 border-2 border-background" style={{
                background: 'linear-gradient(135deg, #10b981, #34d399)',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.5)'
              }} />
                  <Input ref={pickupInputRef} value={pickupQuery || pickup} onChange={e => handlePickupChange(e.target.value)} onFocus={() => setActiveSearchField('pickup')} placeholder="من أين؟ (موقع الانطلاق)" className={`pr-11 pl-12 h-12 text-sm rounded-xl bg-secondary/50 border-2 transition-all duration-300 ${activeSearchField === 'pickup' ? 'border-emerald-500/50 ring-2 ring-emerald-500/20' : 'border-transparent hover:border-muted'}`} />
                  {/* Current location button */}
                  <button onClick={handleSetCurrentLocation} disabled={!userLocation || isSettingCurrentLocation} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50" title="استخدم موقعي الحالي">
                    {isSettingCurrentLocation ? <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Target className="w-5 h-5 text-emerald-500" />}
                  </button>
                </div>

                {/* Swap Button with Animation */}
                {onSwapLocations && (pickup || dropoff) && <button onClick={e => {
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
            }} className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-card border-2 border-primary/40 flex items-center justify-center hover:bg-primary/10 hover:border-primary hover:shadow-[0_0_20px_rgba(var(--primary)/0.4)] transition-all duration-300 active:scale-90 shadow-lg group" title="تبديل الانطلاق والوجهة">
                    <ArrowUpDown className="w-5 h-5 text-primary group-hover:text-primary transition-transform duration-300" />
                  </button>}

                {/* Dropoff Input - Hidden in pickup only mode */}
                {!isPickupOnlyMode && <div className="relative">
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full z-10 border-2 border-background" style={{
                background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)'
              }} />
                    <Input ref={dropoffInputRef} value={dropoffQuery || dropoff} onChange={e => handleDropoffChange(e.target.value)} onFocus={() => setActiveSearchField('dropoff')} placeholder="إلى أين؟ (الوجهة)" className={`pr-11 pl-12 h-12 text-sm rounded-xl bg-secondary/50 border-2 transition-all duration-300 ${activeSearchField === 'dropoff' ? 'border-blue-500/50 ring-2 ring-blue-500/20' : 'border-transparent hover:border-muted'}`} />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Search className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>}
              </div>

              {/* Quick actions - Choose from map */}
              <div className="flex gap-2">
                {(!pickupCoords || activeField === 'pickup') && <Button variant="outline" onClick={() => onOpenMapPicker('pickup')} className="flex-1 h-11 gap-2 rounded-xl border border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-300 text-xs">
                    <MapIcon className="w-4 h-4 text-emerald-500" />
                    <span>اختر الانطلاق من الخريطة</span>
                  </Button>}
                {!isPickupOnlyMode && <Button variant="outline" onClick={() => onOpenMapPicker('dropoff')} className="flex-1 h-11 gap-2 rounded-xl border border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-300 text-xs">
                    <MapIcon className="w-4 h-4 text-blue-500" />
                    <span>اختر الوجهة من الخريطة</span>
                  </Button>}
              </div>

              {/* Current location quick button */}
              {!pickup && userLocation && <Button variant="ghost" onClick={handleSetCurrentLocation} disabled={isSettingCurrentLocation} className="w-full h-12 gap-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all duration-300">
                  {isSettingCurrentLocation ? <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <Target className="w-5 h-5" />}
                  <span className="font-medium">استخدم موقعي الحالي كنقطة انطلاق</span>
                </Button>}
            </>}

          {/* Search results or default content */}
          <div className="max-h-[50vh] overflow-y-auto space-y-1 scrollbar-thin">
            {showResults ? renderSearchResults(activeSearchField) : renderDefaultContent()}
          </div>
        </div>
      </DrawerContent>
    </Drawer>;
};
export default LocationBottomSheet;