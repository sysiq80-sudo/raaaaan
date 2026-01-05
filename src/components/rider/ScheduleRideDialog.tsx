import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
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

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

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

      toast.success('تم جدولة الرحلة بنجاح! سيتم تذكيرك قبل 15 دقيقة');
      setOpen(false);
      onScheduled?.();
    } catch (error) {
      console.error('Error scheduling ride:', error);
      toast.error('حدث خطأ في جدولة الرحلة');
    } finally {
      setIsLoading(false);
    }
  };

  const canSchedule = pickup && dropoff && selectedDate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={!pickup || !dropoff}>
          <CalendarIcon className="h-4 w-4" />
          جدولة لاحقاً
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">جدولة رحلة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Route Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-sm">
                <span className="text-muted-foreground">من: </span>
                {pickup?.address || 'غير محدد'}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <span className="text-muted-foreground">إلى: </span>
                {dropoff?.address || 'غير محدد'}
              </div>
            </div>
            {estimatedFare && (
              <div className="text-sm font-medium text-primary">
                التكلفة التقديرية: {estimatedFare.toLocaleString()} د.ع
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-sm font-medium mb-2 block">اختر التاريخ</label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ar}
              disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
              className="rounded-md border"
            />
          </div>

          {/* Time Picker */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">الساعة</label>
              <Select value={selectedHour} onValueChange={setSelectedHour}>
                <SelectTrigger>
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
                <SelectTrigger>
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
          </div>

          {selectedDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
              <Clock className="h-4 w-4" />
              <span>
                موعد الرحلة: {format(
                  setMinutes(setHours(selectedDate, parseInt(selectedHour)), parseInt(selectedMinute)),
                  'EEEE d MMMM yyyy - HH:mm',
                  { locale: ar }
                )}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block">ملاحظات (اختياري)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: أحتاج مساعدة في الأمتعة..."
              className="resize-none"
              rows={2}
            />
          </div>

          <Button 
            onClick={handleSchedule} 
            disabled={!canSchedule || isLoading}
            className="w-full"
          >
            {isLoading ? 'جاري الجدولة...' : 'تأكيد الجدولة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
