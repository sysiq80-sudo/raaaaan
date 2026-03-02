/**
 * ران - لوحة إدارة طلبات السحب
 * عرض ومراجعة وموافقة/رفض طلبات سحب أرباح السائقين
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown, CheckCircle, XCircle, Clock, RefreshCw, Loader2,
  Search, DollarSign, User, Phone, AlertTriangle, FileText,
  ChevronLeft, Ban
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";

interface WithdrawalRequest {
  id: string;
  driver_id: string;
  wallet_id: string;
  amount: number;
  withdrawal_method: string;
  account_holder_name: string;
  account_details: Record<string, string>;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  transaction_reference: string | null;
  created_at: string;
  driver?: {
    full_name: string | null;
    phone: string | null;
    total_rides: number;
    rating: number;
  };
}

interface Stats {
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
  totalPending: number;
}

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, completed: 0, rejected: 0, totalPending: 0 });
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "complete" | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [txRef, setTxRef] = useState("");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("withdrawal_requests" as any) as any)
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const all = (data || []) as WithdrawalRequest[];

      // Fetch driver details for each request
      const driverIds = [...new Set(all.map(r => r.driver_id))];
      if (driverIds.length > 0) {
        const { data: drivers } = await supabase
          .from("drivers")
          .select("id, full_name, phone, total_rides, rating")
          .in("id", driverIds);

        if (drivers) {
          const driverMap = new Map(drivers.map(d => [d.id, d]));
          all.forEach(r => {
            r.driver = driverMap.get(r.driver_id) as any;
          });
        }
      }

      setRequests(all);

      // Calculate stats
      const pending = all.filter(r => r.status === "pending");
      setStats({
        pending: pending.length,
        approved: all.filter(r => r.status === "approved" || r.status === "processing").length,
        completed: all.filter(r => r.status === "completed").length,
        rejected: all.filter(r => r.status === "rejected").length,
        totalPending: pending.reduce((sum, r) => sum + Number(r.amount), 0),
      });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    setProcessing(true);
    try {
      const updates: Record<string, any> = {};

      if (actionType === "approve") {
        updates.status = "approved";
        updates.reviewed_at = new Date().toISOString();
        updates.review_notes = reviewNotes || null;
      } else if (actionType === "reject") {
        if (!reviewNotes.trim()) {
          toast({ title: "خطأ", description: "يجب كتابة سبب الرفض", variant: "destructive" });
          setProcessing(false);
          return;
        }
        updates.status = "rejected";
        updates.reviewed_at = new Date().toISOString();
        updates.review_notes = reviewNotes;
      } else if (actionType === "complete") {
        updates.status = "completed";
        updates.processed_at = new Date().toISOString();
        updates.transaction_reference = txRef || null;
        updates.review_notes = reviewNotes || selectedRequest.review_notes;

        // Deduct from wallet
        const { data: wallet } = await supabase
          .from("driver_wallets")
          .select("id, balance, total_withdrawn")
          .eq("id", selectedRequest.wallet_id)
          .maybeSingle();

        if (wallet) {
          const newBalance = Number(wallet.balance) - Number(selectedRequest.amount);
          const newWithdrawn = Number(wallet.total_withdrawn) + Number(selectedRequest.amount);

          await supabase
            .from("driver_wallets")
            .update({
              balance: Math.max(0, newBalance),
              total_withdrawn: newWithdrawn,
            })
            .eq("id", wallet.id);

          // Record transaction
          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            driver_id: selectedRequest.driver_id,
            transaction_type: "withdrawal",
            amount: -Number(selectedRequest.amount),
            balance_before: Number(wallet.balance),
            balance_after: Math.max(0, newBalance),
            description: `سحب أرباح — ${getMethodName(selectedRequest.withdrawal_method)}`,
            metadata: { withdrawal_request_id: selectedRequest.id, transaction_reference: txRef },
            status: "completed",
          });
        }
      }

      const { error } = await (supabase
        .from("withdrawal_requests" as any) as any)
        .from("withdrawal_requests")
        .update(updates)
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: actionType === "approve" ? "✅ تمت الموافقة" :
               actionType === "reject" ? "❌ تم الرفض" : "✅ تم التحويل",
        description: `طلب ${selectedRequest.account_holder_name} — ${Number(selectedRequest.amount).toLocaleString()} د.ع`,
      });

      setSelectedRequest(null);
      setActionType(null);
      setReviewNotes("");
      setTxRef("");
      await fetchData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const getMethodName = (method: string) => {
    switch (method) {
      case "zain_cash": return "زين كاش";
      case "nas_wallet": return "ناس واليت";
      case "bank_transfer": return "تحويل بنكي";
      case "super_key": return "سوبر كي";
      case "manual": return "صرف يدوي";
      default: return method;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-yellow-100 text-yellow-800">قيد المراجعة</Badge>;
      case "approved": return <Badge className="bg-blue-100 text-blue-800">موافق عليه</Badge>;
      case "processing": return <Badge className="bg-purple-100 text-purple-800">قيد التنفيذ</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-800">تم التحويل</Badge>;
      case "rejected": return <Badge variant="destructive">مرفوض</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesTab = tab === "all" || r.status === tab ||
      (tab === "active" && ["approved", "processing"].includes(r.status));
    const matchesSearch = !search ||
      r.account_holder_name.toLowerCase().includes(search.toLowerCase()) ||
      r.driver?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.driver?.phone?.includes(search);
    return matchesTab && matchesSearch;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/admin")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <ArrowDown className="w-6 h-6" />
                طلبات سحب الأرباح
              </h1>
              <p className="text-sm opacity-80">{stats.pending} طلب قيد المراجعة</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={fetchData}>
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-1 text-yellow-600" />
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">قيد المراجعة</p>
              <p className="text-sm font-medium text-yellow-700">{stats.totalPending.toLocaleString()} د.ع</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-1 text-blue-600" />
              <p className="text-2xl font-bold">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">موافق عليها</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-6 h-6 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">مكتملة</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4 text-center">
              <XCircle className="w-6 h-6 mx-auto mb-1 text-red-600" />
              <p className="text-2xl font-bold">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">مرفوضة</p>
            </CardContent>
          </Card>
        </div>

        {/* Search + Tabs */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم السائق أو رقم الهاتف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="pending" className="text-xs">قيد المراجعة ({stats.pending})</TabsTrigger>
            <TabsTrigger value="active" className="text-xs">موافق عليها ({stats.approved})</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">مكتملة ({stats.completed})</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">مرفوضة ({stats.rejected})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">الكل ({requests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">لا توجد طلبات</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map(req => (
                  <Card key={req.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{req.driver?.full_name || req.account_holder_name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {req.driver?.phone || "—"}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">المبلغ:</span>
                          <p className="font-bold text-lg">{Number(req.amount).toLocaleString()} د.ع</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">الطريقة:</span>
                          <p className="font-medium">{getMethodName(req.withdrawal_method)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">صاحب الحساب:</span>
                          <p className="font-medium">{req.account_holder_name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">رقم الحساب:</span>
                          <p className="font-medium">{req.account_details?.account_number || "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(req.created_at), "d MMM yyyy — HH:mm", { locale: ar })}
                        </p>
                        <div className="flex gap-2">
                          {req.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => { setSelectedRequest(req); setActionType("approve"); }}>
                                <CheckCircle className="w-4 h-4 ml-1" />
                                موافقة
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setSelectedRequest(req); setActionType("reject"); }}>
                                <Ban className="w-4 h-4 ml-1" />
                                رفض
                              </Button>
                            </>
                          )}
                          {(req.status === "approved" || req.status === "processing") && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setSelectedRequest(req); setActionType("complete"); }}>
                              <DollarSign className="w-4 h-4 ml-1" />
                              تأكيد التحويل
                            </Button>
                          )}
                        </div>
                      </div>

                      {req.review_notes && (
                        <div className="mt-2 p-2 bg-secondary/50 rounded text-xs text-muted-foreground">
                          <strong>ملاحظات:</strong> {req.review_notes}
                        </div>
                      )}
                      {req.transaction_reference && (
                        <div className="mt-1 text-xs text-green-600">
                          رقم العملية: {req.transaction_reference}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => { setActionType(null); setSelectedRequest(null); setReviewNotes(""); setTxRef(""); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "✅ موافقة على طلب السحب"}
              {actionType === "reject" && "❌ رفض طلب السحب"}
              {actionType === "complete" && "💰 تأكيد التحويل"}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>السائق:</span>
                  <span className="font-medium">{selectedRequest.driver?.full_name || selectedRequest.account_holder_name}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span>المبلغ:</span>
                  <span className="font-bold text-lg">{Number(selectedRequest.amount).toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>الطريقة:</span>
                  <span>{getMethodName(selectedRequest.withdrawal_method)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>الحساب:</span>
                  <span>{selectedRequest.account_details?.account_number || "—"}</span>
                </div>
              </div>

              {actionType === "complete" && (
                <div>
                  <Label>رقم العملية / المرجع</Label>
                  <Input placeholder="رقم التحويل البنكي أو المرجع" value={txRef} onChange={e => setTxRef(e.target.value)} />
                </div>
              )}

              <div>
                <Label>{actionType === "reject" ? "سبب الرفض (مطلوب)" : "ملاحظات (اختياري)"}</Label>
                <Textarea placeholder="أدخل ملاحظات..." value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
              </div>

              {actionType === "complete" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    سيتم خصم {Number(selectedRequest.amount).toLocaleString()} د.ع من محفظة السائق وتسجيل عملية السحب.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionType(null); setSelectedRequest(null); }}>
              إلغاء
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={
                actionType === "reject" ? "bg-red-600 hover:bg-red-700" :
                actionType === "complete" ? "bg-green-600 hover:bg-green-700" : ""
              }
            >
              {processing && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              {actionType === "approve" && "موافقة"}
              {actionType === "reject" && "رفض"}
              {actionType === "complete" && "تأكيد التحويل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
