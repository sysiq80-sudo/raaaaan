import React from "react";
import { ChevronLeft, Wallet, Banknote, CreditCard } from "lucide-react";
import type { PaymentMethod as PaymentMethodType } from "@/types/savedCards";

interface PaymentMethodRowProps {
  method: PaymentMethodType;
  onPress: () => void;
}

const PAYMENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  cash:       { label: "نقداً",     icon: <Banknote className="w-4.5 h-4.5" />,    color: "text-[#12B76A]" },
  wallet:     { label: "المحفظة",   icon: <Wallet className="w-4.5 h-4.5" />,      color: "text-[#0A2F6E]" },
  card:       { label: "البطاقة",   icon: <CreditCard className="w-4.5 h-4.5" />,  color: "text-[#6941C6]" },
  zain_cash:  { label: "زين كاش",   icon: <Wallet className="w-4.5 h-4.5" />,      color: "text-[#00B3B0]" },
  super_key:  { label: "سوبر كي",   icon: <CreditCard className="w-4.5 h-4.5" />,  color: "text-[#F79009]" },
  nas_wallet: { label: "ناس ولت",   icon: <Wallet className="w-4.5 h-4.5" />,      color: "text-[#0A2F6E]" },
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
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors active:scale-[0.98] min-h-[48px]"
    >
      <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ${config.color}`}>
        {config.icon}
      </div>
      <div className="flex-1 text-right">
        <p className="text-[10px] font-semibold text-[#667085] uppercase tracking-wider">طريقة الدفع</p>
        <p className="text-sm font-bold text-[#101828]">{config.label}</p>
      </div>
      <ChevronLeft className="w-4 h-4 text-[#667085]" />
    </button>
  );
};

export default PaymentMethodRow;
