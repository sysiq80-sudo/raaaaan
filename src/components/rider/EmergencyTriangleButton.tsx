import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, MapPin, Settings, X, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ComplaintDialog } from '@/components/common/ComplaintDialog';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

interface EmergencyTriangleButtonProps {
  rideId?: string;
  currentLocation?: { lat: number; lng: number };
}

export const EmergencyTriangleButton: React.FC<EmergencyTriangleButtonProps> = ({
  rideId,
  currentLocation
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showComplaintDialog, setShowComplaintDialog] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [sending, setSending] = useState(false);
  const [endingRide, setEndingRide] = useState(false);
  const [driverName, setDriverName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (showSettings) {
      loadContacts();
    }
  }, [showSettings]);

  const loadContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      setContacts(data);
    }
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) {
      toast({ title: 'يرجى ملء جميع الحقول', variant: 'destructive' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: user.id,
        name: newContact.name,
        phone: newContact.phone
      });

    if (!error) {
      setNewContact({ name: '', phone: '' });
      loadContacts();
      toast({ title: 'تمت الإضافة بنجاح' });
    }
  };

  const deleteContact = async (id: string) => {
    await supabase.from('emergency_contacts').delete().eq('id', id);
    loadContacts();
  };

  const callEmergency = () => {
    window.location.href = 'tel:911';
  };

  const handleEndRideEmergency = async () => {
    if (!rideId) {
      toast({ title: 'لا توجد رحلة نشطة', variant: 'destructive' });
      return;
    }

    setEndingRide(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        // جلب معلومات السائق
        let driverFullName = 'السائق';
        const { data: rideData } = await supabase
          .from('rides')
          .select('driver_id')
          .eq('id', rideId)
          .single();

        if (rideData?.driver_id) {
          const { data: driverInfo } = await supabase
            .from('drivers')
            .select('full_name')
            .eq('id', rideData.driver_id)
            .single();
          
          if (driverInfo?.full_name) {
            driverFullName = driverInfo.full_name;
          }
        }
        setDriverName(driverFullName);
      } catch (err) {
        console.warn('Could not fetch driver info:', err);
      }

      // تسجيل استخدام الطوارئ - Wrapped to prevent crashing
      try {
        await supabase.from('emergency_usage_log').insert({
          user_id: user.id,
          user_type: 'rider',
          action_type: 'end_ride',
          ride_id: rideId,
          location: currentLocation,
          reason: 'emergency_end'
        });
      } catch (logErr) {
        console.warn('Logging emergency failed:', logErr);
      }

      // إنهاء الرحلة بعلامة طوارئ - باستخدام system لتجاوز أخطاء قواعد البيانات المتعلقة بغرامات الإلغاء
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'cancelled',
          cancellation_reason: 'إنهاء طارئ من قبل الراكب',
          cancelled_by: 'system'
        })
        .eq('id', rideId);

      if (error) {
        console.error('❌ Error ending ride:', error);
        throw new Error('فشل إنهاء الرحلة: ' + error.message);
      }

      console.log('✅ Ride ended successfully');

      // انتظار 500ms للتأكد من تحديث الـ subscription
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({ 
        title: '✅ تم إنهاء الرحلة', 
        description: 'تم إنهاء الرحلة بنجاح. يمكنك الآن تقديم شكوى إذا كنت بحاجة لذلك.',
        duration: 5000
      });

      // إغلاق نافذة الطوارئ وفتح نافذة الشكوى
      setShowDialog(false);
      
      // فتح نافذة الشكوى فقط إذا أراد المستخدم
      // بعد 1 ثانية لإعطاء الوقت للنظام للتحديث
      setTimeout(() => {
        setShowComplaintDialog(true);
      }, 1000);

    } catch (error: any) {
      console.error('❌ Error ending ride:', error);
      toast({ 
        title: 'فشل إنهاء الرحلة', 
        description: error.message || 'حدث خطأ غير متوقع',
        variant: 'destructive',
        duration: 7000
      });
    } finally {
      setEndingRide(false);
    }
  };

  const sendLocationToEmergency = async () => {
    if (!currentLocation) {
      toast({ 
        title: '⚠️ موقعك غير متاح', 
        description: 'يرجى تفعيل GPS',
        variant: 'locationError' as any,
        duration: 3000 
      });
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save emergency alert to database
      await supabase.from('emergency_alerts').insert({
        user_id: user.id,
        ride_id: rideId || null,
        location: currentLocation,
        status: 'active'
      });

      const mapsUrl = `https://maps.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`;

      // Send to all emergency contacts via WhatsApp
      for (const contact of contacts) {
        const message = `🆘 طوارئ! أحتاج مساعدة!\n📍 موقعي: ${mapsUrl}`;
        const whatsappUrl = `https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }

      toast({ title: '✅ تم إرسال موقعك لجهات الاتصال' });
    } catch (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Triangle Button - تصميم محسن */}
      <Button
        variant="ghost"
        size="sm"
        className="relative p-2 h-10 w-10 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-center"
        onClick={() => setShowDialog(true)}
      >
        <div className="relative">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 animate-pulse drop-shadow-lg" />
          <span className="absolute inset-0 rounded-full bg-red-950/50 animate-ping" />
        </div>
      </Button>

      {/* Main Emergency Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden bg-[#0A0D14] backdrop-blur-2xl border border-red-500/30 shadow-[0_0_40px_rgba(220,38,38,0.15)] rounded-2xl" dir="rtl">
          <DialogDescription className="sr-only">خيارات الطوارئ للركاب وإرسال الموقع</DialogDescription>
          <div className="bg-gradient-to-b from-red-950/40 to-transparent p-6 pb-4 text-center border-b border-white/5 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 relative shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
              <AlertTriangle className="w-8 h-8 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white tracking-wide">
              مركز الطوارئ
            </DialogTitle>
            <p className="text-sm text-slate-400 mt-2">
              نحن معك، اختر الإجراء المناسب لحمايتك فوراً.
            </p>
          </div>

          <div className="p-5 space-y-3">
            {/* 911 Call Button */}
            <Button
              className="w-full h-20 text-xl font-bold flex items-center justify-between px-6 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-2xl shadow-[0_4px_20px_rgba(220,38,38,0.3)] transition-all active:scale-[0.98] border border-red-400/20"
              onClick={callEmergency}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                  <Phone className="w-6 h-6 text-white drop-shadow-md" />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-xs font-medium text-red-100 uppercase tracking-wider">استدعاء الشرطة / الإسعاف</span>
                  <span className="text-xl">الطوارئ <span className="font-black text-2xl tracking-widest pl-1">911</span></span>
                </div>
              </div>
            </Button>

            {/* End Ride Emergency Button */}
            {rideId && (
              <Button
                variant="outline"
                className="w-full h-16 text-lg font-bold flex items-center justify-start gap-4 px-4 bg-red-950/20 border-red-500/30 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-2xl transition-all active:scale-[0.98]"
                onClick={handleEndRideEmergency}
                disabled={endingRide}
              >
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  {endingRide ? <Loader2 className="w-5 h-5 animate-spin"/> : <XCircle className="w-5 h-5" />}
                </div>
                <span>{endingRide ? 'جاري إنهاء الرحلة...' : 'إنهاء الرحلة فوراً'}</span>
              </Button>
            )}

            {/* Send Location */}
            <Button
              variant="outline"
              className="w-full h-16 text-lg font-bold flex items-center justify-start gap-4 px-4 bg-slate-900/50 border-white/5 hover:bg-slate-800 text-slate-300 rounded-2xl transition-all active:scale-[0.98]"
              onClick={sendLocationToEmergency}
              disabled={sending || contacts.length === 0}
            >
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                {sending ? <Loader2 className="w-5 h-5 animate-spin"/> : <MapPin className="w-5 h-5 text-emerald-400" />}
              </div>
              <div className="flex flex-col items-start">
                <span>إرسال موقعي لجهات الاتصال</span>
                {contacts.length === 0 && <span className="text-[10px] text-amber-500/80 font-normal mt-0.5">يرجى إضافة جهات اتصال أولاً</span>}
              </div>
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              className="w-full h-12 text-sm flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all mt-2"
              onClick={() => {
                setShowDialog(false);
                setShowSettings(true);
              }}
            >
              <Settings className="w-4 h-4" />
              <span>إعدادات جهات الاتصال</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>جهات اتصال الطوارئ</DialogTitle>
            <DialogDescription className="sr-only">إدارة وإضافة جهات اتصال الطوارئ الخاصة بك لاستخدامها عند الحاجة.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new contact */}
            <div className="space-y-2">
              <Input
                placeholder="الاسم"
                value={newContact.name}
                onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="رقم الهاتف"
                value={newContact.phone}
                onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                dir="ltr"
              />
              <Button onClick={addContact} className="w-full">
                إضافة جهة اتصال
              </Button>
            </div>

            {/* Contacts list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{contact.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{contact.phone}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteContact(contact.id)}
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {contacts.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  لا توجد جهات اتصال
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complaint Dialog */}
      {rideId && (
        <ComplaintDialog
          open={showComplaintDialog}
          onOpenChange={setShowComplaintDialog}
          rideId={rideId}
          complainantType="rider"
          otherPartyName={driverName || 'السائق'}
        />
      )}
    </>
  );
};
