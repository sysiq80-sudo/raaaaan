/**
 * ران - نظام الاتصال الطارئ (SOS)
 * إضافة جهات اتصال + زر SOS أثناء الرحلة
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Phone,
  Plus,
  Trash2,
  Shield,
  Clock,
  MapPin,
  Loader2
} from "lucide-react";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  user_id: string;
  created_at: string | null;
}

export const EmergencyContactsManager = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    relationship: "friend",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // تحميل جهات الاتصال
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("priority_order");

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({
        title: "خطأ في التحميل",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // إضافة جهة اتصال
  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      toast({
        title: "معلومات ناقصة",
        description: "أدخل الاسم ورقم الهاتف",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل دخول");

      const { error } = await supabase.from("emergency_contacts").insert({
        user_id: user.id,
        name: newContact.name,
        phone: newContact.phone,
      });

      if (error) throw error;

      toast({
        title: "✅ تم الإضافة",
        description: "تم إضافة جهة الاتصال بنجاح",
      });

      setShowAddDialog(false);
      setNewContact({ name: "", phone: "", relationship: "friend" });
      fetchContacts();
    } catch (error: any) {
      toast({
        title: "خطأ في الإضافة",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // حذف جهة اتصال
  const handleDelete = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from("emergency_contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف جهة الاتصال",
      });

      fetchContacts();
    } catch (error: any) {
      toast({
        title: "خطأ في الحذف",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                جهات الاتصال للطوارئ
              </CardTitle>
              <CardDescription>
                سيتم إشعار هذه الجهات تلقائياً عند الضغط على زر SOS
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="w-4 h-4 ml-2" />
              إضافة
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                لم تضف جهات اتصال بعد
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                إضافة أول جهة اتصال
              </Button>
            </div>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {contact.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    جهة اتصال طارئة
                  </Badge>
                  <Button
                    onClick={() => handleDelete(contact.id)}
                    variant="ghost"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* معلومات مهمة */}
          {contacts.length > 0 && (
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 mt-4">
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-600 mb-1">
                    ملاحظة هامة:
                  </p>
                  <p className="text-xs text-muted-foreground">
                    عند الضغط على زر SOS، سيتم إرسال رسالة نصية تلقائية لجميع
                    جهات الاتصال مع موقعك الحالي ومعلومات الرحلة (إن وجدت)
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog إضافة جهة اتصال */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة جهة اتصال للطوارئ</DialogTitle>
            <DialogDescription>
              أضف شخصاً موثوقاً للتواصل معه في حالات الطوارئ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input
                value={newContact.name}
                onChange={(e) =>
                  setNewContact({ ...newContact, name: e.target.value })
                }
                placeholder="أحمد محمد علي"
              />
            </div>

            <div className="space-y-2">
              <Label>رقم الهاتف *</Label>
              <Input
                value={newContact.phone}
                onChange={(e) =>
                  setNewContact({ ...newContact, phone: e.target.value })
                }
                placeholder="07XX XXX XXXX"
                type="tel"
              />
            </div>

            <div className="space-y-2">
              <Label>العلاقة</Label>
              <Select
                value={newContact.relationship}
                onValueChange={(value) =>
                  setNewContact({ ...newContact, relationship: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="family">عائلة</SelectItem>
                  <SelectItem value="friend">صديق</SelectItem>
                  <SelectItem value="colleague">زميل</SelectItem>
                  <SelectItem value="other">آخر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => setShowAddDialog(false)}
              variant="outline"
              disabled={saving}
            >
              إلغاء
            </Button>
            <Button onClick={handleAddContact} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Plus className="w-4 h-4 ml-2" />
              )}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ===================================================
// مكون زر SOS للاستخدام أثناء الرحلة
// ===================================================

interface SOSButtonProps {
  rideId?: string;
}

export const SOSButton = ({ rideId }: SOSButtonProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSOS = async () => {
    try {
      setSending(true);

      // الحصول على الموقع الحالي
      let location = null;
      if ("geolocation" in navigator) {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }
        );
        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل دخول");

      // استدعاء الدالة لإرسال التنبيه
      const { data, error } = await supabase.rpc("trigger_emergency_alert", {
        p_user_id: user.id,
        p_alert_type: "sos",
        p_location: location,
        p_ride_id: rideId || null,
      });

      if (error) throw error;

      toast({
        title: "🆘 تم إرسال تنبيه الطوارئ",
        description: "تم إشعار جميع جهات الاتصال المسجلة",
        variant: "default",
      });

      setShowConfirm(false);
    } catch (error: any) {
      toast({
        title: "خطأ في الإرسال",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowConfirm(true)}
        variant="destructive"
        size="lg"
        className="w-full font-bold text-lg"
      >
        <AlertTriangle className="w-5 h-5 ml-2 animate-pulse" />
        SOS - طوارئ
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              تأكيد تنبيه الطوارئ
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من إرسال تنبيه طوارئ؟
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <p className="text-sm">سيتم إرسال التالي تلقائياً:</p>
              <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                <li className="flex items-center gap-2">
                  <Phone className="w-3 h-3" />
                  رسائل نصية لجهات الاتصال
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-3 h-3" />
                  موقعك الحالي
                </li>
                {rideId && (
                  <li className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    معلومات الرحلة
                  </li>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => setShowConfirm(false)}
              variant="outline"
              disabled={sending}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSOS}
              variant="destructive"
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <AlertTriangle className="w-4 h-4 ml-2" />
              )}
              تأكيد - إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
