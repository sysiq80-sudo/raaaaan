import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText,
  Phone,
  MessageCircle,
  RefreshCw,
  ArrowLeft,
  Bell,
  Camera
} from "lucide-react";
import { toast } from "sonner";

type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

interface DriverData {
  id: string;
  full_name: string;
  phone: string;
  status: DriverStatus;
  created_at: string;
  vehicle_type: string | null;
  vehicle_model: string | null;
  vehicle_image_url: string | null;
  license_image_url: string | null;
  profile_image_url: string | null;
}

interface DocReview {
  document_type: string;
  status: string;
  rejection_reason: string | null;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  profile_image: 'الصورة الشخصية',
  id_front: 'البطاقة الموحدة (أمام)',
  id_back: 'البطاقة الموحدة (خلف)',
  license_front: 'إجازة السوق (أمام)',
  license_back: 'إجازة السوق (خلف)',
  vehicle_image: 'صورة السيارة',
};

const statusConfig: Record<DriverStatus, {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  pending: {
    icon: <Clock className="h-16 w-16" />,
    title: "طلبك قيد المراجعة",
    description: "نقوم حالياً بمراجعة طلبك والتحقق من المستندات المرفقة. سيتم إعلامك فور اتخاذ القرار.",
    color: "text-amber-600",
    bgColor: "bg-amber-100"
  },
  approved: {
    icon: <CheckCircle2 className="h-16 w-16" />,
    title: "تمت الموافقة على طلبك! 🎉",
    description: "مبروك! يمكنك الآن البدء في استقبال الطلبات وكسب المال. انطلق!",
    color: "text-green-600",
    bgColor: "bg-green-100"
  },
  rejected: {
    icon: <XCircle className="h-16 w-16" />,
    title: "تم رفض طلبك",
    description: "للأسف، لم يتم قبول طلبك في هذه المرة. يمكنك التواصل مع الدعم لمعرفة الأسباب.",
    color: "text-red-600",
    bgColor: "bg-red-100"
  },
  suspended: {
    icon: <AlertTriangle className="h-16 w-16" />,
    title: "حسابك موقوف",
    description: "تم إيقاف حسابك مؤقتاً. يرجى التواصل مع الدعم لمعرفة التفاصيل.",
    color: "text-orange-600",
    bgColor: "bg-orange-100"
  }
};

export default function DriverApplicationStatus() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [docReviews, setDocReviews] = useState<DocReview[]>([]);

  const fetchDriverStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/driver/auth");
        return;
      }

      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        navigate("/driver/register");
        return;
      }

      setDriver(data as DriverData);

      // جلب حالات مراجعة الوثائق
      const { data: reviews } = await supabase
        .from("driver_document_reviews" as any)
        .select("document_type, status, rejection_reason")
        .eq("driver_id", data.id);
      
      if (reviews) {
        setDocReviews(reviews as any[]);
      }
    } catch (error) {
      console.error("Error fetching driver:", error);
      toast.error("حدث خطأ في جلب البيانات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDriverStatus();

    // ⚡ drivers أُزيل من supabase_realtime — polling كل 30 ثانية بدلاً من Realtime
    // هذه الصفحة تُزار مرة واحدة (أثناء انتظار الموافقة) — polling مقبول تماماً
    const pollInterval = setInterval(async () => {
      if (!driver?.id) return;
      const { data } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", driver.id)
        .single();
      if (data) {
        const prev = driver;
        setDriver(data as DriverData);
        if (data.status === 'approved' && prev?.status !== 'approved') {
          toast.success("🎉 تمت الموافقة على طلبك!");
        }
      }
    }, 30000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [navigate, driver?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDriverStatus();
  };

  const isProfileComplete = driver?.vehicle_image_url && 
    driver?.license_image_url && 
    driver?.profile_image_url;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!driver) return null;

  const config = statusConfig[driver.status];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" dir="rtl">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/driver")}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">حالة طلب الانضمام</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="mr-auto text-primary-foreground hover:bg-primary-foreground/20"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Status Card */}
        <Card className="overflow-hidden">
          <div className={`${config.bgColor} p-8 flex flex-col items-center text-center`}>
            <div className={config.color}>
              {config.icon}
            </div>
            <h2 className={`text-2xl font-bold mt-4 ${config.color}`}>
              {config.title}
            </h2>
            <p className="text-muted-foreground mt-2">
              {config.description}
            </p>
          </div>
          
          <CardContent className="p-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">الاسم</span>
              <span className="font-medium">{driver.full_name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">رقم الهاتف</span>
              <span className="font-medium" dir="ltr">{driver.phone}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">تاريخ التقديم</span>
              <span className="font-medium">
                {new Date(driver.created_at).toLocaleDateString('ar-IQ')}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">الحالة</span>
              <Badge variant={
                driver.status === 'approved' ? 'default' :
                driver.status === 'pending' ? 'secondary' :
                'destructive'
              }>
                {driver.status === 'pending' && 'قيد المراجعة'}
                {driver.status === 'approved' && 'مقبول'}
                {driver.status === 'rejected' && 'مرفوض'}
                {driver.status === 'suspended' && 'موقوف'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* تفاصيل الوثائق المرفوضة */}
        {docReviews.some(r => r.status === 'rejected') && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-6 w-6 text-red-600 mt-1 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-2">وثائق تحتاج إعادة رفع</h3>
                  <div className="space-y-2">
                    {docReviews.filter(r => r.status === 'rejected').map((r) => (
                      <div key={r.document_type} className="bg-white/60 rounded p-2">
                        <p className="font-medium text-sm text-red-800">{DOC_TYPE_LABELS[r.document_type] || r.document_type}</p>
                        {r.rejection_reason && (
                          <p className="text-xs text-red-600 mt-1">السبب: {r.rejection_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="mt-3"
                    size="sm"
                    variant="destructive"
                    onClick={() => navigate("/driver/complete-registration")}
                  >
                    <Camera className="w-4 h-4 ml-1" />
                    إعادة رفع الوثائق
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ملخص حالة الوثائق */}
        {docReviews.length > 0 && !docReviews.some(r => r.status === 'rejected') && (
          <Card className="border-muted">
            <CardContent className="p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                حالة الوثائق
              </h3>
              <div className="space-y-1">
                {docReviews.map((r) => (
                  <div key={r.document_type} className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">{DOC_TYPE_LABELS[r.document_type] || r.document_type}</span>
                    <Badge variant={r.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                      {r.status === 'approved' ? 'معتمد' : r.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Completion Warning */}
        {!isProfileComplete && driver.status === 'pending' && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-6 w-6 text-amber-600 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-800">أكمل ملفك الشخصي</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    لم تقم بإكمال جميع البيانات المطلوبة. أكمل ملفك لتسريع عملية المراجعة.
                  </p>
                  <Button 
                    className="mt-3"
                    size="sm"
                    onClick={() => navigate("/driver/complete-registration")}
                  >
                    إكمال الملف الشخصي
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {driver.status === 'approved' && (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-4">
              <h3 className="font-bold text-green-800 mb-3">الخطوات التالية</h3>
              <div className="space-y-2 text-sm text-green-700">
                <p>✓ فعّل وضع "متصل" لاستقبال الطلبات</p>
                <p>✓ تأكد من تفعيل الإشعارات</p>
                <p>✓ حافظ على موقعك مفعّل دائماً</p>
              </div>
              <Button 
                className="w-full mt-4"
                onClick={() => navigate("/driver")}
              >
                الانتقال للصفحة الرئيسية
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contact & Follow */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              تابع آخر الأخبار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              تابع قناة التليغرام الرسمية للإعلان عن قبول طلبات السائقين الجدد وآخر التحديثات
            </p>
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.open("https://t.me/raanapp", "_blank")}
            >
              <MessageCircle className="h-4 w-4" />
              قناة التليغرام الرسمية
            </Button>
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => window.open("tel:+9647884669922", "_blank")}
            >
              <Phone className="h-4 w-4" />
              التواصل مع الدعم
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
