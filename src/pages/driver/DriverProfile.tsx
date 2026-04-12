import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/common/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
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
  User,
  Car,
  MapPin,
  Star,
  Phone,
  Mail,
  Shield,
  Edit3,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  ChevronLeft,
  TrendingUp,
  Award,
  Wallet,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useDriverSession } from "@/hooks/useDriverSession";

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
  { value: "email", label: "البريد الالكتروني" },
  { value: "vehicle_model", label: "موديل السيارة" },
  { value: "vehicle_color", label: "لون السيارة" },
  { value: "vehicle_plate", label: "رقم اللوحة" },
];

const DriverProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { driver: sessionDriver, loading: authLoading } = useDriverSession();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [region, setRegion] = useState<RegionData | null>(null);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState("");
  const [requestedValue, setRequestedValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionDriver) return;
    const fetchDriverProfile = async () => {
      const { data: driverData, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", sessionDriver.userId)
        .maybeSingle();

      if (error || !driverData) {
        navigate("/driver/auth");
        return;
      }

      setDriver(driverData as any);

      if ((driverData as any).working_region_id) {
        const { data: regionData } = await supabase
          .from("regions")
          .select("id, name_ar")
          .eq("id", (driverData as any).working_region_id)
          .maybeSingle();
        if (regionData) setRegion(regionData as any);
      }

      const { data: requests } = await supabase
        .from("driver_edit_requests")
        .select("*")
        .eq("driver_id", (driverData as any).id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (requests) setEditRequests(requests as any);
      setLoading(false);
    };

    fetchDriverProfile();
  }, [sessionDriver, navigate]);

  const getVehicleTypeName = (type: string | null) => {
    switch (type) {
      case "economy": return "اقتصادي";
      case "comfort": return "مريح";
      case "premium": return "فاخر";
      case "women_only": return "تكسي نسائي";
      default: return "غير محدد";
    }
  };

  const getStatusInfo = (status: string | null) => {
    switch (status) {
      case "approved":  return { label: "معتمد",        color: "text-[#5bdda6]",  bg: "bg-[#5bdda6]/10 border-[#5bdda6]/30" };
      case "pending":   return { label: "قيد المراجعة", color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/30" };
      case "rejected":  return { label: "مرفوض",        color: "text-red-400",    bg: "bg-red-400/10 border-red-400/30" };
      case "suspended": return { label: "موقوف",         color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" };
      default:          return { label: "غير معروف",     color: "text-slate-400",  bg: "bg-slate-400/10 border-slate-400/30" };
    }
  };

  const getGenderName = (gender: string | null) => {
    switch (gender) {
      case "male":   return "ذكر";
      case "female": return "انثى";
      default:       return "غير محدد";
    }
  };

  const getFieldLabel = (fieldName: string) =>
    EDITABLE_FIELDS.find(f => f.value === fieldName)?.label || fieldName;

  const getCurrentFieldValue = (fieldName: string): string => {
    if (!driver) return "";
    const value = driver[fieldName as keyof DriverData];
    return value?.toString() || "";
  };

  const getRequestStatusInfo = (status: string) => {
    switch (status) {
      case "pending":  return { label: "قيد المراجعة", icon: <Clock className="w-3 h-3" />,       color: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
      case "approved": return { label: "تمت الموافقة", icon: <CheckCircle2 className="w-3 h-3" />, color: "text-[#5bdda6] bg-[#5bdda6]/10 border-[#5bdda6]/20" };
      case "rejected": return { label: "مرفوض",        icon: <XCircle className="w-3 h-3" />,      color: "text-red-400 bg-red-400/10 border-red-400/20" };
      default:         return { label: status,          icon: null,                                  color: "text-slate-400 bg-slate-400/10 border-slate-400/20" };
    }
  };

  const handleSubmitRequest = async () => {
    if (!driver || !selectedField || !requestedValue.trim()) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    const hasPendingRequest = editRequests.some(r => r.field_name === selectedField && r.status === "pending");
    if (hasPendingRequest) {
      toast({ title: "طلب موجود", description: "لديك طلب تعديل قيد المراجعة لهذا الحقل", variant: "destructive" });
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
      } as any)
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      toast({ title: "خطأ", description: "حدث خطأ اثناء ارسال الطلب", variant: "destructive" });
      return;
    }
    toast({ title: "تم ارسال الطلب", description: "سيتم مراجعة طلبك من قبل الادارة" });
    if (data) setEditRequests(prev => [data as any, ...prev]);
    setDialogOpen(false);
    setSelectedField("");
    setRequestedValue("");
    setReason("");
  };

  if (authLoading || loading) return <SplashScreen />;
  if (!driver) return null;

  const statusInfo = getStatusInfo(driver.status);
  const pendingCount = editRequests.filter(r => r.status === "pending").length;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-[#080e1d]"
      dir="rtl"
    >
      {/* HEADER */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-[#0b1326]/95 backdrop-blur border-b border-[#5bdda6]/10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          onClick={() => navigate("/driver")}
          className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 active:scale-90 transition-all rounded-xl px-3 py-2"
        >
          <ChevronLeft className="w-5 h-5 text-slate-300" />
          <span className="text-sm font-medium text-slate-300">رجوع</span>
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <img src={logo} alt="RAAN" className="w-8 h-8 rounded-xl shadow-[0_0_12px_rgba(91,221,166,0.3)]" />
          <span className="font-black text-white text-base tracking-wider">الملف الشخصي</span>
        </div>
        <div className="w-20" />
      </header>

      {/* MAIN CONTENT */}
      <main className="px-4 py-6 pb-16 max-w-lg mx-auto space-y-5">

        {/* Hero Card */}
        <div className="relative rounded-2xl overflow-hidden border border-[#5bdda6]/15 bg-gradient-to-br from-[#0f1a2e] to-[#0b1326]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#5bdda6]/5 blur-3xl pointer-events-none" />
          <div className="relative p-6 flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={driver.profile_image_url || logo}
                alt="profile"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-[#5bdda6]/30 shadow-[0_0_30px_rgba(91,221,166,0.15)]"
                onError={(e) => { e.currentTarget.src = logo; }}
              />
              <span className={`absolute -bottom-2 -right-2 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black text-white tracking-wide">{driver.full_name}</h1>
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-white font-bold text-lg">{driver.rating?.toFixed(1) || "5.0"}</span>
                <span className="text-slate-500 text-sm">({driver.total_rides || 0} رحلة)</span>
              </div>
            </div>
            <div className="w-full grid grid-cols-3 gap-3 mt-1">
              {[
                { icon: <TrendingUp className="w-4 h-4" />, val: String(driver.total_rides || 0), label: "رحلة" },
                { icon: <Award className="w-4 h-4" />,      val: driver.rating?.toFixed(1) || "5.0", label: "تقييم" },
                { icon: <Wallet className="w-4 h-4" />,     val: `${((driver.total_earnings || 0) / 1000).toFixed(0)}K`, label: "دينار" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-1 p-3 bg-[#0b1326] rounded-xl border border-slate-700/40">
                  <span className="text-[#5bdda6]">{s.icon}</span>
                  <span className="text-white font-black text-lg tabular-nums">{s.val}</span>
                  <span className="text-slate-500 text-[10px]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Edit Request Banner */}
        <div className="flex items-center justify-between p-4 rounded-2xl border border-[#5bdda6]/20 bg-[#5bdda6]/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex-shrink-0">
              <Shield className="w-5 h-5 text-[#5bdda6]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">طلب تعديل البيانات</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {pendingCount > 0 ? `لديك ${pendingCount} طلب قيد المراجعة` : "ارسل طلب للادارة لتعديل بياناتك"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5bdda6] text-[#0b1326] font-bold text-sm active:scale-95 transition-all hover:bg-[#4ac99a] flex-shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            تعديل
          </button>
        </div>

        {/* Personal Info */}
        <ProfileSection icon={<User className="w-4 h-4 text-[#5bdda6]" />} title="المعلومات الشخصية">
          <ProfileRow label="الاسم الكامل" value={driver.full_name} />
          <ProfileRow label="الجنس" value={getGenderName(driver.gender)} />
          <ProfileRow label="رقم الهاتف" value={driver.phone} icon={<Phone className="w-3.5 h-3.5 text-slate-500" />} />
          {driver.email && <ProfileRow label="البريد الالكتروني" value={driver.email} icon={<Mail className="w-3.5 h-3.5 text-slate-500" />} />}
        </ProfileSection>

        {/* Vehicle Info */}
        <ProfileSection icon={<Car className="w-4 h-4 text-[#5bdda6]" />} title="معلومات المركبة">
          <ProfileRow label="نوع الخدمة" value={getVehicleTypeName(driver.vehicle_type)} />
          <ProfileRow label="موديل السيارة" value={driver.vehicle_model || "غير محدد"} />
          <ProfileRow label="لون السيارة" value={driver.vehicle_color || "غير محدد"} />
          <ProfileRow label="رقم اللوحة" value={driver.vehicle_plate || "غير محدد"} />
        </ProfileSection>

        {/* Work Area */}
        <ProfileSection icon={<MapPin className="w-4 h-4 text-[#5bdda6]" />} title="منطقة العمل">
          <ProfileRow label="المنطقة الحالية" value={region?.name_ar || "غير محددة"} />
        </ProfileSection>

        {/* Edit Requests History */}
        {editRequests.length > 0 && (
          <ProfileSection icon={<Clock className="w-4 h-4 text-[#5bdda6]" />} title="طلبات التعديل السابقة">
            <div className="space-y-3 py-3">
              {editRequests.slice(0, 6).map((req) => {
                const si = getRequestStatusInfo(req.status);
                return (
                  <div key={req.id} className="p-3 rounded-xl bg-[#0b1326] border border-slate-700/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold text-sm">{getFieldLabel(req.field_name)}</span>
                      <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${si.color}`}>
                        {si.icon}
                        {si.label}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs">
                      القيمة المطلوبة: <span className="text-slate-200">{req.requested_value}</span>
                    </p>
                    {req.admin_notes && (
                      <p className="text-orange-400 text-xs mt-1">ملاحظات الادارة: {req.admin_notes}</p>
                    )}
                    <p className="text-slate-600 text-[11px] mt-1">
                      {new Date(req.created_at).toLocaleDateString("ar-IQ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </ProfileSection>
        )}

      </main>

      {/* Edit Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md bg-[#0f1a2e] border-slate-700/50 text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white">طلب تعديل البيانات</DialogTitle>
            <DialogDescription className="text-slate-400">
              اختر الحقل الذي تريد تعديله وادخل القيمة الجديدة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">الحقل المراد تعديله *</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="bg-[#0b1326] border-slate-700/50 text-white h-11">
                  <SelectValue placeholder="اختر الحقل" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1a2e] border-slate-700/50">
                  {EDITABLE_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value} className="text-white focus:bg-slate-700/50">
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedField && (
              <div className="p-3 bg-[#0b1326] rounded-xl border border-slate-700/40 text-sm">
                <p className="text-slate-500 text-xs mb-1">القيمة الحالية:</p>
                <p className="text-white font-medium">{getCurrentFieldValue(selectedField) || "غير محدد"}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">القيمة الجديدة *</Label>
              <Input
                value={requestedValue}
                onChange={(e) => setRequestedValue(e.target.value)}
                placeholder="ادخل القيمة الجديدة"
                className="bg-[#0b1326] border-slate-700/50 text-white placeholder:text-slate-600 h-11 focus:border-[#5bdda6]/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">سبب التعديل (اختياري)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اشرح سبب طلب التعديل..."
                rows={3}
                className="bg-[#0b1326] border-slate-700/50 text-white placeholder:text-slate-600 focus:border-[#5bdda6]/50 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <button
              onClick={() => setDialogOpen(false)}
              className="flex-1 h-11 rounded-xl border border-slate-700/50 text-slate-300 text-sm font-medium hover:bg-slate-700/30 transition-colors"
            >
              الغاء
            </button>
            <button
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#5bdda6] to-[#3eba89] text-[#0b1326] font-bold text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(91,221,166,0.3)] transition-all disabled:opacity-40"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              ارسال الطلب
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProfileSection = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-700/40 bg-[#0f1a2e] overflow-hidden">
    <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-700/30">
      <div className="w-7 h-7 rounded-lg bg-[#5bdda6]/10 flex items-center justify-center">{icon}</div>
      <h2 className="text-white font-bold text-sm">{title}</h2>
    </div>
    <div className="divide-y divide-slate-700/20 px-4">{children}</div>
  </div>
);

const ProfileRow = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-slate-400 text-sm">{label}</span>
    <div className="flex items-center gap-1.5 max-w-[55%]">
      {icon}
      <span className="text-white font-medium text-sm truncate">{value}</span>
    </div>
  </div>
);

export default DriverProfile;
