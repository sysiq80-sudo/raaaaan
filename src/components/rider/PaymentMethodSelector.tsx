/**
 * ران - محدد طريقة الدفع (النسخة المبسطة)
 * 3 خيارات فقط: نقداً، المحفظة، البطاقة
 * مع دعم البطاقات المحفوظة ونافذة إضافة بطاقة جديدة
 */

import React, { useState } from "react";
import { Banknote, Wallet, CreditCard, Check, Plus } from "lucide-react";
import { useSavedCards } from "@/hooks/useSavedCards";
import AddCardModal from "./AddCardModal";
import type { PaymentMethod } from "@/types/savedCards";

interface PaymentOption {
  type: PaymentMethod;
  name: string;
  nameEn: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  className?: string;
  walletBalance?: number; // رصيد المحفظة
}

// الخيارات الثلاثة الأساسية
const paymentOptions: PaymentOption[] = [
  {
    type: "cash",
    name: "نقداً",
    nameEn: "Cash",
    icon: <Banknote className="w-5 h-5" />,
    color: "bg-green-500/20 text-green-600",
    description: "ادفع للسائق مباشرة",
  },
  {
    type: "wallet",
    name: "المحفظة",
    nameEn: "Wallet",
    icon: <Wallet className="w-5 h-5" />,
    color: "bg-primary/20 text-primary",
    description: "الاستقطاع من رصيدك",
  },
  {
    type: "card",
    name: "البطاقة",
    nameEn: "Card",
    icon: <CreditCard className="w-5 h-5" />,
    color: "bg-blue-500/20 text-blue-600",
    description: "الدفع عبر البطاقة",
  },
];

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onSelect,
  className = "",
  walletBalance,
}) => {
  const [addCardOpen, setAddCardOpen] = useState(false);
  const { data: savedCards } = useSavedCards();

  // البطاقة الافتراضية (أو أول بطاقة)
  const defaultCard = savedCards?.find((c) => c.is_default) || savedCards?.[0];
  const hasCard = !!defaultCard;

  const handleSelect = (type: PaymentMethod) => {
    // إذا اختار البطاقة ولا يوجد بطاقة محفوظة → فتح نافذة الإضافة
    if (type === "card" && !hasCard) {
      setAddCardOpen(true);
      return;
    }
    onSelect(type);
  };

  const getDescription = (option: PaymentOption): string => {
    if (option.type === "wallet" && walletBalance !== undefined) {
      return `رصيدك: ${walletBalance.toLocaleString()} د.ع`;
    }
    if (option.type === "card" && hasCard) {
      return `${defaultCard.brand} •••• ${defaultCard.last4}`;
    }
    if (option.type === "card" && !hasCard) {
      return "أضف بطاقة جديدة";
    }
    return option.description;
  };

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        {paymentOptions.map((option) => {
          const isSelected = selectedMethod === option.type;
          const isCardWithout = option.type === "card" && !hasCard;

          return (
            <button
              key={option.type}
              onClick={() => handleSelect(option.type)}
              className={`w-full flex items-center gap-4 p-4 rounded-md transition-all ${
                isSelected
                  ? "bg-primary/10 border-2 border-primary"
                  : "bg-secondary/50 border-2 border-transparent hover:bg-secondary"
              }`}
            >
              {/* أيقونة الدفع */}
              <div
                className={`w-12 h-12 rounded-md flex items-center justify-center ${option.color}`}
              >
                {isCardWithout ? <Plus className="w-5 h-5" /> : option.icon}
              </div>

              {/* معلومات الدفع */}
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold ${isSelected ? "text-primary" : "text-foreground"}`}
                  >
                    {option.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({option.nameEn})
                  </span>
                </div>
                <p className={`text-sm ${isCardWithout ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {getDescription(option)}
                </p>
              </div>

              {/* مؤشر الاختيار */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* نافذة إضافة بطاقة */}
      <AddCardModal
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onCardAdded={() => {
          // بعد إضافة البطاقة بنجاح → اختيار البطاقة تلقائياً
          onSelect("card");
        }}
      />
    </>
  );
};

/**
 * تحويل طرق الدفع القديمة (6 أنواع) إلى الأنواع الثلاثة الجديدة
 */
const normalizePaymentMethod = (method: string): PaymentMethod => {
  switch (method) {
    case "cash":
      return "cash";
    case "wallet":
    case "nas_wallet":
      return "wallet";
    case "card":
    case "nass":
    case "qi_card":
      return "card";
    case "zain_cash":
    case "super_key":
    case "asia_hawala":
      return "cash";
    default:
      return "cash";
  }
};

// === نسخة مصغرة للعرض المختصر ===
export const PaymentMethodBadge: React.FC<{
  method: PaymentMethod | string;
  onClick?: () => void;
  showChangeButton?: boolean;
}> = ({ method, onClick, showChangeButton = true }) => {
  const normalizedMethod = normalizePaymentMethod(method);
  const option = paymentOptions.find((o) => o.type === normalizedMethod);
  if (!option) return null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-md bg-secondary/50 hover:bg-secondary transition-colors border border-border/50"
    >
      {/* أيقونة */}
      <div
        className={`w-10 h-10 rounded-md flex items-center justify-center ${option.color}`}
      >
        {option.icon}
      </div>

      {/* معلومات */}
      <div className="flex-1 text-right">
        <span className="font-semibold text-foreground">{option.name}</span>
        <span className="text-xs text-muted-foreground mr-2">
          ({option.nameEn})
        </span>
      </div>

      {/* زر التغيير */}
      {showChangeButton && (
        <div className="flex items-center gap-1 text-primary text-sm font-medium">
          <span>تغيير</span>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      )}
    </button>
  );
};

// === دالة الحصول على اسم طريقة الدفع ===
export const getPaymentMethodLabel = (method: PaymentMethod | string): string => {
  const normalized = normalizePaymentMethod(method);
  const option = paymentOptions.find((o) => o.type === normalized);
  return option?.name || "نقداً";
};

export default PaymentMethodSelector;
