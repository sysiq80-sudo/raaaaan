import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Upload, 
  Loader2, 
  X, 
  ZoomIn, 
  CheckCircle, 
  AlertCircle,
  Car,
  User,
  CreditCard,
  Download,
  ExternalLink
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];

interface DriverDocumentsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  onSuccess: () => void;
}

interface DocumentItem {
  key: string;
  label: string;
  url: string | null;
  icon: React.ReactNode;
}

export const DriverDocumentsViewer = ({
  open,
  onOpenChange,
  driver,
  onSuccess,
}: DriverDocumentsViewerProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const documents: DocumentItem[] = [
    {
      key: "profile_image_url",
      label: "الصورة الشخصية",
      url: driver?.profile_image_url || null,
      icon: <User className="w-4 h-4" />
    },
    {
      key: "id_image_url",
      label: "البطاقة الموحدة (أمام)",
      url: driver?.id_image_url || null,
      icon: <CreditCard className="w-4 h-4" />
    },
    {
      key: "id_image_back_url",
      label: "البطاقة الموحدة (خلف)",
      url: driver?.id_image_back_url || null,
      icon: <CreditCard className="w-4 h-4" />
    },
    {
      key: "license_image_url",
      label: "إجازة السوق (أمام)",
      url: driver?.license_image_url || null,
      icon: <FileText className="w-4 h-4" />
    },
    {
      key: "license_image_back_url",
      label: "إجازة السوق (خلف)",
      url: driver?.license_image_back_url || null,
      icon: <FileText className="w-4 h-4" />
    },
    {
      key: "vehicle_image_url",
      label: "صورة السيارة",
      url: driver?.vehicle_image_url || null,
      icon: <Car className="w-4 h-4" />
    },
  ];

  const uploadedCount = documents.filter(d => d.url).length;
  const totalCount = documents.length;
  const isComplete = uploadedCount === totalCount;

  const uploadDocument = async (file: File, key: string) => {
    if (!driver) return;

    setUploading(key);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${driver.user_id}/${key.replace('_url', '')}.${fileExt}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from("driver-documents")
        .getPublicUrl(fileName);

      // Update driver record
      const { error: updateError } = await supabase
        .from("drivers")
        .update({ [key]: data.publicUrl })
        .eq("id", driver.id);

      if (updateError) throw updateError;

      toast({
        title: "تم بنجاح",
        description: "تم رفع الوثيقة بنجاح",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في رفع الوثيقة",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument(file, key);
    }
  };

  const handleDownload = (url: string, label: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${driver?.full_name}_${label}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              وثائق السائق - {driver?.full_name}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Documents Status */}
              <div className={`p-4 rounded-lg flex items-center justify-between ${isComplete ? "bg-green-500/10 border border-green-500/30" : "bg-amber-500/10 border border-amber-500/30"}`}>
                <div className="flex items-center gap-3">
                  {isComplete ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-medium">جميع الوثائق مكتملة ({uploadedCount}/{totalCount})</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <span className="text-amber-700 font-medium">الوثائق غير مكتملة ({uploadedCount}/{totalCount})</span>
                    </>
                  )}
                </div>
              </div>

              {/* Driver Info Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">الاسم</p>
                  <p className="font-medium">{driver?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الهاتف</p>
                  <p className="font-medium" dir="ltr">{driver?.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">نوع السيارة</p>
                  <p className="font-medium">
                    {driver?.vehicle_type === 'economy' && 'اقتصادي'}
                    {driver?.vehicle_type === 'comfort' && 'مريح'}
                    {driver?.vehicle_type === 'premium' && 'فاخر'}
                    {driver?.vehicle_type === 'women_only' && 'نسائي'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">موديل السيارة</p>
                  <p className="font-medium">{driver?.vehicle_model || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">لون السيارة</p>
                  <p className="font-medium">{driver?.vehicle_color || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">رقم اللوحة</p>
                  <p className="font-medium">{driver?.vehicle_plate || '-'}</p>
                </div>
              </div>

              {/* Documents Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((doc) => (
                  <div key={doc.key} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        {doc.icon}
                        <span className="font-medium text-sm">{doc.label}</span>
                        {doc.url ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex gap-1">
                        {doc.url && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewImage(doc.url)}
                              className="h-7 px-2"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc.url!, doc.label)}
                              className="h-7 px-2"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(doc.url!, '_blank')}
                              className="h-7 px-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, doc.key)}
                          className="hidden"
                          id={`upload-${doc.key}`}
                        />
                        <label htmlFor={`upload-${doc.key}`}>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild 
                            disabled={uploading === doc.key}
                            className="h-7 px-2"
                          >
                            <span className="cursor-pointer">
                              {uploading === doc.key ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                    
                    {doc.url ? (
                      <div 
                        className="aspect-video bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewImage(doc.url)}
                      >
                        <img
                          src={doc.url}
                          alt={doc.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted/30 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <span className="text-sm">لم يتم الرفع</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 z-10 bg-background/80"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-4 h-4" />
          </Button>
          {previewImage && (
            <img
              src={previewImage}
              alt="معاينة الوثيقة"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
