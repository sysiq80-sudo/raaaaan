import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Home, Briefcase, Coffee, Dumbbell, Building2, Droplets } from 'lucide-react';

interface SaveLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  onSave: (name: string, icon: string) => Promise<void>;
}

const LOCATION_ICONS = [
  { value: 'home', label: '🏠 البيت', icon: Home },
  { value: 'work', label: '💼 العمل', icon: Briefcase },
  { value: 'cafe', label: '☕ مقهى', icon: Coffee },
  { value: 'gym', label: '💪 جيم', icon: Dumbbell },
  { value: 'diwaniya', label: '🏛️ ديوانية', icon: Building2 },
  { value: 'carwash', label: '🚗 مغسلة سيارات', icon: Droplets },
];

export default function SaveLocationModal({
  open,
  onOpenChange,
  address,
  onSave,
}: SaveLocationModalProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('home');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsLoading(true);
    try {
      onSave(name.trim(), selectedIcon);
      setName('');
      setSelectedIcon('home');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">
            💚 حفظ المكان المفضل
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Address Display */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">الموقع المحدد:</p>
            <p className="text-sm font-medium truncate">{address}</p>
          </div>

          {/* Name Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              أدخل اسماً للمكان (اختياري)
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: بيتي، عملي..."
              className="text-right"
              autoFocus
            />
          </div>

          {/* Icon Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              اختر أيقونة المكان
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LOCATION_ICONS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setSelectedIcon(item.value)}
                  className={`flex items-center justify-center gap-1 p-3 rounded-lg border-2 transition-all ${
                    selectedIcon === item.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <span className="text-lg">{item.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700 mb-2">معاينة:</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💚</span>
              <div>
                <p className="font-medium text-sm">
                  {name || 'بدون اسم'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {address}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? '⏳ جاري الحفظ...' : '💚 حفظ المكان'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
