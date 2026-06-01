/**
 * ران - صفحة إدارة الأساطيل
 * للمشرفين فقط - إنشاء وإدارة أساطيل السيارات وتعيين السائقين
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Building2,
  Users,
  Car,
  Phone,
  Mail,
  Edit,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  UserMinus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import AdminLayout from "@/components/admin/AdminLayout";

interface Fleet {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  commission_rate: number | null;
  is_active: boolean;
  max_drivers: number | null;
  notes: string | null;
  created_at: string;
}

interface FleetStats {
  fleet_id: string;
  name: string;
  is_active: boolean;
  total_drivers: number;
  online_drivers: number;
  approved_drivers: number;
  total_rides: number;
  total_earnings: number;
  avg_rating: number;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string | null;
  fleet_id: string | null;
  is_online: boolean;
  status: string | null;
}

const emptyFleetForm = {
  name: "",
  owner_name: "",
  phone: "",
  email: "",
  commission_rate: "",
  max_drivers: "",
  notes: "",
};

const AdminFleets = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFleetDialog, setShowFleetDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [assignFleetId, setAssignFleetId] = useState<string | null>(null);
  const [fleetForm, setFleetForm] = useState(emptyFleetForm);

  // جلب الأساطيل مع الإحصائيات
  const { data: fleetStats = [], isLoading } = useQuery({
    queryKey: ["fleet-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fleet_stats")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as FleetStats[];
    },
  });

  // جلب تفاصيل الأساطيل
  const { data: fleets = [] } = useQuery({
    queryKey: ["fleets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fleets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Fleet[];
    },
  });

  // جلب السائقين غير المرتبطين بأسطول (للتعيين)
  const { data: unassignedDrivers = [] } = useQuery({
    queryKey: ["unassigned-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, full_name, phone, vehicle_type, fleet_id, is_online, status")
        .is("fleet_id", null)
        .eq("status", "approved")
        .order("full_name");
      if (error) throw error;
      return (data || []) as Driver[];
    },
  });

  // جلب سائقي أسطول معين
  const { data: fleetDrivers = [] } = useQuery({
    queryKey: ["fleet-drivers", assignFleetId],
    enabled: !!assignFleetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, full_name, phone, vehicle_type, fleet_id, is_online, status")
        .eq("fleet_id", assignFleetId!)
        .order("full_name");
      if (error) throw error;
      return (data || []) as Driver[];
    },
  });

  // إنشاء/تعديل أسطول
  const fleetMutation = useMutation({
    mutationFn: async (isEdit: boolean) => {
      const payload: Record<string, unknown> = {
        name: fleetForm.name,
        owner_name: fleetForm.owner_name || null,
        phone: fleetForm.phone || null,
        email: fleetForm.email || null,
        commission_rate: fleetForm.commission_rate ? parseFloat(fleetForm.commission_rate) : null,
        max_drivers: fleetForm.max_drivers ? parseInt(fleetForm.max_drivers) : null,
        notes: fleetForm.notes || null,
      };

      if (isEdit && editingFleet) {
        const { error } = await (supabase as any)
          .from("fleets")
          .update(payload)
          .eq("id", editingFleet.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("fleets")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingFleet ? "تم تعديل الأسطول" : "تم إنشاء الأسطول بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["fleets"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-stats"] });
      closeFleetDialog();
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // تفعيل/إيقاف أسطول
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("fleets")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleets"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-stats"] });
    },
  });

  // تعيين سائق لأسطول
  const assignMutation = useMutation({
    mutationFn: async ({ driverId, fleetId }: { driverId: string; fleetId: string | null }) => {
      const { error } = await supabase
        .from("drivers")
        .update({ fleet_id: fleetId } as any)
        .eq("id", driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-drivers"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-drivers"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-stats"] });
    },
  });

  const openCreateDialog = () => {
    setEditingFleet(null);
    setFleetForm(emptyFleetForm);
    setShowFleetDialog(true);
  };

  const openEditDialog = (fleet: Fleet) => {
    setEditingFleet(fleet);
    setFleetForm({
      name: fleet.name,
      owner_name: fleet.owner_name || "",
      phone: fleet.phone || "",
      email: fleet.email || "",
      commission_rate: fleet.commission_rate?.toString() || "",
      max_drivers: fleet.max_drivers?.toString() || "",
      notes: fleet.notes || "",
    });
    setShowFleetDialog(true);
  };

  const closeFleetDialog = () => {
    setShowFleetDialog(false);
    setEditingFleet(null);
    setFleetForm(emptyFleetForm);
  };

  const openAssignDialog = (fleetId: string) => {
    setAssignFleetId(fleetId);
    setShowAssignDialog(true);
  };

  const getStatsForFleet = (fleetId: string) =>
    fleetStats.find((s) => s.fleet_id === fleetId);

  const filteredFleets = fleets.filter(
    (f) =>
      f.name.includes(searchQuery) ||
      f.owner_name?.includes(searchQuery) ||
      f.phone?.includes(searchQuery)
  );

  return (
    <AdminLayout title="إدارة الأساطيل">
      {/* الإحصائيات العامة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{fleets.length}</p>
                <p className="text-sm text-muted-foreground">إجمالي الأساطيل</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {fleetStats.reduce((sum, s) => sum + s.total_drivers, 0)}
                </p>
                <p className="text-sm text-muted-foreground">سائقين في أساطيل</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Car className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {fleetStats.reduce((sum, s) => sum + s.total_rides, 0).toLocaleString('en-US')}
                </p>
                <p className="text-sm text-muted-foreground">إجمالي الرحلات</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {fleetStats.reduce((sum, s) => sum + s.online_drivers, 0)}
                </p>
                <p className="text-sm text-muted-foreground">سائقين متصلين</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* شريط البحث والإنشاء */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="البحث في الأساطيل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 ml-2" />
          أسطول جديد
        </Button>
      </div>

      {/* جدول الأساطيل */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : filteredFleets.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">لا توجد أساطيل</h3>
            <p className="text-muted-foreground mb-4">
              أنشئ أسطولاً جديداً لتنظيم السائقين
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 ml-2" />
              إنشاء أسطول
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">المالك</TableHead>
                <TableHead className="text-right">السائقين</TableHead>
                <TableHead className="text-right">متصلين</TableHead>
                <TableHead className="text-right">الرحلات</TableHead>
                <TableHead className="text-right">التقييم</TableHead>
                <TableHead className="text-right">العمولة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFleets.map((fleet) => {
                const stats = getStatsForFleet(fleet.id);
                return (
                  <TableRow key={fleet.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{fleet.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {fleet.owner_name || "-"}
                        {fleet.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {fleet.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{stats?.total_drivers || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stats?.online_drivers ? "default" : "outline"}>
                        {stats?.online_drivers || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>{stats?.total_rides?.toLocaleString('en-US') || 0}</TableCell>
                    <TableCell>
                      {stats?.avg_rating ? `⭐ ${Number(stats.avg_rating).toFixed(1)}` : "-"}
                    </TableCell>
                    <TableCell>
                      {fleet.commission_rate
                        ? `${fleet.commission_rate}%`
                        : "افتراضي"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={fleet.is_active ? "default" : "destructive"}>
                        {fleet.is_active ? "نشط" : "متوقف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(fleet)}
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssignDialog(fleet.id)}
                          title="إدارة السائقين"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleMutation.mutate({
                              id: fleet.id,
                              is_active: !fleet.is_active,
                            })
                          }
                          title={fleet.is_active ? "إيقاف" : "تفعيل"}
                        >
                          {fleet.is_active ? (
                            <ToggleRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ☐ حوار إنشاء/تعديل أسطول */}
      <Dialog open={showFleetDialog} onOpenChange={setShowFleetDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingFleet ? "تعديل الأسطول" : "إنشاء أسطول جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingFleet
                ? "عدّل بيانات الأسطول"
                : "أدخل بيانات الأسطول الجديد"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>اسم الأسطول *</Label>
              <Input
                value={fleetForm.name}
                onChange={(e) => setFleetForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="مثال: أسطول بغداد الذهبي"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>اسم المالك</Label>
                <Input
                  value={fleetForm.owner_name}
                  onChange={(e) => setFleetForm((p) => ({ ...p, owner_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>الهاتف</Label>
                <Input
                  value={fleetForm.phone}
                  onChange={(e) => setFleetForm((p) => ({ ...p, phone: e.target.value }))}
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={fleetForm.email}
                onChange={(e) => setFleetForm((p) => ({ ...p, email: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>نسبة العمولة (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={fleetForm.commission_rate}
                  onChange={(e) =>
                    setFleetForm((p) => ({ ...p, commission_rate: e.target.value }))
                  }
                  placeholder="افتراضي: نظام"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>الحد الأقصى للسائقين</Label>
                <Input
                  type="number"
                  min="1"
                  value={fleetForm.max_drivers}
                  onChange={(e) =>
                    setFleetForm((p) => ({ ...p, max_drivers: e.target.value }))
                  }
                  placeholder="بدون حد"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={fleetForm.notes}
                onChange={(e) => setFleetForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFleetDialog}>
              إلغاء
            </Button>
            <Button
              onClick={() => fleetMutation.mutate(!!editingFleet)}
              disabled={!fleetForm.name.trim() || fleetMutation.isPending}
            >
              {fleetMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {editingFleet ? "حفظ" : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ☐ حوار تعيين السائقين */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إدارة سائقي الأسطول</DialogTitle>
            <DialogDescription>
              أضف أو أزل السائقين من هذا الأسطول
            </DialogDescription>
          </DialogHeader>

          {/* السائقين الحاليين في الأسطول */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">
              سائقي الأسطول ({fleetDrivers.length})
            </h4>
            {fleetDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                لا يوجد سائقين في هذا الأسطول
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {fleetDrivers.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <span>
                      {d.full_name} - {d.phone}
                      {d.is_online && (
                        <Badge variant="default" className="mr-2 text-xs">
                          متصل
                        </Badge>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        assignMutation.mutate({ driverId: d.id, fleetId: null })
                      }
                      disabled={assignMutation.isPending}
                    >
                      <UserMinus className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* السائقين غير المرتبطين */}
          <div className="space-y-3 border-t pt-3">
            <h4 className="font-medium text-sm">
              سائقين بدون أسطول ({unassignedDrivers.length})
            </h4>
            {unassignedDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                كل السائقين المعتمدين منتسبون لأساطيل
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {unassignedDrivers.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <span>
                      {d.full_name} - {d.phone}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        assignMutation.mutate({
                          driverId: d.id,
                          fleetId: assignFleetId!,
                        })
                      }
                      disabled={assignMutation.isPending}
                    >
                      <UserPlus className="w-4 h-4 text-green-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssignDialog(false)}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminFleets;
