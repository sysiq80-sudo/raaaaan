import { useState } from "react";
import { AlertTriangle, Phone, Send, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

interface EmergencyButtonProps {
  rideId?: string;
  currentLocation?: { lat: number; lng: number };
}

export const EmergencyButton = ({ rideId, currentLocation }: EmergencyButtonProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const POLICE_NUMBER = "104";
  const AMBULANCE_NUMBER = "115";

  const loadContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id);

    if (!error && data) {
      setContacts(data as EmergencyContact[]);
    }
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) {
      toast({ title: "يرجى إدخال الاسم ورقم الهاتف", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: user.id,
        name: newContact.name,
        phone: newContact.phone
      });

    if (error) {
      toast({ title: "خطأ في إضافة جهة الاتصال", variant: "destructive" });
    } else {
      toast({ title: "تمت إضافة جهة الاتصال" });
      setNewContact({ name: "", phone: "" });
      loadContacts();
    }
    setLoading(false);
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', id);

    if (!error) {
      setContacts(contacts.filter(c => c.id !== id));
      toast({ title: "تم حذف جهة الاتصال" });
    }
  };

  const sendEmergencyAlert = async () => {
    setSending(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get current location if not provided
      let location = currentLocation;
      if (!location) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000
          });
        });
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }

      // Save emergency alert to database
      const { error: alertError } = await supabase
        .from('emergency_alerts')
        .insert({
          user_id: user.id,
          ride_id: rideId || null,
          location: location
        });

      if (alertError) throw alertError;

      // Generate Google Maps link
      const mapsLink = `https://maps.google.com/maps?q=${location.lat},${location.lng}`;

      // Load contacts
      const { data: emergencyContacts } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id);

      // Send WhatsApp messages to all contacts
      if (emergencyContacts && emergencyContacts.length > 0) {
        const message = encodeURIComponent(
          `🚨 طوارئ! أحتاج مساعدة!\n\nموقعي الحالي:\n${mapsLink}\n\nأرسلت من تطبيق رعان`
        );
        
        // Open WhatsApp with the first contact
        const firstContact = emergencyContacts[0] as EmergencyContact;
        const phone = firstContact.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
      }

      toast({
        title: "تم إرسال تنبيه الطوارئ",
        description: "تم إرسال موقعك إلى جهات الاتصال"
      });

      setShowConfirm(false);

    } catch (error) {
      console.error('Emergency alert error:', error);
      toast({
        title: "خطأ في إرسال التنبيه",
        description: "يرجى الاتصال مباشرة بالطوارئ",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const callEmergency = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  return (
    <>
      {/* SOS Button */}
      <Button
        variant="destructive"
        size="lg"
        className="fixed bottom-24 left-4 z-50 rounded-full h-14 w-14 shadow-lg animate-pulse"
        onClick={() => setShowConfirm(true)}
      >
        <AlertTriangle className="h-6 w-6" />
      </Button>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-destructive">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
              طوارئ
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              هل تريد إرسال تنبيه طوارئ مع موقعك الحالي؟
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid grid-cols-2 gap-2 my-4">
            <Button
              variant="outline"
              className="flex flex-col h-auto py-3"
              onClick={() => callEmergency(POLICE_NUMBER)}
            >
              <Phone className="h-5 w-5 mb-1" />
              <span className="text-xs">الشرطة</span>
              <span className="text-lg font-bold">{POLICE_NUMBER}</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col h-auto py-3"
              onClick={() => callEmergency(AMBULANCE_NUMBER)}
            >
              <Phone className="h-5 w-5 mb-1" />
              <span className="text-xs">الإسعاف</span>
              <span className="text-lg font-bold">{AMBULANCE_NUMBER}</span>
            </Button>
          </div>

          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction
              className="w-full bg-destructive hover:bg-destructive/90"
              onClick={sendEmergencyAlert}
              disabled={sending}
            >
              <Send className="h-4 w-4 ml-2" />
              {sending ? "جاري الإرسال..." : "إرسال موقعي للطوارئ"}
            </AlertDialogAction>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setShowConfirm(false);
                setShowSettings(true);
                loadContacts();
              }}
            >
              إعدادات جهات الاتصال
            </Button>
            <AlertDialogCancel className="w-full">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>جهات اتصال الطوارئ</DialogTitle>
            <DialogDescription>
              أضف أرقام الأشخاص الذين سيتم إرسال موقعك لهم عند الطوارئ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new contact */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>الاسم</Label>
                <Input
                  placeholder="مثال: أحمد"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>رقم الهاتف</Label>
                <Input
                  placeholder="07xxxxxxxx"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  dir="ltr"
                />
              </div>
              <Button
                className="mt-auto"
                onClick={addContact}
                disabled={loading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Contact list */}
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  لم تتم إضافة جهات اتصال بعد
                </p>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground" dir="ltr">
                        {contact.phone}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteContact(contact.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
