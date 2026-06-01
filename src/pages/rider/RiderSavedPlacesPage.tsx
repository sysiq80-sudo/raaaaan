import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
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
import RiderPageHeader from "@/components/rider/RiderPageHeader";

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
  { label: "home", name: "المنزل", icon: "🏠", lucideIcon: Home },
  { label: "work", name: "العمل", icon: "💼", lucideIcon: Briefcase },
  { label: "favorite", name: "مفضل", icon: "⭐", lucideIcon: Star },
];

const EXTENDED_ICONS = [
  { icon: "🏠", label: "home", name: "منزل", lucideIcon: Home },
  { icon: "💼", label: "work", name: "عمل", lucideIcon: Briefcase },
  { icon: "⭐", label: "favorite", name: "مفضل", lucideIcon: Star },
  { icon: "❤️", label: "loved", name: "محبب", lucideIcon: Heart },
  {
    icon: "🎓",
    label: "school",
    name: "مدرسة/جامعة",
    lucideIcon: GraduationCap,
  },
  { icon: "💪", label: "gym", name: "نادي رياضي", lucideIcon: Dumbbell },
  { icon: "🍽️", label: "restaurant", name: "مطعم", lucideIcon: Utensils },
  { icon: "🏥", label: "hospital", name: "مستشفى", lucideIcon: Cross },
  { icon: "🛍️", label: "shopping", name: "تسوق", lucideIcon: ShoppingBag },
  { icon: "🏢", label: "office", name: "مكتب", lucideIcon: Building2 },
  { icon: "📍", label: "other", name: "آخر", lucideIcon: MapPin },
];

const RiderSavedPlacesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("home");
  const [selectedIcon, setSelectedIcon] = useState<string>("🏠");
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Location state
  const [currentLocation, setCurrentLocation] =
    useState<CurrentLocation | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
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
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        },
      );

      const { latitude, longitude } = position.coords;

      // تم إيقاف طلب الـ Reverse Geocoding لتجنب تكاليف API المكانية
      /*
      const { data, error } = await supabase.functions.invoke("search-places", {
        body: {
          action: "reverse",
          lat: latitude,
          lng: longitude,
        },
      });

      if (error) throw error;
      */
      
      const data: any = null;

      const address =
        data?.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      setCurrentLocation({
        lat: latitude,
        lng: longitude,
        address: address,
      });

      setShowAddDialog(true);
    } catch (error: any) {
      console.error("Error getting location:", error);
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
  const searchPlaces = useCallback(async (_query: string) => {
    // 🛑 تم إيقاف ميزة البحث لتجنب تكاليف API
    setSearchResults([]);
    setShowSearchResults(false);
    return;
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
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleSavePlace = async () => {
    if (!userId || !currentLocation) return;

    const preset = PRESET_LABELS.find((p) => p.label === selectedLabel);
    const isBasicLabel = ["home", "work"].includes(selectedLabel);
    const name = isBasicLabel
      ? preset?.name || customName
      : customName || preset?.name || "مكان جديد";

    if (!name) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم للمكان",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (isBasicLabel) {
        // Check if home/work already exists
        const existing = places.find((p) => p.label === selectedLabel);
        if (existing) {
          const { error } = await supabase
            .from("saved_places")
            .update({
              address: currentLocation.address,
              lat: currentLocation.lat,
              lng: currentLocation.lng,
              name: name,
            })
            .eq("id", existing.id);

          if (error) throw error;
          toast({ title: "تم تحديث المكان بنجاح ✅" });
        } else {
          const { error } = await supabase.from("saved_places").insert({
            user_id: userId,
            name: name,
            label: selectedLabel,
            address: currentLocation.address,
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            icon: selectedIcon,
          });

          if (error) throw error;
          toast({ title: "تم حفظ المكان بنجاح ✅" });
        }
      } else {
        // Insert new custom place
        const { error } = await supabase.from("saved_places").insert({
          user_id: userId,
          name: name,
          label: selectedLabel,
          address: currentLocation.address,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          icon: selectedIcon,
        });

        if (error) throw error;
        toast({ title: "تم حفظ المكان بنجاح ✅" });
      }

      await fetchPlaces();
      handleCloseDialog();
    } catch (error: any) {
      console.error("Error saving place:", error);
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setSelectedLabel("home");
    setSelectedIcon("🏠");
    setCustomName("");
    setShowIconPicker(false);
    setCurrentLocation(null);
    setSearchQuery("");
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
        return "bg-blue-500/15 text-blue-400";
      case "work":
        return "bg-amber-500/15 text-amber-400";
      case "school":
        return "bg-purple-500/15 text-purple-400";
      case "gym":
        return "bg-red-500/15 text-red-400";
      case "restaurant":
        return "bg-orange-500/15 text-orange-400";
      case "hospital":
        return "bg-pink-500/15 text-pink-400";
      case "shopping":
        return "bg-cyan-500/15 text-cyan-400";
      default:
        return "bg-emerald-500/15 text-emerald-400";
    }
  };

  const handleNavigateTo = (place: SavedPlace) => {
    const savedDropoff = {
      lat: place.lat,
      lng: place.lng,
      address: place.address,
    };
    navigate("/rider/go", {
      state: {
        fromSavedPlace: true,
        preferredMode: "pickup",
        savedDropoff,
        savedPickup: null,
      },
    });
  };

  return (
    <div 
      className="flex flex-col bg-background min-h-screen"
      style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
    >
      <RiderPageHeader title="الأماكن المحفوظة" />

      {/* زر إضافة مكان — ثابت */}
      <div className="px-4 py-3 flex-shrink-0 bg-background/95 backdrop-blur-xl border-b border-slate-700/30 flex items-center justify-end">
        <button
          onClick={openAddDialog}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold text-[13px] shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          إضافة مكان
        </button>
      </div>

      {/* Content */}
      <div className="p-4 pb-8 space-y-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">جاري تحميل الأماكن...</p>
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-20 space-y-5">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-[#151f30] border border-slate-700/50 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-slate-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">لا توجد أماكن محفوظة</h2>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">
                احفظ أماكنك المفضلة مثل المنزل والعمل للوصول السريع إليها
              </p>
            </div>
            <button
              onClick={getCurrentLocation}
              disabled={gettingLocation}
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold text-sm rounded-full shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              {gettingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Locate className="w-4 h-4" />
              )}
              حفظ موقعي الحالي
            </button>
          </div>
        ) : (
          <>
            {/* Quick add buttons for home/work if not set */}
            <div className="grid grid-cols-2 gap-3">
              {!places.find((p) => p.label === "home") && (
                <button
                  className="h-auto py-4 flex flex-col items-center gap-2 rounded-xl bg-[#151f30] border border-slate-700/50 hover:bg-blue-500/10 hover:border-blue-500/30 text-white transition-all disabled:opacity-50"
                  onClick={() => {
                    setSelectedLabel("home");
                    setSelectedIcon("🏠");
                    getCurrentLocation();
                  }}
                  disabled={gettingLocation}
                >
                  <Home className="w-6 h-6 text-blue-400" />
                  <span className="text-[13px] font-medium">أضف المنزل</span>
                </button>
              )}
              {!places.find((p) => p.label === "work") && (
                <button
                  className="h-auto py-4 flex flex-col items-center gap-2 rounded-xl bg-[#151f30] border border-slate-700/50 hover:bg-amber-500/10 hover:border-amber-500/30 text-white transition-all disabled:opacity-50"
                  onClick={() => {
                    setSelectedLabel("work");
                    setSelectedIcon("💼");
                    getCurrentLocation();
                  }}
                  disabled={gettingLocation}
                >
                  <Briefcase className="w-6 h-6 text-amber-400" />
                  <span className="text-[13px] font-medium">أضف العمل</span>
                </button>
              )}
            </div>

            {/* Places list */}
            <div className="grid grid-cols-2 gap-3">
              {places.map((place) => (
                <div key={place.id} className="bg-[#151f30] rounded-2xl border border-slate-700/50 overflow-hidden">
                  <div className="p-3.5 flex flex-col items-center text-center gap-2.5">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-700/30 ${getColorForLabel(
                        place.label,
                      )}`}
                    >
                      {getIconComponent(place.label, place.icon)}
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="font-semibold text-white text-[14px] truncate">{place.name}</p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {place.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full mt-1">
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-all"
                        onClick={() => handleNavigateTo(place)}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        اذهب
                      </button>
                      <button
                        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                        onClick={() => handleDelete(place.id)}
                        aria-label="حذف المكان"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Place Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md bg-[#151f30] border-slate-700/50">
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
                      setSearchQuery("");
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded-full"
                    aria-label="مسح البحث"
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
                          <p className="text-sm font-medium truncate">
                            {result.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {result.address}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {isSearching && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground mr-2">
                    جاري البحث...
                  </span>
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
                      <p className="text-xs text-muted-foreground">
                        الموقع المحدد
                      </p>
                      <p className="font-medium truncate">
                        {currentLocation.address}
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentLocation(null)}
                      className="p-1 hover:bg-secondary rounded-full"
                      aria-label="إزالة الموقع"
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
              <label className="text-sm font-medium mb-2 block">
                نوع المكان
              </label>
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
                        ? "bg-primary text-primary-foreground scale-105"
                        : "bg-secondary hover:bg-secondary/80"
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
                {showIconPicker ? "إخفاء الأيقونات" : "اختيار أيقونة مختلفة"}
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
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-secondary"
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
              <label className="text-sm text-muted-foreground mb-2 block">
                اسم المكان (اختياري)
              </label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={
                  PRESET_LABELS.find((p) => p.label === selectedLabel)?.name ||
                  "مثال: بيت جدتي"
                }
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
