import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users,
  Eye,
  Pencil,
  Key,
  Mail,
  User,
  AlertCircle,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface ControllerAccount {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

const AdminControllerUsers = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [accounts, setAccounts] = useState<ControllerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // حوارات
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ControllerAccount | null>(null);

  // نموذج إضافة
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [adding, setAdding] = useState(false);

  // نموذج تعديل
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editing, setEditing] = useState(false);

  // نموذج كلمة المرور
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchAccounts();
      return;
    }
    if (!authLoading) {
      setLoading(false);
      return;
    }
    const fallbackTimer = setTimeout(() => fetchAccounts(), 2000);
    return () => clearTimeout(fallbackTimer);
  }, [isAdmin, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAccounts = async () => {
    setLoading(true);
    setFetchError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("list_controller_accounts");

    if (error) {
      console.error("[AdminControllerUsers] Fetch error:", error);
      setFetchError(`فشل جلب بيانات المدراء: ${error.message}`);
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات مدراء النظام",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setAccounts((data as ControllerAccount[]) || []);
    setLoading(false);
  };

  const handleAddAccount = async () => {
    if (!newEmail || !newPassword) {
      toast({ title: "خطأ", description: "البريد الإلكتروني وكلمة المرور مطلوبان", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 8 أحرف على الأقل", variant: "destructive" });
      return;
    }

    setAdding(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("create_controller_account", {
      p_email: newEmail.trim().toLowerCase(),
      p_password: newPassword,
      p_full_name: newFullName.trim() || "Admin",
      p_role: newRole,
    });

    if (error) {
      console.error("[AdminControllerUsers] Create error:", error);
      const isDuplicate = error.message?.includes("duplicate") || error.message?.includes("unique");
      toast({
        title: "خطأ",
        description: isDuplicate ? "البريد الإلكتروني مسجل مسبقاً" : `فشل إنشاء الحساب: ${error.message}`,
        variant: "destructive",
      });
      setAdding(false);
      return;
    }

    toast({ title: "تم", description: "تم إنشاء حساب المدير بنجاح" });
    setAddDialogOpen(false);
    setNewEmail("");
    setNewPassword("");
    setNewFullName("");
    setNewRole("admin");
    setAdding(false);
    fetchAccounts();
  };

  const handleEditAccount = async () => {
    if (!selectedAccount) return;
    setEditing(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("update_controller_account", {
      p_id: selectedAccount.id,
      p_full_name: editFullName.trim() || null,
      p_role: editRole || null,
      p_is_active: null,
    });

    if (error) {
      toast({ title: "خطأ", description: `فشل التحديث: ${error.message}`, variant: "destructive" });
      setEditing(false);
      return;
    }

    toast({ title: "تم", description: "تم تحديث بيانات المدير" });
    setEditDialogOpen(false);
    setEditing(false);
    fetchAccounts();
  };

  const handleResetPassword = async () => {
    if (!selectedAccount || !resetPassword) return;
    if (resetPassword.length < 8) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 8 أحرف على الأقل", variant: "destructive" });
      return;
    }

    setResettingPassword(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("reset_controller_password", {
      p_id: selectedAccount.id,
      p_new_password: resetPassword,
    });

    if (error) {
      toast({ title: "خطأ", description: `فشل تغيير كلمة المرور: ${error.message}`, variant: "destructive" });
      setResettingPassword(false);
      return;
    }

    toast({ title: "تم", description: "تم تغيير كلمة المرور بنجاح" });
    setResetPasswordDialogOpen(false);
    setResetPassword("");
    setResettingPassword(false);
  };

  const handleToggleActive = async () => {
    if (!selectedAccount) return;

    const newStatus = !selectedAccount.is_active;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("update_controller_account", {
      p_id: selectedAccount.id,
      p_full_name: null,
      p_role: null,
      p_is_active: newStatus,
    });

    if (error) {
      toast({ title: "خطأ", description: `فشل تغيير الحالة: ${error.message}`, variant: "destructive" });
      return;
    }

    toast({
      title: "تم",
      description: newStatus ? "تم تفعيل الحساب" : "تم تعطيل الحساب",
    });
    setDeactivateDialogOpen(false);
    setSelectedAccount(null);
    fetchAccounts();
  };

  const openEditDialog = (account: ControllerAccount) => {
    setSelectedAccount(account);
    setEditFullName(account.full_name || "");
    setEditRole(account.role);
    setEditDialogOpen(true);
  };

  const openResetPasswordDialog = (account: ControllerAccount) => {
    setSelectedAccount(account);
    setResetPassword("");
    setResetPasswordDialogOpen(true);
  };

  const openDeactivateDialog = (account: ControllerAccount) => {
    setSelectedAccount(account);
    setDeactivateDialogOpen(true);
  };

  // إحصائيات
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.is_active).length;
  const inactiveAccounts = accounts.filter((a) => !a.is_active).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Badge className="bg-red-100 text-red-800">مدير أعلى</Badge>;
      case "admin":
        return <Badge className="bg-blue-100 text-blue-800">مدير</Badge>;
      case "moderator":
        return <Badge className="bg-yellow-100 text-yellow-800">مشرف</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (loading || authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">جاري تحميل بيانات المدراء...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (fetchError) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">{fetchError}</p>
            <Button onClick={fetchAccounts} className="mt-4">إعادة المحاولة</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">مدراء النظام</h1>
            <p className="text-muted-foreground text-sm mt-1">
              إدارة حسابات المدراء والمشرفين في لوحة التحكم — منفصلة تماماً عن حسابات الركاب والسواق
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            إضافة مدير جديد
          </Button>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المدراء</p>
                  <p className="text-2xl font-bold">{totalAccounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">مدراء نشطون</p>
                  <p className="text-2xl font-bold text-green-600">{activeAccounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ShieldOff className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">معطّلون</p>
                  <p className="text-2xl font-bold text-red-600">{inactiveAccounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* جدول المدراء */}
        <Card>
          <CardContent className="pt-6">
            {accounts.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">لا يوجد حسابات مدراء حالياً</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">آخر دخول</TableHead>
                    <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{account.full_name || "بدون اسم"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span dir="ltr">{account.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(account.role)}</TableCell>
                      <TableCell>
                        {account.is_active ? (
                          <Badge className="bg-green-100 text-green-800">نشط</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">معطّل</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.last_login_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(account)}
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResetPasswordDialog(account)}
                            title="تغيير كلمة المرور"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeactivateDialog(account)}
                            title={account.is_active ? "تعطيل" : "تفعيل"}
                          >
                            {account.is_active ? (
                              <ShieldOff className="h-4 w-4 text-red-500" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* حوار إضافة مدير جديد */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مدير جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">البريد الإلكتروني *</Label>
              <Input
                id="new-email"
                type="email"
                dir="ltr"
                placeholder="admin@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور *</Label>
              <Input
                id="new-password"
                type="password"
                dir="ltr"
                placeholder="8 أحرف على الأقل"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">الاسم الكامل</Label>
              <Input
                id="new-name"
                placeholder="اسم المدير"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">الدور</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="super_admin">مدير أعلى</SelectItem>
                  <SelectItem value="moderator">مشرف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddAccount} disabled={adding}>
              {adding ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تعديل المدير */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المدير</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={selectedAccount?.email || ""} disabled dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">الاسم الكامل</Label>
              <Input
                id="edit-name"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">الدور</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="super_admin">مدير أعلى</SelectItem>
                  <SelectItem value="moderator">مشرف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleEditAccount} disabled={editing}>
              {editing ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تغيير كلمة المرور */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              تغيير كلمة المرور للمدير: <strong>{selectedAccount?.email}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-password">كلمة المرور الجديدة</Label>
              <Input
                id="reset-password"
                type="password"
                dir="ltr"
                placeholder="8 أحرف على الأقل"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد التفعيل/التعطيل */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAccount?.is_active ? "تعطيل حساب المدير" : "تفعيل حساب المدير"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAccount?.is_active
                ? `هل أنت متأكد من تعطيل حساب "${selectedAccount?.full_name || selectedAccount?.email}"؟ لن يتمكن من الدخول بعد ذلك.`
                : `هل أنت متأكد من إعادة تفعيل حساب "${selectedAccount?.full_name || selectedAccount?.email}"؟`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>
              {selectedAccount?.is_active ? "تعطيل" : "تفعيل"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminControllerUsers;
