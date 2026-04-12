import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Car, Pencil, Percent, Save, Loader2, Plus, Trash2, RefreshCw } from "lucide-react";

interface VehicleType {
  id: string;
  name_ar: string;
  name_en: string;
  icon: string;
  description_ar: string | null;
  description_en: string | null;
  multiplier: number;
  min_fare: number;
  commission_rate: number;
  is_active: boolean;
  sort_order: number;
}

const emptyVehicleType: Omit<VehicleType, 'id'> & { id: string } = {
  id: '',
  name_ar: '',
  name_en: '',
  icon: '🚗',
  description_ar: '',
  description_en: '',
  multiplier: 1.0,
  min_fare: 2000,
  commission_rate: 15,
  is_active: true,
  sort_order: 0
};

const AdminVehicleTypes = () => {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [editingType, setEditingType] = useState<VehicleType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [deleteType, setDeleteType] = useState<VehicleType | null>(null);

  const { data: vehicleTypes = [], isLoading: loading } = useQuery({
    queryKey: ['vehicle-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as VehicleType[];
    },
    enabled: isAdmin,
  });

  const handleAdd = () => {
    const maxOrder = Math.max(...vehicleTypes.map(v => v.sort_order), 0);
    setEditingType({ ...emptyVehicleType, sort_order: maxOrder + 1 });
    setIsAddMode(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (type: VehicleType) => {
    setEditingType({ ...type });
    setIsAddMode(false);
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (type: VehicleType) => {
      if (isAddMode) {
        const existing = vehicleTypes.find(v => v.id === type.id);
        if (existing) throw new Error('معرف النوع موجود مسبقاً');

        const { error } = await supabase
          .from('vehicle_types')
          .insert({
            id: type.id,
            name_ar: type.name_ar,
            name_en: type.name_en,
            icon: type.icon,
            description_ar: type.description_ar,
            description_en: type.description_en,
            multiplier: type.multiplier,
            min_fare: type.min_fare,
            commission_rate: type.commission_rate,
            is_active: type.is_active,
            sort_order: type.sort_order
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicle_types')
          .update({
            name_ar: type.name_ar,
            name_en: type.name_en,
            icon: type.icon,
            description_ar: type.description_ar,
            description_en: type.description_en,
            multiplier: type.multiplier,
            min_fare: type.min_fare,
            commission_rate: type.commission_rate,
            is_active: type.is_active,
            sort_order: type.sort_order
          })
          .eq('id', type.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] });
      toast.success(isAddMode ? 'تم إضافة نوع السيارة بنجاح' : 'تم حفظ التغييرات بنجاح');
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      console.error('Error saving vehicle type:', error);
      toast.error(error.message === 'معرف النوع موجود مسبقاً' ? error.message : 'حدث خطأ أثناء حفظ التغييرات');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehicle_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] });
      toast.success('تم حذف نوع السيارة');
      setDeleteType(null);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء الحذف - قد يكون النوع مستخدماً في رحلات سابقة');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (type: VehicleType) => {
      const { error } = await supabase
        .from('vehicle_types')
        .update({ is_active: !type.is_active })
        .eq('id', type.id);
      if (error) throw error;
      return type;
    },
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] });
      toast.success(type.is_active ? 'تم تعطيل النوع' : 'تم تفعيل النوع');
    },
    onError: () => {
      toast.error('حدث خطأ');
    },
  });

  const handleSave = () => {
    if (!editingType) return;

    if (!editingType.id.trim() || !editingType.name_ar.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const idRegex = /^[a-z_]+$/;
    if (!idRegex.test(editingType.id)) {
      toast.error('معرف النوع يجب أن يكون بالإنجليزية الصغيرة بدون مسافات');
      return;
    }

    saveMutation.mutate(editingType);
  };

  const handleDelete = () => {
    if (!deleteType) return;
    deleteMutation.mutate(deleteType.id);
  };

  const handleToggleActive = (type: VehicleType) => {
    toggleMutation.mutate(type);
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="أنواع السيارات" subtitle="إدارة أنواع السيارات والعمولات">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="أنواع السيارات" 
      subtitle="إدارة أنواع السيارات ونسب العمولة"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['vehicle-types'] })}>
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة نوع جديد
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            أنواع السيارات والعمولات
          </CardTitle>
          <CardDescription>
            تحديد أنواع السيارات المتاحة ومعاملات الأسعار ونسب العمولة لكل نوع
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right font-semibold">الأيقونة</TableHead>
                  <TableHead className="text-right font-semibold">المعرف</TableHead>
                  <TableHead className="text-right font-semibold">الاسم</TableHead>
                  <TableHead className="text-right font-semibold">معامل السعر</TableHead>
                  <TableHead className="text-right font-semibold">الحد الأدنى</TableHead>
                  <TableHead className="text-right font-semibold">نسبة العمولة</TableHead>
                  <TableHead className="text-right font-semibold">الترتيب</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      لا توجد أنواع سيارات. أضف نوعاً جديداً للبدء.
                    </TableCell>
                  </TableRow>
                ) : (
                  vehicleTypes.map((type) => (
                    <TableRow key={type.id} className="hover:bg-muted/30">
                      <TableCell>
                        <span className="text-2xl">{type.icon}</span>
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 rounded bg-muted text-sm">{type.id}</code>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{type.name_ar}</div>
                          <div className="text-sm text-muted-foreground">{type.name_en}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">×{type.multiplier}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{type.min_fare.toLocaleString('ar-IQ')}</span>
                        <span className="text-muted-foreground text-xs mr-1">د.ع</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm">
                          <Percent className="w-3 h-3" />
                          {type.commission_rate}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-muted-foreground">{type.sort_order}</span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={type.is_active}
                          onCheckedChange={() => handleToggleActive(type)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(type)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteType(type)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 p-4 rounded-lg border border-muted bg-muted/50">
            <p className="text-sm text-muted-foreground">
              <strong>ملاحظة:</strong> نسبة العمولة لكل نوع سيارة تُطبق تلقائياً عند اكتمال الرحلة. 
              معامل السعر يُضرب في السعر الأساسي للمنطقة لحساب تكلفة الرحلة.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isAddMode ? (
                <>
                  <Plus className="w-5 h-5" />
                  إضافة نوع سيارة جديد
                </>
              ) : (
                <>
                  <span className="text-2xl">{editingType?.icon}</span>
                  تعديل {editingType?.name_ar}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isAddMode ? 'أدخل بيانات نوع السيارة الجديد' : 'قم بتعديل بيانات نوع السيارة'}
            </DialogDescription>
          </DialogHeader>

          {editingType && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {isAddMode && (
                <div className="space-y-2">
                  <Label>المعرف (ID) <span className="text-destructive">*</span></Label>
                  <Input
                    value={editingType.id}
                    onChange={(e) => setEditingType({ ...editingType, id: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    placeholder="مثال: luxury, suv, van"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    معرف فريد بالإنجليزية الصغيرة بدون مسافات (يُستخدم داخلياً)
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الاسم بالعربية <span className="text-destructive">*</span></Label>
                  <Input
                    value={editingType.name_ar}
                    onChange={(e) => setEditingType({ ...editingType, name_ar: e.target.value })}
                    placeholder="اقتصادي"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الاسم بالإنجليزية</Label>
                  <Input
                    value={editingType.name_en}
                    onChange={(e) => setEditingType({ ...editingType, name_en: e.target.value })}
                    placeholder="Economy"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الأيقونة (Emoji)</Label>
                  <Input
                    value={editingType.icon}
                    onChange={(e) => setEditingType({ ...editingType, icon: e.target.value })}
                    className="text-center text-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    value={editingType.sort_order}
                    onChange={(e) => setEditingType({ ...editingType, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الوصف بالعربية</Label>
                  <Input
                    value={editingType.description_ar || ''}
                    onChange={(e) => setEditingType({ ...editingType, description_ar: e.target.value })}
                    placeholder="رحلات يومية بأسعار معقولة"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوصف بالإنجليزية</Label>
                  <Input
                    value={editingType.description_en || ''}
                    onChange={(e) => setEditingType({ ...editingType, description_en: e.target.value })}
                    placeholder="Affordable everyday rides"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>معامل السعر</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5"
                    value={editingType.multiplier}
                    onChange={(e) => setEditingType({ ...editingType, multiplier: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">يُضرب في السعر الأساسي</p>
                </div>
                <div className="space-y-2">
                  <Label>الحد الأدنى (د.ع)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    value={editingType.min_fare}
                    onChange={(e) => setEditingType({ ...editingType, min_fare: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>نسبة العمولة (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={editingType.commission_rate}
                    onChange={(e) => setEditingType({ ...editingType, commission_rate: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="font-medium text-primary">مثال على الحساب</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  لرحلة بسعر أساسي 10,000 د.ع:
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• السعر بعد المعامل: <span className="font-semibold">{(10000 * editingType.multiplier).toLocaleString('ar-IQ')} د.ع</span></li>
                  <li>• عمولة الشركة ({editingType.commission_rate}%): <span className="font-semibold text-primary">{(10000 * editingType.multiplier * editingType.commission_rate / 100).toLocaleString('ar-IQ')} د.ع</span></li>
                  <li>• حصة السائق: <span className="font-semibold">{(10000 * editingType.multiplier * (1 - editingType.commission_rate / 100)).toLocaleString('ar-IQ')} د.ع</span></li>
                </ul>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <Label>حالة التفعيل</Label>
                  <p className="text-sm text-muted-foreground">
                    {editingType.is_active ? 'هذا النوع مفعّل ويظهر للمستخدمين' : 'هذا النوع معطّل ولا يظهر للمستخدمين'}
                  </p>
                </div>
                <Switch
                  checked={editingType.is_active}
                  onCheckedChange={(checked) => setEditingType({ ...editingType, is_active: checked })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
              {isAddMode ? 'إضافة' : 'حفظ التغييرات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteType} onOpenChange={() => setDeleteType(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              حذف نوع السيارة
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف نوع السيارة "{deleteType?.name_ar}"؟ 
              لا يمكن التراجع عن هذا الإجراء.
              <br />
              <strong className="text-destructive">ملاحظة:</strong> إذا كان هذا النوع مستخدماً في رحلات سابقة، قد لا يتم الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminVehicleTypes;
