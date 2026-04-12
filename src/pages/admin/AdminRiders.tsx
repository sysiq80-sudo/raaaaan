import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Phone,
  Mail,
  Eye,
  Users,
  Search,
  Filter,
  Calendar,
  MapPin,
  CreditCard,
  TrendingUp,
  Car,
  Clock,
  Grid3X3,
  List,
  Star,
  Wallet,
  X,
  MoreVertical,
  Trash2,
  Ban,
  CheckCircle,
  Map as MapIcon
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import DeleteRiderDialog from "@/components/admin/DeleteRiderDialog";
import SuspendRiderDialog from "@/components/admin/SuspendRiderDialog";
import RidersLiveMap from "@/components/admin/RidersLiveMap";

interface RiderProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  current_location: { lat: number; lng: number } | null;
}

interface RiderStats {
  total_rides: number;
  completed_rides: number;
  cancelled_rides: number;
  total_spent: number;
  avg_rating: number;
  last_ride_date: string | null;
  favorite_payment_method: string | null;
}

interface RiderWithStats extends RiderProfile {
  stats: RiderStats;
}

const AdminRiders = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [riders, setRiders] = useState<RiderWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRider, setSelectedRider] = useState<RiderWithStats | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [riderRides, setRiderRides] = useState<any[]>([]);
  const [ridesLoading, setRidesLoading] = useState(false);

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendAction, setSuspendAction] = useState<"suspend" | "activate">("suspend");
  const [liveMapOpen, setLiveMapOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Server-side pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Stats
  const [totalStats, setTotalStats] = useState({
    totalRiders: 0,
    activeRiders: 0,
    newThisMonth: 0,
    totalRevenue: 0,
    suspendedRiders: 0
  });

  useEffect(() => {
    if (isAdmin) {
      fetchRiders();
    }
  }, [isAdmin, currentPage]);

  const fetchRiders = async () => {
    setLoading(true);

    try {
      // محاولة إنشاء الملفات الشخصية المفقودة أولاً
      const { data: syncResult, error: syncError } = await supabase
        .rpc('ensure_all_users_have_profiles');

      if (syncError) {
        console.log('Note: Could not sync profiles (function may not exist yet):', syncError.message);
      } else if (syncResult > 0) {
        console.log(`Created ${syncResult} missing profiles`);
      }
    } catch (e) {
      console.log('Profile sync not available');
    }

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // جلب البيانات بالتوازي: عدد الملفات الشخصية + الصفحة الحالية + أدوار الإدارة + السائقين
    const [countResult, profilesResult, adminRolesResult, driverRecordsResult] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).range(from, to),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("user_roles") as any).select("user_id").in("role", ["admin", "moderator"]),
      supabase.from("drivers").select("user_id"),
    ]);

    if (profilesResult.error) {
      console.error("Error fetching profiles:", profilesResult.error);
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات الركاب: " + profilesResult.error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (countResult.count !== null) setTotalCount(countResult.count);

    const adminUserIds = new Set((adminRolesResult.data || []).map((r: any) => r.user_id));
    const driverUserIds = new Set((driverRecordsResult.data || []).map((d: any) => d.user_id));
    const filteredProfiles = (profilesResult.data || []).filter((p: any) => !adminUserIds.has(p.user_id) && !driverUserIds.has(p.user_id));

    // جلب الرحلات فقط للركاب في الصفحة الحالية (بدلاً من كل الرحلات)
    const riderUserIds = filteredProfiles.map((p: any) => p.user_id);
    let rides: any[] = [];
    if (riderUserIds.length > 0) {
      const { data: ridesData, error: ridesError } = await supabase
        .from("rides")
        .select("rider_id, status, final_fare, payment_method, created_at, driver_rating")
        .in("rider_id", riderUserIds);

      if (ridesError) {
        console.error("Error fetching rides:", ridesError);
      } else {
        rides = ridesData || [];
      }
    }

    // Group rides by rider_id using Map for O(n+m) performance
    const ridesByRider = new Map<string, typeof rides>();
    (rides || []).forEach(r => {
      if (!r.rider_id) return;
      const arr = ridesByRider.get(r.rider_id) || [];
      arr.push(r);
      ridesByRider.set(r.rider_id, arr);
    });

    // Calculate stats for each rider (استبعاد الإدارة)
    const ridersWithStats: RiderWithStats[] = filteredProfiles.map((profile: any) => {
      const riderRides = ridesByRider.get(profile.user_id) || [];
      const completedRides = riderRides.filter(r => r.status === 'completed');
      const cancelledRides = riderRides.filter(r => r.status === 'cancelled');
      const totalSpent = completedRides.reduce((sum, r) => sum + (r.final_fare || 0), 0);
      const ratings = completedRides.filter(r => r.driver_rating).map(r => r.driver_rating);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      // Find most used payment method
      const paymentMethods = completedRides.map(r => r.payment_method).filter(Boolean);
      const paymentCounts = paymentMethods.reduce((acc, pm) => {
        acc[pm] = (acc[pm] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const favoritePaymentMethod = Object.keys(paymentCounts).sort((a, b) => paymentCounts[b] - paymentCounts[a])[0] || null;

      // Last ride date
      const sortedRides = [...riderRides].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastRideDate = sortedRides[0]?.created_at || null;

      // Parse current_location
      const currentLocation = profile.current_location as { lat: number; lng: number } | null;

      return {
        ...profile,
        status: profile.status || 'active',
        current_location: currentLocation,
        stats: {
          total_rides: riderRides.length,
          completed_rides: completedRides.length,
          cancelled_rides: cancelledRides.length,
          total_spent: totalSpent,
          avg_rating: avgRating,
          last_ride_date: lastRideDate,
          favorite_payment_method: favoritePaymentMethod
        }
      };
    });

    setRiders(ridersWithStats);

    // Calculate total stats
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeRiders = ridersWithStats.filter(r =>
      r.stats.last_ride_date && new Date(r.stats.last_ride_date) > thirtyDaysAgo
    ).length;

    const newThisMonth = ridersWithStats.filter(r =>
      new Date(r.created_at) >= thisMonth
    ).length;

    const totalRevenue = ridersWithStats.reduce((sum, r) => sum + r.stats.total_spent, 0);

    const suspendedRiders = ridersWithStats.filter(r => r.status === 'suspended').length;

    setTotalStats({
      totalRiders: ridersWithStats.length,
      activeRiders,
      newThisMonth,
      totalRevenue,
      suspendedRiders
    });

    setLoading(false);
  };

  const fetchRiderRides = async (userId: string) => {
    setRidesLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*, drivers(full_name, vehicle_model)")
      .eq("rider_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching rider rides:", error);
    } else {
      setRiderRides(data || []);
    }
    setRidesLoading(false);
  };

  const viewRiderDetails = async (rider: RiderWithStats) => {
    setSelectedRider(rider);
    setDetailsOpen(true);
    await fetchRiderRides(rider.user_id);
  };

  // Filter riders
  const filteredRiders = useMemo(() => {
    let result = [...riders];

    // Search filter - تحسين البحث ليتعامل مع تنسيقات الأرقام المختلفة
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      // تنظيف رقم الهاتف من الأحرف غير الرقمية للبحث
      const phoneQuery = searchQuery.replace(/\D/g, '');

      result = result.filter(r => {
        // البحث بالاسم
        if (r.full_name?.toLowerCase().includes(query)) return true;
        // البحث بالبريد
        if (r.email?.toLowerCase().includes(query)) return true;

        // البحث بالهاتف - دعم تنسيقات متعددة
        if (phoneQuery.length >= 4 && r.phone) {
          const riderPhone = r.phone.replace(/\D/g, '');
          // البحث إذا كان الرقم يحتوي على النص أو ينتهي به
          if (riderPhone.includes(phoneQuery) || riderPhone.endsWith(phoneQuery)) {
            return true;
          }
          // البحث بدون الصفر الأول
          const phoneWithoutZero = phoneQuery.replace(/^0/, '');
          if (riderPhone.includes(phoneWithoutZero) || riderPhone.endsWith(phoneWithoutZero)) {
            return true;
          }
        }

        return false;
      });
    }

    // Date filter
    const now = new Date();
    if (dateFilter === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      result = result.filter(r => new Date(r.created_at) >= today);
    } else if (dateFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(r => new Date(r.created_at) >= weekAgo);
    } else if (dateFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter(r => new Date(r.created_at) >= monthAgo);
    }

    // Activity filter
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (activityFilter === "active") {
      result = result.filter(r =>
        r.stats.last_ride_date && new Date(r.stats.last_ride_date) > thirtyDaysAgo
      );
    } else if (activityFilter === "inactive") {
      result = result.filter(r =>
        !r.stats.last_ride_date || new Date(r.stats.last_ride_date) <= thirtyDaysAgo
      );
    } else if (activityFilter === "new") {
      result = result.filter(r => r.stats.total_rides === 0);
    }

    return result;
  }, [riders, searchQuery, dateFilter, activityFilter]);

  const getPaymentMethodLabel = (method: string | null) => {
    const labels: Record<string, string> = {
      cash: "نقداً",
      nas_wallet: "المحفظة",
      nass: "البطاقة",
      wallet: "المحفظة",
      card: "البطاقة",
      zain_cash: "نقداً",
      asia_hawala: "نقداً",
      qi_card: "البطاقة"
    };
    return method ? labels[method] || method : "-";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "قيد الانتظار", variant: "outline" },
      accepted: { label: "مقبول", variant: "secondary" },
      arrived: { label: "وصل", variant: "secondary" },
      in_progress: { label: "جارية", variant: "default" },
      completed: { label: "مكتملة", variant: "default" },
      cancelled: { label: "ملغية", variant: "destructive" }
    };
    const c = config[status] || { label: status, variant: "outline" };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("all");
    setActivityFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFilter !== "all" || activityFilter !== "all";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <AdminLayout
      title="إدارة الركاب"
      subtitle={`${filteredRiders.length} من ${riders.length} راكب`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLiveMapOpen(true)}
          >
            <MapIcon className="w-4 h-4 ml-2" />
            خريطة حية
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("table")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الركاب</p>
                <p className="text-2xl font-bold">{totalStats.totalRiders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نشطون (30 يوم)</p>
                <p className="text-2xl font-bold">{totalStats.activeRiders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Ban className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">معطلون</p>
                <p className="text-2xl font-bold">{totalStats.suspendedRiders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">جدد هذا الشهر</p>
                <p className="text-2xl font-bold">{totalStats.newThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold">{totalStats.totalRevenue.toLocaleString()} د.ع</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="w-4 h-4 ml-2" />
                <SelectValue placeholder="تاريخ التسجيل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأوقات</SelectItem>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">آخر أسبوع</SelectItem>
                <SelectItem value="month">آخر شهر</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 ml-2" />
                <SelectValue placeholder="حالة النشاط" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
                <SelectItem value="new">جديد (بدون رحلات)</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 ml-1" />
                مسح الفلاتر
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : filteredRiders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">لا يوجد ركاب</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters ? "لا توجد نتائج تطابق معايير البحث" : "لم يتم تسجيل أي راكب حتى الآن"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRiders.map((rider) => (
            <Card key={rider.id} className={`hover:shadow-lg transition-shadow ${rider.status === 'suspended' ? 'border-destructive/50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => viewRiderDetails(rider)}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${rider.status === 'suspended' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                      {rider.avatar_url ? (
                        <img src={rider.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <User className={`w-6 h-6 ${rider.status === 'suspended' ? 'text-destructive' : 'text-primary'}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{rider.full_name || "بدون اسم"}</h3>
                        {rider.status === 'suspended' && <Badge variant="destructive" className="text-xs">معطل</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground" dir="ltr">{rider.phone || "-"}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => viewRiderDetails(rider)}>
                        <Eye className="w-4 h-4 ml-2" /> عرض التفاصيل
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {rider.status === 'suspended' ? (
                        <DropdownMenuItem onClick={() => { setSelectedRider(rider); setSuspendAction("activate"); setSuspendDialogOpen(true); }}>
                          <CheckCircle className="w-4 h-4 ml-2 text-green-500" /> تفعيل الحساب
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => { setSelectedRider(rider); setSuspendAction("suspend"); setSuspendDialogOpen(true); }}>
                          <Ban className="w-4 h-4 ml-2 text-amber-500" /> تعطيل الحساب
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedRider(rider); setDeleteDialogOpen(true); }}>
                        <Trash2 className="w-4 h-4 ml-2" /> حذف الراكب
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Car className="w-3 h-3" /> الرحلات
                    </p>
                    <p className="font-bold">{rider.stats.completed_rides}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> الإنفاق
                    </p>
                    <p className="font-bold">{rider.stats.total_spent.toLocaleString()} د.ع</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>منذ {new Date(rider.created_at).toLocaleDateString("ar-IQ")}</span>
                  {rider.stats.last_ride_date && (
                    <span>آخر رحلة: {new Date(rider.stats.last_ride_date).toLocaleDateString("ar-IQ")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Table View */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الراكب</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">البريد الإلكتروني</TableHead>
                <TableHead className="text-right">الرحلات</TableHead>
                <TableHead className="text-right">الإنفاق</TableHead>
                <TableHead className="text-right">التقييم</TableHead>
                <TableHead className="text-right">آخر رحلة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRiders.map((rider) => (
                <TableRow key={rider.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      {rider.full_name || "بدون اسم"}
                    </div>
                  </TableCell>
                  <TableCell dir="ltr">{rider.phone || "-"}</TableCell>
                  <TableCell className="text-sm">{rider.email || "-"}</TableCell>
                  <TableCell>
                    <span className="font-medium">{rider.stats.completed_rides}</span>
                    {rider.stats.cancelled_rides > 0 && (
                      <span className="text-destructive text-xs mr-1">({rider.stats.cancelled_rides} ملغية)</span>
                    )}
                  </TableCell>
                  <TableCell>{rider.stats.total_spent.toLocaleString()} د.ع</TableCell>
                  <TableCell>
                    {rider.stats.avg_rating > 0 ? (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{rider.stats.avg_rating.toFixed(1)}</span>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {rider.stats.last_ride_date
                      ? new Date(rider.stats.last_ride_date).toLocaleDateString("ar-IQ")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => viewRiderDetails(rider)}>
                          <Eye className="w-4 h-4 ml-2" /> عرض
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {rider.status === 'suspended' ? (
                          <DropdownMenuItem onClick={() => { setSelectedRider(rider); setSuspendAction("activate"); setSuspendDialogOpen(true); }}>
                            <CheckCircle className="w-4 h-4 ml-2 text-green-500" /> تفعيل
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => { setSelectedRider(rider); setSuspendAction("suspend"); setSuspendDialogOpen(true); }}>
                            <Ban className="w-4 h-4 ml-2 text-amber-500" /> تعطيل
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedRider(rider); setDeleteDialogOpen(true); }}>
                          <Trash2 className="w-4 h-4 ml-2" /> حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Rider Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الراكب</DialogTitle>
          </DialogHeader>
          {selectedRider && (
            <div className="space-y-6 mt-4">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  {selectedRider.avatar_url ? (
                    <img src={selectedRider.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{selectedRider.full_name || "بدون اسم"}</h3>
                  {selectedRider.phone && (
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span dir="ltr">{selectedRider.phone}</span>
                    </p>
                  )}
                  {selectedRider.email && (
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <span>{selectedRider.email}</span>
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    عضو منذ {new Date(selectedRider.created_at).toLocaleDateString("ar-IQ")}
                  </p>
                </div>
                {selectedRider.stats.avg_rating > 0 && (
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-amber-500 text-2xl">
                      <Star className="w-6 h-6 fill-current" />
                      <span className="font-bold">{selectedRider.stats.avg_rating.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">التقييم</p>
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <Car className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold">{selectedRider.stats.total_rides}</p>
                  <p className="text-xs text-muted-foreground">إجمالي الرحلات</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
                  <p className="text-2xl font-bold">{selectedRider.stats.completed_rides}</p>
                  <p className="text-xs text-muted-foreground">رحلات مكتملة</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10 text-center">
                  <X className="w-5 h-5 mx-auto text-destructive mb-1" />
                  <p className="text-2xl font-bold">{selectedRider.stats.cancelled_rides}</p>
                  <p className="text-xs text-muted-foreground">رحلات ملغية</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                  <Wallet className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                  <p className="text-2xl font-bold">{selectedRider.stats.total_spent.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">د.ع إنفاق</p>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">طريقة الدفع المفضلة</p>
                  <p className="font-medium flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    {getPaymentMethodLabel(selectedRider.stats.favorite_payment_method)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">آخر رحلة</p>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {selectedRider.stats.last_ride_date
                      ? new Date(selectedRider.stats.last_ride_date).toLocaleDateString("ar-IQ")
                      : "لا توجد رحلات"}
                  </p>
                </div>
              </div>

              {/* Recent Rides */}
              <div>
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  آخر الرحلات
                </h4>
                {ridesLoading ? (
                  <p className="text-muted-foreground text-center py-4">جاري التحميل...</p>
                ) : riderRides.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">لا توجد رحلات</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {riderRides.map((ride) => (
                      <div key={ride.id} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(ride.status)}
                          <div className="text-sm">
                            <p className="font-medium">{ride.pickup_address || "موقع الانطلاق"}</p>
                            <p className="text-muted-foreground text-xs">
                              {new Date(ride.created_at).toLocaleString("ar-IQ")}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{(ride.final_fare || ride.estimated_fare || 0).toLocaleString()} د.ع</p>
                          {ride.drivers?.full_name && (
                            <p className="text-xs text-muted-foreground">{ride.drivers.full_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            صفحة {currentPage + 1} من {totalPages} ({totalCount} راكب)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <DeleteRiderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        rider={selectedRider}
        onSuccess={fetchRiders}
      />

      {/* Suspend Dialog */}
      <SuspendRiderDialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        rider={selectedRider}
        action={suspendAction}
        onSuccess={fetchRiders}
      />

      {/* Live Map */}
      <RidersLiveMap open={liveMapOpen} onClose={() => setLiveMapOpen(false)} />
    </AdminLayout>
  );
};

export default AdminRiders;
