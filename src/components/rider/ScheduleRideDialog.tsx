import { useState, forwardRef, useImperativeHandle } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, X, ChevronDown, Loader2 } from 'lucide-react';
import { format, addDays, addHours, setHours, setMinutes, isBefore, isAfter, startOfDay, differenceInMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mapPaymentToDb } from '@/types/savedCards';

interface ScheduleRideDialogProps {
  pickup: { lat: number; lng: number; address: string; snappedLat?: number; snappedLng?: number } | null;
  dropoff: { lat: number; lng: number; address: string; snappedLat?: number; snappedLng?: number } | null;
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

      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };

      const groupId = generateUUID();
      const basePayload = {
        rider_id: user.id,
        pickup_location: {
          lat: pickup.snappedLat ?? pickup.lat,
          lng: pickup.snappedLng ?? pickup.lng,
          selected_lat: pickup.lat,
          selected_lng: pickup.lng
        },
        pickup_address: pickup.address,
        dropoff_location: {
          lat: dropoff.snappedLat ?? dropoff.lat,
          lng: dropoff.snappedLng ?? dropoff.lng,
          selected_lat: dropoff.lat,
          selected_lng: dropoff.lng
        },
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
            pickup_location: {
              lat: dropoff.snappedLat ?? dropoff.lat,
              lng: dropoff.snappedLng ?? dropoff.lng,
              selected_lat: dropoff.lat,
              selected_lng: dropoff.lng
            },
            pickup_address: dropoff.address,
            dropoff_location: {
              lat: pickup.snappedLat ?? pickup.lat,
              lng: pickup.snappedLng ?? pickup.lng,
              selected_lat: pickup.lat,
              selected_lng: pickup.lng
            },
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
      <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto border border-slate-800/40 bg-[#0d1a2e] text-white rounded-3xl p-5 shadow-2xl overflow-x-hidden" dir="rtl">
        <DialogHeader className="border-b border-slate-800/40 pb-4 mb-2">
          <DialogTitle className="text-right flex items-center gap-2 justify-end text-white font-cairo text-lg font-black">
            <span>جدولة رحلة متقدمة</span>
            <span className="text-2xl">📅</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ===== TRIP SUMMARY CARD WITH GLASSMORPHISM ===== */}
          <div className="bg-[#171f33] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            {/* Subtle decorative glow */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2 font-cairo relative z-10">
              <span className="text-lg">🗺️</span> ملخص الرحلة
            </h3>
            
            <div className="relative flex flex-col gap-4">
              {/* Pickup Location - Green */}
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 border border-emerald-500/20 shadow-glow-sm shadow-emerald-500/10">
                  <span className="text-sm font-bold text-emerald-400">✓</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-emerald-400 mb-0.5 uppercase font-cairo">نقطة الانطلاق</p>
                  <p className="text-sm font-bold text-white truncate font-tajawal">{pickup?.address || 'غير محدد'}</p>
                </div>
              </div>

              {/* Connecting Line */}
              <div className="absolute right-[17px] top-[26px] bottom-[26px] w-0.5 bg-gradient-to-b from-emerald-500/40 via-slate-700/20 to-blue-500/40 pointer-events-none" />

              {/* Dropoff Location - Blue */}
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 border border-blue-500/20 shadow-glow-sm shadow-blue-500/10">
                  <span className="text-sm font-bold text-blue-400">✕</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-blue-400 mb-0.5 uppercase font-cairo">نقطة الوصول</p>
                  <p className="text-sm font-bold text-white truncate font-tajawal">{dropoff?.address || 'غير محدد'}</p>
                </div>
              </div>
            </div>

            {/* Estimated Fare */}
            {estimatedFare && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/30 relative z-10">
                <span className="text-xs text-slate-400 font-bold font-cairo">💰 التكلفة المتوقعة:</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-black text-emerald-400 font-sans">{estimatedFare.toLocaleString('en-US')}</span>
                  <span className="text-[10px] font-bold text-slate-400 font-sans mr-0.5">د.ع</span>
                </div>
              </div>
            )}
          </div>

          {/* Date Picker - Enhanced */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 flex items-center gap-2 font-cairo">
              <CalendarIcon className="w-4 h-4 text-emerald-400" />
              اختر التاريخ
            </label>
            <div className="border border-slate-800/40 rounded-2xl overflow-hidden bg-[#171f33] shadow-inner">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ar}
                disabled={(date) =>
                  isBefore(startOfDay(date), startOfDay(new Date())) ||
                  isAfter(startOfDay(date), startOfDay(maxScheduleDate))
                }
                className="[&_.rdp]:justify-center [&_.rdp-caption]:px-2 [&_.rdp-cell]:p-0.5 [&_.rdp-cell_button]:h-8 [&_.rdp-cell_button]:w-8 [&_.rdp-cell_button]:text-xs [&_.rdp-head_cell]:text-xs [&_.rdp-head_cell]:font-semibold [&_.rdp_today]:bg-emerald-500/10 [&_.rdp_today]:text-emerald-400 [&_.rdp_selected]:bg-emerald-500 [&_.rdp_selected]:text-white [&_.rdp-nav_button]:text-slate-400"
              />
            </div>
            <p className="text-[11px] font-medium text-slate-500 font-tajawal">متاح من ساعتين مقدماً إلى 30 يوماً</p>
          </div>

          {/* Time Picker with Button Grid */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 flex items-center gap-2 font-cairo">
              <Clock className="w-4 h-4 text-emerald-400" />
              اختر الوقت (الساعة والدقيقة)
            </label>
            
            <div className="space-y-4">
              {/* Hours - Circular Button Grid (Full Width) */}
              <div className="bg-[#171f33] border border-slate-800/40 rounded-2xl p-3 shadow-inner">
                <p className="text-[11px] font-bold text-slate-400 mb-2 font-cairo">الساعة</p>
                <div className="grid grid-cols-6 gap-2">
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => setSelectedHour(hour)}
                      className={`h-9 w-full rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                        selectedHour === hour
                          ? 'bg-emerald-500 text-[#0b1326] shadow-md shadow-emerald-500/20 font-sans'
                          : 'bg-[#0d1a2e] text-slate-300 border border-slate-800/60 hover:bg-[#171f33] hover:shadow-sm font-sans'
                      }`}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes - Button Grid (Full Width) */}
              <div className="bg-[#171f33] border border-slate-800/40 rounded-2xl p-3 shadow-inner">
                <p className="text-[11px] font-bold text-slate-400 mb-2 font-cairo">الدقيقة</p>
                <div className="grid grid-cols-4 gap-2">
                  {minutes.map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => setSelectedMinute(minute)}
                      className={`h-9 w-full rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                        selectedMinute === minute
                          ? 'bg-emerald-500 text-[#0b1326] shadow-md shadow-emerald-500/20 font-sans'
                          : 'bg-[#0d1a2e] text-slate-300 border border-slate-800/60 hover:bg-[#171f33] hover:shadow-sm font-sans'
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
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                <Clock className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                <span className="font-bold text-right font-tajawal">
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
          <div className="border border-slate-800/40 rounded-2xl overflow-hidden bg-[#171f33]">
            <button
              onClick={() => toggleSection('tripType')}
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#0d1a2e]/50 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2 text-white font-cairo">
                <span className="text-base">🔄</span> نوع الرحلة
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  expandedSections.tripType ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSections.tripType && (
              <div className="border-t border-slate-800/40 px-4 py-3 space-y-3 bg-[#0d1a2e]/20">
                <Select value={tripType} onValueChange={(value) => setTripType(value as 'one_way' | 'round_trip')}>
                  <SelectTrigger className="bg-[#0d1a2e] border border-slate-800/40 text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#171f33] border border-slate-800/40 text-white">
                    <SelectItem value="one_way">→ ذهاب فقط</SelectItem>
                    <SelectItem value="round_trip">🔄 ذهاب وعودة في نفس اليوم</SelectItem>
                  </SelectContent>
                </Select>

                {/* Return Time - Visible when round_trip selected */}
                {tripType === 'round_trip' && (
                  <div className="space-y-3 pt-3 border-t border-slate-800/40">
                    <p className="text-xs font-bold text-white font-cairo">⏰ موعد العودة</p>
                    <div className="border border-slate-800/40 rounded-xl overflow-hidden bg-[#171f33]">
                      <Calendar
                        mode="single"
                        selected={returnDate}
                        onSelect={setReturnDate}
                        locale={ar}
                        disabled={(date) =>
                          isBefore(startOfDay(date), startOfDay(new Date())) ||
                          isAfter(startOfDay(date), startOfDay(maxScheduleDate))
                        }
                        className="[&_.rdp]:justify-center [&_.rdp-caption]:px-2 [&_.rdp-cell]:p-0.5 [&_.rdp-cell_button]:h-7 [&_.rdp-cell_button]:w-7 [&_.rdp-cell_button]:text-xs [&_.rdp-head_cell]:text-xs [&_.rdp_today]:bg-emerald-500/10 [&_.rdp_today]:text-emerald-400 [&_.rdp_selected]:bg-emerald-500 [&_.rdp_selected]:text-white [&_.rdp-nav_button]:text-slate-400"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      {/* Return Hours Grid */}
                      <div className="bg-[#171f33] border border-slate-800/40 rounded-2xl p-3 shadow-inner">
                        <p className="text-xs font-bold text-slate-400 mb-2 font-cairo">الساعة</p>
                        <div className="grid grid-cols-6 gap-2">
                          {hours.map((hour) => (
                            <button
                              key={`return-${hour}`}
                              type="button"
                              onClick={() => setReturnHour(hour)}
                              className={`h-9 w-full rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                                returnHour === hour
                                  ? 'bg-emerald-500 text-[#0b1326] shadow-sm font-sans'
                                  : 'bg-[#0d1a2e] text-slate-300 hover:bg-[#171f33] border border-slate-800/60 font-sans'
                              }`}
                            >
                              {hour}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Return Minutes Grid */}
                      <div className="bg-[#171f33] border border-slate-800/40 rounded-2xl p-3 shadow-inner">
                        <p className="text-xs font-bold text-slate-400 mb-2 font-cairo">الدقيقة</p>
                        <div className="grid grid-cols-4 gap-2">
                          {minutes.map((minute) => (
                            <button
                              key={`return-${minute}`}
                              type="button"
                              onClick={() => setReturnMinute(minute)}
                              className={`h-9 w-full rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                                returnMinute === minute
                                  ? 'bg-emerald-500 text-[#0b1326] shadow-sm font-sans'
                                  : 'bg-[#0d1a2e] text-slate-300 hover:bg-[#171f33] border border-slate-800/60 font-sans'
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
          <div className="border border-slate-800/40 rounded-2xl overflow-hidden bg-[#171f33]">
            <button
              onClick={() => toggleSection('stops')}
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#0d1a2e]/50 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2 text-white font-cairo">
                <span className="text-base">🛑</span> محطات توقف إضافية
                {stops.length > 0 && <span className="text-xs bg-emerald-50/10 text-emerald-400 px-2 py-0.5 rounded-full ml-1 font-sans">({stops.length})</span>}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  expandedSections.stops ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSections.stops && (
              <div className="border-t border-slate-800/40 px-4 py-3 space-y-2 bg-[#0d1a2e]/20">
                {/* Add Stop Input - Conditional Display */}
                <div className="flex gap-2">
                  {showStopInput && (
                    <Input
                      value={stopInput}
                      onChange={(e) => setStopInput(e.target.value)}
                      placeholder="اكتب عنوان المحطة..."
                      className="text-sm bg-[#0d1a2e] border border-slate-800/40 text-white rounded-xl placeholder:text-slate-500"
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
                    className="whitespace-nowrap rounded-xl border-slate-800/40"
                  >
                    {showStopInput && stopInput.trim() ? 'إضافة' : <Plus className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Stops List */}
                {stops.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 font-cairo">📍 المحطات المضافة:</p>
                    {stops.map((stop, index) => (
                      <div
                        key={`${stop}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/40 bg-[#0d1a2e] px-3 py-2 hover:bg-[#171f33] transition-colors"
                      >
                        <span className="text-sm font-medium text-white truncate">
                          <span className="text-emerald-400 font-bold font-sans ml-1">{index + 1}.</span> {stop}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStops((prev) => prev.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded p-1 transition-colors flex-shrink-0"
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
          <div className="border border-slate-800/40 rounded-2xl overflow-hidden bg-[#171f33]">
            <button
              onClick={() => toggleSection('preferences')}
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#0d1a2e]/50 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2 text-white font-cairo">
                <span className="text-base">💜</span> تفضيلات خاصة
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  expandedSections.preferences ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSections.preferences && (
              <div className="border-t border-slate-800/40 px-4 py-3 space-y-2 bg-[#0d1a2e]/20">
                <div 
                  className="flex items-center gap-3 rounded-xl border border-slate-800/40 bg-[#0d1a2e] px-3 py-3 cursor-pointer hover:bg-[#171f33] transition-colors"
                  onClick={() => setPreferWomenDriver(!preferWomenDriver)}
                >
                  <Checkbox
                    id="preferWomen"
                    checked={preferWomenDriver}
                    onCheckedChange={(value) => setPreferWomenDriver(Boolean(value))}
                    className="border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-[#0b1326] data-[state=checked]:border-emerald-500"
                  />
                  <label htmlFor="preferWomen" className="text-sm font-bold text-white cursor-pointer flex-1 font-cairo">
                    👩 عائلات / سائقة فقط
                    <span className="text-[11px] text-slate-400 font-medium font-tajawal block mt-0.5">قد تطبق رسوم إضافية</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 flex items-center gap-2 font-cairo">
              <span>📝</span> ملاحظات للسائق (اختياري)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: أحتاج مساعدة في الأمتعة، أو لدي طلب خاص..."
              className="resize-none text-sm border border-slate-800/40 bg-[#0d1a2e] text-white rounded-xl placeholder:text-slate-500"
              rows={2}
            />
          </div>

          {/* Confirm Button */}
          <Button 
            onClick={handleSchedule} 
            disabled={!canSchedule || isLoading}
            className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-cairo"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
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
