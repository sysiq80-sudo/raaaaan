import { useState, useEffect, useCallback } from "react";
import { getDriverDocumentUrl } from "@/utils/driverDocumentUrl";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ExternalLink,
  XCircle,
  Clock
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];

// أنواع الوثائق للمراجعة
type DocType = 'profile_image' | 'id_front' | 'id_back' | 'license_front' | 'license_back' | 'vehicle_image';
type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface DocumentReview {
  document_type: DocType;
  status: ReviewStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  expiry_date: string | null;
}

interface DriverDocumentsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  onSuccess: () => void;
}

interface DocumentItem {
  key: string;
  docType: DocType;
  label: string;
  url: string | null;
  icon: React.ReactNode;
}

// ربط أعمدة URL بأنواع الوثائق
const DOC_TYPE_MAP: Record<string, DocType> = {
  profile_image_url: 'profile_image',
  id_image_url: 'id_front',
  id_image_back_url: 'id_back',
  license_image_url: 'license_front',
  license_image_back_url: 'license_back',
  vehicle_image_url: 'vehicle_image',
};

export const DriverDocumentsViewer = ({
  open,
  onOpenChange,
  driver,
  onSuccess,
}: DriverDocumentsViewerProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<DocType, DocumentReview>>({} as any);
  const [rejectingDoc, setRejectingDoc] = useState<DocType | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewLoading, setReviewLoading] = useState<DocType | null>(null);
  // Signed URLs للوثائق (bucket أصبح private)
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null>>({});

  // جلب حالات المراجعة
  const fetchReviews = useCallback(async () => {
    if (!driver) return;
    const { data } = await supabase
      .from("driver_document_reviews" as any)
      .select("document_type, status, rejection_reason, reviewed_at, expiry_date")
      .eq("driver_id", driver.id);
    
    if (data) {
      const map: Record<string, DocumentReview> = {};
      for (const r of data as any[]) {
        map[r.document_type] = r;
      }
      setReviews(map as any);
    }
  }, [driver]);

  // تحميل signed URLs عند فتح الـ dialog
  const resolveSignedUrls = useCallback(async () => {
    if (!driver) return;
    const urlFields = [
      'profile_image_url', 'id_image_url', 'id_image_back_url',
      'license_image_url', 'license_image_back_url', 'vehicle_image_url',
      'residency_image_url', 'guarantor_image_url',
    ] as const;
    const resolved: Record<string, string | null> = {};
    await Promise.all(
      urlFields.map(async (field) => {
        const raw = (driver as any)?.[field];
        resolved[field] = await getDriverDocumentUrl(raw, 3600);
      }),
    );
    setSignedUrls(resolved);
  }, [driver]);

  useEffect(() => {
    if (open && driver) {
      fetchReviews();
      resolveSignedUrls();
    }
  }, [open, driver, fetchReviews, resolveSignedUrls]);

  const documents: DocumentItem[] = [
    {
      key: "profile_image_url",
      docType: "profile_image",
      label: "الصورة الشخصية",
      url: signedUrls["profile_image_url"] || null,
      icon: <User className="w-4 h-4" />
    },
    {
      key: "id_image_url",
      docType: "id_front",
      label: "البطاقة الموحدة (أمام)",
      url: signedUrls["id_image_url"] || null,
      icon: <CreditCard className="w-4 h-4" />
    },
    {
      key: "id_image_back_url",
      docType: "id_back",
      label: "البطاقة الموحدة (خلف)",
      url: signedUrls["id_image_back_url"] || null,
      icon: <CreditCard className="w-4 h-4" />
    },
    {
      key: "license_image_url",
      docType: "license_front",
      label: "إجازة السوق (أمام)",
      url: signedUrls["license_image_url"] || null,
      icon: <FileText className="w-4 h-4" />
    },
    {
      key: "license_image_back_url",
      docType: "license_back",
      label: "إجازة السوق (خلف)",
      url: signedUrls["license_image_back_url"] || null,
      icon: <FileText className="w-4 h-4" />
    },
    {
      key: "vehicle_image_url",
      docType: "vehicle_image",
      label: "صورة السيارة",
      url: signedUrls["vehicle_image_url"] || null,
      icon: <Car className="w-4 h-4" />
    },
  ];

  const uploadedCount = documents.filter(d => d.url).length;
  const totalCount = documents.length;
  const isComplete = uploadedCount === totalCount;

  const approvedCount = Object.values(reviews).filter(r => r.status === 'approved').length;
  const rejectedCount = Object.values(reviews).filter(r => r.status === 'rejected').length;
  const pendingCount = Object.values(reviews).filter(r => r.status === 'pending').length;

  // مراجعة وثيقة (اعتماد أو رفض)
  const handleReviewDocument = async (docType: DocType, status: ReviewStatus, reason?: string) => {
    if (!driver) return;
    setReviewLoading(docType);
    try {
      const { data, error } = await supabase.rpc("review_driver_document" as any, {
        p_driver_id: driver.id,
        p_document_type: docType,
        p_status: status,
        p_rejection_reason: reason || null,
        p_expiry_date: null,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'فشل المراجعة');

      toast({
        title: status === 'approved' ? "✅ تم الاعتماد" : "❌ تم الرفض",
        description: status === 'approved' 
          ? `تم اعتماد الوثيقة بنجاح` 
          : `تم رفض الوثيقة: ${reason}`,
      });

      if (result.all_approved) {
        toast({
          title: "🎉 موافقة تلقائية",
          description: "تم اعتماد جميع الوثائق — تمت الموافقة على السائق تلقائياً",
        });
        onSuccess();
      }

      fetchReviews();
      setRejectingDoc(null);
      setRejectionReason("");
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في مراجعة الوثيقة",
        variant: "destructive",
      });
    } finally {
      setReviewLoading(null);
    }
  };

  const getReviewBadge = (docType: DocType) => {
    const review = reviews[docType];
    if (!review) return null;

    switch (review.status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="w-3 h-3 ml-1" />معتمد</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 ml-1" />مرفوض</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-xs"><Clock className="w-3 h-3 ml-1" />بانتظار المراجعة</Badge>;
    }
  };

  const uploadDocument = async (file: File, key: string) => {
    if (!driver) return;

    setUploading(key);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${driver.user_id}/${key.replace('_url', '')}.${fileExt}`;

      // ✅ ضغط الصورة قبل الرفع
      const { compressImage } = await import('@/utils/compressImage');
      const compressed = await compressImage(file, { maxDimension: 1024, quality: 0.8 });

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(fileName, compressed, { upsert: true, cacheControl: '604800' });

      if (uploadError) throw uploadError;

      // نُخزّن المسار فقط — bucket أصبح private
      const storagePath = fileName;

      // Update driver record
      const { error: updateError } = await supabase
        .from("drivers")
        .update({ [key]: storagePath })
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
                      <span className="text-green-700 font-medium">جميع الوثائق مرفوعة ({uploadedCount}/{totalCount})</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <span className="text-amber-700 font-medium">الوثائق غير مكتملة ({uploadedCount}/{totalCount})</span>
                    </>
                  )}
                </div>
                {Object.keys(reviews).length > 0 && (
                  <div className="flex gap-2 text-xs">
                    {approvedCount > 0 && <Badge className="bg-green-100 text-green-800">معتمد: {approvedCount}</Badge>}
                    {pendingCount > 0 && <Badge variant="secondary">بانتظار: {pendingCount}</Badge>}
                    {rejectedCount > 0 && <Badge variant="destructive">مرفوض: {rejectedCount}</Badge>}
                  </div>
                )}
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
                {documents.map((doc) => {
                  const review = reviews[doc.docType];
                  const isRejected = review?.status === 'rejected';
                  const isApproved = review?.status === 'approved';

                  return (
                  <div key={doc.key} className={`border rounded-lg overflow-hidden ${isRejected ? 'border-red-300' : isApproved ? 'border-green-300' : ''}`}>
                    <div className="flex items-center justify-between p-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        {doc.icon}
                        <span className="font-medium text-sm">{doc.label}</span>
                        {getReviewBadge(doc.docType) || (doc.url ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        ))}
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

                    {/* أزرار مراجعة الوثيقة */}
                    {doc.url && (
                      <div className="p-2 border-t bg-muted/10">
                        {isRejected && review?.rejection_reason && (
                          <p className="text-xs text-red-600 mb-2 px-1">سبب الرفض: {review.rejection_reason}</p>
                        )}
                        {rejectingDoc === doc.docType ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="سبب الرفض (مطلوب)..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="text-sm h-16"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={!rejectionReason.trim() || reviewLoading === doc.docType}
                                onClick={() => handleReviewDocument(doc.docType, 'rejected', rejectionReason)}
                                className="h-7 text-xs"
                              >
                                {reviewLoading === doc.docType ? <Loader2 className="w-3 h-3 animate-spin" /> : 'تأكيد الرفض'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setRejectingDoc(null); setRejectionReason(""); }}
                                className="h-7 text-xs"
                              >
                                إلغاء
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewLoading === doc.docType || isApproved}
                              onClick={() => handleReviewDocument(doc.docType, 'approved')}
                              className={`h-7 text-xs flex-1 ${isApproved ? 'bg-green-50 text-green-700 border-green-300' : ''}`}
                            >
                              {reviewLoading === doc.docType ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                                <><CheckCircle className="w-3 h-3 ml-1" />{isApproved ? 'معتمد' : 'اعتماد'}</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewLoading === doc.docType}
                              onClick={() => setRejectingDoc(doc.docType)}
                              className={`h-7 text-xs flex-1 ${isRejected ? 'bg-red-50 text-red-700 border-red-300' : ''}`}
                            >
                              <XCircle className="w-3 h-3 ml-1" />{isRejected ? 'مرفوض' : 'رفض'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
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
