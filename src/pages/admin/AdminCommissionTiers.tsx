import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, TrendingUp, Award } from 'lucide-react';

interface CommissionTier {
  id: string;
  name_ar: string;
  name_en: string | null;
  min_rides_monthly: number;
  min_rating: number;
  commission_discount: number;
  badge_icon: string;
  badge_color: string;
  is_active: boolean;
  priority: number;
}

const AdminCommissionTiers = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    min_rides_monthly: 0,
    min_rating: 4.0,
    commission_discount: 0,
    badge_icon: '🥉',
    badge_color: '#CD7F32',
    is_active: true,
    priority: 0,
  });

  const { data: tiers = [], isLoading: loading } = useQuery({
    queryKey: ['commission-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_tiers')
        .select('*')
        .order('priority');
      if (error) throw error;
      return (data || []) as CommissionTier[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (editingTier) {
        const { error } = await supabase
          .from('commission_tiers')
          .update(formData)
          .eq('id', editingTier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('commission_tiers')
          .insert(formData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] });
      toast.success(editingTier ? 'تم التحديث بنجاح' : 'تم الإضافة بنجاح');
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error(editingTier ? 'خطأ في التحديث' : 'خطأ في الإضافة');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('commission_tiers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] });
      toast.success('تم الحذف بنجاح');
    },
    onError: () => {
      toast.error('خطأ في الحذف');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (tier: CommissionTier) => {
      const { error } = await supabase
        .from('commission_tiers')
        .update({ is_active: !tier.is_active })
        .eq('id', tier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] });
    },
    onError: () => {
      toast.error('خطأ في التحديث');
    },
  });

  const handleSubmit = () => {
    if (!formData.name_ar) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    submitMutation.mutate();
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    deleteMutation.mutate(id);
  };

  const toggleActive = (tier: CommissionTier) => {
    toggleMutation.mutate(tier);
  };

  const openEditDialog = (tier: CommissionTier) => {
    setEditingTier(tier);
    setFormData({
      name_ar: tier.name_ar,
      name_en: tier.name_en || '',
      min_rides_monthly: tier.min_rides_monthly,
      min_rating: tier.min_rating,
      commission_discount: tier.commission_discount,
      badge_icon: tier.badge_icon,
      badge_color: tier.badge_color,
      is_active: tier.is_active,
      priority: tier.priority,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTier(null);
    setFormData({
      name_ar: '',
      name_en: '',
      min_rides_monthly: 0,
      min_rating: 4.0,
      commission_discount: 0,
      badge_icon: '🥉',
      badge_color: '#CD7F32',
      is_active: true,
      priority: 0,
    });
  };

  const BADGE_OPTIONS = [
    { icon: '🥉', color: '#CD7F32', label: 'برونزي' },
    { icon: '🥈', color: '#C0C0C0', label: 'فضي' },
    { icon: '🥇', color: '#FFD700', label: 'ذهبي' },
    { icon: '💎', color: '#E5E4E2', label: 'بلاتيني' },
    { icon: '👑', color: '#B9F2FF', label: 'ماسي' },
    { icon: '⭐', color: '#FFD700', label: 'نجمة' },
    { icon: '🌟', color: '#FFD700', label: 'نجمة لامعة' },
    { icon: '🔥', color: '#FF4500', label: 'ناري' },
  ];

  return (
    <AdminLayout title="مستويات العمولة" subtitle="إدارة مستويات العمولة المتدرجة للسائقين">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <h2 className="text-xl font-bold">مستويات العمولة المتدرجة</h2>
              <p className="text-muted-foreground text-sm">
                تحديد خصومات العمولة حسب نشاط وتقييم السائق
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة مستوى جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTier ? 'تعديل مستوى' : 'إضافة مستوى جديد'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم بالعربية *</Label>
                    <Input
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      placeholder="ذهبي"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم بالإنجليزية</Label>
                    <Input
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      placeholder="Gold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للرحلات الشهرية</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.min_rides_monthly}
                      onChange={(e) => setFormData({ ...formData, min_rides_monthly: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأدنى للتقييم</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.min_rating}
                      onChange={(e) => setFormData({ ...formData, min_rating: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>خصم العمولة (%)</Label>
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
                    <Label>الأولوية</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">الأعلى = المستوى الأفضل</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>الشارة</Label>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_OPTIONS.map((option) => (
                      <button
                        key={option.icon}
                        type="button"
                        className={`p-2 rounded-lg border-2 transition-all ${
                          formData.badge_icon === option.icon
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent hover:border-muted'
                        }`}
                        onClick={() => setFormData({ 
                          ...formData, 
                          badge_icon: option.icon,
                          badge_color: option.color 
                        })}
                      >
                        <span className="text-2xl">{option.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>لون الشارة</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={formData.badge_color}
                      onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.badge_color}
                      onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                      placeholder="#FFD700"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>تفعيل المستوى</Label>
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  {editingTier ? 'تحديث' : 'إضافة'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tiers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستوى</TableHead>
                  <TableHead>الشارة</TableHead>
                  <TableHead>الحد الأدنى للرحلات</TableHead>
                  <TableHead>الحد الأدنى للتقييم</TableHead>
                  <TableHead>خصم العمولة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : tiers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد مستويات عمولة
                    </TableCell>
                  </TableRow>
                ) : (
                  tiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tier.name_ar}</p>
                          {tier.name_en && (
                            <p className="text-xs text-muted-foreground">{tier.name_en}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${tier.badge_color}20` }}
                        >
                          {tier.badge_icon}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Award className="h-4 w-4 text-muted-foreground" />
                          <span>{tier.min_rides_monthly}+ رحلة</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500">★</span>
                          <span>{tier.min_rating}+</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tier.commission_discount > 0 ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            -{tier.commission_discount}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">بدون خصم</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={tier.is_active}
                          onCheckedChange={() => toggleActive(tier)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(tier.id)}
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

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">كيف تعمل مستويات العمولة؟</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• يتم تحديد مستوى السائق تلقائياً بناءً على عدد رحلاته الشهرية وتقييمه</li>
              <li>• كلما زادت الرحلات والتقييم، حصل السائق على خصم أكبر على العمولة</li>
              <li>• يتم تطبيق الخصم تلقائياً عند اكتمال كل رحلة</li>
              <li>• يمكن للسائق الجمع بين خصم المستوى وخصم الاشتراك Premium</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCommissionTiers;
