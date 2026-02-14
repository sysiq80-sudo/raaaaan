import { useState, forwardRef, useImperativeHandle } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, X, ChevronDown } from 'lucide-react';
import { format, addDays, addHours, setHours, setMinutes, isBefore, isAfter, startOfDay, differenceInMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapPaymentToDb } from '@/types/savedCards';

interface ScheduleRideDialogProps {
  pickup: { lat: number; lng: number; address: string } | null;
  dropoff: { lat: number; lng: number; address: string } | null;
  vehicleType: string;
  paymentMethod: string;
  estimatedFare: number | null;
  onScheduled?: () => void;
}

export const ScheduleRideDialog = forwardRef<
  { openDialog: () => void },
  ScheduleRideDialogProps
>(({
  pickup,
  dropoff,
  vehicleType,
  paymentMethod,
  estimatedFare,
  onScheduled
}: ScheduleRideDialogProps, ref) => {
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
  const [showStopInput, setShowStopInput] = useState(false);
  const [preferWomenDriver, setPreferWomenDriver] = useState(false);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    tripType: true,
    stops: false,
    preferences: false
  });

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const minScheduleTime = addHours(new Date(), 2);
  const maxScheduleDate = addDays(new Date(), 30);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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
        payment_method: mapPaymentToDb(paymentMethod as any) as any,
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

  useImperativeHandle(ref, () => ({
    openDialog: () => setOpen(true),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="hidden" />
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 justify-end">
            <span>جدولة رحلة متقدمة</span>
            <span className="text-2xl">📅</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ===== TRIP SUMMARY CARD WITH GLASSMORPHISM ===== */}
          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-md border border-blue-200/30 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🗺️</span> ملخص الرحلة
            </h3>
            
            {/* Pickup Location - Green */}
            <div className="flex items-start gap-3 mb-3 pb-3 border-b border-blue-100/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white text-xs font-bold flex-shrink-0">
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-600 font-semibold">نقطة الانطلاق</p>
                <p className="text-sm text-blue-900 font-medium truncate">{pickup?.address || 'غير محدد'}</p>
              </div>
            </div>

            {/* Dropoff Location - Red */}
            <div className="flex items-start gap-3 pb-3 border-b border-blue-100/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white text-xs font-bold flex-shrink-0">
                ✕
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-600 font-semibold">نقطة الوصول</p>
                <p className="text-sm text-blue-900 font-medium truncate">{dropoff?.address || 'غير محدد'}</p>
              </div>
            </div>

            {/* Estimated Fare */}
            {estimatedFare && (
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs text-blue-600 font-semibold">💰 التكلفة المتوقعة:</span>
                <span className="text-sm font-bold text-blue-900">{estimatedFare.toLocaleString()} د.ع</span>
              </div>
            )}
          </div>

          {/* Date Picker - Enhanced */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              اختر التاريخ
            </label>
            <div className="border rounded-xl overflow-hidden bg-white">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ar}
                disabled={(date) =>
                  isBefore(startOfDay(date), startOfDay(new Date())) ||
                  isAfter(startOfDay(date), startOfDay(maxScheduleDate))
                }
                className="[&_.rdp]:justify-center [&_.rdp-caption]:px-2 [&_.rdp-cell]:p-0.5 [&_.rdp-cell_button]:h-8 [&_.rdp-cell_button]:w-8 [&_.rdp-cell_button]:text-xs [&_.rdp-head_cell]:text-xs [&_.rdp-head_cell]:font-semibold [&_.rdp_today]:bg-green-500/10 [&_.rdp_selected]:bg-green-600 [&_.rdp_selected]:text-white"
              />
            </div>
            <p className="text-xs text-muted-foreground">متاح من ساعتين مقدماً إلى 30 يوماً</p>
          </div>

          {/* Time Picker with Button Grid */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              اختر الوقت (الساعة والدقيقة)
            </label>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Hours - Circular Button Grid */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">الساعة</p>
                <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto border border-blue-200/50 rounded-lg p-2 bg-blue-50/30">
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      onClick={() => setSelectedHour(hour)}
                      className={`py-1.5 px-1 rounded-full text-xs font-bold transition-all ${
                        selectedHour === hour
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white text-foreground border border-blue-200 hover:bg-blue-100 hover:shadow-sm'
                      }`}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes - Button Grid */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">الدقيقة</p>
                <div className="grid grid-cols-2 gap-2 border border-blue-200/50 rounded-lg p-2 bg-blue-50/30">
                  {minutes.map((minute) => (
                    <button
                      key={minute}
                      onClick={() => setSelectedMinute(minute)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        selectedMinute === minute
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white text-foreground border border-blue-200 hover:bg-blue-100 hover:shadow-sm'
                      }`}
                    >
                      {minute}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Display selected time */}
            {selectedDate && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50/80 border border-blue-200/50 p-2.5 rounded-lg">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span className="font-semibold text-right">
                  {format(
                    setMinutes(setHours(selectedDate, parseInt(selectedHour)), parseInt(selectedMinute)),
                    'EEEE d MMMM yyyy - HH:mm',
                    { locale: ar }
                  )}
                </span>
              </div>
            )}
          </div>

          {/* ===== ACCORDION SECTIONS - ADVANCED FEATURES ===== */}

          {/* Trip Type Section */}
          <div className="border border-border/30 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => toggleSection('tripType')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary/5 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2 text-foreground">
                <span className="text-base">🔄</span> نوع الرحلة
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  expandedSections.tripType ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSections.tripType && (
              <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-primary/5">
                <Select value={tripType} onValueChange={(value) => setTripType(value as 'one_way' | 'round_trip')}>
                  <SelectTrigger className="bg-white border border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_way">→ ذهاب فقط</SelectItem>
                    <SelectItem value="round_trip">🔄 ذهاب وعودة في نفس اليوم</SelectItem>
                  </SelectContent>
                </Select>

                {/* Return Time - Visible when round_trip selected */}
                {tripType === 'round_trip' && (
                  <div className="space-y-3 pt-3 border-t border-border/30">
                    <p className="text-xs font-bold text-foreground">⏰ موعد العودة</p>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <Calendar
                        mode="single"
                        selected={returnDate}
                        onSelect={setReturnDate}
                        locale={ar}
                        disabled={(date) =>
                          isBefore(startOfDay(date), startOfDay(new Date())) ||
                          isAfter(startOfDay(date), startOfDay(maxScheduleDate))
                        }
                        className="[&_.rdp]:justify-center [&_.rdp-caption]:px-2 [&_.rdp-cell]:p-0.5 [&_.rdp-cell_button]:h-7 [&_.rdp-cell_button]:w-7 [&_.rdp-cell_button]:text-xs [&_.rdp-head_cell]:text-xs [&_.rdp_today]:bg-primary/10 [&_.rdp_selected]:bg-primary [&_.rdp_selected]:text-white"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">الساعة</p>
                        <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto border border-primary/20 rounded p-1.5 bg-primary/5">
                          {hours.map((hour) => (
                            <button
                              key={`return-${hour}`}
                              onClick={() => setReturnHour(hour)}
                              className={`py-1 px-0.5 rounded text-xs font-bold transition-all ${
                                returnHour === hour
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'bg-white text-foreground hover:bg-primary/10 border border-primary/20'
                              }`}
                            >
                              {hour}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">الدقيقة</p>
                        <div className="grid grid-cols-2 gap-1 border border-primary/20 rounded p-1.5 bg-primary/5">
                          {minutes.map((minute) => (
                            <button
                              key={`return-${minute}`}
                              onClick={() => setReturnMinute(minute)}
                              className={`py-1.5 px-1 rounded text-xs font-bold transition-all ${
                                returnMinute === minute
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'bg-white text-foreground hover:bg-primary/10 border border-primary/20'
                              }`}
                            >
                              {minute}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Multi-Stop Section */}
          <div className="border border-border/30 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => toggleSection('stops')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary/5 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2 text-foreground">
                <span className="text-base">🛑</span> محطات توقف إضافية
                {stops.length > 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">({stops.length})</span>}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  expandedSections.stops ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSections.stops && (
              <div className="border-t border-border/30 px-4 py-3 space-y-2 bg-primary/5">
                {/* Add Stop Input - Conditional Display */}
                <div className="flex gap-2">
                  {showStopInput && (
                    <Input
                      value={stopInput}
                      onChange={(e) => setStopInput(e.target.value)}
                      placeholder="اكتب عنوان المحطة..."
                      className="text-sm border-primary/20"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && stopInput.trim()) {
                          setStops((prev) => [...prev, stopInput.trim()]);
                          setStopInput('');
                          setShowStopInput(false);
                        }
                      }}
                    />
                  )}
                  <Button
                    type="button"
                    variant={showStopInput ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (showStopInput && stopInput.trim()) {
                        setStops((prev) => [...prev, stopInput.trim()]);
                        setStopInput('');
                        setShowStopInput(false);
                      } else {
                        setShowStopInput(!showStopInput);
                      }
                    }}
                    className="whitespace-nowrap"
                  >
                    {showStopInput && stopInput.trim() ? 'إضافة' : <Plus className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Stops List */}
                {stops.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-primary">📍 المحطات المضافة:</p>
                    {stops.map((stop, index) => (
                      <div
                        key={`${stop}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2 hover:bg-primary/5 transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground truncate">
                          <span className="text-primary font-bold">{index + 1}.</span> {stop}
                        </span>
                        <button
                          onClick={() => setStops((prev) => prev.filter((_, i) => i !== index))}
                          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded p-1 transition-colors flex-shrink-0"
                          title="حذف"
                          aria-label={`حذف محطة ${stop}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preferences Section */}
          <div className="border border-border/30 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => toggleSection('preferences')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary/5 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2 text-foreground">
                <span className="text-base">💜</span> تفضيلات خاصة
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  expandedSections.preferences ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSections.preferences && (
              <div className="border-t border-border/30 px-4 py-3 space-y-2 bg-primary/5">
                <div 
                  className="flex items-center gap-3 rounded-lg border border-primary/20 bg-white px-3 py-2.5 cursor-pointer hover:bg-primary/5 transition-colors"
                  onClick={() => setPreferWomenDriver(!preferWomenDriver)}
                >
                  <Checkbox
                    id="preferWomen"
                    checked={preferWomenDriver}
                    onCheckedChange={(value) => setPreferWomenDriver(Boolean(value))}
                  />
                  <label htmlFor="preferWomen" className="text-sm font-medium text-foreground cursor-pointer flex-1">
                    👩 عائلات / سائقة فقط
                    <span className="text-xs text-muted-foreground block">قد تطبق رسوم إضافية</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>📝</span> ملاحظات للسائق (اختياري)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: أحتاج مساعدة في الأمتعة، أو لدي طلب خاص..."
              className="resize-none text-sm border-border/50"
              rows={2}
            />
          </div>

          {/* Confirm Button */}
          <Button 
            onClick={handleSchedule} 
            disabled={!canSchedule || isLoading}
            className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-base rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block animate-spin">⏳</span>
                جاري الجدولة...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>✅</span>
                تأكيد الجدولة
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

ScheduleRideDialog.displayName = 'ScheduleRideDialog';
