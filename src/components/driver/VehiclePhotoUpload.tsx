/**
 * ران - نظام رفع صورة السيارة
 * رفع صورة واحدة للمركبة
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Check, 
  X, 
  Loader2, 
  Camera,
  AlertCircle
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const PHOTO_TYPES = [
  { key: "vehicle", label: "صورة المركبة", icon: "🚗", required: true },
];

interface VehiclePhoto {
  id: string;
  photo_type: string;
  photo_url: string;
  is_verified: boolean;
  uploaded_at: string;
}

export const VehiclePhotoUpload = () => {
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // تحميل الصور الحالية
  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!driverData) return;

      const { data, error } = await supabase
        .from("vehicle_photos")
        .select("*")
        .eq("driver_id", driverData.id);

      if (error) throw error;
      setPhotos(data || []);
    } catch (error: any) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  // رفع صورة
  const handleUpload = async (photoType: string, file: File) => {
    try {
      setUploading(photoType);

      // التحقق من نوع الملف
      if (!file.type.startsWith("image/")) {
        throw new Error("الملف يجب أن يكون صورة");
      }

      // التحقق من الحجم (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("حجم الصورة يجب أن يكون أقل من 5MB");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل دخول");

      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!driverData) throw new Error("السائق غير موجود");

      // حذف الصورة القديمة من نفس النوع (إن وجدت)
      const existingPhoto = photos.find((p) => p.photo_type === photoType);
      if (existingPhoto) {
        const oldPath = existingPhoto.photo_url.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("vehicle-photos")
            .remove([`${driverData.id}/${oldPath}`]);
        }

        await supabase
          .from("vehicle_photos")
          .delete()
          .eq("id", existingPhoto.id);
      }

      // رفع الصورة الجديدة
      const fileExt = file.name.split(".").pop();
      const filePath = `${driverData.id}/${photoType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("vehicle-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // الحصول على URL
      const { data: urlData } = supabase.storage
        .from("vehicle-photos")
        .getPublicUrl(filePath);

      // حفظ في قاعدة البيانات
      const { error: dbError } = await supabase.from("vehicle_photos").insert({
        driver_id: driverData.id,
        photo_type: photoType,
        photo_url: urlData.publicUrl,
        file_size_bytes: file.size,
        mime_type: file.type,
      });

      if (dbError) throw dbError;

      toast({
        title: "✅ تم الرفع",
        description: "تم رفع الصورة بنجاح",
      });

      fetchPhotos();
    } catch (error: any) {
      toast({
        title: "خطأ في الرفع",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const getPhotoForType = (type: string) => photos.find((p) => p.photo_type === type);

  const allRequiredUploaded = PHOTO_TYPES.filter((t) => t.required).every((t) =>
    photos.some((p) => p.photo_type === t.key)
  );

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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              صورة المركبة
            </CardTitle>
            <CardDescription>
              ارفع صورة واضحة للمركبة من الخارج
            </CardDescription>
          </div>
          {allRequiredUploaded && (
            <Badge variant="default" className="gap-1">
              <Check className="w-3 h-3" />
              تم الرفع
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* الشروط */}
        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-600 mb-1">متطلبات الصورة:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• صورة واضحة في الإضاءة الجيدة</li>
                <li>• المركبة كاملة ظاهرة في الإطار</li>
                <li>• أقل من 5MB</li>
                <li>• بدون فلاتر أو تعديلات</li>
              </ul>
            </div>
          </div>
        </div>

        {/* صورة المركبة */}
        <div className="max-w-md mx-auto">
          {PHOTO_TYPES.map((type) => {
            const photo = getPhotoForType(type.key);
            const isUploading = uploading === type.key;

            return (
              <div
                key={type.key}
                className="relative border-2 border-dashed rounded-lg p-6 hover:border-primary/50 transition-colors"
              >
                {/* العنوان */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{type.icon}</span>
                    <div>
                      <span className="text-base font-semibold">{type.label}</span>
                      {type.required && !photo && (
                        <Badge variant="destructive" className="text-xs mr-2">
                          إلزامي
                        </Badge>
                      )}
                    </div>
                  </div>
                  {photo?.is_verified && (
                    <Badge variant="default" className="text-xs gap-1">
                      <Check className="w-3 h-3" />
                      موثق من الإدارة
                    </Badge>
                  )}
                </div>

                {/* معاينة الصورة أو منطقة الرفع */}
                {photo ? (
                  <div className="relative">
                    <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <img
                        src={photo.photo_url}
                        alt={type.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(type.key, file);
                        };
                        input.click();
                      }}
                      size="sm"
                      variant="secondary"
                      className="absolute bottom-3 right-3"
                      disabled={isUploading}
                    >
                      <Camera className="w-4 h-4 ml-2" />
                      تغيير الصورة
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(type.key, file);
                      }}
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <>
                        <Loader2 className="w-12 h-12 animate-spin text-primary mb-3" />
                        <span className="text-sm text-muted-foreground">جارٍ الرفع...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                        <span className="text-base font-medium mb-1">انقر لرفع صورة المركبة</span>
                        <span className="text-xs text-muted-foreground">
                          JPG, PNG (أقل من 5MB)
                        </span>
                      </>
                    )}
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {/* تحذير للصورة غير المرفوعة */}
        {!allRequiredUploaded && (
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-600">
                يجب رفع صورة المركبة لإتمام عملية التسجيل
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
