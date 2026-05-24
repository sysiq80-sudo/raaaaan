import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Home, 
  Briefcase, 
  MapPin, 
  Plus, 
  X, 
  Loader2, 
  Check, 
  Star,
  Heart,
  GraduationCap,
  Dumbbell,
  Utensils,
  Cross,
  ShoppingBag,
  Building2,
  Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export interface SavedPlace {
  id: string;
  name: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
}

interface SavedPlacesProps {
  userId: string | null;
  onSelect: (place: SavedPlace) => void;
  currentLocation?: { lat: number; lng: number; address: string } | null;
  showAddButton?: boolean;
  compact?: boolean;
}

export const PRESET_LABELS = [
  { label: 'home', name: 'المنزل', icon: '🏠', lucideIcon: Home, color: 'bg-blue-500/20 text-blue-500' },
  { label: 'work', name: 'العمل', icon: '💼', lucideIcon: Briefcase, color: 'bg-amber-500/20 text-amber-500' },
  { label: 'favorite', name: 'مفضل', icon: '⭐', lucideIcon: Star, color: 'bg-primary/20 text-primary' },
];

export const EXTENDED_ICONS = [
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

const SavedPlaces: React.FC<SavedPlacesProps> = ({
  userId,
  onSelect,
  currentLocation,
  showAddButton = true,
  compact = false
}) => {
  const { toast } = useToast();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('home');
  const [selectedIcon, setSelectedIcon] = useState<string>('🏠');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchSavedPlaces();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchSavedPlaces = async () => {
    if (!userId) return;
    
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
    } finally {
      setLoading(false);
    }
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
      if (editingPlace) {
        // Update existing place
        const { error } = await supabase
          .from('saved_places')
          .update({
            address: currentLocation.address,
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            name: name,
            icon: selectedIcon,
            label: selectedLabel
          })
          .eq('id', editingPlace.id);

        if (error) throw error;
        toast({ title: "تم تحديث المكان بنجاح" });
      } else if (isBasicLabel) {
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
          toast({ title: "تم تحديث المكان بنجاح" });
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
          toast({ title: "تم حفظ المكان بنجاح" });
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
        toast({ title: "تم حفظ المكان بنجاح" });
      }

      await fetchSavedPlaces();
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

  const handleDeletePlace = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    }
  };

  const handleEditPlace = (place: SavedPlace, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlace(place);
    setSelectedLabel(place.label);
    setSelectedIcon(place.icon);
    setCustomName(place.name);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingPlace(null);
    setSelectedLabel('home');
    setSelectedIcon('🏠');
    setCustomName('');
    setShowIconPicker(false);
  };

  const getIconForLabel = (label: string, icon?: string) => {
    const extendedIcon = EXTENDED_ICONS.find(i => i.icon === icon);
    if (extendedIcon) {
      const IconComponent = extendedIcon.lucideIcon;
      return <IconComponent className="w-4 h-4" />;
    }
    
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
      case 'school': return 'bg-purple-500/20 text-purple-500';
      case 'gym': return 'bg-red-500/20 text-red-500';
      case 'restaurant': return 'bg-orange-500/20 text-orange-500';
      case 'hospital': return 'bg-pink-500/20 text-pink-500';
      case 'shopping': return 'bg-cyan-500/20 text-cyan-500';
      default: return 'bg-primary/20 text-primary';
    }
  };

  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Compact mode for quick access
  if (compact) {
    const homePlace = places.find(p => p.label === 'home');
    const workPlace = places.find(p => p.label === 'work');
    
    if (!homePlace && !workPlace) return null;
    
    return (
      <div className="flex gap-2">
        {homePlace && (
          <button
            onClick={() => onSelect(homePlace)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 transition-all"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">المنزل</span>
          </button>
        )}
        {workPlace && (
          <button
            onClick={() => onSelect(workPlace)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-all"
          >
            <Briefcase className="w-4 h-4" />
            <span className="text-sm font-medium">العمل</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Quick access buttons for home/work if not set */}
      {places.length === 0 && showAddButton && currentLocation && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedLabel('home');
              setSelectedIcon('🏠');
              setShowAddDialog(true);
            }}
            className="flex-1 gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/30"
          >
            <Home className="w-4 h-4" />
            حفظ كمنزل
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedLabel('work');
              setSelectedIcon('💼');
              setShowAddDialog(true);
            }}
            className="flex-1 gap-2 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30"
          >
            <Briefcase className="w-4 h-4" />
            حفظ كعمل
          </Button>
        </div>
      )}

      {/* Saved places list */}
      {places.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground px-1">الأماكن المحفوظة</p>
          {places.map((place) => (
            <div
              key={place.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-all group animate-in fade-in-50 duration-300"
            >
              <button
                onClick={() => onSelect(place)}
                className="flex-1 flex items-center gap-3 text-right"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getColorForLabel(place.label)}`}>
                  {getIconForLabel(place.label, place.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{place.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                </div>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleEditPlace(place, e)}
                  className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeletePlace(place.id, e)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add new place button */}
      {showAddButton && currentLocation && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="w-full gap-2 text-muted-foreground hover:text-primary"
        >
          <Plus className="w-4 h-4" />
          حفظ الموقع الحالي
        </Button>
      )}

      {/* Add/Edit place dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlace ? 'تعديل المكان' : 'حفظ مكان جديد'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Basic label selection */}
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
              <label className="text-sm text-muted-foreground mb-2 block">اسم المكان</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={PRESET_LABELS.find(p => p.label === selectedLabel)?.name || "مثال: بيت جدتي"}
              />
            </div>

            {/* Location preview */}
            {currentLocation && (
              <div className="p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{currentLocation.address}</span>
                </div>
              </div>
            )}

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
              {editingPlace ? 'تحديث المكان' : 'حفظ المكان'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedPlaces;
