import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  MapPin,
  Home,
  Briefcase,
  Star,
  Plus,
  Trash2,
  Loader2,
  Navigation,
  Locate,
  Check,
  Heart,
  GraduationCap,
  Dumbbell,
  Utensils,
  Cross,
  ShoppingBag,
  Building2,
  Search,
  X,
  Map,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MapLocationPicker from "@/components/rider/MapLocationPicker";

interface SearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface SavedPlace {
  id: string;
  name: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
}

interface CurrentLocation {
  lat: number;
  lng: number;
  address: string;
}

const PRESET_LABELS = [
  { label: 'home', name: 'المنزل', icon: '🏠', lucideIcon: Home },
  { label: 'work', name: 'العمل', icon: '💼', lucideIcon: Briefcase },
  { label: 'favorite', name: 'مفضل', icon: '⭐', lucideIcon: Star },
];

const EXTENDED_ICONS = [
  { icon: '🏠', label: 'home', name: 'منزل', lucideIcon: Home },
  { icon: '💼', label: 'work', name: 'عمل', lucideIcon: Briefcase },
  { icon: '⭐', label: 'favorite', name: 'مفضل', lucideIcon: Star },
  { icon: '❤️', label: 'loved', name: 'محبب', lucideIcon: Heart },
  { icon: '🎓', label: 'school', name: 'مدرسة/جامعة', lucideIcon: GraduationCap },
  { icon: '💪', label: 'gym', name: 'نادي رياضي', lucideIcon: Dumbbell },
  { icon: '🍽️', label: 'restaurant', name: 'مطعم', lucideIcon: Utensils },
  { icon: '🏥', label: 'hospital', name: 'مستشفى', lucideIcon: Cross },
  { icon: '🛍️', label: 'shopping', name: 'تسوق', lucideIcon: ShoppingBag },
  { icon: '🏢', label: 'office', name: 'مكتب', lucideIcon: Building2 },
  { icon: '📍', label: 'other', name: 'آخر', lucideIcon: MapPin },
];

const RiderSavedPlacesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('home');
  const [selectedIcon, setSelectedIcon] = useState<string>('🏠');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  
  // Location state
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth?redirect=/rider/saved-places");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchPlaces();
    }
  }, [userId]);

  const fetchPlaces = async () => {
    if (!userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("saved_places")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setPlaces(data);
    }
    setLoading(false);
  };

  const getCurrentLocation = useCallback(async () => {
    setGettingLocation(true);
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Reverse geocode using Supabase function
      const { data, error } = await supabase.functions.invoke('search-places', {
        body: {
          action: 'reverse',
          lat: latitude,
          lng: longitude,
        },
      });

      if (error) throw error;

      const address = data?.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      
      setCurrentLocation({
        lat: latitude,
        lng: longitude,
        address: address,
      });
      
      setShowAddDialog(true);
      
    } catch (error: any) {
      console.error('Error getting location:', error);
      toast({
        title: "خطأ في تحديد الموقع",
        description: error.message || "تعذر الحصول على موقعك الحالي",
        variant: "destructive",
      });
    } finally {
      setGettingLocation(false);
    }
  }, [toast]);

  // Search for places
  const searchPlaces = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-places', {
        body: {
          query,
          lat: 33.3, // Default Iraq coordinates
          lng: 44.4,
        },
      });

      if (error) throw error;

      const results: SearchResult[] = (data?.results || []).map((r: any) => ({
        id: r.id || Math.random().toString(),
        name: r.name || r.address,
        address: r.address || r.name,
        lat: r.lat,
        lng: r.lng,
      }));

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search input change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchPlaces(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchPlaces]);

  // Handle selecting a search result
  const handleSelectSearchResult = (result: SearchResult) => {
    setCurrentLocation({
      lat: result.lat,
      lng: result.lng,
      address: result.address,
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleSavePlace = async () => {
    if (!userId || !currentLocation) return;
    
    const preset = PRESET_LABELS.find(p => p.label === selectedLabel);
    const isBasicLabel = ['home', 'work'].includes(selectedLabel);
    const name = isBasicLabel ? preset?.name || customName : customName || preset?.name || 'مكان جديد';
    
    if (!name) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم للمكان",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (isBasicLabel) {
        // Check if home/work already exists
        const existing = places.find(p => p.label === selectedLabel);
        if (existing) {
          const { error } = await supabase
            .from('saved_places')
            .update({
              address: currentLocation.address,
              lat: currentLocation.lat,
              lng: currentLocation.lng,
              name: name
            })
            .eq('id', existing.id);

          if (error) throw error;
          toast({ title: "تم تحديث المكان بنجاح ✅" });
        } else {
          const { error } = await supabase
            .from('saved_places')
            .insert({
              user_id: userId,
              name: name,
              label: selectedLabel,
              address: currentLocation.address,
              lat: currentLocation.lat,
              lng: currentLocation.lng,
              icon: selectedIcon
            });

          if (error) throw error;
          toast({ title: "تم حفظ المكان بنجاح ✅" });
        }
      } else {
        // Insert new custom place
        const { error } = await supabase
          .from('saved_places')
          .insert({
            user_id: userId,
            name: name,
            label: selectedLabel,
            address: currentLocation.address,
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            icon: selectedIcon
          });

        if (error) throw error;
        toast({ title: "تم حفظ المكان بنجاح ✅" });
      }

      await fetchPlaces();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving place:', error);
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setSelectedLabel('home');
    setSelectedIcon('🏠');
    setCustomName('');
    setShowIconPicker(false);
    setCurrentLocation(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Open dialog without location (for search)
  const openAddDialog = () => {
    setShowAddDialog(true);
  };

  // Handle map location selection
  const handleMapLocationSelect = (location: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
  }) => {
    setCurrentLocation({
      lat: location.lat,
      lng: location.lng,
      address: location.address,
    });
    setShowMapPicker(false);
    setShowAddDialog(true);
  };

  // Open map picker
  const openMapPicker = () => {
    setShowAddDialog(false);
    setShowMapPicker(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_places").delete().eq("id", id);

    if (!error) {
      setPlaces(places.filter((p) => p.id !== id));
      toast({ title: "تم حذف المكان بنجاح" });
    } else {
      toast({
        title: "خطأ",
        description: "فشل في حذف المكان",
        variant: "destructive",
      });
    }
  };

  const getIconComponent = (label: string, icon?: string) => {
    const extendedIcon = EXTENDED_ICONS.find((i) => i.icon === icon);
    if (extendedIcon) {
      const IconComponent = extendedIcon.lucideIcon;
      return <IconComponent className="w-5 h-5" />;
    }

    switch (label) {
      case "home":
        return <Home className="w-5 h-5" />;
      case "work":
        return <Briefcase className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const getColorForLabel = (label: string) => {
    switch (label) {
      case "home":
        return "bg-blue-500/20 text-blue-600";
      case "work":
        return "bg-amber-500/20 text-amber-600";
      case "school":
        return "bg-purple-500/20 text-purple-600";
      case "gym":
        return "bg-red-500/20 text-red-600";
      case "restaurant":
        return "bg-orange-500/20 text-orange-600";
      case "hospital":
        return "bg-pink-500/20 text-pink-600";
      case "shopping":
        return "bg-cyan-500/20 text-cyan-600";
      default:
        return "bg-primary/20 text-primary";
    }
  };

  const handleNavigateTo = (place: SavedPlace) => {
    const params = new URLSearchParams({
      dropoff_lat: place.lat.toString(),
      dropoff_lng: place.lng.toString(),
      dropoff_address: place.address,
    });
    navigate(`/rider?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/rider")}
            className="shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">الأماكن المحفوظة</h1>
          <Button
            size="sm"
            onClick={openAddDialog}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            إضافة مكان
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-lg font-bold">لا توجد أماكن محفوظة</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              احفظ أماكنك المفضلة مثل المنزل والعمل للوصول السريع إليها
            </p>
            <Button 
              onClick={getCurrentLocation} 
              disabled={gettingLocation}
              className="gap-2"
            >
              {gettingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Locate className="w-4 h-4" />
              )}
              حفظ موقعي الحالي
            </Button>
          </div>
        ) : (
          <>
            {/* Quick add buttons for home/work if not set */}
            <div className="grid grid-cols-2 gap-3">
              {!places.find((p) => p.label === "home") && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-blue-500/10 hover:border-blue-500/30"
                  onClick={() => {
                    setSelectedLabel('home');
                    setSelectedIcon('🏠');
                    getCurrentLocation();
                  }}
                  disabled={gettingLocation}
                >
                  <Home className="w-6 h-6 text-blue-500" />
                  <span>أضف المنزل</span>
                </Button>
              )}
              {!places.find((p) => p.label === "work") && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-amber-500/10 hover:border-amber-500/30"
                  onClick={() => {
                    setSelectedLabel('work');
                    setSelectedIcon('💼');
                    getCurrentLocation();
                  }}
                  disabled={gettingLocation}
                >
                  <Briefcase className="w-6 h-6 text-amber-500" />
                  <span>أضف العمل</span>
                </Button>
              )}
            </div>

            {/* Places list */}
            <div className="space-y-3">
              {places.map((place) => (
                <Card key={place.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getColorForLabel(
                          place.label
                        )}`}
                      >
                        {getIconComponent(place.label, place.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{place.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {place.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => handleNavigateTo(place)}
                      >
                        <Navigation className="w-4 h-4" />
                        اذهب إلى هنا
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(place.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Place Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حفظ مكان جديد</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Location Selection Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium block">تحديد الموقع</label>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن مكان أو عنوان..."
                  className="pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Search Results */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl border bg-background shadow-lg">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelectSearchResult(result)}
                      className="w-full p-3 text-right hover:bg-secondary/50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.address}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {isSearching && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground mr-2">جاري البحث...</span>
                </div>
              )}

              {/* Location Selection Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  className="gap-2"
                >
                  {gettingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Locate className="w-4 h-4" />
                  )}
                  موقعي الحالي
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={openMapPicker}
                  className="gap-2"
                >
                  <Map className="w-4 h-4" />
                  اختر من الخريطة
                </Button>
              </div>

              {/* Selected Location Preview */}
              {currentLocation && (
                <div className="p-3 rounded-xl bg-accent/50 border border-accent">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">الموقع المحدد</p>
                      <p className="font-medium truncate">{currentLocation.address}</p>
                    </div>
                    <button
                      onClick={() => setCurrentLocation(null)}
                      className="p-1 hover:bg-secondary rounded-full"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Basic label selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">نوع المكان</label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_LABELS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setSelectedLabel(preset.label);
                      setSelectedIcon(preset.icon);
                    }}
                    className={`p-3 rounded-xl text-center transition-all ${
                      selectedLabel === preset.label
                        ? 'bg-primary text-primary-foreground scale-105'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    <span className="text-xl block mb-1">{preset.icon}</span>
                    <span className="text-xs font-medium">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Extended icon picker */}
            <div>
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="text-xs text-primary hover:underline"
              >
                {showIconPicker ? 'إخفاء الأيقونات' : 'اختيار أيقونة مختلفة'}
              </button>
              
              {showIconPicker && (
                <div className="grid grid-cols-6 gap-2 mt-3 p-3 rounded-xl bg-secondary/30 animate-in fade-in-50 duration-200">
                  {EXTENDED_ICONS.map((iconOption) => (
                    <button
                      key={iconOption.label}
                      onClick={() => {
                        setSelectedIcon(iconOption.icon);
                        setSelectedLabel(iconOption.label);
                      }}
                      className={`p-2 rounded-lg text-center transition-all ${
                        selectedIcon === iconOption.icon
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-secondary'
                      }`}
                      title={iconOption.name}
                    >
                      <span className="text-lg">{iconOption.icon}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom name input */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">اسم المكان (اختياري)</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={PRESET_LABELS.find(p => p.label === selectedLabel)?.name || "مثال: بيت جدتي"}
              />
            </div>

            <Button
              onClick={handleSavePlace}
              disabled={saving || !currentLocation}
              className="w-full"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Check className="w-4 h-4 ml-2" />
              )}
              حفظ المكان
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Map Location Picker */}
      {showMapPicker && (
        <MapLocationPicker
          isOpen={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          type="dropoff"
          onConfirm={handleMapLocationSelect}
          userLocation={currentLocation || undefined}
        />
      )}
    </div>
  );
};

export default RiderSavedPlacesPage;
