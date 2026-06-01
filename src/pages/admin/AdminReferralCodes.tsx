/**
 * صفحة إدارة الإحالات - Admin Referral Codes
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Gift,
  Wallet,
  Search,
  Loader2,
  CheckCircle,
  Clock,
  Ban,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  total_referrals: number;
  total_earned: number;
  is_active: boolean;
  created_at: string;
  profile?: { full_name: string; phone: string };
}

interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  referrer_reward: number;
  referred_reward: number;
  status: string;
  completed_at: string | null;
  created_at: string;
  referrer_profile?: { full_name: string };
  referred_profile?: { full_name: string };
}

const AdminReferralCodes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  useAdminAuth();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["referral-data"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const codesTable = supabase.from("referral_codes") as any;
      const { data: codesData, error: codesError } = await codesTable
        .select("*")
        .order("created_at", { ascending: false });

      if (codesError) throw codesError;

      // جلب الأسماء
      const userIds = (codesData || []).map((c: ReferralCode) => c.user_id);
      let profileMap: Record<string, { full_name: string; phone: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", userIds);
        (profiles || []).forEach((p: { user_id: string; full_name: string; phone: string }) => {
          profileMap[p.user_id] = { full_name: p.full_name, phone: p.phone };
        });
      }

      const enrichedCodes = (codesData || []).map((c: ReferralCode) => ({
        ...c,
        profile: profileMap[c.user_id],
      }));

      // جلب الإحالات
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const referralsTable = supabase.from("referrals") as any;
      const { data: referralsData } = await referralsTable
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // جلب أسماء المُحيلين والمُحالين
      const allUserIds = new Set<string>();
      (referralsData || []).forEach((r: Referral) => {
        allUserIds.add(r.referrer_id);
        allUserIds.add(r.referred_id);
      });
      const refProfileMap: Record<string, { full_name: string }> = {};
      if (allUserIds.size > 0) {
        const { data: refProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", Array.from(allUserIds));
        (refProfiles || []).forEach((p: { user_id: string; full_name: string }) => {
          refProfileMap[p.user_id] = { full_name: p.full_name };
        });
      }

      const enrichedReferrals = (referralsData || []).map((r: Referral) => ({
        ...r,
        referrer_profile: refProfileMap[r.referrer_id],
        referred_profile: refProfileMap[r.referred_id],
      }));

      // حساب الإحصائيات
      const totalRewards = (referralsData || [])
        .filter((r: Referral) => r.status === "completed")
        .reduce((sum: number, r: Referral) => sum + (r.referrer_reward || 0) + (r.referred_reward || 0), 0);
      const pendingCount = (referralsData || []).filter((r: Referral) => r.status === "pending").length;

      return {
        codes: enrichedCodes as ReferralCode[],
        referrals: enrichedReferrals as Referral[],
        stats: {
          totalCodes: (codesData || []).length,
          totalReferrals: (referralsData || []).length,
          totalRewards,
          pendingReferrals: pendingCount,
        },
      };
    },
  });

  const codes = data?.codes || [];
  const referrals = data?.referrals || [];
  const stats = data?.stats || { totalCodes: 0, totalReferrals: 0, totalRewards: 0, pendingReferrals: 0 };

  const toggleMutation = useMutation({
    mutationFn: async ({ codeId, currentStatus }: { codeId: string; currentStatus: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const codesTable = supabase.from("referral_codes") as any;
      const { error } = await codesTable
        .update({ is_active: !currentStatus })
        .eq("id", codeId);
      if (error) throw error;
      return currentStatus;
    },
    onSuccess: (_data, variables) => {
      toast({ title: variables.currentStatus ? "تم تعطيل الكود" : "تم تفعيل الكود" });
      queryClient.invalidateQueries({ queryKey: ["referral-data"] });
    },
    onError: (err) => {
      toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
    },
  });

  const toggleCodeStatus = (codeId: string, currentStatus: boolean) => {
    toggleMutation.mutate({ codeId, currentStatus });
  };

  const filteredCodes = codes.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.profile?.phone?.includes(search)
  );

  return (
    <AdminLayout title="نظام الإحالات" subtitle="إدارة أكواد الإحالات والمكافآت">
      <div className="space-y-6">
        {/* الإحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCodes}</p>
                <p className="text-xs text-muted-foreground">كود إحالة</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                <p className="text-xs text-muted-foreground">إحالة</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalRewards.toLocaleString('en-US')}</p>
                <p className="text-xs text-muted-foreground">د.ع مكافآت</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingReferrals}</p>
                <p className="text-xs text-muted-foreground">قيد الانتظار</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* البحث */}
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالكود أو الاسم أو الرقم..."
            className="pr-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <>
            {/* جدول الأكواد */}
            <Card>
              <CardHeader>
                <CardTitle>أكواد الإحالة ({filteredCodes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المستخدم</TableHead>
                      <TableHead>الكود</TableHead>
                      <TableHead>الإحالات</TableHead>
                      <TableHead>المكتسب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{code.profile?.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {code.profile?.phone || "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm font-bold">
                            {code.code}
                          </code>
                        </TableCell>
                        <TableCell>{code.total_referrals}</TableCell>
                        <TableCell>{code.total_earned.toLocaleString('en-US')} د.ع</TableCell>
                        <TableCell>
                          <Badge variant={code.is_active ? "default" : "destructive"}>
                            {code.is_active ? "فعّال" : "معطّل"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCodeStatus(code.id, code.is_active)}
                          >
                            {code.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* جدول الإحالات */}
            <Card>
              <CardHeader>
                <CardTitle>سجل الإحالات (آخر 100)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المُحيل</TableHead>
                      <TableHead>المُحال</TableHead>
                      <TableHead>الكود</TableHead>
                      <TableHead>المكافأة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((ref) => (
                      <TableRow key={ref.id}>
                        <TableCell>{ref.referrer_profile?.full_name || "—"}</TableCell>
                        <TableCell>{ref.referred_profile?.full_name || "—"}</TableCell>
                        <TableCell>
                          <code className="text-xs">{ref.referral_code}</code>
                        </TableCell>
                        <TableCell>{((ref.referrer_reward || 0) + (ref.referred_reward || 0)).toLocaleString('en-US')} د.ع</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ref.status === "completed"
                                ? "default"
                                : ref.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {ref.status === "completed" ? "مكتمل" : ref.status === "cancelled" ? "ملغي" : "معلّق"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(ref.created_at), { addSuffix: true, locale: ar })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReferralCodes;
