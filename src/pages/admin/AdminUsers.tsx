import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User,
  Phone,
  Shield,
  ShieldPlus,
  ShieldMinus,
  Eye,
  Users
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

const AdminUsers = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addingRole, setAddingRole] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات المستخدمين",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }

    // Combine profiles with their roles
    const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
      ...profile,
      roles: (roles || [])
        .filter((role) => role.user_id === profile.user_id)
        .map((role) => role.role),
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const handleAddRole = async (userId: string, role: AppRole) => {
    setAddingRole(true);
    
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "تنبيه",
          description: "المستخدم لديه هذه الصلاحية بالفعل",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "تم",
        description: "تمت إضافة الصلاحية بنجاح",
      });
      fetchUsers();
      if (selectedUser) {
        setSelectedUser({
          ...selectedUser,
          roles: [...selectedUser.roles, role],
        });
      }
    }
    setAddingRole(false);
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "تم",
        description: "تمت إزالة الصلاحية بنجاح",
      });
      fetchUsers();
      if (selectedUser) {
        setSelectedUser({
          ...selectedUser,
          roles: selectedUser.roles.filter((r) => r !== role),
        });
      }
    }
  };

  const getRoleBadge = (role: AppRole) => {
    const roleConfig: Record<AppRole, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      admin: { label: "مدير", variant: "destructive" },
      moderator: { label: "مشرف", variant: "default" },
      user: { label: "مستخدم", variant: "secondary" },
    };
    const config = roleConfig[role];
    return <Badge key={role} variant={config.variant} className="mx-0.5">{config.label}</Badge>;
  };

  const viewUserDetails = (user: UserWithRoles) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  const availableRoles: AppRole[] = ["admin", "moderator", "user"];

  const adminsCount = users.filter(u => u.roles.includes("admin")).length;
  const moderatorsCount = users.filter(u => u.roles.includes("moderator")).length;
  const usersCount = users.filter(u => u.roles.includes("user")).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <AdminLayout 
      title="إدارة المستخدمين" 
      subtitle={`${users.length} مستخدم • ${adminsCount} مدير • ${moderatorsCount} مشرف • ${usersCount} مستخدم عادي`}
    >
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : users.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">لا يوجد مستخدمين</h3>
            <p className="text-muted-foreground">لم يتم تسجيل أي مستخدم حتى الآن</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الصلاحيات</TableHead>
                <TableHead className="text-right">تاريخ التسجيل</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      {user.full_name || "بدون اسم"}
                    </div>
                  </TableCell>
                  <TableCell dir="ltr">{user.phone || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => getRoleBadge(role))
                      ) : (
                        <span className="text-muted-foreground text-sm">بدون صلاحيات</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("ar-IQ")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewUserDetails(user)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تفاصيل المستخدم</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6 mt-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.full_name || "بدون اسم"}</h3>
                  {selectedUser.phone && (
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span dir="ltr">{selectedUser.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-3">الصلاحيات الحالية</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.roles.length > 0 ? (
                    selectedUser.roles.map((role) => (
                      <div key={role} className="flex items-center gap-1 bg-background rounded-full px-3 py-1">
                        {getRoleBadge(role)}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveRole(selectedUser.user_id, role)}
                        >
                          <ShieldMinus className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground">لا توجد صلاحيات</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-3">إضافة صلاحية</p>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => handleAddRole(selectedUser.user_id, value as AppRole)}
                    disabled={addingRole}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="اختر صلاحية" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles
                        .filter((role) => !selectedUser.roles.includes(role))
                        .map((role) => (
                          <SelectItem key={role} value={role}>
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              {role === "admin" && "مدير"}
                              {role === "moderator" && "مشرف"}
                              {role === "user" && "مستخدم"}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">تاريخ التسجيل</p>
                  <p className="font-medium">
                    {new Date(selectedUser.created_at).toLocaleDateString("ar-IQ")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">آخر تحديث</p>
                  <p className="font-medium">
                    {new Date(selectedUser.updated_at).toLocaleDateString("ar-IQ")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;
