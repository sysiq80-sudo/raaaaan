/**
 * ران - شاشة الترحيب المحسّنة
 * تصميم عصري مستوحى من التطبيقات العالمية
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getGeocoder } from "@/lib/googleMapService";
import { Search, MapPin, Star, Clock, Home, Briefcase, ChevronDown, Loader2, X, Building2, Menu, Gift, Crown, MapPinned, Coffee, LandmarkIcon, GraduationCap, Sparkles, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PickupLocationSelector from "@/components/rider/PickupLocationSelector";
import LocationOptionsSection from "@/components/rider/LocationOptionsSection";
import DynamicPromoBanners from "@/components/rider/DynamicPromoBanners";
import logo from "@/assets/logo.png";
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
interface RecentPlace {
  id: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
}
interface WelcomeLocationScreenProps {
  userId: string | null;
  onSearchClick: () => void;
  onMapPickerClick: () => void;
  onPlaceSelect: (place: {
    lat: number;
    lng: number;
    address: string;
  }) => void;
  isExiting?: boolean;
  onMenuOpen?: () => void;
}

// Quick category buttons
const quickCategories = [{
  id: 'work',
  label: 'عمل',
  icon: Briefcase,
  color: 'from-amber-500 to-orange-600'
}, {
  id: 'university',
  label: 'جامعة',
  icon: GraduationCap,
  color: 'from-green-500 to-emerald-600'
}, {
  id: 'mosque',
  label: 'مسجد',
  icon: LandmarkIcon,
  color: 'from-teal-500 to-cyan-600'
}, {
  id: 'cafe',
  label: 'كافيه',
  icon: Coffee,
  color: 'from-pink-500 to-rose-600'
}];
const WelcomeLocationScreen = ({
  userId,
  onSearchClick,
  onMapPickerClick,
  onPlaceSelect,
  isExiting = false,
  onMenuOpen
}: WelcomeLocationScreenProps) => {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAddress, setCurrentAddress] = useState<string>('جاري تحديد الموقع...');

  // Search states
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Destination selection state (NEW FLOW: Destination first)
  const [destinationSelected, setDestinationSelected] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const debounceRef = useRef<any>();

  // Get user location and reverse geocode using Google Maps
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async position => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(loc);

        // Reverse geocode using Google Maps Geocoding API
        try {
          if (window.google?.maps) {
            const geocoder = await getGeocoder();
            if (geocoder) {
            const result = await geocoder.geocode({ 
              location: loc,
              language: 'ar'
            });
            const address = result.results?.[0]?.formatted_address || 'الرمادي، الأنبار';
            setCurrentAddress(address);
            } else {
              setCurrentAddress('الرمادي، الأنبار');
            }
          } else {
            setCurrentAddress('الرمادي، الأنبار');
          }
        } catch (error) {
          console.error('Reverse geocode error:', error);
          setCurrentAddress('الرمادي، الأنبار');
        }
      }, () => setCurrentAddress('الرمادي، الأنبار'));
    }
  }, []);
  useEffect(() => {
    if (userId) {
      fetchPlaces();
    } else {
      setLoading(false);
    }
  }, [userId]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSavedDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const fetchPlaces = async () => {
    if (!userId) return;
    try {
      const {
        data: saved
      } = await supabase.from('saved_places').select('*').eq('user_id', userId).order('created_at', {
        ascending: false
      });
      if (saved) setSavedPlaces(saved);
      const {
        data: rides
      } = await supabase.from('rides').select('id, dropoff_address, dropoff_location, created_at').eq('rider_id', userId).eq('status', 'completed').order('created_at', {
        ascending: false
      }).limit(5);
      if (rides) {
        const uniquePlaces = rides.filter(ride => ride.dropoff_address && ride.dropoff_location).reduce((acc: RecentPlace[], ride) => {
          const location = ride.dropoff_location as {
            lat: number;
            lng: number;
          };
          if (!acc.find(p => p.address === ride.dropoff_address)) {
            acc.push({
              id: ride.id,
              address: ride.dropoff_address!,
              lat: location.lat,
              lng: location.lng,
              created_at: ride.created_at
            });
          }
          return acc;
        }, []).slice(0, 3);
        setRecentPlaces(uniquePlaces);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setLoading(false);
    }
  };
  const searchPlaces = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '8'
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
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setShowSavedDropdown(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 200);
  };
  const handleSelectResult = (result: SearchResult) => {
    onPlaceSelect({
      lat: result.lat,
      lng: result.lng,
      address: result.name
    });
    setQuery('');
    setSearchResults([]);
  };
  const handleSelectSavedPlace = (place: SavedPlace) => {
    onPlaceSelect({
      lat: place.lat,
      lng: place.lng,
      address: place.address
    });
    setShowSavedDropdown(false);
  };
  const getIconForLabel = (label: string) => {
    switch (label) {
      case 'home':
        return <Home className="w-4 h-4" />;
      case 'work':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <Star className="w-4 h-4" />;
    }
  };
  const homePlace = savedPlaces.find(p => p.label === 'home');
  const workPlace = savedPlaces.find(p => p.label === 'work');
  const showSearchResults = query.length >= 2 && (searchResults.length > 0 || isSearching);

  // Animation variants
  const containerVariants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        when: "beforeChildren" as const,
        staggerChildren: 0.08
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1] as const
      }
    }
  };
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0, 0, 0.2, 1] as const
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.3
      }
    }
  };
  // حالة: هل الزر الثابت في الأسفل يجب أن يظهر (عندما يكون الوجهة محددة والموقع الحالي متاح)
  const showConfirmButton = destinationSelected && userLocation;

  return <motion.div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden" variants={containerVariants} initial="hidden" animate={isExiting ? "exit" : "visible"} exit="exit">
      {/* Header */}
      <motion.header className="relative z-20 px-4 pt-6 pb-4" variants={itemVariants}>
        <div className="items-center justify-between flex flex-row">
          {/* Menu Button */}
          <button onClick={onMenuOpen} className="w-11 h-11 rounded-xl bg-card/80 backdrop-blur-md border border-border/50 flex items-center justify-center shadow-lg">
            <Menu className="w-5 h-5" />
          </button>

          {/* RAAN+ Badge */}
          <motion.div className="flex items-center gap-2" whileHover={{
          scale: 1.05
        }}>
            <Badge variant="outline" className="bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 text-primary px-3 py-1.5 text-sm font-bold">
              <Crown className="w-4 h-4 ml-1" />
              RAAN+
            </Badge>
          </motion.div>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="RAAN" className="w-10 h-10" />
          </div>
        </div>
      </motion.header>

      {/* Main Content - Scrollable */}
      <motion.div className="flex-1 overflow-y-auto px-4 space-y-6" style={{ paddingBottom: showConfirmButton ? '5rem' : '2rem' }} variants={itemVariants}>
        {/* ===== NEW FLOW: DESTINATION FIRST ===== */}

        {/* Show Destination Options FIRST (when destination NOT selected) */}
        {!destinationSelected && <>
            <LocationOptionsSection type="dropoff" title="إلى أين تذهب؟" subtitle="حدد وجهتك أولاً" currentAddress={currentAddress} onUseCurrentLocation={() => {
          // لا نستخدم الموقع الحالي كوجهة
        }} onSelectFromMap={onMapPickerClick} onSearchLocation={onSearchClick} />

            {/* Quick Categories for Destination */}
            <motion.div variants={itemVariants}>
              <p className="mb-3 text-right text-primary-foreground text-base font-extrabold">وجهات محفوظة </p>
              <div className="flex justify-between gap-3">
                {quickCategories.map(cat => <motion.button key={cat.id} onClick={() => {
              const place = savedPlaces.find(p => p.label === cat.id);
              if (place) {
                setSelectedDestination({
                  lat: place.lat,
                  lng: place.lng,
                  address: place.address
                });
                setDestinationSelected(true);
                // تعيين الموقع الحالي كنقطة انطلاق تلقائياً
                if (userLocation) {
                  setPickupLocation({
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    address: currentAddress
                  });
                }
              }
            }} whileHover={{
              scale: 1.02
            }} whileTap={{
              scale: 0.98
            }} className="flex-1 items-center gap-2 p-4 rounded-2xl bg-card border border-border/30 hover:border-primary/30 transition-all flex flex-row">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-lg`}>
                      <cat.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-sm font-medium">{cat.label}</span>
                  </motion.button>)}
              </div>
            </motion.div>
          </>}

        {/* Show Pickup Options AFTER destination is selected */}
        {destinationSelected && <>
            {/* Confirmed Destination Display */}
            <motion.div initial={{
          opacity: 0,
          y: -10
        }} animate={{
          opacity: 1,
          y: 0
        }} className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center justify-between">
                <button onClick={() => {
              setDestinationSelected(false);
              setSelectedDestination(null);
            }} className="text-sm text-blue-600 font-medium hover:underline px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors">
                  تغيير
                </button>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-blue-600 font-medium mb-0.5">✓ الوجهة</p>
                    <p className="text-sm font-bold text-foreground truncate max-w-[200px]">
                      {selectedDestination?.address}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Pickup Options with GPS Auto-selected */}
            <motion.div initial={{
          opacity: 0,
          y: 10
        }} animate={{
          opacity: 1,
          y: 0
        }} className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPinned className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-bold">من أين تنطلق؟</h3>
              </div>

              {/* GPS Auto-selected Option — مؤشر معلوماتي فقط، الزر الرئيسي في الأسفل */}
              <div className="w-full p-4 rounded-2xl bg-green-500/10 border-2 border-green-500/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                  <MapPinned className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-bold text-green-600 flex items-center gap-2 justify-end">
                    <Sparkles className="w-4 h-4" />
                    موقعي الحالي (GPS)
                  </p>
                  <p className="text-sm text-foreground truncate">{currentAddress}</p>
                </div>
              </div>

              {/* Other Pickup Options */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">أو اختر موقع آخر:</p>

                {/* Select from Map */}
                <motion.button onClick={() => onMapPickerClick()} className="w-full p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:border-primary/30 transition-all" whileTap={{
              scale: 0.98
            }}>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-medium">اختر من الخريطة</span>
                </motion.button>

                {/* Search Location */}
                <motion.button onClick={() => onSearchClick()} className="w-full p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:border-primary/30 transition-all" whileTap={{
              scale: 0.98
            }}>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Search className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="font-medium">ابحث بالاسم</span>
                </motion.button>

                {/* Saved Places */}
                {savedPlaces.length > 0 && <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground">الأماكن المحفوظة:</p>
                    {savedPlaces.slice(0, 3).map(place => <motion.button key={place.id} onClick={() => {
                setPickupLocation({
                  lat: place.lat,
                  lng: place.lng,
                  address: place.address
                });
                if (selectedDestination) {
                  onPlaceSelect(selectedDestination);
                }
              }} className="w-full p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3 hover:border-primary/30 transition-all" whileTap={{
                scale: 0.98
              }}>
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          {place.label === 'home' ? <Home className="w-5 h-5 text-amber-500" /> : place.label === 'work' ? <Briefcase className="w-5 h-5 text-amber-500" /> : <Star className="w-5 h-5 text-amber-500" />}
                        </div>
                        <div className="flex-1 text-right">
                          <p className="font-medium">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        </div>
                      </motion.button>)}
                  </div>}
              </div>
            </motion.div>
          </>}


        {/* Dynamic Promo Banners from Database */}
        <DynamicPromoBanners />

        {/* Recent Places */}
        {recentPlaces.length > 0 && <motion.div className="space-y-3" variants={itemVariants}>
            <div className="flex items-center gap-2 px-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">آخر الأماكن</p>
            </div>
            <div className="space-y-2">
              {recentPlaces.map(place => <motion.button key={place.id} onClick={() => onPlaceSelect({
            lat: place.lat,
            lng: place.lng,
            address: place.address
          })} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-right" whileTap={{
            scale: 0.98
          }}>
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="flex-1 font-medium truncate">{place.address}</p>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </motion.button>)}
            </div>
          </motion.div>}

        {/* Referral Banner - قريباً */}
        <motion.div variants={itemVariants}>
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center gap-4 opacity-75 cursor-default">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">ادعُ أصدقاءك واربح!</p>
              <p className="text-xs text-muted-foreground">قريباً - احصل على 5,000 د.ع لكل صديق</p>
            </div>
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">قريباً</span>
          </div>
        </motion.div>
      </motion.div>

      {/* ════════════════════════════════════════
           زر تأكيد موقع الانطلاق — ملاصق للأسفل
           بنفس نمط أزرار شاشة السائق
           ════════════════════════════════════════ */}
      {showConfirmButton && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="fixed bottom-0 inset-x-0 z-[60] bg-slate-900/98 backdrop-blur-lg border-t border-slate-700/50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <motion.button
            onClick={() => {
              if (userLocation && selectedDestination) {
                setPickupLocation({
                  lat: userLocation.lat,
                  lng: userLocation.lng,
                  address: currentAddress
                });
                onPlaceSelect(selectedDestination);
              }
            }}
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(34,197,94,0)",
                "0 0 0 12px rgba(34,197,94,0.2)",
                "0 0 0 0 rgba(34,197,94,0)"
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            whileTap={{ scale: 0.98 }}
            className="w-full h-16 flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-lg font-black rounded-none touch-manipulation transition-all duration-200"
          >
            <MapPinned className="w-6 h-6" />
            تأكيد موقع الانطلاق
          </motion.button>
        </motion.div>
      )}
    </motion.div>;
};
export default WelcomeLocationScreen;