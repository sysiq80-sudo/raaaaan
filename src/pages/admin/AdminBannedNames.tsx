/**
 * ران - صفحة إدارة الأسماء المحظورة
 * للمشرفين فقط
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
    Plus,
    Trash2,
    Search,
    Ban,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import AdminLayout from "@/components/admin/AdminLayout";

interface BannedName {
    id: string;
    name: string;
    reason: string | null;
    is_active: boolean;
    created_at: string;
}

const AdminBannedNames = () => {
    const { isAdmin, loading: authLoading } = useAdminAuth();
    const { toast } = useToast();
    const [bannedNames, setBannedNames] = useState<BannedName[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Add new name state
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [newReason, setNewReason] = useState("");
    const [addLoading, setAddLoading] = useState(false);

    // Delete confirmation
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        fetchBannedNames();
    }, []);

    const fetchBannedNames = async () => {
        try {
            const { data, error } = await supabase
                .from('banned_names')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBannedNames(data || []);
        } catch (error: any) {
            console.error('Error fetching banned names:', error);
            toast({
                title: "خطأ",
                description: "فشل في تحميل الأسماء المحظورة",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddName = async () => {
        if (!newName.trim()) {
            toast({
                title: "خطأ",
                description: "الرجاء إدخال الاسم",
                variant: "destructive",
            });
            return;
        }

        setAddLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('banned_names')
                .insert({
                    name: newName.trim().toLowerCase(),
                    reason: newReason.trim() || null,
                    added_by: user?.id
                });

            if (error) {
                if (error.code === '23505') {
                    toast({
                        title: "الاسم موجود",
                        description: "هذا الاسم موجود بالفعل في القائمة",
                        variant: "destructive",
                    });
                } else {
                    throw error;
                }
            } else {
                toast({
                    title: "تمت الإضافة ✅",
                    description: `تم إضافة "${newName}" إلى قائمة الأسماء المحظورة`,
                });
                setNewName("");
                setNewReason("");
                setShowAddDialog(false);
                fetchBannedNames();
            }
        } catch (error: any) {
            console.error('Error adding banned name:', error);
            toast({
                title: "خطأ",
                description: "فشل في إضافة الاسم",
                variant: "destructive",
            });
        } finally {
            setAddLoading(false);
        }
    };

    const handleDeleteName = async (id: string) => {
        setDeleteLoading(true);
        try {
            const { error } = await supabase
                .from('banned_names')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({
                title: "تم الحذف ✅",
                description: "تم حذف الاسم من القائمة",
            });
            setDeleteId(null);
            fetchBannedNames();
        } catch (error: any) {
            console.error('Error deleting banned name:', error);
            toast({
                title: "خطأ",
                description: "فشل في حذف الاسم",
                variant: "destructive",
            });
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('banned_names')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            toast({
                title: currentStatus ? "تم التعطيل" : "تم التفعيل ✅",
                description: currentStatus ? "تم تعطيل الحظر مؤقتاً" : "تم تفعيل الحظر",
            });
            fetchBannedNames();
        } catch (error: any) {
            console.error('Error toggling status:', error);
            toast({
                title: "خطأ",
                description: "فشل في تغيير الحالة",
                variant: "destructive",
            });
        }
    };

    // Filter names based on search
    const filteredNames = bannedNames.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.reason && item.reason.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Stats
    const activeCount = bannedNames.filter(n => n.is_active).length;
    const inactiveCount = bannedNames.filter(n => !n.is_active).length;

    if (authLoading) return <AdminLayout title="إدارة الأسماء المحظورة"><div className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div></AdminLayout>;
    if (!isAdmin) return null;

    return (
        <AdminLayout title="إدارة الأسماء المحظورة">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Ban className="w-6 h-6 text-destructive" />
                            إدارة الأسماء المحظورة
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            تحكم في الأسماء الممنوعة للمستخدمين
                        </p>
                    </div>

                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                إضافة اسم محظور
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>إضافة اسم محظور جديد</DialogTitle>
                                <DialogDescription>
                                    سيتم منع المستخدمين من استخدام هذا الاسم
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">الاسم المحظور *</label>
                                    <Input
                                        placeholder="مثال: مستخدم"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">السبب (اختياري)</label>
                                    <Input
                                        placeholder="مثال: اسم افتراضي"
                                        value={newReason}
                                        onChange={(e) => setNewReason(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                                    إلغاء
                                </Button>
                                <Button onClick={handleAddName} disabled={addLoading}>
                                    {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                                <Ban className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{bannedNames.length}</p>
                                <p className="text-sm text-muted-foreground">إجمالي الأسماء</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                                <AlertCircle className="w-6 h-6 text-destructive" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-destructive">{activeCount}</p>
                                <p className="text-sm text-muted-foreground">محظور نشط</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-amber-500">{inactiveCount}</p>
                                <p className="text-sm text-muted-foreground">معطّل</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder="ابحث عن اسم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10"
                    />
                </div>

                {/* Table */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredNames.length === 0 ? (
                            <div className="text-center py-12">
                                <Ban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">
                                    {searchQuery ? "لا توجد نتائج" : "لا توجد أسماء محظورة"}
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">الاسم</TableHead>
                                        <TableHead className="text-right">السبب</TableHead>
                                        <TableHead className="text-right">الحالة</TableHead>
                                        <TableHead className="text-right">التاريخ</TableHead>
                                        <TableHead className="text-left">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredNames.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {item.reason || "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={item.is_active ? "destructive" : "secondary"}
                                                    className="cursor-pointer"
                                                    onClick={() => handleToggleActive(item.id, item.is_active)}
                                                >
                                                    {item.is_active ? "نشط" : "معطّل"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(item.created_at).toLocaleDateString('ar-IQ')}
                                            </TableCell>
                                            <TableCell>
                                                <Dialog open={deleteId === item.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            onClick={() => setDeleteId(item.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>تأكيد الحذف</DialogTitle>
                                                            <DialogDescription>
                                                                هل أنت متأكد من حذف "{item.name}" من قائمة الأسماء المحظورة؟
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <DialogFooter>
                                                            <Button variant="outline" onClick={() => setDeleteId(null)}>
                                                                إلغاء
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                onClick={() => handleDeleteName(item.id)}
                                                                disabled={deleteLoading}
                                                            >
                                                                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف"}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Info */}
                <Card className="bg-muted/50">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium mb-1">كيف يعمل نظام الأسماء المحظورة؟</p>
                                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>عند تسجيل مستخدم جديد، يتم التحقق من اسمه</li>
                                    <li>إذا كان الاسم محظوراً، يُطلب منه إدخال اسم آخر</li>
                                    <li>يمكن تعطيل الحظر مؤقتاً بدون حذفه</li>
                                    <li>البحث يشمل الأسماء والأسباب</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
};

export default AdminBannedNames;
