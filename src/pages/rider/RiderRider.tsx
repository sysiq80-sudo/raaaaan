import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, Navigation, Clock, Wallet, ChevronDown, Home, 
  Search, Star, History, Plus, X, Calendar, Users, MapPinned,
  Briefcase, Building2, ShoppingBag, Coffee, Hospital, School,
  Target, Locate, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import LazyMap from "@/components/LazyMap";
import RiderBottomNav from "@/components/rider/RiderBottomNav";

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  location: Location;
  icon: string;
  type: 'home' | 'work' | 'favorite';
}

interface RecentDestination {
  address: string;
  location: Location;
  timestamp: Date;
}

export default function RiderRider() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State Management
  const [session, setSession] = useState<Session | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<Location[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("economy");
  const [selectedPayment, setSelectedPayment] = useState<string>("cash");
  const [estimatedFare, setEstimatedFare] = useState<number>(0);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // UI State
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<'pickup' | 'dropoff' | 'stop'>('pickup');
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{center: [number, number], place_name: string, place_name_ar?: string, text: string}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerLocation, setMapPickerLocation] = useState<Location | null>(null);
  const [activeStep, setActiveStep] = useState<'location' | 'vehicle' | 'confirm'>('location');
  const [pickupSearchQuery, setPickupSearchQuery] = useState("");
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [dropoffSearchQuery, setDropoffSearchQuery] = useState("");
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  // Mock saved places
  const [savedPlaces] = useState<SavedPlace[]>([
    {
      id: '1',
      name: 'المنزل',
      address: 'شارع الكرادة، بغداد',
      location: { lat: 33.3157, lng: 44.3661 },
      icon: '🏠',
      type: 'home'
    },
    {
      id: '2',
      name: 'العمل',
      address: 'منطقة المنصور، بغداد',
      location: { lat: 33.3128, lng: 44.3615 },
      icon: '💼',
      type: 'work'
    },
  ]);

  // Mock recent destinations
  const [recentDestinations] = useState<RecentDestination[]>([
    {
      address: 'مركز المدينة التجاري',
      location: { lat: 33.3152, lng: 44.3661 },
      timestamp: new Date()
    },
    {
      address: 'مطار بغداد الدولي',
      location: { lat: 33.2625, lng: 44.2347 },
      timestamp: new Date()
    },
  ]);

  // Popular destinations
  const popularDestinations = [
    { name: 'مطار بغداد', icon: '✈️', location: { lat: 33.2625, lng: 44.2347, address: 'مطار بغداد الدولي' }},
    { name: 'المنطقة الخضراء', icon: '🏛️', location: { lat: 33.3061, lng: 44.3872, address: 'المنطقة الخضراء' }},
    { name: 'شارع المتنبي', icon: '📚', location: { lat: 33.3406, lng: 44.4009, address: 'شارع المتنبي' }},
    { name: 'مول بغداد', icon: '🛍️', location: { lat: 33.2882, lng: 44.3661, address: 'مول بغداد' }},
  ];

  // Get session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: "موقعي الحالي"
          };
          setUserLocation(location);
          if (!pickupLocation) {
            setPickupLocation(location);
          }
        },
        (error) => console.error("Error getting location:", error),
        { enableHighAccuracy: true }
      );
    }
  }, [pickupLocation]);

  // Calculate route when locations change
  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      calculateRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupLocation, dropoffLocation, intermediateStops]);

  // Search for locations using Mapbox Geocoding
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&country=IQ&language=ar&proximity=${userLocation?.lng},${userLocation?.lat}&limit=5`
        );
        const data = await response.json();
        setSearchResults(data.features || []);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, userLocation]);

  const calculateRoute = async () => {
    if (!pickupLocation || !dropoffLocation) return;

    try {
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      
      // Build waypoints including intermediate stops
      const allWaypoints = [
        `${pickupLocation.lng},${pickupLocation.lat}`,
        ...intermediateStops.map(stop => `${stop.lng},${stop.lat}`),
        `${dropoffLocation.lng},${dropoffLocation.lat}`
      ];
      
      const waypoints = allWaypoints.join(';');

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&access_token=${mapboxToken}`
      );

      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;
        
        setRouteDistance(distanceKm);
        setRouteDuration(durationMin);
        
        // Enhanced fare calculation
        const baseFare = 2000;
        const perKmRate = 500;
        const stopFee = intermediateStops.length * 500; // 500 per stop
        const vehicleMultiplier = vehicleTypes.find(v => v.id === selectedVehicle)?.price || 1;
        
        const calculatedFare = (baseFare + (distanceKm * perKmRate) + stopFee) * vehicleMultiplier;
        setEstimatedFare(Math.round(calculatedFare));
      }
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  };

  const handleSelectLocation = (location: Location, mode: 'pickup' | 'dropoff' | 'stop') => {
    if (mode === 'pickup') {
      setPickupLocation(location);
      setActiveStep('location');
      toast({
        title: "✓ تم تحديد موقع الانطلاق",
        description: location.address,
      });
    } else if (mode === 'dropoff') {
      setDropoffLocation(location);
      if (pickupLocation) {
        setActiveStep('vehicle');
        setTimeout(() => {
          toast({
            title: "✅ تم تحديد الموقعين",
            description: "اختر نوع المركبة المناسب",
          });
        }, 300);
      }
      toast({
        title: "✓ تم تحديد الوجهة",
        description: location.address,
      });
    } else {
      setIntermediateStops([...intermediateStops, location]);
      toast({
        title: "✓ تمت إضافة محطة",
        description: location.address,
      });
    }
    setShowLocationSearch(false);
    setShowMapPicker(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSearchResultClick = (result: {center: [number, number], place_name: string, place_name_ar?: string}) => {
    const location: Location = {
      lat: result.center[1],
      lng: result.center[0],
      address: result.place_name_ar || result.place_name
    };
    handleSelectLocation(location, searchMode);
  };

  const openLocationSearch = (mode: 'pickup' | 'dropoff' | 'stop') => {
    setSearchMode(mode);
    setShowLocationSearch(true);
    setSearchQuery("");
  };

  const handleGPSPickup = async () => {
    setIsLoadingGPS(true);
    if (userLocation) {
      setPickupLocation(userLocation);
      setPickupSearchQuery(userLocation.address || "الموقع الحالي");
      setActiveStep('location');
      setShowPickupSuggestions(false);
      toast({
        title: "✓ تم تحديد موقعك الحالي",
        description: userLocation.address || "موقعي الحالي",
      });
      setIsLoadingGPS(false);
    } else {
      // Try to get location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: "الموقع الحالي"
            };
            setUserLocation(location);
            setPickupLocation(location);
            setPickupSearchQuery("الموقع الحالي");
            setShowPickupSuggestions(false);
            toast({
              title: "✓ تم تحديد موقعك",
              description: "الموقع الحالي",
            });
            setIsLoadingGPS(false);
          },
          (error) => {
            console.error("GPS error:", error);
            toast({
              title: "خطأ في GPS",
              description: "يرجى تفعيل خدمات الموقع",
              variant: "destructive"
            });
            setIsLoadingGPS(false);
          },
          { enableHighAccuracy: true }
        );
      } else {
        toast({
          title: "غير مدعوم",
          description: "GPS غير متاح على هذا الجهاز",
          variant: "destructive"
        });
        setIsLoadingGPS(false);
      }
    }
  };

  const handleUseCurrentLocation = () => {
    if (userLocation) {
      handleSelectLocation(userLocation, searchMode);
    } else {
      toast({
        title: "جاري تحديد موقعك",
        description: "يرجى تفعيل خدمات الموقع",
        variant: "destructive"
      });
    }
  };

  const handleOpenMapPicker = () => {
    setShowLocationSearch(false);
    setShowMapPicker(true);
    setMapPickerLocation(userLocation || pickupLocation);
  };

  const handleConfirmMapLocation = async () => {
    if (mapPickerLocation) {
      // Reverse geocode to get address
      try {
        const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${mapPickerLocation.lng},${mapPickerLocation.lat}.json?access_token=${mapboxToken}&language=ar`
        );
        const data = await response.json();
        const address = data.features[0]?.place_name_ar || data.features[0]?.place_name || `${mapPickerLocation.lat.toFixed(4)}, ${mapPickerLocation.lng.toFixed(4)}`;
        handleSelectLocation({ ...mapPickerLocation, address }, searchMode);
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        handleSelectLocation(mapPickerLocation, searchMode);
      }
    }
  };

  const handleSetPickup = () => {
    if (userLocation) {
      setPickupLocation(userLocation);
      toast({ title: "تم تحديد موقع الانطلاق" });
    } else {
      openLocationSearch('pickup');
    }
  };

  const handleSetDestination = () => {
    openLocationSearch('dropoff');
  };

  const handleRemoveStop = (index: number) => {
    setIntermediateStops(intermediateStops.filter((_, i) => i !== index));
  };

  const handleBookRide = async () => {
    if (!session?.user?.id) {
      toast({
        title: "يرجى تسجيل الدخول",
        description: "يجب تسجيل الدخول لحجز رحلة",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      toast({
        title: "معلومات غير كاملة",
        description: "يرجى تحديد موقع الانطلاق والوجهة",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const rideData = {
        rider_id: session.user.id,
        pickup_location: { lat: pickupLocation.lat, lng: pickupLocation.lng },
        dropoff_location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
        pickup_address: pickupLocation.address || "موقع الانطلاق",
        dropoff_address: dropoffLocation.address || "الوجهة",
        vehicle_type: selectedVehicle as "economy" | "comfort" | "premium" | "women_only",
        payment_method: selectedPayment as "cash" | "zain_cash" | "asia_hawala" | "qi_card",
        estimated_fare: estimatedFare,
        distance_km: routeDistance || 0,
        duration_minutes: routeDuration || 0,
        status: "pending" as const,
      };

      const { data, error } = await supabase
        .from("rides")
        .insert(rideData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "تم إنشاء الطلب بنجاح",
        description: "جاري البحث عن سائق قريب منك",
      });

      // Navigate to rides page to see the new ride
      setTimeout(() => {
        navigate("/rider/rides");
      }, 2000);
    } catch (error) {
      console.error("Error booking ride:", error);
      toast({
        title: "فشل الحجز",
        description: "حدث خطأ أثناء حجز الرحلة. يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwapLocations = () => {
    const temp = pickupLocation;
    setPickupLocation(dropoffLocation);
    setDropoffLocation(temp);
  };

  const vehicleTypes = [
    { id: "economy", name: "اقتصادية", icon: "🚗", price: 1 },
    { id: "comfort", name: "مريحة", icon: "🚙", price: 1.3 },
    { id: "luxury", name: "فاخرة", icon: "🚕", price: 1.8 },
    { id: "family", name: "عائلية", icon: "🚐", price: 1.5 },
  ];

  const paymentMethods = [
    { id: "cash", name: "نقداً", icon: "💵" },
    { id: "zain_cash", name: "زين كاش", icon: "💳" },
    { id: "asia_hawala", name: "آسيا", icon: "👛" },
  ];

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background" dir="rtl">
      {/* Full-screen Map */}
      <div className="absolute inset-0">
        <LazyMap
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
        />
      </div>

      {/* Progress Steps */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-card/95 backdrop-blur-xl rounded-full px-6 py-3 shadow-lg border border-border/50"
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 ${pickupLocation && dropoffLocation ? 'text-primary' : 'text-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${pickupLocation && dropoffLocation ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {pickupLocation && dropoffLocation ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            <span className="text-sm font-medium">المواقع</span>
          </div>
          <div className="w-8 h-0.5 bg-border" />
          <div className={`flex items-center gap-2 ${activeStep === 'vehicle' || activeStep === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === 'vehicle' || activeStep === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {activeStep === 'confirm' ? <CheckCircle2 className="w-4 h-4" /> : '2'}
            </div>
            <span className="text-sm font-medium">المركبة</span>
          </div>
          <div className="w-8 h-0.5 bg-border" />
          <div className={`flex items-center gap-2 ${activeStep === 'confirm' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              3
            </div>
            <span className="text-sm font-medium">التأكيد</span>
          </div>
        </div>
      </motion.div>

      {/* Top Search Bar */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-20 left-0 right-0 z-10 p-4 bg-gradient-to-b from-background/95 to-transparent backdrop-blur-sm"
      >
        <div className="max-w-lg mx-auto space-y-3">
          {/* Pickup Search Bar - Technical Design */}
          <div className="relative">
            {/* Main Search Bar - White Floating */}
            <div className="bg-white rounded-full shadow-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center">
                {/* Search Icon - Right Side */}
                <div className="flex items-center justify-center w-12 h-14 text-gray-400">
                  <Search className="w-5 h-5" />
                </div>

                {/* Search Input Field */}
                <input
                  ref={pickupInputRef}
                  type="text"
                  placeholder="بحث عن مكان"
                  value={pickupSearchQuery}
                  onChange={(e) => {
                    setPickupSearchQuery(e.target.value);
                    setShowPickupSuggestions(e.target.value.length > 0);
                    // Trigger Mapbox search
                    setSearchQuery(e.target.value);
                  }}
                  onFocus={() => {
                    if (pickupSearchQuery.length > 0) {
                      setShowPickupSuggestions(true);
                    }
                  }}
                  className="flex-1 h-14 bg-transparent border-0 outline-none text-right pr-2 pl-4 text-gray-800 placeholder-gray-400 text-sm"
                  dir="rtl"
                />

                {/* Vertical Separator */}
                <div className="w-px h-8 bg-gray-200" />

                {/* GPS Button - Left Side */}
                <button
                  onClick={handleGPSPickup}
                  disabled={isLoadingGPS}
                  title="استخدم موقعي الحالي"
                  className={`flex items-center justify-center w-14 h-14 transition-all ${
                    pickupLocation?.address === userLocation?.address
                      ? "text-green-500"
                      : "text-blue-500 hover:text-blue-600"
                  } ${
                    isLoadingGPS ? "opacity-50 cursor-wait" : "hover:bg-blue-50 active:scale-95"
                  }`}
                >
                  {isLoadingGPS ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : pickupLocation?.address === userLocation?.address ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Target className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showPickupSuggestions && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
                >
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.slice(0, 5).map((result, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const location: Location = {
                            lat: result.center[1],
                            lng: result.center[0],
                            address: result.place_name_ar || result.place_name
                          };
                          setPickupLocation(location);
                          setPickupSearchQuery(location.address || "");
                          setShowPickupSuggestions(false);
                          setActiveStep('location');
                          toast({
                            title: "✓ تم تحديد موقع الانطلاق",
                            description: location.address,
                          });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-right border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{result.text}</p>
                          <p className="text-xs text-gray-500 truncate">{result.place_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Location Badge */}
            {pickupLocation && pickupSearchQuery && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-200"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-gray-600">نقطة الانطلاق:</span>
                <span className="text-xs font-medium text-gray-800 flex-1 truncate">{pickupLocation.address}</span>
                <button
                  onClick={() => {
                    setPickupLocation(null);
                    setPickupSearchQuery("");
                    setShowPickupSuggestions(false);
                    pickupInputRef.current?.focus();
                  }}
                  title="إزالة"
                  className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </motion.div>
            )}
          </div>

          {/* Intermediate Stops */}
          <AnimatePresence>
            {intermediateStops.map((stop, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full flex items-center gap-3 bg-card/95 backdrop-blur-sm rounded-2xl p-4 border border-amber-500/50 shadow-lg"
              >
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="flex-1 text-right">
                  <p className="text-xs text-muted-foreground">محطة {index + 1}</p>
                  <p className="text-sm font-medium truncate">{stop.address}</p>
                </div>
                <button
                  onClick={() => handleRemoveStop(index)}
                  title="حذف المحطة"
                  className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center hover:bg-destructive/30 transition-colors"
                >
                  <X className="w-3 h-3 text-destructive" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Dropoff Search Bar - Technical Design */}
          <div className="relative">
            {/* Main Search Bar - White Floating */}
            <div className="bg-white rounded-full shadow-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center">
                {/* Destination Icon - Right Side */}
                <div className="flex items-center justify-center w-12 h-14 text-red-500">
                  <MapPin className="w-5 h-5" />
                </div>

                {/* Search Input Field */}
                <input
                  ref={dropoffInputRef}
                  type="text"
                  placeholder="بحث عن الوجهة"
                  value={dropoffSearchQuery}
                  onChange={(e) => {
                    setDropoffSearchQuery(e.target.value);
                    setShowDropoffSuggestions(e.target.value.length > 0);
                    // Trigger Mapbox search
                    setSearchQuery(e.target.value);
                    setSearchMode('dropoff');
                  }}
                  onFocus={() => {
                    if (dropoffSearchQuery.length > 0) {
                      setShowDropoffSuggestions(true);
                    }
                  }}
                  className="flex-1 h-14 bg-transparent border-0 outline-none text-right pr-2 pl-4 text-gray-800 placeholder-gray-400 text-sm"
                  dir="rtl"
                />

                {/* Vertical Separator */}
                <div className="w-px h-8 bg-gray-200" />

                {/* Map Picker Button - Left Side */}
                <button
                  onClick={() => {
                    setSearchMode('dropoff');
                    setShowLocationSearch(false);
                    setShowMapPicker(true);
                    setMapPickerLocation(dropoffLocation || userLocation);
                  }}
                  title="اختر من الخريطة"
                  className="flex items-center justify-center w-14 h-14 text-blue-500 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition-all"
                >
                  <Target className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showDropoffSuggestions && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
                >
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.slice(0, 5).map((result, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const location: Location = {
                            lat: result.center[1],
                            lng: result.center[0],
                            address: result.place_name_ar || result.place_name
                          };
                          setDropoffLocation(location);
                          setDropoffSearchQuery(location.address || "");
                          setShowDropoffSuggestions(false);
                          if (pickupLocation) {
                            setActiveStep('vehicle');
                          }
                          toast({
                            title: "✓ تم تحديد الوجهة",
                            description: location.address,
                          });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-right border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{result.text}</p>
                          <p className="text-xs text-gray-500 truncate">{result.place_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Location Badge */}
            {dropoffLocation && dropoffSearchQuery && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full border border-red-200"
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-gray-600">الوجهة:</span>
                <span className="text-xs font-medium text-gray-800 flex-1 truncate">{dropoffLocation.address}</span>
                <button
                  onClick={() => {
                    setDropoffLocation(null);
                    setDropoffSearchQuery("");
                    setShowDropoffSuggestions(false);
                    dropoffInputRef.current?.focus();
                  }}
                  title="إزالة"
                  className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </motion.div>
            )}
          </div>

          {/* Add Stop Button */}
          {pickupLocation && dropoffLocation && intermediateStops.length < 3 && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => openLocationSearch('stop')}
              className="w-full flex items-center justify-center gap-2 bg-primary/10 backdrop-blur-sm rounded-xl p-3 border border-primary/30 hover:bg-primary/20 transition-all"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">إضافة محطة</span>
            </motion.button>
          )}

          {/* Swap Button */}
          {pickupLocation && dropoffLocation && intermediateStops.length === 0 && (
            <button
              onClick={handleSwapLocations}
              title="تبديل المواقع"
              className="absolute left-8 top-20 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <ChevronDown className="w-4 h-4 text-primary-foreground rotate-90" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Bottom Booking Panel */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-background via-background/98 to-transparent backdrop-blur-xl rounded-t-3xl border-t border-border/50 shadow-2xl"
      >
        <div className="max-w-lg mx-auto px-4 py-3 space-y-2.5 pb-20 max-h-[50vh] overflow-y-auto scrollbar-hide">
          {/* Trip Options */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap text-xs ${
                showSchedule
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/50 hover:border-primary/50"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>جدولة</span>
            </button>
            
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card rounded-full border border-border/50">
              <Users className="w-3.5 h-3.5" />
              <button onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))} title="تقليل عدد الركاب" className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">-</button>
              <span className="text-xs font-medium min-w-[16px] text-center">{passengerCount}</span>
              <button onClick={() => setPassengerCount(Math.min(6, passengerCount + 1))} title="زيادة عدد الركاب" className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">+</button>
            </div>
          </div>

          {/* Vehicle Selection */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5 text-right">نوع المركبة</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {vehicleTypes.map((vehicle) => (
                <button
                  key={vehicle.id}
                  onClick={() => {
                    setSelectedVehicle(vehicle.id);
                    if (pickupLocation && dropoffLocation) {
                      setActiveStep('confirm');
                    }
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                    selectedVehicle === vehicle.id
                      ? "bg-primary/20 border-primary scale-105"
                      : "bg-card border-border/50 hover:border-primary/50"
                  }`}
                >
                  <span className="text-xl">{vehicle.icon}</span>
                  <span className="text-[10px] leading-tight">{vehicle.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fare Display */}
          {estimatedFare > 0 && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-2.5 border border-primary/30"
            >
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">التكلفة المتوقعة</p>
                  <p className="text-lg font-bold text-primary">
                    {estimatedFare.toLocaleString()} د.ع
                  </p>
                  {routeDistance && (
                    <p className="text-[10px] text-muted-foreground">
                      {routeDistance.toFixed(1)} كم • {routeDuration?.toFixed(0)} د
                      {intermediateStops.length > 0 && ` • ${intermediateStops.length} محطة`}
                    </p>
                  )}
                </div>
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </motion.div>
          )}

          {/* Payment Method */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5 text-right">الدفع</h3>
            <div className="flex gap-1.5">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPayment(method.id)}
                  className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                    selectedPayment === method.id
                      ? "bg-primary/20 border-primary scale-105"
                      : "bg-card border-border/50 hover:border-primary/50"
                  }`}
                >
                  <span className="text-xl">{method.icon}</span>
                  <span className="text-[10px] leading-tight">{method.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Book Button */}
          <Button
            onClick={handleBookRide}
            disabled={!pickupLocation || !dropoffLocation || isLoading}
            className="w-full h-11 text-base font-bold rounded-xl shadow-glow hover:shadow-glow-lg transition-all"
          >
            {isLoading ? "جاري الحجز..." : showSchedule ? "جدولة الرحلة" : "احجز الآن"}
          </Button>
        </div>
      </motion.div>

      {/* Location Search Modal */}
      <AnimatePresence>
        {showLocationSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col"
            onClick={() => setShowLocationSearch(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-background rounded-t-3xl mt-20 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">
                    {searchMode === 'pickup' ? 'موقع الانطلاق' : searchMode === 'dropoff' ? 'الوجهة' : 'محطة إضافية'}
                  </h2>
                  <button
                    onClick={() => setShowLocationSearch(false)}
                    title="إغلاق"
                    className="w-8 h-8 rounded-full bg-card flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Action Buttons - Single Row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUseCurrentLocation}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary/10 rounded-xl border border-primary/30 hover:bg-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Locate className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-primary">موقعي</span>
                  </button>

                  <button
                    onClick={handleOpenMapPicker}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 hover:bg-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-500">الخريطة</span>
                  </button>

                  <button
                    onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="ابحث عن عنوان..."]')?.focus()}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 hover:bg-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Search className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-500">بحت</span>
                  </button>
                </div>
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="ابحث عن عنوان..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 pl-10 h-11 rounded-xl text-right text-sm border-border/50 focus:border-primary/50"
                  />
                  {isSearching && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Current Location */}
                {userLocation && (
                  <div>
                    <button
                      onClick={() => handleSelectLocation(userLocation, searchMode)}
                      className="w-full flex items-center gap-4 p-4 bg-primary/10 rounded-2xl border border-primary/30 hover:bg-primary/20 transition-all"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-medium">موقعي الحالي</p>
                        <p className="text-sm text-muted-foreground">استخدم موقعي الحالي</p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 text-right">نتائج البحث</h3>
                    <div className="space-y-2">
                      {searchResults.map((result, index) => (
                        <button
                          key={index}
                          onClick={() => handleSearchResultClick(result)}
                          className="w-full flex items-center gap-4 p-4 bg-card rounded-xl hover:bg-muted transition-all text-right"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{result.text}</p>
                            <p className="text-sm text-muted-foreground">{result.place_name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Saved Places */}
                {searchQuery.length === 0 && savedPlaces.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 text-right flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      <span>الأماكن المحفوظة</span>
                    </h3>
                    <div className="space-y-2">
                      {savedPlaces.map((place) => (
                        <button
                          key={place.id}
                          onClick={() => handleSelectLocation(place.location, searchMode)}
                          className="w-full flex items-center gap-4 p-4 bg-card rounded-xl hover:bg-muted transition-all text-right"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                            {place.icon}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{place.name}</p>
                            <p className="text-sm text-muted-foreground">{place.address}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Destinations */}
                {searchQuery.length === 0 && recentDestinations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 text-right flex items-center gap-2">
                      <History className="w-4 h-4" />
                      <span>الوجهات الأخيرة</span>
                    </h3>
                    <div className="space-y-2">
                      {recentDestinations.map((dest, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectLocation(dest.location, searchMode)}
                          className="w-full flex items-center gap-4 p-4 bg-card rounded-xl hover:bg-muted transition-all text-right"
                        >
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{dest.address}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Destinations */}
                {searchQuery.length === 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 text-right">وجهات شائعة</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {popularDestinations.map((dest, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectLocation(dest.location, searchMode)}
                          className="flex flex-col items-center gap-2 p-4 bg-card rounded-xl hover:bg-muted transition-all"
                        >
                          <span className="text-3xl">{dest.icon}</span>
                          <span className="text-sm font-medium">{dest.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Picker Modal */}
      <AnimatePresence>
        {showMapPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background z-50"
          >
            <div className="relative h-full w-full">
              {/* Map */}
              <div className="absolute inset-0">
                <LazyMap
                  pickupLocation={mapPickerLocation}
                  dropoffLocation={null}
                />
              </div>

              {/* Center Pin with Bounce Animation */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <MapPin className="w-12 h-12 text-destructive drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" fill="currentColor" />
                </motion.div>
              </div>

              {/* Header */}
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-background/95 to-transparent backdrop-blur-sm z-20">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                  <Button
                    onClick={() => {
                      setShowMapPicker(false);
                      setShowLocationSearch(true);
                    }}
                    variant="outline"
                    size="lg"
                    className="rounded-xl shadow-lg"
                  >
                    <X className="w-5 h-5 ml-2" />
                    إلغاء
                  </Button>
                  <h2 className="text-xl font-bold">حدد الموقع على الخريطة</h2>
                </div>
              </div>

              {/* Address Preview Card */}
              <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-20 left-0 right-0 px-4 z-20"
              >
                <div className="max-w-lg mx-auto bg-card/95 backdrop-blur-xl rounded-2xl p-4 border border-border/50 shadow-xl">
                  <p className="text-xs text-muted-foreground text-center mb-1">الموقع المختار</p>
                  <p className="text-base font-bold text-center">
                    {mapPickerLocation?.address || `${mapPickerLocation?.lat.toFixed(4)}, ${mapPickerLocation?.lng.toFixed(4)}`}
                  </p>
                </div>
              </motion.div>

              {/* Bottom Confirm Panel */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-sm z-20">
                <div className="max-w-lg mx-auto space-y-3">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-sm text-muted-foreground">حرك الخريطة لتحديد الموقع بدقة</p>
                  </div>
                  <Button
                    onClick={handleConfirmMapLocation}
                    size="lg"
                    className="w-full h-14 text-lg font-bold rounded-2xl shadow-glow hover:shadow-glow-lg"
                  >
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                    تأكيد الموقع
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <RiderBottomNav />
    </div>
  );
}
