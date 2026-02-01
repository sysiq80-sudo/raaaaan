import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, X } from 'lucide-react';
import { format, addDays, addHours, setHours, setMinutes, isBefore, isAfter, startOfDay, differenceInMinutes } from 'date-fns';
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
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way');
  const [returnDate, setReturnDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [returnHour, setReturnHour] = useState('12');
  const [returnMinute, setReturnMinute] = useState('00');
  const [stops, setStops] = useState<string[]>([]);
  const [stopInput, setStopInput] = useState('');
  const [preferWomenDriver, setPreferWomenDriver] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const minScheduleTime = addHours(new Date(), 2);
  const maxScheduleDate = addDays(new Date(), 30);

  const handleSchedule = async () => {
    if (!pickup || !dropoff || !selectedDate) {
      toast.error('يرجى اختيار نقاط الانطلاق والوصول والوقت');
      return;
    }

    const scheduledAt = setMinutes(
      setHours(selectedDate, parseInt(selectedHour)),
      parseInt(selectedMinute)
    );

    if (isBefore(scheduledAt, minScheduleTime)) {
      toast.error('يجب أن يكون الحجز بعد ساعتين على الأقل');
      return;
    }

    if (isAfter(scheduledAt, maxScheduleDate)) {
      toast.error('لا يمكن جدولة رحلة بعد 30 يوماً');
      return;
    }

    let returnAt: Date | null = null;
    if (tripType === 'round_trip') {
      if (!returnDate) {
        toast.error('يرجى تحديد وقت العودة');
        return;
      }

      returnAt = setMinutes(
        setHours(returnDate, parseInt(returnHour)),
        parseInt(returnMinute)
      );

      if (isBefore(returnAt, scheduledAt)) {
        toast.error('وقت العودة يجب أن يكون بعد الذهاب');
        return;
      }

      if (differenceInMinutes(returnAt, scheduledAt) < 30) {
        toast.error('يجب أن يكون فرق العودة 30 دقيقة على الأقل');
        return;
      }
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }

      const groupId = crypto?.randomUUID?.() || undefined;
      const basePayload = {
        rider_id: user.id,
        pickup_location: { lat: pickup.lat, lng: pickup.lng },
        pickup_address: pickup.address,
        dropoff_location: { lat: dropoff.lat, lng: dropoff.lng },
        dropoff_address: dropoff.address,
        scheduled_at: scheduledAt.toISOString(),
        vehicle_type: vehicleType as any,
        payment_method: paymentMethod as any,
        estimated_fare: estimatedFare,
        notes: notes || null,
        trip_type: tripType,
        return_at: returnAt ? returnAt.toISOString() : null,
        stops: stops.length > 0 ? stops.map((address) => ({ address })) : null,
        prefer_women_driver: preferWomenDriver,
        group_id: groupId
      };

      const { error: outboundError } = await supabase
        .from('scheduled_rides')
        .insert(basePayload);

      if (outboundError) throw outboundError;

      if (tripType === 'round_trip' && returnAt) {
        const { error: returnError } = await supabase
          .from('scheduled_rides')
          .insert({
            ...basePayload,
            pickup_location: { lat: dropoff.lat, lng: dropoff.lng },
            pickup_address: dropoff.address,
            dropoff_location: { lat: pickup.lat, lng: pickup.lng },
            dropoff_address: pickup.address,
            scheduled_at: returnAt.toISOString(),
          });

        if (returnError) throw returnError;
      }

      toast.success('تم جدولة الرحلة بنجاح! سيتم إرسال تذكير قبل الموعد');
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
        <Button 
          className="gap-2 w-full h-12 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 hover:from-blue-700 hover:via-blue-600 hover:to-blue-800 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300" 
          disabled={!pickup || !dropoff}
        >
          <CalendarIcon className="h-5 w-5" />
          📅 حجز متقدم
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 justify-end">
            <span>جدولة رحلة متقدمة</span>
            <span className="text-2xl">📅</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground text-right mt-2">
            ⭐ اختر وقتك بدقة + محطات وسيطة + تفضيلات خاصة
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Highlights of advanced features */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-900">✨ ميزات الحجز المتقدم:</p>
            <ul className="text-xs text-blue-800 space-y-1 ml-2">
              <li>✓ اختر موعد دقيق (ساعة + دقيقة)</li>
              <li>✓ ذهاب وعودة في نفس اليوم</li>
              <li>✓ أضف محطات توقف وسيطة</li>
              <li>✓ اطلب سائق نسائي</li>
              <li>✓ تفضيلات خاصة وملاحظات</li>
            </ul>
          </div>

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
              disabled={(date) =>
                isBefore(startOfDay(date), startOfDay(new Date())) ||
                isAfter(startOfDay(date), startOfDay(maxScheduleDate))
              }
              className="rounded-md border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              متاح من ساعتين مقدماً وحتى 30 يوماً
            </p>
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

          {/* Trip Type - ADVANCED FEATURE */}
          <div className="space-y-2 border-l-4 border-blue-500 pl-3 bg-blue-50/50 p-3 rounded">
            <label className="text-sm font-bold text-blue-900">🎯 نوع الرحلة (ميزة متقدمة)</label>
            <Select value={tripType} onValueChange={(value) => setTripType(value as 'one_way' | 'round_trip')}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_way">→ ذهاب فقط</SelectItem>
                <SelectItem value="round_trip">🔄 ذهاب وعودة في نفس اليوم</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Return Time */}
          {tripType === 'round_trip' && (
            <div className="space-y-3 rounded-md border p-3">
              <label className="text-sm font-medium block">وقت العودة</label>
              <Calendar
                mode="single"
                selected={returnDate}
                onSelect={setReturnDate}
                locale={ar}
                disabled={(date) =>
                  isBefore(startOfDay(date), startOfDay(new Date())) ||
                  isAfter(startOfDay(date), startOfDay(maxScheduleDate))
                }
                className="rounded-md border"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">الساعة</label>
                  <Select value={returnHour} onValueChange={setReturnHour}>
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
                  <Select value={returnMinute} onValueChange={setReturnMinute}>
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
            </div>
          )}

          {/* Multi-stop - ADVANCED FEATURE */}
          <div className="space-y-2 border-l-4 border-green-500 pl-3 bg-green-50/50 p-3 rounded">
            <label className="text-sm font-bold text-green-900">🛑 محطات توقف إضافية (ميزة متقدمة)</label>
            <div className="flex gap-2">
              <Input
                value={stopInput}
                onChange={(e) => setStopInput(e.target.value)}
                placeholder="مثال: مول الآراضي..."
                className="bg-white"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!stopInput.trim()) return;
                  setStops((prev) => [...prev, stopInput.trim()]);
                  setStopInput('');
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {stops.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-green-800">📍 المحطات المضافة:</p>
                {stops.map((stop, index) => (
                  <div key={`${stop}-${index}`} className="flex items-center justify-between rounded-md bg-white border border-green-200 p-2 text-sm">
                    <span className="truncate text-green-900 font-medium">{index + 1}. {stop}</span>
                    <button
                      onClick={() => setStops((prev) => prev.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700"
                      title="حذف هذه المحطة"
                      aria-label={`حذف محطة ${stop}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preferences - ADVANCED FEATURE */}
          <div className="space-y-2 border-l-4 border-purple-500 pl-3 bg-purple-50/50 p-3 rounded">
            <label className="text-sm font-bold text-purple-900">💜 تفضيلات خاصة (ميزة متقدمة)</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-md bg-white border border-purple-200 p-3">
                <Checkbox
                  id="preferWomen"
                  checked={preferWomenDriver}
                  onCheckedChange={(value) => setPreferWomenDriver(Boolean(value))}
                />
                <label htmlFor="preferWomen" className="text-sm font-medium text-purple-900 cursor-pointer">
                  👩 عائلات / سائقة فقط
                </label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block">ملاحظات للسائق (اختياري)</label>
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
            className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {isLoading ? '⏳ جاري الجدولة...' : '✅ تأكيد الجدولة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
