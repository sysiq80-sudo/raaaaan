/**
 * RideSetupScreen - شاشة إعداد الرحلة
 * يسمح للراكب بتحديد مواقع الانطلاق والوصول بطرق متعددة
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  MapPin,
  Star,
  Map,
  Edit3,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Home,
  Briefcase,
  Heart,
  Loader2,
  X,
  Search,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useRiderStore } from '@/stores/riderStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import MapLocationPicker from './MapLocationPicker';

// Types
interface Location {
  lat: number;
  lng: number;
  address: string;
  name?: string;
  inService?: boolean;
}

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  label: string;
  icon?: string;
}

interface RideSetupScreenProps {
  onConfirmRoute: (pickup: Location, dropoff: Location) => void;
  userId?: string | null;
}

type PickupOption = 'current' | 'saved' | 'map' | 'manual';
type DropoffOption = 'saved' | 'map' | 'manual';

const PICKUP_OPTIONS = [
  { id: 'current' as PickupOption, label: 'موقعي الحالي', icon: Navigation, color: 'from-emerald-500 to-green-600' },
  { id: 'saved' as PickupOption, label: 'الأماكن المحفوظة', icon: Star, color: 'from-amber-500 to-orange-500' },
  { id: 'map' as PickupOption, label: 'اختر من الخريطة', icon: Map, color: 'from-blue-500 to-indigo-600' },
  { id: 'manual' as PickupOption, label: 'أدخل العنوان يدوياً', icon: Edit3, color: 'from-purple-500 to-violet-600' },
];

const DROPOFF_OPTIONS = [
  { id: 'saved' as DropoffOption, label: 'الأماكن المحفوظة', icon: Star, color: 'from-amber-500 to-orange-500' },
  { id: 'map' as DropoffOption, label: 'اختر من الخريطة', icon: Map, color: 'from-blue-500 to-indigo-600' },
  { id: 'manual' as DropoffOption, label: 'أدخل العنوان يدوياً', icon: Edit3, color: 'from-purple-500 to-violet-600' },
];

const RideSetupScreen = ({ onConfirmRoute, userId }: RideSetupScreenProps) => {
  // State
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  
  // Sheets/Dialogs
  const [showSavedSheet, setShowSavedSheet] = useState(false);
  const [savedSheetType, setSavedSheetType] = useState<'pickup' | 'dropoff'>('pickup');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputType, setManualInputType] = useState<'pickup' | 'dropoff'>('pickup');
  const [manualAddress, setManualAddress] = useState('');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);
  
  // Map picker
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerType, setMapPickerType] = useState<'pickup' | 'dropoff'>('pickup');
  
  // User location for map
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  // Store
  const { setPickupLocation: setStorePickup, setDropoffLocation: setStoreDropoff } = useRiderStore();

  // Load saved places
  useEffect(() => {
    if (userId) {
      loadSavedPlaces();
    }
  }, [userId]);

  const loadSavedPlaces = async () => {
    if (!userId) return;
    
    setIsLoadingSaved(true);
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSavedPlaces(data?.map(place => ({
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        label: place.label || 'other',
        icon: place.icon
      })) || []);
    } catch (error) {
      console.error('Error loading saved places:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  // Get current location via GPS
  const handleCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('الموقع غير متاح في هذا المتصفح');
      return;
    }

    setIsLocatingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        // Reverse geocode
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${latitude}&lng=${longitude}`,
            {
              headers: {
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo`
              }
            }
          );
          const data = await response.json();
          
          const address = data.address || 'موقعك الحالي';
          const location: Location = {
            lat: latitude,
            lng: longitude,
            address,
            name: 'موقعي الحالي',
            inService: true
          };
          
          setPickupLocation(location);
          setStorePickup({ lat: latitude, lng: longitude, address });
          toast.success('تم تحديد موقعك بنجاح');
        } catch (error) {
          console.error('Reverse geocode error:', error);
          const location: Location = {
            lat: latitude,
            lng: longitude,
            address: 'موقعك الحالي',
            name: 'موقعي الحالي'
          };
          setPickupLocation(location);
        }

        setIsLocatingGPS(false);
      },
      (error) => {
        console.error('GPS Error:', error);
        toast.error('فشل في الحصول على الموقع');
        setIsLocatingGPS(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Open saved places sheet
  const handleOpenSaved = (type: 'pickup' | 'dropoff') => {
    setSavedSheetType(type);
    setShowSavedSheet(true);
  };

  // Select saved place
  const handleSelectSaved = (place: SavedPlace) => {
    const location: Location = {
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      name: place.name
    };

    if (savedSheetType === 'pickup') {
      setPickupLocation(location);
      setStorePickup({ lat: place.lat, lng: place.lng, address: place.address });
    } else {
      setDropoffLocation(location);
      setStoreDropoff({ lat: place.lat, lng: place.lng, address: place.address });
    }

    setShowSavedSheet(false);
    toast.success(`تم اختيار ${place.name}`);
  };

  // Open map picker
  const handleOpenMap = (type: 'pickup' | 'dropoff') => {
    setMapPickerType(type);
    setShowMapPicker(true);
  };

  // Confirm map selection
  const handleMapConfirm = (location: { lat: number; lng: number; address: string; inService?: boolean }) => {
    const loc: Location = {
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      inService: location.inService
    };

    if (mapPickerType === 'pickup') {
      setPickupLocation(loc);
      setStorePickup({ lat: location.lat, lng: location.lng, address: location.address });
    } else {
      setDropoffLocation(loc);
      setStoreDropoff({ lat: location.lat, lng: location.lng, address: location.address });
    }

    setShowMapPicker(false);
  };

  // Open manual input
  const handleOpenManual = (type: 'pickup' | 'dropoff') => {
    setManualInputType(type);
    setManualAddress('');
    setShowManualInput(true);
  };

  // Geocode manual address
  const handleManualSubmit = async () => {
    if (!manualAddress.trim()) {
      toast.error('يرجى إدخال العنوان');
      return;
    }

    setIsGeocodingManual(true);
    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/search-places?q=${encodeURIComponent(manualAddress)}&lat=33.4262&lng=43.2954&limit=1`,
        {
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo`
          }
        }
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const location: Location = {
          lat: result.lat,
          lng: result.lng,
          address: result.name,
          name: result.name
        };

        if (manualInputType === 'pickup') {
          setPickupLocation(location);
          setStorePickup({ lat: result.lat, lng: result.lng, address: result.name });
        } else {
          setDropoffLocation(location);
          setStoreDropoff({ lat: result.lat, lng: result.lng, address: result.name });
        }

        setShowManualInput(false);
        toast.success('تم تحديد الموقع');
      } else {
        toast.error('لم يتم العثور على الموقع');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('خطأ في البحث عن الموقع');
    } finally {
      setIsGeocodingManual(false);
    }
  };

  // Swap locations
  const handleSwapLocations = () => {
    if (pickupLocation && dropoffLocation) {
      const temp = pickupLocation;
      setPickupLocation(dropoffLocation);
      setDropoffLocation(temp);
      
      setStorePickup({ lat: dropoffLocation.lat, lng: dropoffLocation.lng, address: dropoffLocation.address });
      setStoreDropoff({ lat: temp.lat, lng: temp.lng, address: temp.address });
      
      toast.success('تم تبديل المواقع');
    }
  };

  // Clear location
  const handleClearLocation = (type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setPickupLocation(null);
      setStorePickup(null);
    } else {
      setDropoffLocation(null);
      setStoreDropoff(null);
    }
  };

  // Confirm route
  const handleConfirmRoute = () => {
    if (!pickupLocation) {
      toast.error('يرجى تحديد موقع الانطلاق');
      return;
    }
    if (!dropoffLocation) {
      toast.error('يرجى تحديد موقع الوصول');
      return;
    }

    onConfirmRoute(pickupLocation, dropoffLocation);
  };

  // Get icon for saved place label
  const getLabelIcon = (label: string) => {
    switch (label) {
      case 'home': return Home;
      case 'work': return Briefcase;
      case 'favorite': return Heart;
      default: return MapPin;
    }
  };

  const canConfirm = pickupLocation && dropoffLocation;

  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-4">
        <h1 className="text-xl font-bold text-center">إعداد الرحلة</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">حدد نقطة الانطلاق والوصول</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Section 1: Pickup Location */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold">موقع الانطلاق</h2>
          </div>

          {/* Selected Pickup Display */}
          <AnimatePresence mode="wait">
            {pickupLocation ? (
              <motion.div
                key="pickup-selected"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4"
              >
                <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {pickupLocation.name && (
                        <p className="font-semibold text-foreground">{pickupLocation.name}</p>
                      )}
                      <p className="text-sm text-muted-foreground truncate">{pickupLocation.address}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleClearLocation('pickup')}
                      className="shrink-0 h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Pickup Options Grid */}
          <div className="grid grid-cols-2 gap-3">
            {PICKUP_OPTIONS.map((option, index) => {
              const Icon = option.icon;
              const isActive = option.id === 'current' && isLocatingGPS;
              
              return (
                <motion.button
                  key={option.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                    if (option.id === 'current') handleCurrentLocation();
                    else if (option.id === 'saved') handleOpenSaved('pickup');
                    else if (option.id === 'map') handleOpenMap('pickup');
                    else if (option.id === 'manual') handleOpenManual('pickup');
                  }}
                  disabled={isActive}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    pickupLocation && option.id === 'current' && pickupLocation.name === 'موقعي الحالي'
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                    option.color
                  )}>
                    {isActive ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Icon className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground text-center">
                    {option.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Swap Button */}
        <AnimatePresence>
          {pickupLocation && dropoffLocation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex justify-center"
            >
              <Button
                variant="outline"
                onClick={handleSwapLocations}
                className="rounded-full px-6 gap-2 border-dashed"
              >
                <ArrowLeftRight className="w-4 h-4" />
                تبديل المواقع
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 2: Dropoff Location */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold">موقع الوصول</h2>
          </div>

          {/* Selected Dropoff Display */}
          <AnimatePresence mode="wait">
            {dropoffLocation ? (
              <motion.div
                key="dropoff-selected"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4"
              >
                <Card className="p-4 border-blue-500/30 bg-blue-500/5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {dropoffLocation.name && (
                        <p className="font-semibold text-foreground">{dropoffLocation.name}</p>
                      )}
                      <p className="text-sm text-muted-foreground truncate">{dropoffLocation.address}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleClearLocation('dropoff')}
                      className="shrink-0 h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Dropoff Options Grid */}
          <div className="grid grid-cols-3 gap-3">
            {DROPOFF_OPTIONS.map((option, index) => {
              const Icon = option.icon;
              
              return (
                <motion.button
                  key={option.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.4 }}
                  onClick={() => {
                    if (option.id === 'saved') handleOpenSaved('dropoff');
                    else if (option.id === 'map') handleOpenMap('dropoff');
                    else if (option.id === 'manual') handleOpenManual('dropoff');
                  }}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    "border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                    option.color
                  )}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground text-center">
                    {option.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Route Summary Card */}
        <AnimatePresence>
          {(pickupLocation || dropoffLocation) && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  ملخص المسار
                </h3>
                
                <div className="space-y-3">
                  {/* Pickup */}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      pickupLocation ? "bg-emerald-500" : "bg-muted"
                    )}>
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">الانطلاق</p>
                      <p className={cn(
                        "text-sm truncate",
                        pickupLocation ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {pickupLocation?.address || 'لم يتم التحديد'}
                      </p>
                    </div>
                  </div>

                  {/* Connector Line */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex justify-center">
                      <div className="w-0.5 h-6 bg-border" />
                    </div>
                  </div>

                  {/* Dropoff */}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      dropoffLocation ? "bg-blue-500" : "bg-muted"
                    )}>
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">الوصول</p>
                      <p className={cn(
                        "text-sm truncate",
                        dropoffLocation ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {dropoffLocation?.address || 'لم يتم التحديد'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/50">
        <Button
          onClick={handleConfirmRoute}
          disabled={!canConfirm}
          className={cn(
            "w-full h-14 text-lg font-bold rounded-2xl transition-all duration-300",
            canConfirm
              ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
              : "bg-muted text-muted-foreground"
          )}
        >
          {canConfirm ? (
            <>
              تأكيد المسار
              <ChevronRight className="w-5 h-5 mr-2" />
            </>
          ) : (
            'حدد موقعي الانطلاق والوصول'
          )}
        </Button>
      </div>

      {/* Saved Places Sheet */}
      <Sheet open={showSavedSheet} onOpenChange={setShowSavedSheet}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
          <SheetHeader className="pb-4 border-b border-border/50">
            <SheetTitle className="text-center">
              {savedSheetType === 'pickup' ? 'اختر موقع الانطلاق' : 'اختر موقع الوصول'}
            </SheetTitle>
          </SheetHeader>
          
          <div className="py-4 overflow-y-auto max-h-[calc(70vh-100px)]">
            {isLoadingSaved ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : savedPlaces.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">لا توجد أماكن محفوظة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedPlaces.map((place) => {
                  const Icon = getLabelIcon(place.label);
                  return (
                    <motion.button
                      key={place.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSelectSaved(place)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 text-right min-w-0">
                        <p className="font-semibold text-foreground">{place.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{place.address}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Input Sheet */}
      <Sheet open={showManualInput} onOpenChange={setShowManualInput}>
        <SheetContent side="bottom" className="h-auto rounded-t-3xl">
          <SheetHeader className="pb-4 border-b border-border/50">
            <SheetTitle className="text-center">
              {manualInputType === 'pickup' ? 'أدخل عنوان الانطلاق' : 'أدخل عنوان الوصول'}
            </SheetTitle>
          </SheetHeader>
          
          <div className="py-6 space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="ابحث عن عنوان أو اسم مكان..."
                className="pr-10 h-12 text-base rounded-xl"
                dir="rtl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualSubmit();
                }}
              />
            </div>
            
            <Button
              onClick={handleManualSubmit}
              disabled={!manualAddress.trim() || isGeocodingManual}
              className="w-full h-12 rounded-xl"
            >
              {isGeocodingManual ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'تأكيد العنوان'
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Map Location Picker */}
      <MapLocationPicker
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        type={mapPickerType}
        onConfirm={handleMapConfirm}
        userLocation={userLocation}
      />
    </div>
  );
};

export default RideSetupScreen;
