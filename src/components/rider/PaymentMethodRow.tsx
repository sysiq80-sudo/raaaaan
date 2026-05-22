import React from "react";
import { ChevronLeft, Wallet, Banknote, CreditCard } from "lucide-react";
import type { PaymentMethod as PaymentMethodType } from "@/types/savedCards";

interface PaymentMethodRowProps {
  method: PaymentMethodType;
  onPress: () => void;
}

const PAYMENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  cash:       { label: "نقداً",     icon: <Banknote className="w-4.5 h-4.5" />,    color: "text-emerald-500" },
  wallet:     { label: "المحفظة",   icon: <Wallet className="w-4.5 h-4.5" />,      color: "text-cyan-500" },
  card:       { label: "البطاقة",   icon: <CreditCard className="w-4.5 h-4.5" />,  color: "text-violet-500" },
  zain_cash:  { label: "زين كاش",   icon: <Wallet className="w-4.5 h-4.5" />,      color: "text-rose-500" },
  super_key:  { label: "سوبر كي",   icon: <CreditCard className="w-4.5 h-4.5" />,  color: "text-amber-500" },
  nas_wallet: { label: "ناس ولت",   icon: <Wallet className="w-4.5 h-4.5" />,      color: "text-sky-500" },
};

/**
 * Compact payment method selector row.
 * Tapping opens the full PaymentMethodSheet.
 */
const PaymentMethodRow: React.FC<PaymentMethodRowProps> = ({ method, onPress }) => {
  const config = PAYMENT_CONFIG[method] || PAYMENT_CONFIG.cash;

  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors active:scale-[0.98] min-h-[48px]"
    >
      <div className={`w-9 h-9 rounded-xl bg-card border border-border/30 flex items-center justify-center shadow-sm ${config.color}`}>
        {config.icon}
      </div>
      <div className="flex-1 text-right">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">طريقة الدفع</p>
        <p className="text-sm font-bold text-foreground">{config.label}</p>
      </div>
      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
    </button>
  );
};

export default PaymentMethodRow;
