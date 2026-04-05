import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, MapPin, Settings, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

      // جلب معلومات السائق
      const { data: rideData } = await supabase
        .from('rides')
        .select('driver_id, drivers(full_name)')
        .eq('id', rideId)
        .single();

      if (rideData?.drivers) {
        setDriverName((rideData.drivers as any).full_name || 'السائق');
      }

      // تسجيل استخدام الطوارئ
      await supabase.from('emergency_usage_log').insert({
        user_id: user.id,
        user_type: 'rider',
        action_type: 'end_ride',
        ride_id: rideId,
        location: currentLocation,
        reason: 'emergency_end'
      });

      // إنهاء الرحلة بعلامة طوارئ
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          emergency_completed: true,
          emergency_end_reason: 'rider_ended',
          ended_by: 'rider'
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
        className="relative p-2 h-10 w-10 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
        onClick={() => setShowDialog(true)}
      >
        <div className="relative">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-500 animate-pulse drop-shadow-lg" />
          <span className="absolute inset-0 rounded-full bg-red-950/50 animate-ping" />
        </div>
      </Button>

      {/* Main Emergency Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              طوارئ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* End Ride Emergency Button */}
            {rideId && (
              <Button
                variant="destructive"
                className="w-full h-16 text-lg font-bold flex flex-col gap-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
                onClick={handleEndRideEmergency}
                disabled={endingRide}
              >
                <XCircle className="w-6 h-6" />
                <span>{endingRide ? 'جاري الإنهاء...' : 'إنهاء الرحلة فوراً'}</span>
              </Button>
            )}

            {/* 911 Call Button */}
            <Button
              variant="destructive"
              className="w-full h-20 text-xl font-bold flex flex-col gap-1"
              onClick={callEmergency}
            >
              <Phone className="w-6 h-6" />
              <span>الطوارئ الموحد</span>
              <span className="text-3xl">911</span>
            </Button>

            {/* Send Location */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12"
              onClick={sendLocationToEmergency}
              disabled={sending || contacts.length === 0}
            >
              <MapPin className="w-5 h-5 text-primary" />
              <span>إرسال موقعي للطوارئ</span>
            </Button>

            {contacts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                أضف جهات اتصال طوارئ أولاً
              </p>
            )}

            {/* Settings */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                setShowDialog(false);
                setShowSettings(true);
              }}
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
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
