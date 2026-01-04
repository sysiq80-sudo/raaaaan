import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, 
  User, 
  Car, 
  MapPin, 
  Star, 
  Phone, 
  Mail,
  Shield,
  Edit,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Send
} from "lucide-react";
import logo from "@/assets/logo.png";

interface DriverData {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  vehicle_type: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  rating: number;
  total_rides: number;
  total_earnings: number;
  status: string;
  profile_image_url: string | null;
  working_region_id: string | null;
}

interface RegionData {
  id: string;
  name_ar: string;
}

interface EditRequest {
  id: string;
  field_name: string;
  current_value: string | null;
  requested_value: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const EDITABLE_FIELDS = [
  { value: "full_name", label: "الاسم الكامل" },
  { value: "phone", label: "رقم الهاتف" },
  { value: "email", label: "البريد الإلكتروني" },
  { value: "vehicle_model", label: "موديل السيارة" },
  { value: "vehicle_color", label: "لون السيارة" },
  { value: "vehicle_plate", label: "رقم اللوحة" },
];

const DriverProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [region, setRegion] = useState<RegionData | null>(null);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  
  // Edit request dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState("");
  const [requestedValue, setRequestedValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchDriverProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/driver/auth");
        return;
      }

      const { data: driverData, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !driverData) {
        navigate("/driver/auth");
        return;
      }

      setDriver(driverData);

      // Fetch region name if exists
      if (driverData.working_region_id) {
        const { data: regionData } = await supabase
          .from("regions")
          .select("id, name_ar")
          .eq("id", driverData.working_region_id)
          .maybeSingle();
        
        if (regionData) {
          setRegion(regionData);
        }
      }

      // Fetch edit requests
      const { data: requests } = await supabase
        .from("driver_edit_requests")
        .select("*")
        .eq("driver_id", driverData.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (requests) {
        setEditRequests(requests);
      }

      setLoading(false);
    };

    fetchDriverProfile();
  }, [navigate]);

  const getVehicleTypeName = (type: string | null) => {
    switch (type) {
      case "economy": return "اقتصادي";
      case "comfort": return "مريح";
      case "premium": return "فاخر";
      case "women_only": return "تكسي نسائي";
      default: return "غير محدد";
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">معتمد</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">قيد المراجعة</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">مرفوض</Badge>;
      case "suspended":
        return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">موقوف</Badge>;
      default:
        return <Badge variant="secondary">غير معروف</Badge>;
    }
  };

  const getGenderName = (gender: string | null) => {
    switch (gender) {
      case "male": return "ذكر";
      case "female": return "أنثى";
      default: return "غير محدد";
    }
  };

  const getFieldLabel = (fieldName: string) => {
    return EDITABLE_FIELDS.find(f => f.value === fieldName)?.label || fieldName;
  };

  const getCurrentFieldValue = (fieldName: string): string => {
    if (!driver) return "";
    const value = driver[fieldName as keyof DriverData];
    return value?.toString() || "";
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            <Clock className="w-3 h-3 ml-1" />
            قيد المراجعة
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
            <CheckCircle className="w-3 h-3 ml-1" />
            تمت الموافقة
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
            <XCircle className="w-3 h-3 ml-1" />
            مرفوض
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSubmitRequest = async () => {
    if (!driver || !selectedField || !requestedValue.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    // Check if there's already a pending request for this field
    const hasPendingRequest = editRequests.some(
      r => r.field_name === selectedField && r.status === "pending"
    );

    if (hasPendingRequest) {
      toast({
        title: "طلب موجود",
        description: "لديك طلب تعديل قيد المراجعة لهذا الحقل",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from("driver_edit_requests")
      .insert({
        driver_id: driver.id,
        field_name: selectedField,
        current_value: getCurrentFieldValue(selectedField),
        requested_value: requestedValue.trim(),
        reason: reason.trim() || null,
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      console.error("Error submitting edit request:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال الطلب",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "تم إرسال الطلب",
      description: "سيتم مراجعة طلبك من قبل الإدارة",
    });

    // Add to local state
    if (data) {
      setEditRequests(prev => [data, ...prev]);
    }

    // Reset form
    setDialogOpen(false);
    setSelectedField("");
    setRequestedValue("");
    setReason("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return null;
  }

  const pendingRequestsCount = editRequests.filter(r => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container max-w-lg flex items-center justify-between h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/driver")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">الملف الشخصي</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="pt-20 pb-8 px-4">
        <div className="container max-w-lg space-y-6">
          
          {/* Profile Header Card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-6">
              <div className="flex items-center gap-4">
                <img 
                  src={driver.profile_image_url || logo} 
                  alt="صورة السائق"
                  className="w-20 h-20 rounded-full object-cover border-4 border-background shadow-lg"
                  onError={(e) => { e.currentTarget.src = logo; }}
                />
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-foreground">{driver.full_name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-4 h-4 text-warning fill-warning" />
                    <span className="font-medium">{driver.rating?.toFixed(1) || "5.0"}</span>
                    <span className="text-muted-foreground text-sm">
                      ({driver.total_rides || 0} رحلة)
                    </span>
                  </div>
                  <div className="mt-2">
                    {getStatusBadge(driver.status)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Edit Request Button */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">طلب تعديل البيانات</p>
                    <p className="text-sm text-muted-foreground">
                      {pendingRequestsCount > 0 
                        ? `لديك ${pendingRequestsCount} طلب قيد المراجعة`
                        : "أرسل طلب للإدارة لتعديل بياناتك"
                      }
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Edit className="w-4 h-4 ml-1" />
                  طلب تعديل
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pending Requests */}
          {editRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  طلبات التعديل السابقة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editRequests.slice(0, 5).map((request) => (
                  <div 
                    key={request.id} 
                    className="p-3 bg-secondary/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {getFieldLabel(request.field_name)}
                      </span>
                      {getRequestStatusBadge(request.status)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>القيمة المطلوبة: <span className="text-foreground">{request.requested_value}</span></p>
                      {request.admin_notes && (
                        <p className="text-orange-600">ملاحظات الإدارة: {request.admin_notes}</p>
                      )}
                      <p>{new Date(request.created_at).toLocaleDateString('ar-IQ')}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Personal Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                المعلومات الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="الاسم الكامل" value={driver.full_name} />
              <InfoRow label="الجنس" value={getGenderName(driver.gender)} />
              <InfoRow 
                label="رقم الهاتف" 
                value={driver.phone} 
                icon={<Phone className="w-4 h-4 text-muted-foreground" />}
              />
              {driver.email && (
                <InfoRow 
                  label="البريد الإلكتروني" 
                  value={driver.email} 
                  icon={<Mail className="w-4 h-4 text-muted-foreground" />}
                />
              )}
            </CardContent>
          </Card>

          {/* Vehicle Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                معلومات المركبة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow label="نوع الخدمة" value={getVehicleTypeName(driver.vehicle_type)} />
              <InfoRow label="موديل السيارة" value={driver.vehicle_model || "غير محدد"} />
              <InfoRow label="لون السيارة" value={driver.vehicle_color || "غير محدد"} />
              <InfoRow label="رقم اللوحة" value={driver.vehicle_plate || "غير محدد"} />
            </CardContent>
          </Card>

          {/* Work Area */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                منطقة العمل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow 
                label="المنطقة الحالية" 
                value={region?.name_ar || "غير محددة"} 
              />
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                ملخص الإحصائيات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{driver.total_rides || 0}</p>
                  <p className="text-xs text-muted-foreground">رحلة مكتملة</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{driver.rating?.toFixed(1) || "5.0"}</p>
                  <p className="text-xs text-muted-foreground">التقييم</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    {((driver.total_earnings || 0) / 1000).toFixed(0)}K
                  </p>
                  <p className="text-xs text-muted-foreground">دينار</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      {/* Edit Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>طلب تعديل البيانات</DialogTitle>
            <DialogDescription>
              اختر الحقل الذي تريد تعديله وأدخل القيمة الجديدة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الحقل المراد تعديله *</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحقل" />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedField && (
              <div className="p-3 bg-secondary/30 rounded-lg text-sm">
                <p className="text-muted-foreground">القيمة الحالية:</p>
                <p className="font-medium">{getCurrentFieldValue(selectedField) || "غير محدد"}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>القيمة الجديدة *</Label>
              <Input
                value={requestedValue}
                onChange={(e) => setRequestedValue(e.target.value)}
                placeholder="أدخل القيمة الجديدة"
              />
            </div>

            <div className="space-y-2">
              <Label>سبب التعديل (اختياري)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اشرح سبب طلب التعديل..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Send className="w-4 h-4 ml-2" />
              )}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper component for info rows
const InfoRow = ({ 
  label, 
  value, 
  icon 
}: { 
  label: string; 
  value: string; 
  icon?: React.ReactNode 
}) => (
  <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
    <span className="text-muted-foreground text-sm">{label}</span>
    <div className="flex items-center gap-2">
      {icon}
      <span className="font-medium text-foreground">{value}</span>
    </div>
  </div>
);

export default DriverProfile;
