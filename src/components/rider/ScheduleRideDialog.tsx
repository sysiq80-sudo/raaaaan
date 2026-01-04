import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Bell, 
  Sparkles,
  CheckCircle2,
  Navigation,
  Flag
} from 'lucide-react';
import { format, addDays, setHours, setMinutes, isBefore, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduleRideDialogProps {
  pickup: { lat: number; lng: number; address: string } | null;
  dropoff: { lat: number; lng: number; address: string } | null;
  vehicleType: string;
  paymentMethod: string;
  estimatedFare: number | null;
  onScheduled?: () => void;
}

export function ScheduleRideDialog({
  pickup,
  dropoff,
  vehicleType,
  paymentMethod,
  estimatedFare,
  onScheduled
}: ScheduleRideDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  // Quick time presets
  const timePresets = [
    { label: 'صباحاً', hour: '08', minute: '00', emoji: '🌅' },
    { label: 'ظهراً', hour: '12', minute: '00', emoji: '☀️' },
    { label: 'عصراً', hour: '16', minute: '00', emoji: '🌤️' },
    { label: 'مساءً', hour: '20', minute: '00', emoji: '🌙' },
  ];

  const handleSchedule = async () => {
    if (!pickup || !dropoff || !selectedDate) {
      toast.error('يرجى اختيار نقاط الانطلاق والوصول والوقت');
      return;
    }

    const scheduledAt = setMinutes(
      setHours(selectedDate, parseInt(selectedHour)),
      parseInt(selectedMinute)
    );

    if (isBefore(scheduledAt, new Date())) {
      toast.error('لا يمكن جدولة رحلة في الماضي');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }

      const { error } = await supabase
        .from('scheduled_rides')
        .insert({
          rider_id: user.id,
          pickup_location: { lat: pickup.lat, lng: pickup.lng },
          pickup_address: pickup.address,
          dropoff_location: { lat: dropoff.lat, lng: dropoff.lng },
          dropoff_address: dropoff.address,
          scheduled_at: scheduledAt.toISOString(),
          vehicle_type: vehicleType as any,
          payment_method: paymentMethod as any,
          estimated_fare: estimatedFare,
          notes: notes || null
        });

      if (error) throw error;

      setIsSuccess(true);
      
      setTimeout(() => {
        setOpen(false);
        setIsSuccess(false);
        onScheduled?.();
      }, 2000);

    } catch (error) {
      console.error('Error scheduling ride:', error);
      toast.error('حدث خطأ في جدولة الرحلة');
    } finally {
      setIsLoading(false);
    }
  };

  const canSchedule = pickup && dropoff && selectedDate;

  // Success State
  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-emerald-500/30"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h3 className="text-2xl font-bold text-foreground mb-2">تم الحجز بنجاح! 🎉</h3>
            <p className="text-muted-foreground">سيتم تذكيرك قبل 15 دقيقة من موعد الرحلة</p>
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 rounded-xl border-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50" 
          disabled={!pickup || !dropoff}
        >
          <CalendarIcon className="h-4 w-4 text-primary" />
          <span>جدولة لاحقاً</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-3 flex items-center justify-center"
          >
            <CalendarIcon className="w-8 h-8 text-primary" />
          </motion.div>
          <DialogTitle className="text-xl font-bold">جدولة رحلة</DialogTitle>
          <p className="text-sm text-muted-foreground">اختر موعد رحلتك وسنذكرك قبلها</p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Route Summary */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-secondary/80 to-secondary/40 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Navigation className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">من</span>
                <p className="font-medium text-foreground truncate">{pickup?.address || 'غير محدد'}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                <Flag className="h-5 w-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">إلى</span>
                <p className="font-medium text-foreground truncate">{dropoff?.address || 'غير محدد'}</p>
              </div>
            </div>
            
            {estimatedFare && (
              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">التكلفة التقديرية</span>
                <span className="text-lg font-bold text-primary">{estimatedFare.toLocaleString()} د.ع</span>
              </div>
            )}
          </motion.div>

          {/* Date Picker */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <label className="text-sm font-semibold mb-3 block flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              اختر التاريخ
            </label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ar}
              disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
              className="rounded-xl border-2 border-border/50 p-3"
            />
          </motion.div>

          {/* Quick Time Presets */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <label className="text-sm font-semibold mb-3 block flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              وقت سريع
            </label>
            <div className="grid grid-cols-4 gap-2">
              {timePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setSelectedHour(preset.hour);
                    setSelectedMinute(preset.minute);
                  }}
                  className={`p-3 rounded-xl text-center transition-all ${
                    selectedHour === preset.hour && selectedMinute === preset.minute
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                      : 'bg-secondary/50 hover:bg-secondary'
                  }`}
                >
                  <span className="text-xl block mb-1">{preset.emoji}</span>
                  <span className="text-xs font-medium">{preset.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Custom Time Picker */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex gap-3"
          >
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">الساعة</label>
              <Select value={selectedHour} onValueChange={setSelectedHour}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">الدقيقة</label>
              <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((minute) => (
                    <SelectItem key={minute} value={minute}>
                      {minute}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Selected DateTime Display */}
          {selectedDate && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Bell className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">موعد الرحلة</p>
                <p className="font-bold text-foreground">
                  {format(
                    setMinutes(setHours(selectedDate, parseInt(selectedHour)), parseInt(selectedMinute)),
                    'EEEE d MMMM - HH:mm',
                    { locale: ar }
                  )}
                </p>
              </div>
            </motion.div>
          )}

          {/* Notes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <label className="text-sm font-semibold mb-2 block flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              ملاحظات (اختياري)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: أحتاج مساعدة في الأمتعة..."
              className="resize-none rounded-xl border-2 border-border/50 focus:border-primary/50"
              rows={2}
            />
          </motion.div>

          {/* Submit Button */}
          <Button 
            onClick={handleSchedule} 
            disabled={!canSchedule || isLoading}
            className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/30"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري الجدولة...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                تأكيد الجدولة
              </div>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
