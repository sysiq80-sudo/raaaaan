import { useState, useEffect } from "react";
import { arabicIncludes } from "@/utils/normalizeArabic";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Eye,
  Car,
  Phone,
  Star,
  Navigation,
  UserPlus,
  Pencil,
  Trash2,
  FileText,
  Search,
  Users,
  Clock,
  DollarSign,
  AlertCircle,
  MessageSquare,
  Download,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AddDriverDialog } from "@/components/admin/AddDriverDialog";
import { EditDriverDialog } from "@/components/admin/EditDriverDialog";
import { DriverDocumentsViewer } from "@/components/admin/DriverDocumentsViewer";
import { DeleteDriverDialog } from "@/components/admin/DeleteDriverDialog";
import { DriverEditRequestsDialog } from "@/components/admin/DriverEditRequestsDialog";
import { exportToCSV, getDriverExportColumns } from "@/lib/exportUtils";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"] & { email?: string | null };
type Region = Database["public"]["Tables"]["regions"]["Row"];

const AdminDrivers = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);

  // Server-side pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(0);

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editRequestsDialogOpen, setEditRequestsDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const { data: driversData, isLoading: loading } = useQuery({
    queryKey: ["admin-drivers", currentPage],
    queryFn: async () => {
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const [countResult, dataResult, adminRolesResult] = await Promise.all([
        supabase.from("drivers").select("*", { count: "exact", head: true }),
        supabase
          .from("drivers")
          .select("id, user_id, full_name, phone, email, vehicle_type, vehicle_model, vehicle_plate, vehicle_color, status, created_at, is_online, is_available, rating, working_region_id, profile_image_url, gender, admin_controlled, total_earnings, total_rides, admin_activated")
          .order("created_at", { ascending: false })
          .range(from, to),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("user_roles") as any).select("user_id").in("role", ["admin", "moderator"]),
      ]);

      if (dataResult.error) throw dataResult.error;
      const adminUserIds = new Set((adminRolesResult.data || []).map((r: any) => r.user_id));
      const filtered = (dataResult.data || []).filter((d: any) => !adminUserIds.has(d.user_id));
      return { drivers: filtered as Driver[], totalCount: countResult.count || 0 };
    },
    enabled: isAdmin,
  });

  const drivers = driversData?.drivers || [];
  const totalCount = driversData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: regions = [] } = useQuery({
    queryKey: ["admin-regions-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("regions")
        .select("*")
        .eq("is_active", true)
        .order("name_ar");
      return (data || []) as Region[];
    },
    enabled: isAdmin,
  });

  const { data: pendingEditRequestsCount = 0 } = useQuery({
    queryKey: ["admin-pending-edit-requests-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("driver_edit_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    filterDrivers();
  }, [drivers, searchQuery, statusFilter, vehicleTypeFilter, regionFilter]);

  const filterDrivers = () => {
    let result = [...drivers];

    // Search filter — بحث مرن (أ=ا، ة=ه، تجاهل التشكيل)
    if (searchQuery) {
      result = result.filter(
        (d) =>
          arabicIncludes(d.full_name, searchQuery) ||
          d.phone.includes(searchQuery) ||
          d.vehicle_plate?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Vehicle type filter
    if (vehicleTypeFilter !== "all") {
      result = result.filter((d) => d.vehicle_type === vehicleTypeFilter);
    }

    // Region filter
    if (regionFilter !== "all") {
      result = result.filter((d) => d.working_region_id === regionFilter);
    }

    setFilteredDrivers(result);
  };

  const statusChangeMutation = useMutation({
    mutationFn: async ({ driverId, newStatus }: { driverId: string; newStatus: "approved" | "rejected" | "suspended" }) => {
      const forceOffline = ["rejected", "suspended"].includes(newStatus);
      const updatePayload: Record<string, unknown> = { status: newStatus };
      if (forceOffline) {
        updatePayload.is_online = false;
        updatePayload.is_available = false;
      }
      const { error } = await supabase
        .from("drivers")
        .update(updatePayload)
        .eq("id", driverId);
      if (error) throw error;
      return { forceOffline };
    },
    onSuccess: (_data, _variables) => {
      toast({
        title: "تم التحديث ✅",
        description: _data.forceOffline
          ? "تم تغيير الحالة وإيقاف السائق عن الخدمة فوراً"
          : "تم اعتماد السائق — يمكنه الآن الدخول للخدمة",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleStatusChange = async (
    driverId: string,
    newStatus: "approved" | "rejected" | "suspended"
  ) => {
    statusChangeMutation.mutate({ driverId, newStatus });
  };

  const toggleActivationMutation = useMutation({
    mutationFn: async ({ driverId, currentActivation }: { driverId: string; currentActivation: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مصرح');

      const { error } = await supabase.rpc('admin_toggle_driver_activation', {
        p_driver_id: driverId,
        p_is_active: !currentActivation,
        p_admin_user_id: user.id
      });
      if (error) throw error;
      return !currentActivation;
    },
    onSuccess: (newActivation) => {
      toast({
        title: "تم التحديث ✅",
        description: newActivation
          ? "تم تفعيل السائق. يمكنه الآن استقبال الطلبات"
          : "تم تعطيل السائق. لن يتمكن من استقبال الطلبات",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تحديث حالة التفعيل",
        variant: "destructive",
      });
    },
  });

  const handleToggleActivation = async (driverId: string, currentActivation: boolean) => {
    toggleActivationMutation.mutate({ driverId, currentActivation });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      pending: { label: "بانتظار الموافقة", variant: "secondary" },
      approved: { label: "مُعتمد", variant: "default" },
      rejected: { label: "مرفوض", variant: "destructive" },
      suspended: { label: "موقوف", variant: "outline" },
    };
    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getVehicleTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      economy: "اقتصادي",
      comfort: "مريح",
      premium: "فاخر",
      women_only: "نسائي",
    };
    return types[type] || type;
  };

  const hasDocuments = (driver: Driver) => {
    return !!driver.id_image_url && 
           !!driver.license_image_url && 
           !!driver.profile_image_url &&
           !!driver.vehicle_image_url;
  };
  
  const getDocumentCount = (driver: Driver) => {
    const docs = [
      driver.profile_image_url,
      driver.id_image_url,
      driver.id_image_back_url,
      driver.license_image_url,
      driver.license_image_back_url,
      driver.vehicle_image_url,
    ];
    return docs.filter(Boolean).length;
  };

  // Statistics
  const pendingCount = drivers.filter((d) => d.status === "pending").length;
  const approvedCount = drivers.filter((d) => d.status === "approved").length;
  const activeCount = drivers.filter((d) => d.status === "approved" && d.is_online).length;
  const totalEarnings = drivers.reduce((sum, d) => sum + (Number(d.total_earnings) || 0), 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <AdminLayout
      title="إدارة السائقين"
      subtitle={`${drivers.length} سائق مسجل`}
      actions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              try {
                exportToCSV(filteredDrivers, getDriverExportColumns(), 'drivers');
                toast({ title: "تم التصدير بنجاح", description: `تم تصدير ${filteredDrivers.length} سائق` });
              } catch (error: any) {
                toast({ title: "خطأ", description: error.message, variant: "destructive" });
              }
            }}
            disabled={filteredDrivers.length === 0}
          >
            <Download className="w-4 h-4 ml-2" />
            تصدير CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setEditRequestsDialogOpen(true)}
            className="relative"
          >
            <MessageSquare className="w-4 h-4 ml-2" />
            طلبات التعديل
            {pendingEditRequestsCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground h-5 min-w-5 text-xs">
                {pendingEditRequestsCount}
              </Badge>
            )}
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <UserPlus className="w-4 h-4 ml-2" />
            إضافة سائق
          </Button>
        </div>
      }
    >
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">معتمدين</p>
                <p className="text-2xl font-bold">{approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:border-amber-500 ${statusFilter === 'pending' ? 'border-amber-500 ring-2 ring-amber-500/20' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">بانتظار الموافقة</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Navigation className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نشطين الآن</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الأرباح</p>
                <p className="text-lg font-bold">{totalEarnings.toLocaleString('en-US')} د.ع</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الهاتف أو اللوحة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">بانتظار الموافقة</SelectItem>
                <SelectItem value="approved">معتمد</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
                <SelectItem value="suspended">موقوف</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="نوع السيارة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="economy">اقتصادي</SelectItem>
                <SelectItem value="comfort">مريح</SelectItem>
                <SelectItem value="premium">فاخر</SelectItem>
                <SelectItem value="women_only">نسائي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="المنطقة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المناطق</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Car className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">لا يوجد سائقين</h3>
            <p className="text-muted-foreground">
              {drivers.length === 0
                ? "لم يتم تسجيل أي سائق حتى الآن"
                : "لا توجد نتائج تطابق معايير البحث"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">البريد الإلكتروني</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">السيارة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">التفعيل</TableHead>
                <TableHead className="text-right">الوثائق</TableHead>
                <TableHead className="text-right">الموقع</TableHead>
                <TableHead className="text-right">التقييم</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell>
                    <div 
                      className="cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/admin/drivers/${driver.id}`)}
                    >
                      <p className="font-medium">{driver.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {driver.vehicle_model || "-"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell dir="ltr" className="text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {driver.email || "غير متوفر"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell dir="ltr" className="text-right">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {driver.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getVehicleTypeLabel(driver.vehicle_type || "economy")}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(driver.status || "pending")}</TableCell>
                  <TableCell>
                    {/* ✅ FIX BUG-6: null يعامل كـ true (مفعّل افتراضياً) */}
                    {(() => {
                      const isActivated = driver.admin_activated !== false; // null → true
                      return (
                        <Button
                          variant={isActivated ? "default" : "destructive"}
                          size="sm"
                          onClick={() => handleToggleActivation(driver.id, isActivated)}
                          className="h-7 text-xs"
                        >
                          {isActivated ? (
                            <>
                              <CheckCircle className="w-3 h-3 ml-1" />
                              مفعّل
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 ml-1" />
                              معطّل
                            </>
                          )}
                        </Button>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDriver(driver);
                        setDocumentsDialogOpen(true);
                      }}
                      className={`h-7 text-xs ${hasDocuments(driver) ? 'text-green-600' : 'text-amber-600'}`}
                    >
                      <FileText className="w-3 h-3 ml-1" />
                      {getDocumentCount(driver)}/6
                    </Button>
                  </TableCell>
                  <TableCell>
                    {driver.is_online && driver.current_location ? (
                      <div className="flex items-center gap-1 text-success">
                        <Navigation className="w-3 h-3" />
                        <span className="text-xs">متصل</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">غير متصل</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-warning text-warning" />
                      <span>{Number(driver.rating || 5).toFixed(1)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary"
                        onClick={() => navigate(`/admin/drivers/${driver.id}`)}
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedDriver(driver);
                          setDocumentsDialogOpen(true);
                        }}
                        title="الوثائق"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedDriver(driver);
                          setEditDialogOpen(true);
                        }}
                        title="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedDriver(driver);
                          setDeleteDialogOpen(true);
                        }}
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            صفحة {currentPage + 1} من {totalPages} ({totalCount} سائق)
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

      {/* Dialogs */}
      <AddDriverDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        regions={regions}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })}
      />

      <EditDriverDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        driver={selectedDriver}
        regions={regions}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })}
      />

      <DriverDocumentsViewer
        open={documentsDialogOpen}
        onOpenChange={setDocumentsDialogOpen}
        driver={selectedDriver}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })}
      />

      <DeleteDriverDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        driver={selectedDriver}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })}
      />

      <DriverEditRequestsDialog
        open={editRequestsDialogOpen}
        onOpenChange={(open) => {
          setEditRequestsDialogOpen(open);
          if (!open) queryClient.invalidateQueries({ queryKey: ["admin-pending-edit-requests-count"] });
        }}
      />
    </AdminLayout>
  );
};

export default AdminDrivers;
