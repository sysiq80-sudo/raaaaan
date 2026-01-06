import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import MapLocationPicker from "@/components/rider/MapLocationPicker";
import { SavedPlace, EXTENDED_ICONS, PRESET_LABELS } from "@/components/rider/SavedPlaces";
import { 
  ArrowRight,
  Plus,
  MapPin,
  Home,
  Briefcase,
  Star,
  Loader2,
  Search,
  Trash2,
  Edit3,
  Navigation,
  Check,
  X
} from "lucide-react";

const RiderSavedPlaces = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>('favorite');
  const [selectedIcon, setSelectedIcon] = useState<string>('⭐');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchPlaces(session.user.id);
      setLoading(false);
    };

    checkAuth();

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Geolocation error:', error)
      );
    }
  }, [navigate]);

  const fetchPlaces = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlaces(data || []);
    } catch (error) {
      console.error('Error fetching saved places:', error);
    }
  };

  const handleSavePlace = async () => {
    if (!user || !selectedLocation) return;

    const isBasicLabel = ['home', 'work'].includes(selectedLabel);
    const preset = PRESET_LABELS.find(p => p.label === selectedLabel);
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
      if (editingPlace) {
        const { error } = await supabase
          .from('saved_places')
          .update({
            address: selectedLocation.address,
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
            name: name,
            icon: selectedIcon,
            label: selectedLabel
          })
          .eq('id', editingPlace.id);

        if (error) throw error;
        toast({ title: "تم تحديث المكان بنجاح ✓" });
      } else if (isBasicLabel) {
        const existing = places.find(p => p.label === selectedLabel);
        if (existing) {
          const { error } = await supabase
            .from('saved_places')
            .update({
              address: selectedLocation.address,
              lat: selectedLocation.lat,
              lng: selectedLocation.lng,
              name: name
            })
            .eq('id', existing.id);

          if (error) throw error;
          toast({ title: "تم تحديث المكان بنجاح ✓" });
        } else {
          const { error } = await supabase
            .from('saved_places')
            .insert({
              user_id: user.id,
              name: name,
              label: selectedLabel,
              address: selectedLocation.address,
              lat: selectedLocation.lat,
              lng: selectedLocation.lng,
              icon: selectedIcon
            });

          if (error) throw error;
          toast({ title: "تم حفظ المكان بنجاح ✓" });
        }
      } else {
        const { error } = await supabase
          .from('saved_places')
          .insert({
            user_id: user.id,
            name: name,
            label: selectedLabel,
            address: selectedLocation.address,
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
            icon: selectedIcon
          });

        if (error) throw error;
        toast({ title: "تم حفظ المكان بنجاح ✓" });
      }

      await fetchPlaces(user.id);
      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlace = async (id: string) => {
    if (!user) return;
    
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('saved_places')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPlaces(places.filter(p => p.id !== id));
      toast({ title: "تم حذف المكان" });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditPlace = (place: SavedPlace) => {
    setEditingPlace(place);
    setSelectedLabel(place.label);
    setSelectedIcon(place.icon);
    setCustomName(place.name);
    setSelectedLocation({
      lat: place.lat,
      lng: place.lng,
      address: place.address
    });
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingPlace(null);
    setSelectedLabel('favorite');
    setSelectedIcon('⭐');
    setCustomName('');
    setSelectedLocation(null);
  };

  const handleMapPickerConfirm = (location: { lat: number; lng: number; address: string }) => {
    setSelectedLocation(location);
    setShowMapPicker(false);
    setShowAddDialog(true);
  };

  const getIconForLabel = (label: string, icon?: string) => {
    switch (label) {
      case 'home': return <Home className="w-5 h-5" />;
      case 'work': return <Briefcase className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getColorForLabel = (label: string) => {
    switch (label) {
      case 'home': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'work': return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      case 'school': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'gym': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'restaurant': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'hospital': return 'bg-pink-500/20 text-pink-500 border-pink-500/30';
      case 'shopping': return 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30';
      default: return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  const filteredPlaces = places.filter(place =>
    place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    place.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const homePlace = places.find(p => p.label === 'home');
  const workPlace = places.find(p => p.label === 'work');
  const otherPlaces = places.filter(p => !['home', 'work'].includes(p.label));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rider/settings")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">الأماكن المحفوظة</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowMapPicker(true)}
            className="text-primary"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          {/* Search */}
          {places.length > 3 && (
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث في الأماكن المحفوظة..."
                className="pr-10"
              />
            </div>
          )}

          {/* Quick Add Home/Work if not set */}
          {(!homePlace || !workPlace) && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-3">إعداد سريع</p>
                <div className="flex gap-2">
                  {!homePlace && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLabel('home');
                        setSelectedIcon('🏠');
                        setShowMapPicker(true);
                      }}
                      className="flex-1 gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                    >
                      <Home className="w-4 h-4" />
                      إضافة المنزل
                    </Button>
                  )}
                  {!workPlace && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLabel('work');
                        setSelectedIcon('💼');
                        setShowMapPicker(true);
                      }}
                      className="flex-1 gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                    >
                      <Briefcase className="w-4 h-4" />
                      إضافة العمل
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Places List */}
          {filteredPlaces.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto rounded-full bg-secondary flex items-center justify-center mb-4">
                <MapPin className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2">لا توجد أماكن محفوظة</h3>
              <p className="text-muted-foreground text-sm mb-6">
                احفظ أماكنك المفضلة للوصول السريع إليها
              </p>
              <Button onClick={() => setShowMapPicker(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة مكان جديد
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Home & Work at top */}
              {(homePlace || workPlace) && (
                <div className="space-y-2">
                  {homePlace && (
                    <PlaceCard
                      place={homePlace}
                      getIconForLabel={getIconForLabel}
                      getColorForLabel={getColorForLabel}
                      onEdit={() => handleEditPlace(homePlace)}
                      onDelete={() => handleDeletePlace(homePlace.id)}
                      onNavigate={() => navigate(`/rider?destination=${homePlace.lat},${homePlace.lng}`)}
                      isDeleting={deletingId === homePlace.id}
                    />
                  )}
                  {workPlace && (
                    <PlaceCard
                      place={workPlace}
                      getIconForLabel={getIconForLabel}
                      getColorForLabel={getColorForLabel}
                      onEdit={() => handleEditPlace(workPlace)}
                      onDelete={() => handleDeletePlace(workPlace.id)}
                      onNavigate={() => navigate(`/rider?destination=${workPlace.lat},${workPlace.lng}`)}
                      isDeleting={deletingId === workPlace.id}
                    />
                  )}
                </div>
              )}

              {/* Other places */}
              {otherPlaces.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground px-1 pt-2">الأماكن المفضلة</p>
                  <div className="space-y-2">
                    {otherPlaces.map((place) => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        getIconForLabel={getIconForLabel}
                        getColorForLabel={getColorForLabel}
                        onEdit={() => handleEditPlace(place)}
                        onDelete={() => handleDeletePlace(place.id)}
                        onNavigate={() => navigate(`/rider?destination=${place.lat},${place.lng}`)}
                        isDeleting={deletingId === place.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Add Button */}
          {places.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowMapPicker(true)}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة مكان جديد
            </Button>
          )}
        </div>
      </main>

      {/* Map Picker */}
      <MapLocationPicker
        isOpen={showMapPicker}
        onClose={() => {
          setShowMapPicker(false);
          // Reset if we were trying to add home/work specifically
          if (!editingPlace) {
            setSelectedLabel('favorite');
            setSelectedIcon('⭐');
          }
        }}
        type="dropoff"
        onConfirm={handleMapPickerConfirm}
        initialLocation={editingPlace ? { lat: editingPlace.lat, lng: editingPlace.lng } : null}
        userLocation={userLocation}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlace ? 'تعديل المكان' : 'حفظ مكان جديد'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Label selection */}
            <div className="grid grid-cols-3 gap-2">
              {PRESET_LABELS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  onClick={() => {
                    setSelectedLabel(preset.label);
                    setSelectedIcon(preset.icon);
                  }}
                  className={`p-3 rounded-xl text-center transition-all h-auto ${
                    selectedLabel === preset.label
                      ? 'bg-primary text-primary-foreground scale-105'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  <span className="text-xl block mb-1">{preset.icon}</span>
                  <span className="text-xs font-medium">{preset.name}</span>
                </Button>
              ))}
            </div>

            {/* Extended icons */}
            <div className="grid grid-cols-6 gap-2 p-3 rounded-xl bg-secondary/30">
              {EXTENDED_ICONS.slice(3).map((iconOption) => (
                <Button
                  key={iconOption.label}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedIcon(iconOption.icon);
                    setSelectedLabel(iconOption.label);
                  }}
                  className={`p-2 rounded-lg text-center transition-all h-auto ${
                    selectedIcon === iconOption.icon
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary'
                  }`}
                  title={iconOption.name}
                >
                  <span className="text-lg">{iconOption.icon}</span>
                </Button>
              ))}
            </div>

            {/* Custom name */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">اسم المكان</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={PRESET_LABELS.find(p => p.label === selectedLabel)?.name || "مثال: بيت جدتي"}
              />
            </div>

            {/* Location preview */}
            {selectedLocation && (
              <div className="p-3 rounded-xl bg-secondary/50">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{selectedLocation.address}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddDialog(false);
                    setShowMapPicker(true);
                  }}
                  className="mt-2 w-full text-xs text-primary"
                >
                  تغيير الموقع على الخريطة
                </Button>
              </div>
            )}

            <Button
              onClick={handleSavePlace}
              disabled={saving || !selectedLocation}
              className="w-full"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Check className="w-4 h-4 ml-2" />
              )}
              {editingPlace ? 'تحديث المكان' : 'حفظ المكان'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Place Card Component
interface PlaceCardProps {
  place: SavedPlace;
  getIconForLabel: (label: string, icon?: string) => React.ReactNode;
  getColorForLabel: (label: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  onNavigate: () => void;
  isDeleting: boolean;
}

const PlaceCard = ({ 
  place, 
  getIconForLabel, 
  getColorForLabel, 
  onEdit, 
  onDelete, 
  onNavigate,
  isDeleting 
}: PlaceCardProps) => (
  <Card className="group hover:shadow-md transition-all overflow-hidden">
    <CardContent className="p-0">
      <div className="flex items-stretch">
        <div className={`w-16 shrink-0 flex items-center justify-center ${getColorForLabel(place.label)} border-l border-border`}>
          {getIconForLabel(place.label, place.icon)}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold truncate">{place.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{place.address}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-all h-auto"
                title="تعديل"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={isDeleting}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-all disabled:opacity-50 h-auto"
                title="حذف"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigate}
            className="mt-2 h-8 text-xs gap-1 text-primary hover:bg-primary/10 -mr-2"
          >
            <Navigation className="w-3 h-3" />
            اذهب إلى هنا
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default RiderSavedPlaces;
