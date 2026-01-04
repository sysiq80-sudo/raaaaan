import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  ArrowRight, 
  User, 
  Phone, 
  Car, 
  FileText, 
  CheckCircle, 
  XCircle,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  vehicle_type: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  license_number: string | null;
  status: string;
  created_at: string;
  profile_image_url: string | null;
  id_image_url: string | null;
  id_image_back_url: string | null;
  license_image_url: string | null;
  license_image_back_url: string | null;
  vehicle_image_url: string | null;
  gender: string | null;
  working_region_id: string | null;
}

interface DocumentItem {
  key: keyof Driver;
  label: string;
  icon: React.ReactNode;
}

const documents: DocumentItem[] = [
  { key: 'profile_image_url', label: 'الصورة الشخصية', icon: <User className="h-5 w-5" /> },
  { key: 'id_image_url', label: 'الهوية (أمام)', icon: <FileText className="h-5 w-5" /> },
  { key: 'id_image_back_url', label: 'الهوية (خلف)', icon: <FileText className="h-5 w-5" /> },
  { key: 'license_image_url', label: 'رخصة القيادة (أمام)', icon: <Car className="h-5 w-5" /> },
  { key: 'license_image_back_url', label: 'رخصة القيادة (خلف)', icon: <Car className="h-5 w-5" /> },
  { key: 'vehicle_image_url', label: 'صورة المركبة', icon: <Car className="h-5 w-5" /> },
];

const AdminDriverApplication = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAdminAuth();
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [region, setRegion] = useState<{ name_ar: string } | null>(null);

  useEffect(() => {
    if (isAdmin && id) {
      fetchDriver();
    }
  }, [isAdmin, id]);

  const fetchDriver = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setDriver(data);

      if (data.working_region_id) {
        const { data: regionData } = await supabase
          .from('regions')
          .select('name_ar')
          .eq('id', data.working_region_id)
          .single();
        setRegion(regionData);
      }
    } catch (error) {
      console.error('Error fetching driver:', error);
      toast.error('فشل في تحميل بيانات السائق');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!driver) return;
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'approved' })
        .eq('id', driver.id);

      if (error) throw error;
      
      toast.success('تمت الموافقة على السائق بنجاح');
      navigate('/admin/drivers');
    } catch (error) {
      console.error('Error approving driver:', error);
      toast.error('فشل في الموافقة على السائق');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!driver || !rejectionReason.trim()) {
      toast.error('يرجى إدخال سبب الرفض');
      return;
    }
    
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'rejected' })
        .eq('id', driver.id);

      if (error) throw error;
      
      // Create notification for driver about rejection
      await supabase.from('driver_notifications').insert({
        driver_id: driver.id,
        title: 'تم رفض طلبك',
        body: `سبب الرفض: ${rejectionReason}`,
        type: 'application_rejected',
        data: { reason: rejectionReason }
      });
      
      toast.success('تم رفض الطلب');
      setShowRejectDialog(false);
      navigate('/admin/drivers');
    } catch (error) {
      console.error('Error rejecting driver:', error);
      toast.error('فشل في رفض الطلب');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVehicleTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'economy': 'اقتصادي',
      'comfort': 'مريح',
      'premium': 'فاخر',
      'women_only': 'نسائي'
    };
    return types[type] || type;
  };

  const getDocumentCount = () => {
    if (!driver) return { uploaded: 0, total: 6 };
    let count = 0;
    documents.forEach(doc => {
      if (driver[doc.key]) count++;
    });
    return { uploaded: count, total: 6 };
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="طلب تسجيل سائق">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!driver) {
    return (
      <AdminLayout title="خطأ">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg">لم يتم العثور على السائق</p>
          <Button onClick={() => navigate('/admin/drivers')}>
            العودة للسائقين
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const docCount = getDocumentCount();

  return (
    <AdminLayout title="طلب تسجيل سائق">
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin/drivers')}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">طلب تسجيل سائق</h1>
              <p className="text-muted-foreground">
                مقدم بتاريخ {new Date(driver.created_at).toLocaleDateString('ar-IQ')}
              </p>
            </div>
          </div>
          <Badge variant={driver.status === 'pending' ? 'secondary' : driver.status === 'approved' ? 'default' : 'destructive'}>
            {driver.status === 'pending' ? 'قيد المراجعة' : driver.status === 'approved' ? 'مقبول' : 'مرفوض'}
          </Badge>
        </div>

        {/* Driver Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                المعلومات الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">الاسم الكامل</p>
                  <p className="font-medium">{driver.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                  <p className="font-medium" dir="ltr">{driver.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                  <p className="font-medium">{driver.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الجنس</p>
                  <p className="font-medium">{driver.gender === 'male' ? 'ذكر' : driver.gender === 'female' ? 'أنثى' : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المنطقة</p>
                  <p className="font-medium">{region?.name_ar || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                معلومات المركبة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">نوع الخدمة</p>
                  <p className="font-medium">{getVehicleTypeLabel(driver.vehicle_type)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">موديل السيارة</p>
                  <p className="font-medium">{driver.vehicle_model || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم اللوحة</p>
                  <p className="font-medium">{driver.vehicle_plate || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">لون السيارة</p>
                  <p className="font-medium">{driver.vehicle_color || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم الرخصة</p>
                  <p className="font-medium">{driver.license_number || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                الوثائق المرفقة
              </span>
              <Badge variant={docCount.uploaded === docCount.total ? 'default' : 'secondary'}>
                {docCount.uploaded}/{docCount.total} مكتمل
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => {
                const url = driver[doc.key] as string | null;
                return (
                  <div 
                    key={doc.key}
                    className={`relative rounded-lg border-2 p-4 transition-colors ${
                      url 
                        ? 'border-primary/20 bg-primary/5' 
                        : 'border-dashed border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-full ${url ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {doc.icon}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{doc.label}</p>
                        <p className={`text-xs ${url ? 'text-primary' : 'text-muted-foreground'}`}>
                          {url ? 'مرفق ✓' : 'غير مرفق'}
                        </p>
                      </div>
                    </div>
                    
                    {url && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setPreviewImage(url)}
                        >
                          <ExternalLink className="h-4 w-4 ml-1" />
                          عرض
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDownload(url, `${doc.label}.jpg`)}
                        >
                          <Download className="h-4 w-4 ml-1" />
                          تحميل
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {driver.status === 'pending' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  الموافقة على الطلب
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={processing}
                >
                  <XCircle className="h-5 w-5" />
                  رفض الطلب
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image Preview Dialog */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>معاينة الوثيقة</DialogTitle>
            </DialogHeader>
            {previewImage && (
              <div className="flex justify-center">
                <img 
                  src={previewImage} 
                  alt="Document preview" 
                  className="max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>رفض طلب السائق</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                يرجى إدخال سبب رفض الطلب. سيتم إرسال هذا السبب للسائق.
              </p>
              <Textarea
                placeholder="سبب الرفض..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                dir="rtl"
              />
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(false)}
                  disabled={processing}
                >
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : null}
                  تأكيد الرفض
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminDriverApplication;
