/**
 * ران - مكون رفع صورة الراكب
 * يسمح للراكب برفع صورة شخصية (Avatar)
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Camera, User, Upload, X, Loader2, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RiderAvatarUploadProps {
  riderId: string;
  currentAvatarUrl: string | null;
  riderName: string;
  onAvatarUpdated: (newUrl: string) => void;
}

export const RiderAvatarUpload = ({
  riderId,
  currentAvatarUrl,
  riderName,
  onAvatarUpdated,
}: RiderAvatarUploadProps) => {
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
        description: "يرجى اختيار صورة فقط",
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
    if (!selectedFile || !riderId) return;

    setUploading(true);
    try {
      // حذف الصورة القديمة إن وجدت
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split("/").pop();
        if (oldPath && oldPath !== "default-avatar.png") {
          await supabase.storage
            .from("avatars")
            .remove([`riders/${riderId}/${oldPath}`]);
        }
      }

      // رفع الصورة الجديدة
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `riders/${riderId}/${fileName}`;

      // ✅ ضغط الصورة قبل الرفع
      const { compressImage } = await import('@/utils/compressImage');
      const compressed = await compressImage(selectedFile, { maxDimension: 512, quality: 0.8 });

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, {
          cacheControl: "604800",
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
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", riderId);

      if (updateError) throw updateError;

      toast({
        title: "✅ تم رفع الصورة",
        description: "تم تحديث صورتك الشخصية بنجاح",
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

  // حذف الصورة
  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl || !riderId) return;

    setUploading(true);
    try {
      // حذف من Storage
      const oldPath = currentAvatarUrl.split("/").pop();
      if (oldPath && oldPath !== "default-avatar.png") {
        await supabase.storage
          .from("avatars")
          .remove([`riders/${riderId}/${oldPath}`]);
      }

      // تحديث قاعدة البيانات
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", riderId);

      if (error) throw error;

      toast({
        title: "✅ تم حذف الصورة",
        description: "تم حذف صورتك الشخصية",
      });

      onAvatarUpdated("");
      setShowDialog(false);
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      toast({
        title: "خطأ في حذف الصورة",
        description: error.message || "حدث خطأ أثناء حذف الصورة",
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
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Avatar مع زر الكاميرا */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative cursor-pointer"
        onClick={handleSelectFile}
      >
        <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-primary/30 shadow-xl">
          <AvatarImage src={currentAvatarUrl || ""} alt={riderName} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-2xl sm:text-3xl font-bold">
            {riderName.charAt(0)}
          </AvatarFallback>
        </Avatar>

        {/* زر الكاميرا */}
        <motion.div
          className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-full flex items-center justify-center shadow-lg border-3 border-background"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
        </motion.div>
      </motion.div>

      {/* Dialog للمعاينة والتأكيد */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">صورتك الشخصية</DialogTitle>
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
                  <Avatar className="w-40 h-40 border-4 border-primary/30 shadow-xl">
                    <AvatarImage src={previewUrl} alt="معاينة" />
                    <AvatarFallback>
                      <User className="w-16 h-16 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  {!selectedFile && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </motion.div>
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
                    {uploading ? "جاري الرفع..." : "تأكيد"}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDialog(false);
                      setPreviewUrl(null);
                      setSelectedFile(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 ml-2" />
                    إلغاء
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleSelectFile}
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                  >
                    <Upload className="w-4 h-4 ml-2" />
                    اختر صورة جديدة
                  </Button>
                  {currentAvatarUrl && (
                    <Button
                      onClick={handleRemoveAvatar}
                      disabled={uploading}
                      variant="destructive"
                      className="flex-1"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      ) : (
                        <X className="w-4 h-4 ml-2" />
                      )}
                      حذف الصورة
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
