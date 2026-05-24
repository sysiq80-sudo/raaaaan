/**
 * ران - صفحة إدارة مجموعات الإشعارات
 * Admin Notification Groups Page
 */

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Trash2,
  Car,
  UserCircle,
  Loader2,
  Filter,
} from "lucide-react";
import {
  useNotificationGroups,
  useCreateNotificationGroup,
  useDeleteNotificationGroup,
} from "@/hooks/useNotificationCampaigns";

const AdminNotificationGroups = () => {
  const { data: groups, isLoading } = useNotificationGroups();
  const createGroup = useCreateNotificationGroup();
  const deleteGroup = useDeleteNotificationGroup();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    group_type: "drivers" as string,
    is_dynamic: true,
    filters: {} as Record<string, unknown>,
  });
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const filters: Record<string, unknown> = {};
    if (vehicleFilter) filters.vehicle_type = vehicleFilter;
    if (ratingFilter) filters.min_rating = parseFloat(ratingFilter);

    await createGroup.mutateAsync({ ...form, filters });
    setDialogOpen(false);
    setForm({ name: "", description: "", group_type: "drivers", is_dynamic: true, filters: {} });
    setVehicleFilter("");
    setRatingFilter("");
  };

  const typeLabels: Record<string, { label: string; icon: typeof Users }> = {
    drivers: { label: "سائقين", icon: Car },
    riders: { label: "ركاب", icon: UserCircle },
    mixed: { label: "مختلط", icon: Users },
  };

  return (
    <AdminLayout title="مجموعات الإشعارات">
      <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-500" />
              مجموعات الإشعارات
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              أنشئ مجموعات لاستهداف شرائح محددة عند إرسال الإشعارات
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            مجموعة جديدة
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : !groups?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">لا توجد مجموعات بعد</p>
              <p className="text-sm text-muted-foreground/70">
                أنشئ مجموعة لتسهيل استهداف الإشعارات
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => {
              const typeInfo = typeLabels[g.group_type] || typeLabels.mixed;
              const TypeIcon = typeInfo.icon;
              return (
                <Card key={g.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <TypeIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{g.name}</h3>
                          {g.description && (
                            <p className="text-sm text-muted-foreground">
                              {g.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm(`هل أنت متأكد من حذف المجموعة "${g.name}"؟`)) {
                            deleteGroup.mutate(g.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge variant="secondary">{typeInfo.label}</Badge>
                      <Badge variant={g.is_dynamic ? "default" : "outline"}>
                        {g.is_dynamic ? "ديناميكية" : "ثابتة"}
                      </Badge>
                      <Badge variant="outline">
                        {g.member_count} عضو
                      </Badge>
                      {g.filters &&
                        Object.entries(g.filters).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-xs">
                            <Filter className="h-3 w-3 ml-1" />
                            {k}: {String(v)}
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ديالوج إنشاء مجموعة */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء مجموعة إشعارات جديدة</DialogTitle>
              <DialogDescription>حدد تفاصيل المجموعة والفلاتر لاستهداف شرائح محددة</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>اسم المجموعة *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: سائقين البصرة"
                />
              </div>

              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="وصف اختياري..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>نوع المجموعة</Label>
                <Select
                  value={form.group_type}
                  onValueChange={(v) => setForm({ ...form, group_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drivers">سائقين فقط</SelectItem>
                    <SelectItem value="riders">ركاب فقط</SelectItem>
                    <SelectItem value="mixed">مختلط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_dynamic}
                  onCheckedChange={(v) => setForm({ ...form, is_dynamic: v })}
                />
                <Label>مجموعة ديناميكية (تُحسب تلقائياً عند الإرسال)</Label>
              </div>

              {form.is_dynamic && form.group_type !== "riders" && (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    فلاتر السائقين
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">نوع المركبة</Label>
                      <Select
                        value={vehicleFilter || "__all__"}
                        onValueChange={(v) => setVehicleFilter(v === "__all__" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">الكل</SelectItem>
                          <SelectItem value="economy">اقتصادي</SelectItem>
                          <SelectItem value="comfort">مريح</SelectItem>
                          <SelectItem value="premium">فاخر</SelectItem>
                          <SelectItem value="women_only">نسائي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">حد أدنى للتقييم</Label>
                      <Select
                        value={ratingFilter || "__none__"}
                        onValueChange={(v) => setRatingFilter(v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="بدون" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">بدون حد</SelectItem>
                          <SelectItem value="3.0">3.0+</SelectItem>
                          <SelectItem value="3.5">3.5+</SelectItem>
                          <SelectItem value="4.0">4.0+</SelectItem>
                          <SelectItem value="4.5">4.5+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.name.trim() || createGroup.isPending}
              >
                {createGroup.isPending && (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                )}
                إنشاء المجموعة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminNotificationGroups;
