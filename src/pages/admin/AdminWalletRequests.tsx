import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  User,
  Car,
  Loader2,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface TopupRequest {
  id: string;
  user_id: string;
  user_type: string;
  amount: number;
  payment_method: string;
  payment_account: string | null;
  reference_number: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  // Joined data
  user_name?: string;
  user_phone?: string;
}

interface UserLookupRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
}

export default function AdminWalletRequests() {
  const { loading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Action dialog state
  const [selectedRequest, setSelectedRequest] = useState<TopupRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests = [], isLoading: loading } = useQuery({
    queryKey: ["wallet-topup-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("wallet_topup_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const reqs = data || [];
      const riderUserIds = [...new Set(reqs.filter(r => r.user_type === "rider").map(r => r.user_id))];
      const driverUserIds = [...new Set(reqs.filter(r => r.user_type !== "rider").map(r => r.user_id))];

      const [profilesResult, driversResult] = await Promise.all([
        riderUserIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name, phone").in("user_id", riderUserIds)
          : { data: [] },
        driverUserIds.length > 0
          ? supabase.from("drivers").select("user_id, full_name, phone").in("user_id", driverUserIds)
          : { data: [] },
      ]);

      const profileMap = new Map(
        ((profilesResult.data as UserLookupRow[] | null) || []).map((p) => [p.user_id, p])
      );
      const driverMap = new Map(
        ((driversResult.data as UserLookupRow[] | null) || []).map((d) => [d.user_id, d])
      );

      return reqs.map((request) => {
        const userData = request.user_type === "rider"
          ? profileMap.get(request.user_id)
          : driverMap.get(request.user_id);
        return {
          ...request,
          user_name: userData?.full_name || "غير معروف",
          user_phone: userData?.phone || "",
        };
      }) as TopupRequest[];
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["wallet-topup-requests"] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ request, type, notes }: { request: TopupRequest; type: "approve" | "reject"; notes: string }) => {
      const { data, error } = await supabase.rpc(
        type === "approve" ? "approve_topup_request" : "reject_topup_request",
        {
          p_request_id: request.id,
          p_admin_notes: notes || null
        }
      );

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "حدث خطأ");
      }
      return { type, amount: request.amount };
    },
    onSuccess: (result) => {
      toast({
        title: result.type === "approve" ? "تمت الموافقة" : "تم الرفض",
        description: result.type === "approve"
          ? `تم إضافة ${result.amount.toLocaleString()} د.ع للمستخدم`
          : "تم رفض الطلب"
      });
      setSelectedRequest(null);
      setActionType(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["wallet-topup-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const processing = actionMutation.isPending;

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    actionMutation.mutate({ request: selectedRequest, type: actionType, notes: adminNotes });
  };

  const getPaymentMethodName = (method: string) => {
    const methods: Record<string, string> = {
      nass: "بوابة ناس",
      nas_wallet: "المحفظة",
      zain_cash: "زين كاش",
      asia_hawala: "آسيا حوالة",
      fastpay: "فاست باي",
      qi_card: "كي كارد"
    };
    return methods[method] || method;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 gap-1"><Clock className="w-3 h-3" /> قيد المراجعة</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 gap-1"><CheckCircle className="w-3 h-3" /> تمت الموافقة</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> مرفوض</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredRequests = requests.filter(request => {
    if (!searchTerm) return true;
    return (
      request.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.user_phone?.includes(searchTerm) ||
      request.reference_number.includes(searchTerm)
    );
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (authLoading) {
    return (
        <AdminLayout title="إدارة طلبات الرصيد">
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="إدارة طلبات الرصيد">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-7 h-7 text-primary" />
              طلبات شحن المحفظة
            </h1>
            <p className="text-muted-foreground">
              إدارة ومراجعة طلبات إضافة الرصيد
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {pendingCount} طلب معلق
              </Badge>
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم، الهاتف، أو رقم العملية..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="pending" className="gap-1">
                <Clock className="w-3 h-3" />
                معلقة
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                موافق عليها
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-1">
                <XCircle className="w-3 h-3" />
                مرفوضة
              </TabsTrigger>
              <TabsTrigger value="all">الكل</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">لا توجد طلبات</h3>
              <p className="text-muted-foreground">
                {statusFilter === "pending" 
                  ? "لا توجد طلبات معلقة حالياً"
                  : "لا توجد طلبات مطابقة للفلتر"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className={`overflow-hidden ${
                request.status === "pending" ? "border-yellow-300 dark:border-yellow-800" : ""
              }`}>
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Amount Section */}
                    <div className={`p-4 flex flex-col items-center justify-center sm:w-32 ${
                      request.status === "pending" 
                        ? "bg-yellow-50 dark:bg-yellow-900/20"
                        : request.status === "approved"
                        ? "bg-green-50 dark:bg-green-900/20"
                        : "bg-red-50 dark:bg-red-900/20"
                    }`}>
                      <p className="text-2xl font-bold">{request.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">د.ع</p>
                    </div>

                    {/* Details Section */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {request.user_type === "rider" ? (
                              <User className="w-4 h-4 text-primary" />
                            ) : (
                              <Car className="w-4 h-4 text-primary" />
                            )}
                            <span className="font-semibold">{request.user_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {request.user_type === "rider" ? "راكب" : "سائق"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{request.user_phone}</p>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">طريقة الدفع</p>
                          <p className="font-medium">{getPaymentMethodName(request.payment_method)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">رقم العملية</p>
                          <p className="font-medium font-mono">{request.reference_number}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">تاريخ الطلب</p>
                          <p className="font-medium">
                            {format(new Date(request.created_at), "d MMM yyyy HH:mm", { locale: ar })}
                          </p>
                        </div>
                        {request.reviewed_at && (
                          <div>
                            <p className="text-muted-foreground text-xs">تاريخ المراجعة</p>
                            <p className="font-medium">
                              {format(new Date(request.reviewed_at), "d MMM yyyy HH:mm", { locale: ar })}
                            </p>
                          </div>
                        )}
                      </div>

                      {request.admin_notes && (
                        <div className="mt-3 p-2 bg-secondary/50 rounded text-sm">
                          <p className="text-muted-foreground text-xs mb-1">ملاحظات الإدارة:</p>
                          <p>{request.admin_notes}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {request.status === "pending" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            className="flex-1 gap-2"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType("approve");
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                            موافقة
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1 gap-2"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType("reject");
                            }}
                          >
                            <XCircle className="w-4 h-4" />
                            رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Dialog */}
        <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setAdminNotes("");
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve" ? "تأكيد الموافقة" : "تأكيد الرفض"}
              </DialogTitle>
              <DialogDescription>
                {actionType === "approve"
                  ? `سيتم إضافة ${selectedRequest?.amount.toLocaleString()} د.ع لحساب ${selectedRequest?.user_name}`
                  : `سيتم رفض طلب ${selectedRequest?.user_name}`
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">المبلغ:</p>
                    <p className="font-bold">{selectedRequest?.amount.toLocaleString()} د.ع</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">رقم العملية:</p>
                    <p className="font-mono">{selectedRequest?.reference_number}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  ملاحظات (اختياري)
                </label>
                <Textarea
                  placeholder="أضف ملاحظات..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setAdminNotes("");
                }}
              >
                إلغاء
              </Button>
              <Button
                variant={actionType === "approve" ? "default" : "destructive"}
                onClick={handleAction}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : actionType === "approve" ? (
                  <CheckCircle className="w-4 h-4 ml-2" />
                ) : (
                  <XCircle className="w-4 h-4 ml-2" />
                )}
                {actionType === "approve" ? "تأكيد الموافقة" : "تأكيد الرفض"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
