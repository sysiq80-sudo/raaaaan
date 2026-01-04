import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Briefcase, MapPin, Save, X, Heart, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SaveLocationPromptProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  locationType: 'pickup' | 'dropoff';
}

const presetLabels = [
  { id: 'home', label: 'المنزل', icon: Home, color: 'bg-blue-500/20 text-blue-600' },
  { id: 'work', label: 'العمل', icon: Briefcase, color: 'bg-amber-500/20 text-amber-600' },
  { id: 'favorite', label: 'مفضل', icon: Heart, color: 'bg-pink-500/20 text-pink-600' },
  { id: 'custom', label: 'مخصص', icon: MapPin, color: 'bg-muted text-muted-foreground' },
];

const SaveLocationPrompt: React.FC<SaveLocationPromptProps> = ({
  isOpen,
  onClose,
  userId,
  location,
  locationType,
}) => {
  const [selectedLabel, setSelectedLabel] = useState<string>('custom');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const labelInfo = presetLabels.find(l => l.id === selectedLabel);
    const name = selectedLabel === 'custom' ? customName : labelInfo?.label || customName;

    if (!name.trim()) {
      toast({
        title: "أدخل اسم الموقع",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Check if this label already exists for user
      if (selectedLabel !== 'custom') {
        const { data: existing } = await supabase
          .from('saved_places')
          .select('id')
          .eq('user_id', userId)
          .eq('label', selectedLabel)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('saved_places')
            .update({
              name,
              address: location.address,
              lat: location.lat,
              lng: location.lng,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (error) throw error;

          toast({
            title: `تم تحديث "${name}" ✅`,
            description: location.address,
          });
        } else {
          // Insert new
          const { error } = await supabase
            .from('saved_places')
            .insert({
              user_id: userId,
              name,
              label: selectedLabel,
              address: location.address,
              lat: location.lat,
              lng: location.lng,
            });

          if (error) throw error;

          toast({
            title: `تم حفظ "${name}" ✅`,
            description: location.address,
          });
        }
      } else {
        // Custom label - always insert new
        const { error } = await supabase
          .from('saved_places')
          .insert({
            user_id: userId,
            name,
            label: 'custom',
            address: location.address,
            lat: location.lat,
            lng: location.lng,
          });

        if (error) throw error;

        toast({
          title: `تم حفظ "${name}" ✅`,
          description: location.address,
        });
      }

      onClose();
      setCustomName('');
      setSelectedLabel('custom');
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast({
        title: "فشل الحفظ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            حفظ {locationType === 'pickup' ? 'موقع الانطلاق' : 'الوجهة'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Preview */}
          <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium flex-1 truncate">{location.address}</p>
          </div>

          {/* Preset Labels */}
          <div className="grid grid-cols-4 gap-2">
            {presetLabels.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedLabel === preset.id;
              
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedLabel(preset.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                    isSelected 
                      ? 'bg-primary/10 border-2 border-primary' 
                      : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${preset.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium">{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Name Input */}
          <AnimatePresence>
            {selectedLabel === 'custom' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <Input
                  placeholder="أدخل اسم للموقع (مثال: بيت الجدة)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="h-12"
                  autoFocus
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              لاحقاً
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSave}
              disabled={saving || (selectedLabel === 'custom' && !customName.trim())}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  حفظ
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveLocationPrompt;
