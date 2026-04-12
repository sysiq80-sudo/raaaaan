import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PRESET_LABELS, EXTENDED_ICONS } from "./SavedPlaces";
import { 
  Check, 
  Loader2, 
  MapPin,
  Home,
  Briefcase,
  Star,
  X
} from "lucide-react";

interface SaveDestinationPromptProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
}

export const SaveDestinationPrompt = ({
  isOpen,
  onClose,
  userId,
  destination
}: SaveDestinationPromptProps) => {
  const { toast } = useToast();
  const [selectedLabel, setSelectedLabel] = useState<string>('favorite');
  const [selectedIcon, setSelectedIcon] = useState<string>('⭐');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const handleSave = async () => {
    if (!userId || !destination) return;

    const preset = PRESET_LABELS.find(p => p.label === selectedLabel);
    const name = customName || preset?.name || 'مكان جديد';

    setSaving(true);
    try {
      // Check if home/work already exists
      if (['home', 'work'].includes(selectedLabel)) {
        const { data: existing } = await supabase
          .from('saved_places')
          .select('id')
          .eq('user_id', userId)
          .eq('label', selectedLabel)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('saved_places')
            .update({
              address: destination.address,
              lat: destination.lat,
              lng: destination.lng,
              name: name
            })
            .eq('id', existing.id);

          if (error) throw error;
          toast({ title: "تم تحديث المكان بنجاح ✓" });
        } else {
          const { error } = await supabase
            .from('saved_places')
            .insert({
              user_id: userId,
              name: name,
              label: selectedLabel,
              address: destination.address,
              lat: destination.lat,
              lng: destination.lng,
              icon: selectedIcon
            });

          if (error) throw error;
          toast({ title: "تم حفظ المكان بنجاح ✓" });
        }
      } else {
        const { error } = await supabase
          .from('saved_places')
          .insert({
            user_id: userId,
            name: name,
            label: selectedLabel,
            address: destination.address,
            lat: destination.lat,
            lng: destination.lng,
            icon: selectedIcon
          });

        if (error) throw error;
        toast({ title: "تم حفظ المكان بنجاح ✓" });
      }

      onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            حفظ هذا المكان؟
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            هل تريد حفظ هذه الوجهة للوصول السريع في المرات القادمة؟
          </p>

          {/* Location preview */}
          <div className="p-3 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{destination.address}</span>
            </div>
          </div>

          {/* Quick labels */}
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

          {/* Extended icon picker toggle */}
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="text-xs text-primary hover:underline"
          >
            {showIconPicker ? 'إخفاء الأيقونات' : 'اختيار أيقونة مختلفة'}
          </button>

          {showIconPicker && (
            <div className="grid grid-cols-6 gap-2 p-3 rounded-xl bg-secondary/30 animate-in fade-in-50 duration-200">
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

          {/* Custom name */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">اسم المكان (اختياري)</label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={PRESET_LABELS.find(p => p.label === selectedLabel)?.name || "مثال: بيت جدتي"}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              لاحقاً
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              حفظ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveDestinationPrompt;
