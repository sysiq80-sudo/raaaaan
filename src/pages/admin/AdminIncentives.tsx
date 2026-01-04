import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Plus, Edit2, Trash2, Trophy, Target, TrendingUp, Users } from "lucide-react";

interface Incentive {
  id: string;
  name: string;
  description: string | null;
  rides_required: number;
  bonus_amount: number;
  period: string;
  is_active: boolean;
}

interface IncentiveClaim {
  id: string;
  driver_id: string;
  incentive_id: string;
  period_start: string;
  period_end: string;
  rides_completed: number;
  bonus_earned: number;
  claimed_at: string;
  drivers?: { full_name: string; phone: string };
  driver_incentives?: { name: string };
}

const AdminIncentives = () => {
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [claims, setClaims] = useState<IncentiveClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncentive, setEditingIncentive] = useState<Incentive | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rides_required: 5,
    bonus_amount: 2000,
    period: "daily",
  });

  const [stats, setStats] = useState({
    totalBonusesPaid: 0,
    totalClaims: 0,
    activeIncentives: 0,
    driversRewarded: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: incentivesData, error: incentivesError } = await supabase
        .from("driver_incentives")
        .select("*")
        .order("period", { ascending: true })
        .order("rides_required", { ascending: true });

      if (incentivesError) throw incentivesError;
      setIncentives(incentivesData || []);

      const { data: claimsData, error: claimsError } = await supabase
        .from("driver_incentive_claims")
        .select(`
          *,
          drivers:driver_id (full_name, phone),
          driver_incentives:incentive_id (name)
        `)
        .order("claimed_at", { ascending: false })
        .limit(50);

      if (claimsError) throw claimsError;
      setClaims(claimsData || []);

      const totalBonuses = (claimsData || []).reduce((sum, c) => sum + c.bonus_earned, 0);
      const uniqueDrivers = new Set((claimsData || []).map(c => c.driver_id)).size;
      const activeCount = (incentivesData || []).filter(i => i.is_active).length;

      setStats({
        totalBonusesPaid: totalBonuses,
        totalClaims: claimsData?.length || 0,
        activeIncentives: activeCount,
        driversRewarded: uniqueDrivers,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("حدث خطأ في جلب البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingIncentive) {
        const { error } = await supabase
          .from("driver_incentives")
          .update({
            name: formData.name,
            description: formData.description,
            rides_required: formData.rides_required,
            bonus_amount: formData.bonus_amount,
            period: formData.period,
          })
          .eq("id", editingIncentive.id);

        if (error) throw error;
        toast.success("تم تحديث الحافز بنجاح");
      } else {
        const { error } = await supabase
          .from("driver_incentives")
          .insert({
            name: formData.name,
            description: formData.description,
            rides_required: formData.rides_required,
            bonus_amount: formData.bonus_amount,
            period: formData.period,
          });

        if (error) throw error;
        toast.success("تم إضافة الحافز بنجاح");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving incentive:", error);
      toast.error("حدث خطأ في حفظ الحافز");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("driver_incentives")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "تم تعطيل الحافز" : "تم تفعيل الحافز");
      fetchData();
    } catch (error) {
      console.error("Error toggling incentive:", error);
      toast.error("حدث خطأ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الحافز؟")) return;

    try {
      const { error } = await supabase
        .from("driver_incentives")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("تم حذف الحافز");
      fetchData();
    } catch (error) {
      console.error("Error deleting incentive:", error);
      toast.error("حدث خطأ في الحذف");
    }
  };

  const handleEdit = (incentive: Incentive) => {
    setEditingIncentive(incentive);
    setFormData({
      name: incentive.name,
      description: incentive.description || "",
      rides_required: incentive.rides_required,
      bonus_amount: incentive.bonus_amount,
      period: incentive.period,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingIncentive(null);
    setFormData({
      name: "",
      description: "",
      rides_required: 5,
      bonus_amount: 2000,
      period: "daily",
    });
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "daily": return "يومي";
      case "weekly": return "أسبوعي";
      case "monthly": return "شهري";
      default: return period;
    }
  };

  const getPeriodColor = (period: string) => {
    switch (period) {
      case "daily": return "bg-blue-500/10 text-blue-500";
      case "weekly": return "bg-purple-500/10 text-purple-500";
      case "monthly": return "bg-amber-500/10 text-amber-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const dialogContent = (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 ml-2" />
          إضافة حافز جديد
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingIncentive ? "تعديل الحافز" : "إضافة حافز جديد"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>اسم الحافز</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثال: مكافأة يومية ذهبية"
            />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="مثال: أكمل 15 رحلة يومياً"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>عدد الرحلات المطلوبة</Label>
              <Input
                type="number"
                value={formData.rides_required}
                onChange={(e) => setFormData({ ...formData, rides_required: parseInt(e.target.value) || 0 })}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>مبلغ المكافأة (د.ع)</Label>
              <Input
                type="number"
                value={formData.bonus_amount}
                onChange={(e) => setFormData({ ...formData, bonus_amount: parseInt(e.target.value) || 0 })}
                min={0}
                step={500}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>الفترة الزمنية</Label>
            <Select
              value={formData.period}
              onValueChange={(value) => setFormData({ ...formData, period: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">يومي</SelectItem>
                <SelectItem value="weekly">أسبوعي</SelectItem>
                <SelectItem value="monthly">شهري</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full">
            {editingIncentive ? "حفظ التغييرات" : "إضافة الحافز"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (loading) {
    return (
      <AdminLayout title="المكافآت والحوافز">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="نظام المكافآت والحوافز" 
      subtitle="إدارة مكافآت السائقين بناءً على عدد الرحلات"
      actions={dialogContent}
    >
      <div className="space-y-6">
        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Trophy className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المكافآت</p>
                  <p className="text-xl font-bold">{stats.totalBonusesPaid.toLocaleString()} د.ع</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">عدد المطالبات</p>
                  <p className="text-xl font-bold">{stats.totalClaims}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الحوافز النشطة</p>
                  <p className="text-xl font-bold">{stats.activeIncentives}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Users className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">سائقين مكافأين</p>
                  <p className="text-xl font-bold">{stats.driversRewarded}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="incentives">
          <TabsList>
            <TabsTrigger value="incentives">الحوافز</TabsTrigger>
            <TabsTrigger value="claims">سجل المكافآت</TabsTrigger>
          </TabsList>

          <TabsContent value="incentives" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>قائمة الحوافز</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الفترة</TableHead>
                      <TableHead>الرحلات المطلوبة</TableHead>
                      <TableHead>المكافأة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incentives.map((incentive) => (
                      <TableRow key={incentive.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{incentive.name}</p>
                            {incentive.description && (
                              <p className="text-sm text-muted-foreground">{incentive.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPeriodColor(incentive.period)}>
                            {getPeriodLabel(incentive.period)}
                          </Badge>
                        </TableCell>
                        <TableCell>{incentive.rides_required} رحلة</TableCell>
                        <TableCell className="font-medium text-green-600">
                          {incentive.bonus_amount.toLocaleString()} د.ع
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={incentive.is_active}
                            onCheckedChange={() => handleToggleActive(incentive.id, incentive.is_active)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(incentive)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(incentive.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claims" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>سجل المكافآت الممنوحة</CardTitle>
              </CardHeader>
              <CardContent>
                {claims.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد مكافآت ممنوحة بعد</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>السائق</TableHead>
                        <TableHead>الحافز</TableHead>
                        <TableHead>الفترة</TableHead>
                        <TableHead>الرحلات المكتملة</TableHead>
                        <TableHead>المكافأة</TableHead>
                        <TableHead>تاريخ المنح</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claims.map((claim) => (
                        <TableRow key={claim.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{claim.drivers?.full_name || "غير معروف"}</p>
                              <p className="text-sm text-muted-foreground">{claim.drivers?.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>{claim.driver_incentives?.name}</TableCell>
                          <TableCell>
                            {new Date(claim.period_start).toLocaleDateString("ar-IQ")} - {new Date(claim.period_end).toLocaleDateString("ar-IQ")}
                          </TableCell>
                          <TableCell>{claim.rides_completed} رحلة</TableCell>
                          <TableCell className="font-medium text-green-600">
                            {claim.bonus_earned.toLocaleString()} د.ع
                          </TableCell>
                          <TableCell>
                            {new Date(claim.claimed_at).toLocaleDateString("ar-IQ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminIncentives;
