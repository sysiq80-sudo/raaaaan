/**
 * ران - مكون رفع صورة السائق (إلزامي)
 * يجب على السائق رفع صورة شخصية واضحة قبل التفعيل
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Camera, User, Upload, X, Loader2, Check, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DriverAvatarUploadProps {
  driverId: string;
  currentAvatarUrl: string | null;
  driverName: string;
  onAvatarUpdated: (newUrl: string) => void;
  isRequired?: boolean; // هل الصورة إلزامية (للسائقين الجدد)
}

export const DriverAvatarUpload = ({
  driverId,
  currentAvatarUrl,
  driverName,
  onAvatarUpdated,
  isRequired = false,
}: DriverAvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // فتح مربع اختيار الملف
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  // معالجة اختيار الملف
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!file.type.startsWith("image/")) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار صورة فقط (JPG, PNG)",
        variant: "destructive",
      });
      return;
    }

    // التحقق من حجم الملف (أقل من 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "الصورة كبيرة جداً",
        description: "يرجى اختيار صورة أصغر من 5 ميجابايت",
        variant: "destructive",
      });
      return;
    }

    // إنشاء معاينة
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setSelectedFile(file);
      setShowDialog(true);
    };
    reader.readAsDataURL(file);
  };

  // رفع الصورة
  const handleUpload = async () => {
    if (!selectedFile || !driverId) return;

    setUploading(true);
    try {
      // حذف الصورة القديمة إن وجدت
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split("/").pop();
        if (oldPath && oldPath !== "default-driver.png") {
          await supabase.storage
            .from("avatars")
            .remove([`drivers/${driverId}/${oldPath}`]);
        }
      }

      // رفع الصورة الجديدة
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `drivers/${driverId}/${fileName}`;

      // ✅ ضغط الصورة قبل الرفع
      const { compressImage } = await import('@/utils/compressImage');
      const compressed = await compressImage(selectedFile, { maxDimension: 512, quality: 0.8 });

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, {
          cacheControl: "604800", // كاش أسبوع
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // الحصول على رابط الصورة العام
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // تحديث قاعدة البيانات
      const { error: updateError } = await supabase
        .from("drivers")
        .update({ 
          profile_image_url: publicUrl,
          // إذا كانت أول صورة، نحدث has_profile_photo
          ...(isRequired && !currentAvatarUrl ? { has_profile_photo: true } : {})
        })
        .eq("id", driverId);

      if (updateError) throw updateError;

      toast({
        title: "✅ تم رفع الصورة",
        description: isRequired 
          ? "تم رفع صورتك الشخصية. يمكنك الآن إكمال بقية البيانات" 
          : "تم تحديث صورتك الشخصية بنجاح",
      });

      onAvatarUpdated(publicUrl);
      setShowDialog(false);
      setPreviewUrl(null);
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "خطأ في رفع الصورة",
        description: error.message || "حدث خطأ أثناء رفع الصورة",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Avatar مع زر الكاميرا */}
      <div className="flex flex-col items-center gap-3">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative cursor-pointer"
          onClick={handleSelectFile}
        >
          <Avatar className="w-28 h-28 sm:w-36 sm:h-36 border-4 border-primary/30 shadow-xl">
            <AvatarImage src={currentAvatarUrl || ""} alt={driverName} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-3xl sm:text-4xl font-bold">
              {driverName.charAt(0)}
            </AvatarFallback>
          </Avatar>

          {/* زر الكاميرا */}
          <motion.div
            className="absolute bottom-0 right-0 w-12 h-12 sm:w-14 sm:h-14 bg-primary rounded-full flex items-center justify-center shadow-xl border-4 border-background"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
          </motion.div>

          {/* علامة إلزامي */}
          {isRequired && !currentAvatarUrl && (
            <div className="absolute -top-2 -left-2 w-8 h-8 bg-destructive rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <span className="text-destructive-foreground text-xs font-bold">!</span>
            </div>
          )}
        </motion.div>

        {/* رسالة إلزامية */}
        {isRequired && !currentAvatarUrl && (
          <Alert className="max-w-sm border-destructive/30 bg-destructive/5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-sm text-destructive">
              <strong>إلزامي:</strong> يجب رفع صورة شخصية واضحة لوجهك للمتابعة
            </AlertDescription>
          </Alert>
        )}

        {/* زر رفع (كبديل للنقر على الصورة) */}
        <Button
          onClick={handleSelectFile}
          variant={isRequired && !currentAvatarUrl ? "default" : "outline"}
          className={isRequired && !currentAvatarUrl ? "bg-gradient-to-r from-primary to-primary/80" : ""}
        >
          <Upload className="w-4 h-4 ml-2" />
          {currentAvatarUrl ? "تغيير الصورة" : "رفع صورة شخصية"}
        </Button>
      </div>

      {/* Dialog للمعاينة والتأكيد */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">صورتك الشخصية</DialogTitle>
            <DialogDescription className="text-center">
              {isRequired 
                ? "تأكد من أن الصورة واضحة وتظهر وجهك بشكل كامل"
                : "معاينة الصورة قبل الرفع"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* معاينة الصورة */}
            {previewUrl && (
              <div className="flex justify-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative"
                >
                  <Avatar className="w-48 h-48 border-4 border-primary/30 shadow-2xl">
                    <AvatarImage src={previewUrl} alt="معاينة" />
                    <AvatarFallback>
                      <User className="w-20 h-20 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  {!selectedFile && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {/* متطلبات الصورة */}
            {isRequired && (
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">✅ متطلبات الصورة:</p>
                <ul className="text-muted-foreground space-y-0.5 mr-4">
                  <li>• صورة واضحة لوجهك بالكامل</li>
                  <li>• إضاءة جيدة وخلفية واضحة</li>
                  <li>• بدون نظارات شمسية أو قبعة</li>
                  <li>• حجم أقل من 5 ميجابايت</li>
                </ul>
              </div>
            )}

            {/* الأزرار */}
            <div className="flex gap-2">
              {selectedFile ? (
                <>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    ) : (
                      <Check className="w-4 h-4 ml-2" />
                    )}
                    {uploading ? "جاري الرفع..." : "تأكيد الرفع"}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDialog(false);
                      setPreviewUrl(null);
                      setSelectedFile(null);
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={uploading}
                  >
                    <X className="w-4 h-4 ml-2" />
                    إلغاء
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleSelectFile}
                  className="w-full bg-gradient-to-r from-primary to-primary/80"
                >
                  <Upload className="w-4 h-4 ml-2" />
                  اختر صورة جديدة
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
