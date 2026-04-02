/**
 * ران - صفحة إدارة العروض الترويجية
 * Admin Promo Banners Management Page
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Edit2, Trash2, Save, X, Eye, EyeOff,
    GripVertical, Sparkles, Crown, Gift, Percent,
    ArrowUp, ArrowDown, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import AdminLayout from "@/components/admin/AdminLayout";

interface PromoBanner {
    id: string;
    title: string;
    subtitle: string;
    button_text: string;
    discount_value: string;
    discount_label: string;
    gradient_from: string;
    gradient_via: string;
    gradient_to: string;
    icon_type: string;
    is_active: boolean;
    display_order: number;
    link_url: string;
}

const gradientColors = [
    { value: 'green-600', label: 'أخضر', preview: 'bg-green-600' },
    { value: 'emerald-500', label: 'زمردي', preview: 'bg-emerald-500' },
    { value: 'teal-600', label: 'أزرق مخضر', preview: 'bg-teal-600' },
    { value: 'blue-600', label: 'أزرق', preview: 'bg-blue-600' },
    { value: 'purple-600', label: 'بنفسجي', preview: 'bg-purple-600' },
    { value: 'violet-500', label: 'بنفسجي فاتح', preview: 'bg-violet-500' },
    { value: 'indigo-600', label: 'نيلي', preview: 'bg-indigo-600' },
    { value: 'pink-500', label: 'زهري', preview: 'bg-pink-500' },
    { value: 'rose-600', label: 'وردي', preview: 'bg-rose-600' },
    { value: 'amber-500', label: 'ذهبي', preview: 'bg-amber-500' },
    { value: 'orange-500', label: 'برتقالي', preview: 'bg-orange-500' },
    { value: 'red-600', label: 'أحمر', preview: 'bg-red-600' },
];

const iconTypes = [
    { value: 'sparkles', label: 'نجوم', icon: Sparkles },
    { value: 'crown', label: 'تاج', icon: Crown },
    { value: 'gift', label: 'هدية', icon: Gift },
    { value: 'percent', label: 'نسبة', icon: Percent },
];

const AdminPromoBanners = () => {
    const { isAdmin, loading: authLoading } = useAdminAuth();
    const [banners, setBanners] = useState<PromoBanner[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    // Form state
    const [formData, setFormData] = useState<Partial<PromoBanner>>({
        title: '',
        subtitle: '',
        button_text: '',
        discount_value: '',
        discount_label: '',
        gradient_from: 'green-600',
        gradient_via: 'emerald-500',
        gradient_to: 'teal-600',
        icon_type: 'sparkles',
        is_active: true,
        link_url: '',
    });

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        try {
            const { data, error } = await supabase
                .from('promo_banners')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;
            setBanners(data || []);
        } catch (error) {
            console.error('Error fetching banners:', error);
            toast({
                title: "خطأ",
                description: "فشل في تحميل العروض",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const openCreateDialog = () => {
        setEditingBanner(null);
        setFormData({
            title: '',
            subtitle: '',
            button_text: '',
            discount_value: '',
            discount_label: '',
            gradient_from: 'green-600',
            gradient_via: 'emerald-500',
            gradient_to: 'teal-600',
            icon_type: 'sparkles',
            is_active: true,
            link_url: '',
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (banner: PromoBanner) => {
        setEditingBanner(banner);
        setFormData(banner);
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title) {
            toast({
                title: "خطأ",
                description: "العنوان مطلوب",
                variant: "destructive"
            });
            return;
        }

        setSaving(true);
        try {
            if (editingBanner) {
                // Update existing
                const { error } = await supabase
                    .from('promo_banners')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingBanner.id);

                if (error) throw error;
                toast({ title: "تم التحديث", description: "تم تحديث العرض بنجاح" });
            } else {
                // Create new
                const { error } = await supabase
                    .from('promo_banners')
                    .insert({
                        title: formData.title || '',
                        subtitle: formData.subtitle || null,
                        button_text: formData.button_text || null,
                        discount_value: formData.discount_value || null,
                        discount_label: formData.discount_label || null,
                        gradient_from: formData.gradient_from || 'green-600',
                        gradient_via: formData.gradient_via || 'emerald-500',
                        gradient_to: formData.gradient_to || 'teal-600',
                        icon_type: formData.icon_type || 'sparkles',
                        is_active: formData.is_active ?? true,
                        link_url: formData.link_url || null,
                    });

                if (error) throw error;
                toast({ title: "تم الإنشاء", description: "تم إنشاء العرض بنجاح" });
            }

            setIsDialogOpen(false);
            fetchBanners();
        } catch (error) {
            console.error('Error saving banner:', error);
            toast({
                title: "خطأ",
                description: "فشل في حفظ العرض",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;

        try {
            const { error } = await supabase
                .from('promo_banners')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast({ title: "تم الحذف", description: "تم حذف العرض بنجاح" });
            fetchBanners();
        } catch (error) {
            console.error('Error deleting banner:', error);
            toast({
                title: "خطأ",
                description: "فشل في حذف العرض",
                variant: "destructive"
            });
        }
    };

    const toggleActive = async (banner: PromoBanner) => {
        try {
            const { error } = await supabase
                .from('promo_banners')
                .update({ is_active: !banner.is_active })
                .eq('id', banner.id);

            if (error) throw error;
            fetchBanners();
        } catch (error) {
            console.error('Error toggling banner:', error);
        }
    };

    const moveOrder = async (banner: PromoBanner, direction: 'up' | 'down') => {
        const currentIndex = banners.findIndex(b => b.id === banner.id);
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (newIndex < 0 || newIndex >= banners.length) return;

        const otherBanner = banners[newIndex];

        try {
            await Promise.all([
                supabase
                    .from('promo_banners')
                    .update({ display_order: banner.display_order })
                    .eq('id', otherBanner.id),
                supabase
                    .from('promo_banners')
                    .update({ display_order: otherBanner.display_order })
                    .eq('id', banner.id),
            ]);

            fetchBanners();
        } catch (error) {
            console.error('Error reordering:', error);
        }
    };

    const getIconComponent = (iconType: string) => {
        const found = iconTypes.find(i => i.value === iconType);
        return found ? found.icon : Sparkles;
    };

    if (authLoading || loading) {
        return (
            <AdminLayout title="العروض الترويجية">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
            </AdminLayout>
        );
    }
    if (!isAdmin) return null;

    return (
        <AdminLayout title="العروض الترويجية">
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">إدارة العروض الترويجية</h1>
                    <p className="text-muted-foreground">تحكم في البانرات الإعلانية في تطبيق الراكب</p>
                </div>
                <Button onClick={openCreateDialog} className="gap-2">
                    <Plus className="w-4 h-4" />
                    إضافة عرض جديد
                </Button>
            </div>

            {/* Banners List */}
            <div className="space-y-4">
                <AnimatePresence>
                    {banners.map((banner, index) => {
                        const IconComp = getIconComponent(banner.icon_type);
                        return (
                            <motion.div
                                key={banner.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className={`relative overflow-hidden rounded-2xl border ${banner.is_active ? 'border-primary/30' : 'border-border opacity-60'
                                    }`}
                            >
                                {/* Preview Banner */}
                                <div className={`relative overflow-hidden`}>
                                    <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom right, ${banner.gradient_from}, ${banner.gradient_via}, ${banner.gradient_to})` }} />
                                    <div className="absolute inset-0 opacity-20">
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
                                    </div>
                                    <div className="relative p-5 flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <IconComp className="w-5 h-5 text-yellow-300" />
                                                <span className="text-yellow-300 font-bold text-lg">{banner.title}</span>
                                            </div>
                                            <p className="text-white/90 text-sm mb-3">{banner.subtitle}</p>
                                            <button className="px-4 py-2 bg-white/20 rounded-xl text-white text-sm font-medium">
                                                {banner.button_text}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center shadow-xl">
                                                <span className="text-green-800 font-black text-2xl">{banner.discount_value}</span>
                                            </div>
                                            <span className="absolute -bottom-1 text-white/80 text-xs">{banner.discount_label}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="bg-card p-4 flex items-center gap-4 border-t">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => moveOrder(banner, 'up')}
                                            disabled={index === 0}
                                            className="p-1.5 hover:bg-accent rounded disabled:opacity-30"
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => moveOrder(banner, 'down')}
                                            disabled={index === banners.length - 1}
                                            className="p-1.5 hover:bg-accent rounded disabled:opacity-30"
                                        >
                                            <ArrowDown className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex-1" />

                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            {banner.is_active ? 'نشط' : 'معطل'}
                                        </span>
                                        <Switch
                                            checked={banner.is_active}
                                            onCheckedChange={() => toggleActive(banner)}
                                        />
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditDialog(banner)}
                                        className="gap-1"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        تعديل
                                    </Button>

                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(banner.id)}
                                        className="gap-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        حذف
                                    </Button>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {banners.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>لا توجد عروض ترويجية</p>
                        <Button onClick={openCreateDialog} className="mt-4">
                            إضافة أول عرض
                        </Button>
                    </div>
                )}
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingBanner ? 'تعديل العرض' : 'إضافة عرض جديد'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        {/* Title */}
                        <div className="col-span-2">
                            <Label>العنوان الرئيسي *</Label>
                            <Input
                                value={formData.title || ''}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="مثال: عروض مذهلة!"
                                className="mt-1"
                            />
                        </div>

                        {/* Subtitle */}
                        <div className="col-span-2">
                            <Label>النص الفرعي</Label>
                            <Input
                                value={formData.subtitle || ''}
                                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                placeholder="مثال: تسوق الآن واحصل على خصم"
                                className="mt-1"
                            />
                        </div>

                        {/* Button Text */}
                        <div>
                            <Label>نص الزر</Label>
                            <Input
                                value={formData.button_text || ''}
                                onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                                placeholder="مثال: احجز الآن"
                                className="mt-1"
                            />
                        </div>

                        {/* Link URL */}
                        <div>
                            <Label>رابط الزر (اختياري)</Label>
                            <Input
                                value={formData.link_url || ''}
                                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                                placeholder="https://..."
                                className="mt-1"
                                dir="ltr"
                            />
                        </div>

                        {/* Discount Value */}
                        <div>
                            <Label>قيمة الخصم</Label>
                            <Input
                                value={formData.discount_value || ''}
                                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                                placeholder="مثال: 40%"
                                className="mt-1"
                            />
                        </div>

                        {/* Discount Label */}
                        <div>
                            <Label>عبارة الخصم</Label>
                            <Input
                                value={formData.discount_label || ''}
                                onChange={(e) => setFormData({ ...formData, discount_label: e.target.value })}
                                placeholder="مثال: خصم على"
                                className="mt-1"
                            />
                        </div>

                        {/* Icon Type */}
                        <div>
                            <Label>نوع الأيقونة</Label>
                            <Select
                                value={formData.icon_type}
                                onValueChange={(value) => setFormData({ ...formData, icon_type: value })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="اختر أيقونة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {iconTypes.map((icon) => (
                                        <SelectItem key={icon.value} value={icon.value}>
                                            <div className="flex items-center gap-2">
                                                <icon.icon className="w-4 h-4" />
                                                {icon.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                            />
                            <Label>نشط</Label>
                        </div>

                        {/* Gradient Colors */}
                        <div className="col-span-2">
                            <Label className="flex items-center gap-2 mb-3">
                                <Palette className="w-4 h-4" />
                                ألوان التدرج
                            </Label>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-xs text-muted-foreground">اللون الأول</Label>
                                    <Select
                                        value={formData.gradient_from}
                                        onValueChange={(value) => setFormData({ ...formData, gradient_from: value })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gradientColors.map((color) => (
                                                <SelectItem key={color.value} value={color.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded ${color.preview}`} />
                                                        {color.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">اللون الوسط</Label>
                                    <Select
                                        value={formData.gradient_via}
                                        onValueChange={(value) => setFormData({ ...formData, gradient_via: value })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gradientColors.map((color) => (
                                                <SelectItem key={color.value} value={color.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded ${color.preview}`} />
                                                        {color.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">اللون الأخير</Label>
                                    <Select
                                        value={formData.gradient_to}
                                        onValueChange={(value) => setFormData({ ...formData, gradient_to: value })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gradientColors.map((color) => (
                                                <SelectItem key={color.value} value={color.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded ${color.preview}`} />
                                                        {color.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="col-span-2">
                            <Label className="mb-3 block">معاينة</Label>
                            <div className="relative overflow-hidden rounded-2xl">
                                <div className={`absolute inset-0 bg-gradient-to-br from-${formData.gradient_from} via-${formData.gradient_via} to-${formData.gradient_to}`} />
                                <div className="absolute inset-0 opacity-20">
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
                                </div>
                                <div className="relative p-5 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            {(() => {
                                                const IconComp = getIconComponent(formData.icon_type || 'sparkles');
                                                return <IconComp className="w-5 h-5 text-yellow-300" />;
                                            })()}
                                            <span className="text-yellow-300 font-bold text-lg">{formData.title || 'العنوان'}</span>
                                        </div>
                                        <p className="text-white/90 text-sm mb-3">{formData.subtitle || 'النص الفرعي'}</p>
                                        <button className="px-4 py-2 bg-white/20 rounded-xl text-white text-sm font-medium">
                                            {formData.button_text || 'نص الزر'}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center shadow-xl">
                                            <span className="text-green-800 font-black text-xl">{formData.discount_value || '0%'}</span>
                                        </div>
                                        <span className="absolute -bottom-1 text-white/80 text-xs">{formData.discount_label || 'خصم'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'جاري الحفظ...' : (editingBanner ? 'تحديث' : 'إنشاء')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </AdminLayout>
    );
};

export default AdminPromoBanners;
