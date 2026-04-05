import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Route,
  Eye,
  MapPin,
  Clock,
  DollarSign,
  User,
  Car,
  Download,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Star,
  MessageSquare,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { exportToCSV, getRideExportColumns } from "@/lib/exportUtils";
import type { Database } from "@/integrations/supabase/types";

type Ride = Database["public"]["Tables"]["rides"]["Row"];

const AdminRides = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState<Ride | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rideRatings, setRideRatings] = useState<{ rating: number; comment: string | null }[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  // حالة الصفحات
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [totalActiveCount, setTotalActiveCount] = useState(0);
  const [totalCompletedCount, setTotalCompletedCount] = useState(0);
  const [totalEarningsAll, setTotalEarningsAll] = useState(0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    if (isAdmin) {
      fetchRides();
    }
  }, [isAdmin, currentPage]);

  const fetchRides = async () => {
    setLoading(true);
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // جلب العدد الكلي والإحصائيات بالتوازي
    const [countResult, activeCountResult, completedCountResult, earningsResult, ridesResult] = await Promise.all([
      supabase.from("rides").select("*", { count: "exact", head: true }),
      supabase.from("rides").select("*", { count: "exact", head: true }).in("status", ["pending", "accepted", "arrived", "in_progress"]),
      supabase.from("rides").select("*", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("rides").select("final_fare").eq("status", "completed").not("final_fare", "is", null),
      supabase.from("rides").select("*").order("created_at", { ascending: false }).range(from, to),
    ]);

    if (countResult.count !== null) setTotalCount(countResult.count);
    if (activeCountResult.count !== null) setTotalActiveCount(activeCountResult.count);
    if (completedCountResult.count !== null) setTotalCompletedCount(completedCountResult.count);
    if (earningsResult.data) {
      setTotalEarningsAll(earningsResult.data.reduce((sum, r) => sum + (r.final_fare || 0), 0));
    }

  if (ridesResult.error) {
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات الرحلات",
        variant: "destructive",
      });
    } else {
      setRides(ridesResult.data || []);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      pending: { label: "بانتظار سائق", variant: "secondary" },
      accepted: { label: "تم القبول", variant: "outline" },
      arrived: { label: "وصل السائق", variant: "outline" },
      in_progress: { label: "جارية", variant: "default" },
      completed: { label: "مكتملة", variant: "default" },
      cancelled: { label: "ملغية", variant: "destructive" },
    };
    const config = statusConfig[status] || {
      label: status,
      variant: "outline" as const,
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const viewRideDetails = async (ride: Ride) => {
    setSelectedRide(ride);
    setDetailsOpen(true);
    setRideRatings([]);
    setRatingsLoading(true);
    try {
      const { data } = await supabase
        .from("ride_ratings")
        .select("rating, comment")
        .eq("ride_id" as any, ride.id);
      setRideRatings((data as any) || []);
    } catch { /* ignore */ }
    setRatingsLoading(false);
  };

  const handleDeleteClick = (ride: Ride) => {
    setRideToDelete(ride);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rideToDelete) return;

    setDeleting(true);

    try {
      // Use RPC function to delete ride with all related data
      const { data, error } = await supabase.rpc("delete_ride_cascade", {
        ride_id_param: rideToDelete.id,
      });

      if (error) {
        toast({
          title: "خطأ",
          description: "فشل في حذف الرحلة: " + error.message,
          variant: "destructive",
        });
      } else if (data && !(data as any).success) {
        toast({
          title: "خطأ",
          description: (data as any).error || "فشل في حذف الرحلة",
          variant: "destructive",
        });
      } else {
        toast({
          title: "تم الحذف",
          description: "تم حذف الرحلة وجميع البيانات المرتبطة بها بنجاح",
        });
        // Remove from local state
        setRides((prev) => prev.filter((r) => r.id !== rideToDelete.id));
        setDeleteDialogOpen(false);
        setRideToDelete(null);
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع: " + error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  const handleExport = () => {
    try {
      exportToCSV(rides, getRideExportColumns(), "rides");
      toast({
        title: "تم التصدير بنجاح",
        description: `تم تصدير ${rides.length} رحلة`,
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout
      title="إدارة الرحلات"
      subtitle={`${totalCount} رحلة إجمالاً • صفحة ${currentPage + 1} من ${totalPages || 1} • ${totalActiveCount} نشطة`}
      actions={
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={rides.length === 0}
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير CSV
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Route className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-sm text-muted-foreground">إجمالي الرحلات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalActiveCount}</p>
              <p className="text-sm text-muted-foreground">رحلات نشطة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Route className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCompletedCount}</p>
              <p className="text-sm text-muted-foreground">مكتملة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {(totalEarningsAll / 1000).toFixed(0)}K
              </p>
              <p className="text-sm text-muted-foreground">الإيرادات (د.ع)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : rides.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Route className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">لا توجد رحلات</h3>
            <p className="text-muted-foreground">
              لم يتم إنشاء أي رحلة حتى الآن
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">من</TableHead>
                <TableHead className="text-right">إلى</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">المسافة</TableHead>
                <TableHead className="text-right">الأجرة</TableHead>
                <TableHead className="text-right">طريقة الدفع</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rides.map((ride) => (
                <TableRow key={ride.id}>
                  <TableCell className="text-sm">
                    {formatDate(ride.created_at)}
                  </TableCell>
                  <TableCell
                    className="max-w-[150px] truncate"
                    title={ride.pickup_address || ""}
                  >
                    {ride.pickup_address || "غير محدد"}
                  </TableCell>
                  <TableCell
                    className="max-w-[150px] truncate"
                    title={ride.dropoff_address || ""}
                  >
                    {ride.dropoff_address || "غير محدد"}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(ride.status || "pending")}
                  </TableCell>
                  <TableCell>
                    {ride.distance_km
                      ? `${Number(ride.distance_km).toFixed(1)} كم`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {ride.final_fare
                      ? `${ride.final_fare.toLocaleString()} د.ع`
                      : ride.estimated_fare
                        ? `~${ride.estimated_fare.toLocaleString()} د.ع`
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {ride.payment_method === "cash"
                      ? "نقدي"
                      : ride.payment_method}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewRideDetails(ride)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(ride)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

      {/* أزرار التنقل بين الصفحات */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          >
            <ChevronRight className="w-4 h-4 ml-1" />
            السابقة
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {currentPage + 1} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            التالية
            <ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        </div>
      )}

      {/* Ride Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تفاصيل الرحلة</DialogTitle>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-6 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">رقم الرحلة</p>
                  <p className="font-mono text-sm">
                    {selectedRide.id.slice(0, 8)}
                  </p>
                </div>
                {getStatusBadge(selectedRide.status || "pending")}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center mt-1">
                    <MapPin className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      نقطة الانطلاق
                    </p>
                    <p className="font-medium">
                      {selectedRide.pickup_address || "غير محدد"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center mt-1">
                    <MapPin className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الوجهة</p>
                    <p className="font-medium">
                      {selectedRide.dropoff_address || "غير محدد"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">المسافة</p>
                  <p className="text-xl font-bold">
                    {selectedRide.distance_km
                      ? `${Number(selectedRide.distance_km).toFixed(1)} كم`
                      : "-"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">المدة</p>
                  <p className="text-xl font-bold">
                    {selectedRide.duration_minutes
                      ? `${selectedRide.duration_minutes} دقيقة`
                      : "-"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">
                    الأجرة المقدرة
                  </p>
                  <p className="text-xl font-bold">
                    {selectedRide.estimated_fare?.toLocaleString() || "-"}{" "}
                    <span className="text-sm">د.ع</span>
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground mb-1">
                    الأجرة النهائية
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {selectedRide.final_fare?.toLocaleString() || "-"}{" "}
                    <span className="text-sm">د.ع</span>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">طريقة الدفع</p>
                    <p className="font-medium">
                      {selectedRide.payment_method === "cash"
                        ? "نقدي"
                        : selectedRide.payment_method}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">انتظار</p>
                    <p className="font-medium">
                      {selectedRide.waiting_minutes || 0} دقيقة
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">تاريخ الإنشاء</p>
                    <p className="font-medium">
                      {formatDate(selectedRide.created_at)}
                    </p>
                  </div>
                  {selectedRide.completed_at && (
                    <div>
                      <p className="text-muted-foreground">تاريخ الإكمال</p>
                      <p className="font-medium">
                        {formatDate(selectedRide.completed_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {selectedRide.cancellation_reason && (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                  <p className="text-sm font-medium mb-1">سبب الإلغاء</p>
                  <p>{selectedRide.cancellation_reason}</p>
                </div>
              )}

              {/* قسم التعليقات */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">تعليقات الراكب</p>
                </div>
                {ratingsLoading ? (
                  <p className="text-xs text-muted-foreground">جاري التحميل...</p>
                ) : rideRatings.length === 0 ? (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">لا يوجد تعليقات لهذه الرحلة</p>
                ) : (() => {
                  const BADGE_MAP: Record<string, string> = {
                    clean: '🧹 سيارة نظيفة', ontime: '⏱️ دقيق في المواعيد',
                    roads: '🛣️ خبير بالطرق', polite: '💬 أسلوب مهذب',
                    ac: '❄️ مكيف ممتاز', safe: '🚗 قيادة آمنة',
                  };
                  return (
                    <div className="space-y-3">
                      {rideRatings.map((rv, i) => {
                        const raw = rv.comment || '';
                        const badgeMatch = raw.match(/\[بادجات: ([^\]]+)\]/);
                        const freePart = raw.replace(/\[بادجات: [^\]]+\]\s*\|?\s*/g, '').trim();
                        const badgeIds = badgeMatch ? badgeMatch[1].split(',') : [];
                        return (
                          <div key={i} className="bg-muted/40 rounded-xl p-3 space-y-2">
                            {/* التقييم */}
                            <div className="flex items-center gap-1.5">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`w-3.5 h-3.5 ${ s <= rv.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                              ))}
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mr-1">{rv.rating}/5</span>
                            </div>
                            {/* البادجات */}
                            {badgeIds.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {badgeIds.map(b => (
                                  <span key={b} className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5">
                                    {BADGE_MAP[b] ?? b}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* النص الحر */}
                            {freePart && (
                              <blockquote className="text-xs text-foreground/80 bg-background/60 border-r-2 border-primary/40 pr-2 py-1 rounded italic leading-relaxed">
                                "{freePart}"
                              </blockquote>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          {rideToDelete && (
            <div className="space-y-4 mt-4">
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p className="text-sm font-medium mb-2">
                  ⚠️ تحذير: عملية لا يمكن التراجع عنها
                </p>
                <p className="text-sm">
                  سيتم حذف هذه الرحلة نهائياً من قاعدة البيانات.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم الرحلة:</span>
                  <span className="font-mono">
                    {rideToDelete.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">من:</span>
                  <span className="max-w-[200px] truncate">
                    {rideToDelete.pickup_address || "غير محدد"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">إلى:</span>
                  <span className="max-w-[200px] truncate">
                    {rideToDelete.dropoff_address || "غير محدد"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الحالة:</span>
                  {getStatusBadge(rideToDelete.status || "pending")}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الأجرة:</span>
                  <span>
                    {rideToDelete.final_fare?.toLocaleString() ||
                      rideToDelete.estimated_fare?.toLocaleString() ||
                      "-"}{" "}
                    د.ع
                  </span>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setRideToDelete(null);
                  }}
                  disabled={deleting}
                >
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <span className="animate-spin ml-2">⏳</span>
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 ml-2" />
                      حذف نهائياً
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRides;
