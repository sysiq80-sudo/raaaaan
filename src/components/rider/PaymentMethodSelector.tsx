import React from 'react';
import { Banknote, Smartphone, CreditCard, Check, Wallet } from 'lucide-react';

type PaymentMethod = 'cash' | 'wallet' | 'card' | 'zain_cash' | 'super_key' | 'nas_wallet';

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

const paymentOptions: PaymentOption[] = [
  {
    type: 'wallet',
    name: 'المحفظة',
    nameEn: 'Wallet',
    icon: <Wallet className="w-5 h-5" />,
    color: 'bg-primary/20 text-primary',
    description: 'الاستقطاع من رصيدك'
  },
  {
    type: 'cash',
    name: 'نقداً',
    nameEn: 'Cash',
    icon: <Banknote className="w-5 h-5" />,
    color: 'bg-green-500/20 text-green-600',
    description: 'ادفع للسائق مباشرة'
  },
  {
    type: 'card',
    name: 'البطاقة',
    nameEn: 'Card',
    icon: <CreditCard className="w-5 h-5" />,
    color: 'bg-blue-500/20 text-blue-600',
    description: 'الدفع عبر البطاقة'
  },
  {
    type: 'zain_cash',
    name: 'زين كاش',
    nameEn: 'Zain Cash',
    icon: <Smartphone className="w-5 h-5" />,
    color: 'bg-purple-500/20 text-purple-600',
    description: 'الدفع عبر محفظة زين'
  },
  {
    type: 'super_key',
    name: 'سوبر كي',
    nameEn: 'Super Key',
    icon: <Smartphone className="w-5 h-5" />,
    color: 'bg-orange-500/20 text-orange-600',
    description: 'الدفع عبر سوبر كي'
  },
  {
    type: 'nas_wallet',
    name: 'ناس ولت',
    nameEn: 'NasWallet',
    icon: <Smartphone className="w-5 h-5" />,
    color: 'bg-teal-500/20 text-teal-600',
    description: 'الدفع عبر ناس ولت'
  },
];

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onSelect,
  className = '',
  walletBalance
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {paymentOptions.map((option) => {
        const isSelected = selectedMethod === option.type;
        
        return (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
              isSelected 
                ? 'bg-primary/10 border-2 border-primary' 
                : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary'
            }`}
          >
            {/* Payment icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${option.color}`}>
              {option.icon}
            </div>
            
            {/* Payment info */}
            <div className="flex-1 text-right">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {option.name}
                </span>
                <span className="text-xs text-muted-foreground">({option.nameEn})</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {option.type === 'wallet' && walletBalance !== undefined 
                  ? `رصيدك: ${walletBalance.toLocaleString()} د.ع`
                  : option.description
                }
              </p>
            </div>
            
            {/* Selection indicator */}
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected 
                ? 'border-primary bg-primary' 
                : 'border-muted-foreground/30'
            }`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
};

// Compact version for inline display
export const PaymentMethodBadge: React.FC<{ 
  method: PaymentMethod; 
  onClick?: () => void;
  showChangeButton?: boolean;
}> = ({ method, onClick, showChangeButton = true }) => {
  const option = paymentOptions.find(o => o.type === method);
  if (!option) return null;

  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/50"
    >
      {/* Payment icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${option.color}`}>
        {option.icon}
      </div>
      
      {/* Payment info */}
      <div className="flex-1 text-right">
        <span className="font-semibold text-foreground">{option.name}</span>
        <span className="text-xs text-muted-foreground mr-2">({option.nameEn})</span>
      </div>
      
      {/* Change button */}
      {showChangeButton && (
        <div className="flex items-center gap-1 text-primary text-sm font-medium">
          <span>تغيير</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}
    </button>
  );
};

// Get payment method label
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const option = paymentOptions.find(o => o.type === method);
  return option?.name || 'نقداً';
};

export default PaymentMethodSelector;
