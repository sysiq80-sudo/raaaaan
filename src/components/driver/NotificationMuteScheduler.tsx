/**
 * ران — مُجدوِل كتم الإشعارات (Notification Mute Scheduler)
 * 
 * يتيح للسائق:
 * - إيقاف الكتم (استقبال كل الإشعارات)
 * - كتم دائم
 * - كتم مجدول (اختيار وقت البداية والنهاية وأيام الأسبوع)
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNotificationMuteSettings } from "@/stores/driverStore";
import { saveNotificationPreferences, type MuteMode } from "@/services/driverNotificationService";
import { useDriverStore } from "@/stores/driverStore";
import {
  Bell,
  BellOff,
  Clock,
  Calendar,
  Volume2,
  VolumeX,
} from "lucide-react";

interface NotificationMuteSchedulerProps {
  driverId: string;
}

const DAYS_AR = [
  { id: 0, short: 'أحد', full: 'الأحد' },
  { id: 1, short: 'إثن', full: 'الإثنين' },
  { id: 2, short: 'ثلا', full: 'الثلاثاء' },
  { id: 3, short: 'أرب', full: 'الأربعاء' },
  { id: 4, short: 'خمي', full: 'الخميس' },
  { id: 5, short: 'جمع', full: 'الجمعة' },
  { id: 6, short: 'سبت', full: 'السبت' },
];

export const NotificationMuteScheduler = ({ driverId }: NotificationMuteSchedulerProps) => {
  const { toast } = useToast();
  const {
    notificationMuteMode,
    muteScheduleStart,
    muteScheduleEnd,
    muteDays,
    notificationVolume,
    isMutedNow,
    setNotificationMuteMode,
    setMuteSchedule,
    setNotificationVolume,
  } = useNotificationMuteSettings();

  const store = useDriverStore.getState();
  const [saving, setSaving] = useState(false);
  const [currentlyMuted, setCurrentlyMuted] = useState(false);

  // تحديث حالة الكتم الحالية
  useEffect(() => {
    setCurrentlyMuted(isMutedNow());
    const interval = setInterval(() => {
      setCurrentlyMuted(isMutedNow());
    }, 30000); // كل 30 ثانية
    return () => clearInterval(interval);
  }, [isMutedNow, notificationMuteMode, muteScheduleStart, muteScheduleEnd, muteDays]);

  // حفظ التفضيلات في قاعدة البيانات
  const savePreferences = useCallback(async () => {
    setSaving(true);
    try {
      await saveNotificationPreferences(driverId, {
        mute_mode: notificationMuteMode,
        mute_schedule_start: muteScheduleStart,
        mute_schedule_end: muteScheduleEnd,
        mute_days: muteDays,
        sounds_enabled: store.soundsEnabled,
        vibration_enabled: store.vibrationEnabled,
        notification_volume: notificationVolume,
      });
    } catch {
      // صامت — الحفظ المحلي يعمل دائماً
    } finally {
      setSaving(false);
    }
  }, [driverId, notificationMuteMode, muteScheduleStart, muteScheduleEnd, muteDays, notificationVolume, store.soundsEnabled, store.vibrationEnabled]);

  const handleModeChange = async (mode: MuteMode) => {
    setNotificationMuteMode(mode);
    
    if (mode === 'always') {
      toast({
        title: "🔇 تم كتم الإشعارات",
        description: "لن تتلقى تنبيهات حتى تعيد تفعيلها",
      });
    } else if (mode === 'off') {
      toast({
        title: "🔔 الإشعارات مفعّلة",
        description: "ستتلقى جميع التنبيهات",
      });
    } else {
      toast({
        title: "⏰ كتم مجدول",
        description: `الكتم من ${muteScheduleStart} إلى ${muteScheduleEnd}`,
      });
    }

    // حفظ بعد تأخير قصير لضمان تحديث الحالة
    setTimeout(savePreferences, 100);
  };

  const handleTimeChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setMuteSchedule(value, muteScheduleEnd, muteDays);
    } else {
      setMuteSchedule(muteScheduleStart, value, muteDays);
    }
    setTimeout(savePreferences, 300);
  };

  const toggleDay = (dayId: number) => {
    const newDays = muteDays.includes(dayId)
      ? muteDays.filter(d => d !== dayId)
      : [...muteDays, dayId].sort();
    setMuteSchedule(muteScheduleStart, muteScheduleEnd, newDays);
    setTimeout(savePreferences, 300);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setNotificationVolume(vol);
    setTimeout(savePreferences, 500);
  };

  const getModeStyle = (mode: MuteMode) => {
    if (notificationMuteMode === mode) {
      switch (mode) {
        case 'off': return 'bg-green-500 text-white shadow-lg shadow-green-500/40';
        case 'always': return 'bg-red-500 text-white shadow-lg shadow-red-500/40';
        case 'scheduled': return 'bg-amber-500 text-white shadow-lg shadow-amber-500/40';
      }
    }
    return 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50';
  };

  return (
    <Card className="border-border/30 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm">
      <CardContent className="p-4 space-y-4">
        {/* العنوان وحالة الكتم الحالية */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentlyMuted ? (
              <VolumeX className="w-5 h-5 text-red-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-green-400" />
            )}
            <h3 className="font-bold text-sm text-foreground">جدولة كتم الإشعارات</h3>
          </div>
          {currentlyMuted && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full animate-pulse">
              مكتوم الآن
            </span>
          )}
          {!currentlyMuted && notificationMuteMode === 'scheduled' && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              مجدول
            </span>
          )}
        </div>

        {/* أزرار وضع الكتم */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleModeChange('off')}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 ${getModeStyle('off')}`}
          >
            <Bell className="w-5 h-5" />
            <span className="text-[11px] font-medium">مفعّل</span>
          </button>
          
          <button
            onClick={() => handleModeChange('scheduled')}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 ${getModeStyle('scheduled')}`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[11px] font-medium">مجدول</span>
          </button>
          
          <button
            onClick={() => handleModeChange('always')}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 ${getModeStyle('always')}`}
          >
            <BellOff className="w-5 h-5" />
            <span className="text-[11px] font-medium">كتم دائم</span>
          </button>
        </div>

        {/* إعدادات الجدول — تظهر فقط في وضع "مجدول" */}
        {notificationMuteMode === 'scheduled' && (
          <div className="space-y-3 pt-2 border-t border-border/20">
            {/* وقت البداية والنهاية */}
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-1">من</label>
                  <input
                    type="time"
                    value={muteScheduleStart}
                    onChange={(e) => handleTimeChange('start', e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg px-2 py-1.5 text-sm text-foreground focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <span className="text-muted-foreground mt-4">→</span>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-1">إلى</label>
                  <input
                    type="time"
                    value={muteScheduleEnd}
                    onChange={(e) => handleTimeChange('end', e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg px-2 py-1.5 text-sm text-foreground focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* أيام الأسبوع */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-muted-foreground">أيام الكتم</span>
              </div>
              <div className="flex gap-1.5 justify-between">
                {DAYS_AR.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    title={day.full}
                    className={`w-9 h-9 rounded-lg text-[11px] font-bold transition-all duration-200
                      ${muteDays.includes(day.id) 
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' 
                        : 'bg-gray-700/40 text-gray-500 hover:bg-gray-600/40'
                      }`}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>

            {/* ملخص */}
            <div className="bg-amber-500/10 rounded-lg p-2.5 text-xs text-amber-300/80">
              {muteDays.length === 0 ? (
                <span>⚠️ لم يتم اختيار أي يوم — الكتم غير فعّال</span>
              ) : muteDays.length === 7 ? (
                <span>🔇 كتم يومي من {muteScheduleStart} إلى {muteScheduleEnd}</span>
              ) : (
                <span>
                  🔇 كتم في{' '}
                  {muteDays.map(d => DAYS_AR.find(day => day.id === d)?.full).join('، ')}{' '}
                  من {muteScheduleStart} إلى {muteScheduleEnd}
                </span>
              )}
            </div>
          </div>
        )}

        {/* شريط مستوى الصوت */}
        {notificationMuteMode !== 'always' && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/20">
            <Volume2 className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">مستوى الصوت</span>
                <span className="text-[10px] text-blue-400 font-mono">{notificationVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={notificationVolume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        )}

        {/* مؤشر الحفظ */}
        {saving && (
          <div className="text-center text-[10px] text-muted-foreground animate-pulse">
            جارٍ الحفظ...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationMuteScheduler;
