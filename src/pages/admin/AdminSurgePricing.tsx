import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Clock, Zap } from 'lucide-react';

interface SurgePricingRule {
  id: string;
  name_ar: string;
  name_en: string | null;
  day_of_week: number[];
  start_time: string;
  end_time: string;
  surge_multiplier: number;
  commission_bonus: number;
  region_id: string | null;
  is_active: boolean;
  priority: number;
}

interface Region {
  id: string;
  name_ar: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

const AdminSurgePricing = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SurgePricingRule | null>(null);
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    day_of_week: [0, 1, 2, 3, 4] as number[],
    start_time: '07:00',
    end_time: '09:00',
    surge_multiplier: 1.5,
    commission_bonus: 0,
    region_id: '',
    is_active: true,
    priority: 0,
  });

  const { data: rules = [], isLoading: loading } = useQuery({
    queryKey: ['surge-pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surge_pricing_rules')
        .select('*')
        .order('priority', { ascending: false });
      if (error) throw error;
      return data as SurgePricingRule[];
    },
  });

  const { data: regions = [] } = useQuery({
    queryKey: ['regions-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name_ar')
        .eq('is_active', true);
      if (error) throw error;
      return data as Region[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        region_id: formData.region_id || null,
      };

      if (editingRule) {
        const { error } = await supabase
          .from('surge_pricing_rules')
          .update(payload)
          .eq('id', editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('surge_pricing_rules')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surge-pricing-rules'] });
      toast.success(editingRule ? 'تم التحديث بنجاح' : 'تم الإضافة بنجاح');
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error(editingRule ? 'خطأ في التحديث' : 'خطأ في الإضافة');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('surge_pricing_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surge-pricing-rules'] });
      toast.success('تم الحذف بنجاح');
    },
    onError: () => {
      toast.error('خطأ في الحذف');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (rule: SurgePricingRule) => {
      const { error } = await supabase
        .from('surge_pricing_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surge-pricing-rules'] });
    },
    onError: () => {
      toast.error('خطأ في التحديث');
    },
  });

  const handleSubmit = () => {
    if (!formData.name_ar || !formData.start_time || !formData.end_time) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (formData.surge_multiplier < 1.0 || formData.surge_multiplier > 2.0) {
      toast.error('معامل الزيادة يجب أن يكون بين 1.0 و 2.0');
      return;
    }

    submitMutation.mutate();
  };

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    deleteMutation.mutate(id);
  };

  const toggleActive = (rule: SurgePricingRule) => {
    toggleMutation.mutate(rule);
  };

  const openEditDialog = (rule: SurgePricingRule) => {
    setEditingRule(rule);
    setFormData({
      name_ar: rule.name_ar,
      name_en: rule.name_en || '',
      day_of_week: rule.day_of_week,
      start_time: rule.start_time,
      end_time: rule.end_time,
      surge_multiplier: rule.surge_multiplier,
      commission_bonus: rule.commission_bonus || 0,
      region_id: rule.region_id || '',
      is_active: rule.is_active,
      priority: rule.priority,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({
      name_ar: '',
      name_en: '',
      day_of_week: [0, 1, 2, 3, 4],
      start_time: '07:00',
      end_time: '09:00',
      surge_multiplier: 1.5,
      commission_bonus: 0,
      region_id: '',
      is_active: true,
      priority: 0,
    });
  };

  const getDaysLabel = (days: number[]) => {
    if (days.length === 7) return 'كل الأيام';
    if (days.length === 5 && !days.includes(5) && !days.includes(6)) return 'أيام العمل';
    if (days.length === 2 && days.includes(5) && days.includes(6)) return 'نهاية الأسبوع';
    return days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ');
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      day_of_week: prev.day_of_week.includes(day)
        ? prev.day_of_week.filter(d => d !== day)
        : [...prev.day_of_week, day].sort()
    }));
  };

  return (
    <AdminLayout title="تسعير ساعات الذروة" subtitle="إدارة أسعار الذروة والزيادات الموسمية">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500" />
            <div>
              <h2 className="text-xl font-bold">قواعد تسعير الذروة</h2>
              <p className="text-muted-foreground text-sm">
                تحديد أوقات الذروة ومعاملات زيادة الأسعار
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة قاعدة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRule ? 'تعديل قاعدة' : 'إضافة قاعدة جديدة'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم بالعربية *</Label>
                    <Input
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      placeholder="ذروة الصباح"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم بالإنجليزية</Label>
                    <Input
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      placeholder="Morning Rush"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>أيام الأسبوع *</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center gap-1">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={formData.day_of_week.includes(day.value)}
                          onCheckedChange={() => toggleDay(day.value)}
                        />
                        <Label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>وقت البداية *</Label>
                    <Input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>وقت النهاية *</Label>
                    <Input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>معامل زيادة السعر *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      max="2"
                      value={formData.surge_multiplier}
                      onChange={(e) => setFormData({ ...formData, surge_multiplier: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      مثال: 1.5 = زيادة 50% (الحد الأقصى 2.0)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>زيادة العمولة (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="20"
                      value={formData.commission_bonus}
                      onChange={(e) => setFormData({ ...formData, commission_bonus: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المنطقة (اختياري)</Label>
                    <Select
                      value={formData.region_id}
                      onValueChange={(value) => setFormData({ ...formData, region_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="جميع المناطق" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">جميع المناطق</SelectItem>
                        {regions.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name_ar}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الأولوية</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>تفعيل القاعدة</Label>
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  {editingRule ? 'تحديث' : 'إضافة'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Rules Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الأيام</TableHead>
                  <TableHead>الوقت</TableHead>
                  <TableHead>معامل الزيادة</TableHead>
                  <TableHead>زيادة العمولة</TableHead>
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
                ) : rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد قواعد تسعير
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name_ar}</p>
                          {rule.name_en && (
                            <p className="text-xs text-muted-foreground">{rule.name_en}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getDaysLabel(rule.day_of_week)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">{rule.start_time} - {rule.end_time}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          ×{rule.surge_multiplier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rule.commission_bonus > 0 ? (
                          <Badge variant="outline">+{rule.commission_bonus}%</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => toggleActive(rule)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(rule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(rule.id)}
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

export default AdminSurgePricing;
