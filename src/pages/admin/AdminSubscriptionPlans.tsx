import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Crown, Star, Users } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  duration_days: number;
  price: number;
  commission_discount: number;
  max_commission_rate: number | null;
  priority_rides: boolean;
  is_active: boolean;
  sort_order: number;
}

interface PlanStats {
  plan_id: string;
  active_subscribers: number;
}

const AdminSubscriptionPlans = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    description_ar: '',
    duration_days: 30,
    price: 25000,
    commission_discount: 3,
    max_commission_rate: null as number | null,
    priority_rides: false,
    is_active: true,
    sort_order: 0,
  });

  const { data: plans = [], isLoading: loading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as SubscriptionPlan[];
    },
  });

  const { data: stats = [] } = useQuery({
    queryKey: ['subscription-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('driver_subscriptions')
        .select('plan_id')
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString());

      if (!data) return [] as PlanStats[];
      const grouped = data.reduce((acc, sub) => {
        acc[sub.plan_id] = (acc[sub.plan_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([plan_id, active_subscribers]) => ({
        plan_id,
        active_subscribers
      })) as PlanStats[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        max_commission_rate: formData.max_commission_rate || null,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(payload)
          .eq('id', editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success(editingPlan ? 'تم التحديث بنجاح' : 'تم الإضافة بنجاح');
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error(editingPlan ? 'خطأ في التحديث' : 'خطأ في الإضافة');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('تم الحذف بنجاح');
    },
    onError: () => {
      toast.error('خطأ في الحذف');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (plan: SubscriptionPlan) => {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
    onError: () => {
      toast.error('خطأ في التحديث');
    },
  });

  const handleSubmit = () => {
    if (!formData.name_ar || formData.price <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    submitMutation.mutate();
  };

  const handleDelete = (id: string) => {
    const planStats = stats.find(s => s.plan_id === id);
    if (planStats && planStats.active_subscribers > 0) {
      toast.error('لا يمكن حذف خطة لها مشتركين نشطين');
      return;
    }
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    deleteMutation.mutate(id);
  };

  const toggleActive = (plan: SubscriptionPlan) => {
    toggleMutation.mutate(plan);
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name_ar: plan.name_ar,
      name_en: plan.name_en || '',
      description_ar: plan.description_ar || '',
      duration_days: plan.duration_days,
      price: plan.price,
      commission_discount: plan.commission_discount,
      max_commission_rate: plan.max_commission_rate,
      priority_rides: plan.priority_rides,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      name_ar: '',
      name_en: '',
      description_ar: '',
      duration_days: 30,
      price: 25000,
      commission_discount: 3,
      max_commission_rate: null,
      priority_rides: false,
      is_active: true,
      sort_order: 0,
    });
  };

  const formatDuration = (days: number) => {
    if (days === 30) return 'شهر واحد';
    if (days === 90) return '3 أشهر';
    if (days === 180) return '6 أشهر';
    if (days === 365) return 'سنة واحدة';
    return `${days} يوم`;
  };

  const getSubscriberCount = (planId: string) => {
    return stats.find(s => s.plan_id === planId)?.active_subscribers || 0;
  };

  return (
    <AdminLayout title="خطط الاشتراك Premium" subtitle="إدارة خطط اشتراك السائقين">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-yellow-500" />
            <div>
              <h2 className="text-xl font-bold">خطط الاشتراك</h2>
              <p className="text-muted-foreground text-sm">
                تحديد خطط الاشتراك وخصومات العمولة للسائقين
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة خطة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'تعديل خطة' : 'إضافة خطة جديدة'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم بالعربية *</Label>
                    <Input
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      placeholder="شهري"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم بالإنجليزية</Label>
                    <Input
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      placeholder="Monthly"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    placeholder="وصف مختصر للخطة..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المدة (بالأيام) *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.duration_days}
                      onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>السعر (د.ع) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>خصم العمولة (%) *</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={formData.commission_discount}
                      onChange={(e) => setFormData({ ...formData, commission_discount: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>أقصى عمولة (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="30"
                      value={formData.max_commission_rate || ''}
                      onChange={(e) => setFormData({ ...formData, max_commission_rate: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="بدون حد"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.priority_rides}
                      onCheckedChange={(checked) => setFormData({ ...formData, priority_rides: checked })}
                    />
                    <Label>أولوية في الطلبات</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>تفعيل الخطة</Label>
                  </div>
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  {editingPlan ? 'تحديث' : 'إضافة'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Plans Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الخطة</TableHead>
                  <TableHead>المدة</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>خصم العمولة</TableHead>
                  <TableHead>المشتركين</TableHead>
                  <TableHead>المميزات</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      لا توجد خطط اشتراك
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-yellow-500" />
                          <div>
                            <p className="font-medium">{plan.name_ar}</p>
                            {plan.name_en && (
                              <p className="text-xs text-muted-foreground">{plan.name_en}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDuration(plan.duration_days)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{plan.price.toLocaleString('en-US')}</span>
                        <span className="text-muted-foreground text-sm"> د.ع</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          -{plan.commission_discount}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{getSubscriberCount(plan.id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {plan.priority_rides && (
                            <Badge variant="outline" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              أولوية
                            </Badge>
                          )}
                          {plan.max_commission_rate && (
                            <Badge variant="outline" className="text-xs">
                              حد {plan.max_commission_rate}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={plan.is_active}
                          onCheckedChange={() => toggleActive(plan)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(plan)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(plan.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptionPlans;
