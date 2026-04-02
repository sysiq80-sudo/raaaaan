import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Loader2, Save, Key, Mail, Phone } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Region = Database["public"]["Tables"]["regions"]["Row"];
type VehicleType = Database["public"]["Enums"]["vehicle_type"];
type DriverStatus = Database["public"]["Enums"]["driver_status"];

interface EditDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  regions: Region[];
  onSuccess: () => void;
}

export const EditDriverDialog = ({
  open,
  onOpenChange,
  driver,
  regions,
  onSuccess,
}: EditDriverDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    license_number: "",
    vehicle_type: "economy" as VehicleType,
    vehicle_model: "",
    vehicle_color: "",
    vehicle_plate: "",
    working_region_id: "",
    max_pickup_radius: 10,
    status: "pending" as DriverStatus,
    rating: 5,
  });
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (driver) {
      setFormData({
        full_name: driver.full_name,
        phone: driver.phone,
        email: (driver as any).email || "",
        license_number: driver.license_number || "",
        vehicle_type: driver.vehicle_type || "economy",
        vehicle_model: driver.vehicle_model || "",
        vehicle_color: driver.vehicle_color || "",
        vehicle_plate: driver.vehicle_plate || "",
        working_region_id: driver.working_region_id || "",
        max_pickup_radius: driver.max_pickup_radius || 10,
        status: driver.status || "pending",
        rating: Number(driver.rating) || 5,
      });
      setNewPassword("");
    }
  }, [driver]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!driver) return;

    if (!formData.full_name || !formData.phone) {
      toast({
        title: "خطأ",
        description: "يرجى ملء الاسم ورقم الهاتف",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. تحديث بيانات السائق
      const { error } = await supabase
        .from("drivers")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email || null,
          license_number: formData.license_number || null,
          vehicle_type: formData.vehicle_type,
          vehicle_model: formData.vehicle_model || null,
          vehicle_color: formData.vehicle_color || null,
          vehicle_plate: formData.vehicle_plate || null,
          working_region_id: formData.working_region_id || null,
          max_pickup_radius: formData.max_pickup_radius,
          status: formData.status,
          rating: formData.rating,
        })
        .eq("id", driver.id);

      if (error) throw error;

      // 2. تغيير كلمة المرور إذا تم إدخالها
      if (newPassword && newPassword.length >= 6 && driver.user_id) {
        const { data: sessionData } = await supabase.auth.getSession();

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bright-endpoint`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData?.session?.access_token}`,
            },
            body: JSON.stringify({
              action: 'update_user_password',
              userId: driver.user_id,
              password: newPassword,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'فشل في تغيير كلمة المرور');
        }

        toast({
          title: "تم بنجاح",
          description: "تم تحديث بيانات السائق وكلمة المرور",
        });
      } else {
        toast({
          title: "تم بنجاح",
          description: "تم تحديث بيانات السائق",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تحديث بيانات السائق",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            تعديل بيانات السائق
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Personal Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">المعلومات الشخصية</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم الكامل *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Login Credentials */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <Key className="w-4 h-4" />
              بيانات الدخول
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  رقم الواتساب
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="07xxxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  البريد الإلكتروني
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="driver@example.com"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة (اختياري)</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="اتركه فارغاً إذا لا تريد تغيير كلمة المرور"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                * سيتم استخدام كلمة المرور عند تفعيل حساب السائق للتسجيل
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>رقم الرخصة</Label>
            <Input
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
            />
          </div>

          {/* Vehicle Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">معلومات السيارة</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نوع السيارة</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_type: value as VehicleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">اقتصادي</SelectItem>
                    <SelectItem value="comfort">مريح</SelectItem>
                    <SelectItem value="premium">فاخر</SelectItem>
                    <SelectItem value="women_only">نسائي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>موديل السيارة</Label>
                <Input
                  value={formData.vehicle_model}
                  onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>لون السيارة</Label>
                <Input
                  value={formData.vehicle_color}
                  onChange={(e) => setFormData({ ...formData, vehicle_color: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>رقم اللوحة</Label>
                <Input
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Work Settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">إعدادات العمل</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>منطقة العمل</Label>
                <Select
                  value={formData.working_region_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, working_region_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المنطقة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">جميع المناطق</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نطاق البحث (كم)</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={formData.max_pickup_radius}
                  onChange={(e) => setFormData({ ...formData, max_pickup_radius: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>حالة السائق</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as DriverStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">معتمد</SelectItem>
                    <SelectItem value="pending">بانتظار الموافقة</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                    <SelectItem value="suspended">موقوف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>التقييم</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
