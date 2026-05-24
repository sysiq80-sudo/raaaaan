import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CreditCard,
  Smartphone,
  Banknote,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import RiderPageHeader from "@/components/rider/RiderPageHeader";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance, wallet_enabled")
      .eq("user_id", userId)
      .single();

    if (profile) {
      setBalance(profile.wallet_balance || 0);
    }

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
    if (type === "topup") return <ArrowDownLeft className="w-5 h-5 text-emerald-400" />;
    if (type === "ride_payment") return <ArrowUpRight className="w-5 h-5 text-red-400" />;
    return <Clock className="w-5 h-5 text-slate-400" />;
  };

  const getTransactionColor = (type: string) => {
    if (type === "topup") return "text-emerald-400";
    if (type === "ride_payment") return "text-red-400";
    return "text-slate-400";
  };

  return (
    <div className="flex flex-col min-h-full transition-colors duration-300" style={{ background: 'var(--raan-bg)' }} dir="rtl">
      <RiderPageHeader title="المحفظة والمدفوعات" />

      <div className="pt-16 p-4 pb-8 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-slate-400">جاري تحميل المحفظة...</p>
          </div>
        ) : (
          <>
            {/* ── بطاقة الرصيد ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden rounded-2xl"
              style={{
                background: "linear-gradient(145deg, #064e3b 0%, #0a3d2f 40%, #0f2922 100%)",
              }}
            >
              {/* ديكور خلفي */}
              <div className="absolute top-[-30px] left-[-30px] w-[120px] h-[120px] rounded-full bg-emerald-500/10 blur-[40px]" />
              <div className="absolute bottom-[-20px] right-[-20px] w-[80px] h-[80px] rounded-full bg-emerald-400/8 blur-[30px]" />

              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[12px] text-emerald-300/60 font-medium">رصيد المحفظة</p>
                    <p className="text-3xl font-black text-white tracking-tight">
                      {balance.toLocaleString()}
                      <span className="text-[14px] text-emerald-300/70 mr-1.5 font-semibold">د.ع</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/rider/wallet-topup")}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#5bdda6] hover:bg-[#4ecf99] text-[#0b1326] font-bold text-[15px] shadow-lg shadow-[#5bdda6]/25 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  شحن المحفظة
                </button>
              </div>
            </motion.div>

            {/* ── طرق الدفع ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="bg-[#151f30] rounded-2xl border border-slate-700/50 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-700/30">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-[15px] font-bold text-white">طرق الدفع</h3>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {/* نقداً */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1a2536] border border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                      <Banknote className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white">الدفع نقداً</p>
                      <p className="text-[11px] text-slate-400">الدفع للسائق مباشرة</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    الافتراضي
                  </span>
                </div>

                {/* المحفظة */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1a2536] border border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-white">المحفظة الإلكترونية</p>
                      <p className="text-[11px] text-slate-400">رصيد: {balance.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-600/30 border border-slate-600/30 text-slate-300">
                    متاح
                  </span>
                </div>
              </div>
            </motion.div>

            {/* ── سجل المعاملات ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="bg-[#171f33] rounded-2xl border border-slate-700/40 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-700/30">
                <h3 className="text-[15px] font-bold text-white">سجل المعاملات</h3>
              </div>
              <div className="p-4">
                {transactions.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1a2536] border border-slate-700/40 flex items-center justify-center">
                      <Clock className="w-7 h-7 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm">لا توجد معاملات سابقة</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {transactions.map((txn, idx) => (
                      <motion.div
                        key={txn.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-[#1a2536]/60 border border-slate-700/20 hover:border-slate-700/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            txn.type === "topup" ? "bg-emerald-500/15" : "bg-red-500/15"
                          }`}>
                            {getTransactionIcon(txn.type)}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-white">
                              {txn.type === "topup" ? "شحن رصيد" : 
                               txn.type === "ride_payment" ? "دفع رحلة" : 
                               txn.description || "معاملة"}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {format(new Date(txn.created_at), "d MMM yyyy - h:mm a", { locale: ar })}
                            </p>
                          </div>
                        </div>
                        <p className={`font-bold text-[14px] ${getTransactionColor(txn.type)}`}>
                          {txn.type === "topup" ? "+" : "-"}
                          {Math.abs(txn.amount).toLocaleString()} د.ع
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default RiderPaymentsPage;
