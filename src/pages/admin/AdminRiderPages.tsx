/**
 * إدارة صفحات الراكب
 * يسمح للمدير بالتحكم في صفحات الراكب وتفعيلها
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Layout, 
  Star, 
  Eye, 
  EyeOff, 
  Plus, 
  Edit2, 
  Trash2, 
  ExternalLink,
  Loader2,
  CheckCircle,
  Settings2
} from "lucide-react";

interface PageLayout {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  layout_type: string;
  is_active: boolean;
  is_default: boolean;
  route_path: string;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface PageLayoutFromDB {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  layout_type: string;
  is_active: boolean;
  is_default: boolean;
  route_path: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const AdminRiderPages = () => {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [layouts, setLayouts] = useState<PageLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<PageLayout | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    layout_type: 'custom',
    route_path: '/rider-custom',
  });

  // Fetch layouts
  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchLayouts();
    }
  }, [authLoading, isAdmin]);

  const fetchLayouts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rider_page_layouts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في جلب التخطيطات",
        variant: "destructive"
      });
    } else {
      setLayouts(data || []);
    }
    setLoading(false);
  };

  // Toggle layout active status
  const toggleActive = async (layout: PageLayout) => {
    const { error } = await supabase
      .from('rider_page_layouts')
      .update({ is_active: !layout.is_active })
      .eq('id', layout.id);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث الحالة",
        variant: "destructive"
      });
    } else {
      fetchLayouts();
      toast({
        title: "تم التحديث",
        description: `الصفحة ${!layout.is_active ? 'مفعّلة' : 'معطّلة'} الآن`,
      });
    }
  };

  // Set as default
  const setAsDefault = async (layout: PageLayout) => {
    if (layout.is_default) return;

    const { error } = await supabase
      .from('rider_page_layouts')
      .update({ is_default: true })
      .eq('id', layout.id);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في تعيين الصفحة الافتراضية",
        variant: "destructive"
      });
    } else {
      fetchLayouts();
      toast({
        title: "تم التحديث",
        description: `"${layout.display_name}" هي الصفحة الافتراضية الآن`,
      });
    }
  };

  // Add new layout
  const handleAdd = async () => {
    if (!formData.name || !formData.display_name || !formData.route_path) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('rider_page_layouts')
      .insert({
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description || null,
        layout_type: formData.layout_type,
        route_path: formData.route_path,
        is_active: false,
        is_default: false,
        settings: {}
      });

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    } else {
      fetchLayouts();
      setShowAddDialog(false);
      resetForm();
      toast({
        title: "تمت الإضافة",
        description: "تم إضافة الصفحة بنجاح",
      });
    }
    setSaving(false);
  };

  // Edit layout
  const handleEdit = async () => {
    if (!selectedLayout) return;

    setSaving(true);
    const { error } = await supabase
      .from('rider_page_layouts')
      .update({
        display_name: formData.display_name,
        description: formData.description || null,
      })
      .eq('id', selectedLayout.id);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    } else {
      fetchLayouts();
      setShowEditDialog(false);
      setSelectedLayout(null);
      resetForm();
      toast({
        title: "تم التحديث",
        description: "تم تحديث الصفحة بنجاح",
      });
    }
    setSaving(false);
  };

  // Delete layout
  const handleDelete = async (layout: PageLayout) => {
    if (layout.is_default) {
      toast({
        title: "خطأ",
        description: "لا يمكن حذف الصفحة الافتراضية",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف "${layout.display_name}"؟`)) return;

    const { error } = await supabase
      .from('rider_page_layouts')
      .delete()
      .eq('id', layout.id);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    } else {
      fetchLayouts();
      toast({
        title: "تم الحذف",
        description: "تم حذف الصفحة بنجاح",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      layout_type: 'custom',
      route_path: '/rider-custom',
    });
  };

  const openEditDialog = (layout: PageLayout) => {
    setSelectedLayout(layout);
    setFormData({
      name: layout.name,
      display_name: layout.display_name,
      description: layout.description || '',
      layout_type: layout.layout_type,
      route_path: layout.route_path,
    });
    setShowEditDialog(true);
  };

  if (authLoading || loading) {
    return (
      <AdminLayout title="إدارة صفحات الراكب">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="إدارة صفحات الراكب" subtitle="تحكم في تخطيطات صفحات الراكب">
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">إدارة صفحات الراكب</h1>
            <p className="text-muted-foreground">
              تحكم في تخطيطات صفحات الراكب وحدد الصفحة الافتراضية
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة صفحة
          </Button>
        </div>

        {/* Layouts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              الصفحات المتاحة
            </CardTitle>
            <CardDescription>
              قائمة بجميع تخطيطات صفحات الراكب
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المسار</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الافتراضية</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {layouts.map((layout) => (
                  <TableRow key={layout.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{layout.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {layout.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{layout.layout_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {layout.route_path}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={layout.is_active}
                          onCheckedChange={() => toggleActive(layout)}
                        />
                        {layout.is_active ? (
                          <Badge variant="default" className="bg-green-500">
                            <Eye className="h-3 w-3 ml-1" />
                            مفعّلة
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <EyeOff className="h-3 w-3 ml-1" />
                            معطّلة
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {layout.is_default ? (
                        <Badge className="bg-primary">
                          <Star className="h-3 w-3 ml-1" />
                          الافتراضية
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAsDefault(layout)}
                          disabled={!layout.is_active}
                        >
                          تعيين كافتراضية
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/page-editor/${layout.id}`)}
                          title="محرر مرئي"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(layout.route_path, '_blank')}
                          title="معاينة"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(layout)}
                          title="تعديل"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {!layout.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(layout)}
                            className="text-destructive hover:text-destructive"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              كيفية الاستخدام
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>الصفحة الافتراضية:</strong> ستظهر عند زيارة /rider</p>
            <p>• <strong>الصفحات الأخرى:</strong> يمكن الوصول إليها عبر روابطها المباشرة (مثل /rider2)</p>
            <p>• <strong>تعطيل صفحة:</strong> لن يتمكن المستخدمون من الوصول إليها</p>
            <p>• <strong>إضافة صفحة:</strong> يمكنك إنشاء تخطيطات مخصصة جديدة</p>
          </CardContent>
        </Card>

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة صفحة جديدة</DialogTitle>
              <DialogDescription>
                أنشئ تخطيط صفحة جديد للراكب
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">المعرّف (بالإنجليزية)</label>
                <Input
                  placeholder="my-custom-page"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">اسم العرض</label>
                <Input
                  placeholder="صفحتي المخصصة"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">الوصف</label>
                <Textarea
                  placeholder="وصف قصير للصفحة..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">المسار</label>
                <Input
                  placeholder="/rider-custom"
                  value={formData.route_path}
                  onChange={(e) => setFormData({ ...formData, route_path: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل الصفحة</DialogTitle>
              <DialogDescription>
                تعديل معلومات الصفحة
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">اسم العرض</label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">الوصف</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRiderPages;
