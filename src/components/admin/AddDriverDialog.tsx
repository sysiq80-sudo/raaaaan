import { useState } from "react";
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
import { UserPlus, Upload, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Region = Database["public"]["Tables"]["regions"]["Row"];
type VehicleType = Database["public"]["Enums"]["vehicle_type"];
type DriverStatus = Database["public"]["Enums"]["driver_status"];

interface AddDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regions: Region[];
  onSuccess: () => void;
}

export const AddDriverDialog = ({
  open,
  onOpenChange,
  regions,
  onSuccess,
}: AddDriverDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    password: "",
    license_number: "",
    vehicle_type: "economy" as VehicleType,
    vehicle_model: "",
    vehicle_color: "",
    vehicle_plate: "",
    working_region_id: "",
    max_pickup_radius: 10,
    status: "approved" as DriverStatus,
  });
  const [idImage, setIdImage] = useState<File | null>(null);
  const [licenseImage, setLicenseImage] = useState<File | null>(null);

  const uploadDocument = async (file: File, driverId: string, type: "id" | "license") => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${driverId}/${type}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage
      .from("driver-documents")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      // Create a temporary user ID for the driver (admin-created drivers don't need auth account)
      const tempUserId = crypto.randomUUID();

      // Insert driver
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .insert({
          user_id: tempUserId,
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
          admin_controlled: false,
          admin_activated: true,
        })
        .select()
        .single();

      if (driverError) throw driverError;

      // Upload documents if provided
      if (idImage && driver) {
        const idUrl = await uploadDocument(idImage, driver.id, "id");
        await supabase
          .from("drivers")
          .update({ id_image_url: idUrl })
          .eq("id", driver.id);
      }

      if (licenseImage && driver) {
        const licenseUrl = await uploadDocument(licenseImage, driver.id, "license");
        await supabase
          .from("drivers")
          .update({ license_image_url: licenseUrl })
          .eq("id", driver.id);
      }

      toast({
        title: "تم بنجاح",
        description: "تم إضافة السائق بنجاح",
      });

      // Reset form
      setFormData({
        full_name: "",
        phone: "",
        email: "",
        password: "",
        license_number: "",
        vehicle_type: "economy",
        vehicle_model: "",
        vehicle_color: "",
        vehicle_plate: "",
        working_region_id: "",
        max_pickup_radius: 10,
        status: "approved",
      });
      setIdImage(null);
      setLicenseImage(null);

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إضافة السائق",
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
            <UserPlus className="w-5 h-5" />
            إضافة سائق جديد
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
                  placeholder="أدخل اسم السائق"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="07xxxxxxxxx"
                  dir="ltr"
                />
            </div>
          </div>

          {/* Login Credentials */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">بيانات الدخول</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="driver@example.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  * كلمة المرور للاستخدام المستقبلي عند تفعيل حساب السائق
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>رقم الرخصة</Label>
            <Input
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              placeholder="رقم رخصة القيادة"
            />
          </div>
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
                  placeholder="مثال: تويوتا كورولا 2020"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>لون السيارة</Label>
                <Input
                  value={formData.vehicle_color}
                  onChange={(e) => setFormData({ ...formData, vehicle_color: e.target.value })}
                  placeholder="مثال: أبيض"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم اللوحة</Label>
                <Input
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                  placeholder="مثال: 12345 أ"
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
                  <SelectItem value="suspended">موقوف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">الوثائق</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>صورة الهوية</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdImage(e.target.files?.[0] || null)}
                    className="hidden"
                    id="id-image"
                  />
                  <label
                    htmlFor="id-image"
                    className="flex-1 h-10 border border-dashed rounded-md flex items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {idImage ? idImage.name : "اختر صورة"}
                    </span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>صورة الرخصة</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLicenseImage(e.target.files?.[0] || null)}
                    className="hidden"
                    id="license-image"
                  />
                  <label
                    htmlFor="license-image"
                    className="flex-1 h-10 border border-dashed rounded-md flex items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">
                      {licenseImage ? licenseImage.name : "اختر صورة"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              إضافة السائق
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
