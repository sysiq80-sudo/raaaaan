/**
 * ران - لوحة محفظة السائق
 * عرض الرصيد، المعاملات، وطلبات السحب
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  History,
  Download,
  DollarSign,
  Gift,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface DriverWallet {
  id: string;
  balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  total_withdrawn: number;
  total_rides_completed: number;
  commission_paid: number;
  tips_received: number;
  is_suspended: boolean;
}

interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  status: string;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  withdrawal_method: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  review_notes: string | null;
}

const TRANSACTION_ICONS: Record<string, any> = {
  ride_earning: { icon: TrendingUp, color: "text-green-500" },
  commission: { icon: TrendingDown, color: "text-amber-500" },
  tip: { icon: Gift, color: "text-purple-500" },
  withdrawal: { icon: Download, color: "text-blue-500" },
  bonus: { icon: DollarSign, color: "text-emerald-500" },
  penalty: { icon: AlertCircle, color: "text-red-500" },
};

const TRANSACTION_LABELS: Record<string, string> = {
  ride_earning: "أرباح رحلة",
  commission: "عمولة",
  tip: "بقشيش",
  withdrawal: "سحب",
  refund: "استرجاع",
  bonus: "مكافأة",
  penalty: "غرامة",
  adjustment: "تعديل",
};

export const DriverWalletDashboard = () => {
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState("bank_transfer");
  const [accountDetails, setAccountDetails] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // تحميل بيانات المحفظة
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      
      // الحصول على driver_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل دخول");

      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!driverData) throw new Error("السائق غير موجود");

      // المحفظة
      const { data: walletData, error: walletError } = await supabase
        .from("driver_wallets")
        .select("*")
        .eq("driver_id", driverData.id)
        .single();

      if (walletError && walletError.code !== "PGRST116") throw walletError;
      setWallet(walletData);

      // المعاملات (آخر 50)
      const { data: txData } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("driver_id", driverData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setTransactions(txData || []);

      // طلبات السحب
      const { data: withdrawalData } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("driver_id", driverData.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setWithdrawals(withdrawalData || []);
    } catch (error: any) {
      toast({
        title: "خطأ في تحميل البيانات",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  // طلب سحب جديد
  const handleWithdrawalRequest = async () => {
    if (!wallet) return;

    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "خطأ في المبلغ",
        description: "أدخل مبلغاً صحيحاً",
        variant: "destructive",
      });
      return;
    }

    if (amount > wallet.balance) {
      toast({
        title: "رصيد غير كافٍ",
        description: `رصيدك الحالي: ${wallet.balance.toLocaleString()}د`,
        variant: "destructive",
      });
      return;
    }

    if (!accountHolderName.trim()) {
      toast({
        title: "معلومات ناقصة",
        description: "أدخل اسم صاحب الحساب",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      const { error } = await supabase.from("withdrawal_requests").insert({
        driver_id: driverData!.id,
        wallet_id: wallet.id,
        amount,
        withdrawal_method: withdrawalMethod,
        account_details: { details: accountDetails },
        account_holder_name: accountHolderName,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "✅ تم إرسال الطلب",
        description: "سيتم مراجعة طلبك خلال 3 أيام عمل",
      });

      setShowWithdrawalDialog(false);
      setWithdrawalAmount("");
      setAccountDetails("");
      setAccountHolderName("");
      fetchWalletData();
    } catch (error: any) {
      toast({
        title: "خطأ في الإرسال",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">لم يتم إنشاء محفظة بعد</p>
        </CardContent>
      </Card>
    );
  }

  if (wallet.is_suspended) {
    return (
      <Card className="border-red-500">
        <CardContent className="py-12 text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">المحفظة معلقة</h3>
          <p className="text-sm text-muted-foreground">
            يرجى التواصل مع الإدارة للمزيد من المعلومات
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* بطاقة الرصيد الرئيسية */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm opacity-90 mb-1">الرصيد المتاح</p>
              <h2 className="text-4xl font-bold">
                {wallet.balance.toLocaleString()}
                <span className="text-xl mr-2">د.ع</span>
              </h2>
            </div>
            <Wallet className="w-10 h-10 opacity-75" />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-xs opacity-75">قيد الانتظار</p>
              <p className="text-lg font-semibold">
                {wallet.pending_balance.toLocaleString()}د
              </p>
            </div>
            <div>
              <p className="text-xs opacity-75">إجمالي الأرباح</p>
              <p className="text-lg font-semibold">
                {wallet.lifetime_earnings.toLocaleString()}د
              </p>
            </div>
            <div>
              <p className="text-xs opacity-75">تم السحب</p>
              <p className="text-lg font-semibold">
                {wallet.total_withdrawn.toLocaleString()}د
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowWithdrawalDialog(true)}
            className="w-full mt-4 bg-white text-primary hover:bg-white/90"
          >
            <Send className="w-4 h-4 ml-2" />
            طلب سحب
          </Button>
        </CardContent>
      </Card>

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{wallet.total_rides_completed}</p>
            <p className="text-xs text-muted-foreground">رحلة مكتملة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingDown className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold">
              {wallet.commission_paid.toLocaleString()}د
            </p>
            <p className="text-xs text-muted-foreground">عمولة مدفوعة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold">
              {wallet.tips_received.toLocaleString()}د
            </p>
            <p className="text-xs text-muted-foreground">بقشيش</p>
          </CardContent>
        </Card>
      </div>

      {/* المعاملات الأخيرة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            المعاملات الأخيرة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد معاملات بعد
              </p>
            ) : (
              transactions.slice(0, 10).map((tx) => {
                const Icon =
                  TRANSACTION_ICONS[tx.transaction_type]?.icon || DollarSign;
                const iconColor =
                  TRANSACTION_ICONS[tx.transaction_type]?.color ||
                  "text-gray-500";

                return (
                  <div key={tx.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-muted/50 ${iconColor}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {tx.description ||
                            TRANSACTION_LABELS[tx.transaction_type] ||
                            tx.transaction_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p
                        className={`font-bold ${
                          tx.amount > 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {tx.amount > 0 && "+"}
                        {tx.amount.toLocaleString()}د
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.balance_after.toLocaleString()}د
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* طلبات السحب */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            طلبات السحب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لم تقم بأي طلب سحب بعد
              </p>
            ) : (
              withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-semibold">
                      {withdrawal.amount.toLocaleString()}د
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(withdrawal.created_at), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </p>
                  </div>
                  <Badge
                    variant={
                      withdrawal.status === "completed"
                        ? "default"
                        : withdrawal.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {withdrawal.status === "pending" && "قيد المراجعة"}
                    {withdrawal.status === "approved" && "موافق عليه"}
                    {withdrawal.status === "processing" && "قيد التنفيذ"}
                    {withdrawal.status === "completed" && "مكتمل"}
                    {withdrawal.status === "rejected" && "مرفوض"}
                    {withdrawal.status === "cancelled" && "ملغي"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog طلب السحب */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>طلب سحب أرباح</DialogTitle>
            <DialogDescription>
              الرصيد المتاح: <span className="font-bold">{wallet.balance.toLocaleString()}د</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>المبلغ (د.ع)</Label>
              <Input
                type="number"
                step="1000"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="10000"
              />
              <p className="text-xs text-muted-foreground">
                الحد الأدنى: 10,000 دينار
              </p>
            </div>

            <div className="space-y-2">
              <Label>طريقة الاستلام</Label>
              <Select value={withdrawalMethod} onValueChange={setWithdrawalMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="zain_cash">زين كاش</SelectItem>
                  <SelectItem value="super_key">سوبر كي</SelectItem>
                  <SelectItem value="nas_wallet">نس والت</SelectItem>
                  <SelectItem value="manual">صرف يدوي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>اسم صاحب الحساب</Label>
              <Input
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="أحمد محمد علي"
              />
            </div>

            <div className="space-y-2">
              <Label>تفاصيل الحساب</Label>
              <Textarea
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
                placeholder="رقم الحساب أو رقم الهاتف..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => setShowWithdrawalDialog(false)}
              variant="outline"
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button onClick={handleWithdrawalRequest} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Send className="w-4 h-4 ml-2" />
              )}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
