import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Loader2,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  status: string;
  created_at: string;
  payment_method: string | null;
}

const RiderPaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth?redirect=/rider/payments");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchWalletData();
    }
  }, [userId]);

  const fetchWalletData = async () => {
    if (!userId) return;
    setLoading(true);

    // Fetch profile for balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance, wallet_enabled")
      .eq("user_id", userId)
      .single();

    if (profile) {
      setBalance(profile.wallet_balance || 0);
    }

    // Fetch transactions
    const { data: txns } = await supabase
      .from("rider_wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (txns) {
      setTransactions(txns);
    }

    setLoading(false);
  };

  const getTransactionIcon = (type: string) => {
    if (type === "topup") return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
    if (type === "ride_payment") return <ArrowUpRight className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-muted-foreground" />;
  };

  const getTransactionColor = (type: string) => {
    if (type === "topup") return "text-green-600";
    if (type === "ride_payment") return "text-red-600";
    return "text-muted-foreground";
  };

  const handleTopUp = () => {
    navigate("/rider/wallet-topup");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/rider")}
            className="shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">المحفظة والمدفوعات</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-28 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm opacity-80">رصيد المحفظة</p>
                    <p className="text-3xl font-bold">{balance.toLocaleString()} د.ع</p>
                  </div>
                </div>
                <Button
                  onClick={handleTopUp}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" />
                  شحن المحفظة
                </Button>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  طرق الدفع
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">الدفع نقداً</p>
                      <p className="text-xs text-muted-foreground">الدفع للسائق مباشرة</p>
                    </div>
                  </div>
                  <Badge variant="outline">الافتراضي</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">المحفظة الإلكترونية</p>
                      <p className="text-xs text-muted-foreground">رصيد: {balance.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                  <Badge variant="secondary">متاح</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Transactions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">سجل المعاملات</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد معاملات سابقة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(txn.type)}
                          <div>
                            <p className="font-medium text-sm">
                              {txn.type === "topup" ? "شحن رصيد" : 
                               txn.type === "ride_payment" ? "دفع رحلة" : 
                               txn.description || "معاملة"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(txn.created_at), "d MMM yyyy - h:mm a", { locale: ar })}
                            </p>
                          </div>
                        </div>
                        <p className={`font-bold ${getTransactionColor(txn.type)}`}>
                          {txn.type === "topup" ? "+" : "-"}
                          {Math.abs(txn.amount).toLocaleString()} د.ع
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default RiderPaymentsPage;
