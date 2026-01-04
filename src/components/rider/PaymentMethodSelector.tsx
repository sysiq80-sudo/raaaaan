import React from 'react';
import { motion } from 'framer-motion';
import { Banknote, Smartphone, CreditCard, Check, Wallet, Sparkles, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentMethod = 'cash' | 'wallet' | 'card' | 'zain_cash' | 'super_key' | 'nas_wallet';

interface PaymentOption {
  type: PaymentMethod;
  name: string;
  nameEn: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  description: string;
  recommended?: boolean;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  className?: string;
  walletBalance?: number;
}

const paymentOptions: PaymentOption[] = [
  {
    type: 'wallet',
    name: 'المحفظة الذكية',
    nameEn: 'Smart Wallet',
    icon: <Wallet className="w-6 h-6" />,
    gradient: 'from-primary/20 to-primary/5',
    iconBg: 'bg-primary text-primary-foreground',
    description: 'الاستقطاع من رصيدك',
    recommended: true
  },
  {
    type: 'cash',
    name: 'الدفع نقداً',
    nameEn: 'Cash',
    icon: <Banknote className="w-6 h-6" />,
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    iconBg: 'bg-emerald-500 text-white',
    description: 'ادفع للسائق مباشرة'
  },
  {
    type: 'card',
    name: 'بطاقة ائتمان',
    nameEn: 'Credit Card',
    icon: <CreditCard className="w-6 h-6" />,
    gradient: 'from-blue-500/20 to-blue-500/5',
    iconBg: 'bg-blue-500 text-white',
    description: 'الدفع عبر البطاقة'
  },
  {
    type: 'zain_cash',
    name: 'زين كاش',
    nameEn: 'Zain Cash',
    icon: <Smartphone className="w-6 h-6" />,
    gradient: 'from-purple-500/20 to-purple-500/5',
    iconBg: 'bg-purple-500 text-white',
    description: 'الدفع عبر محفظة زين'
  },
  {
    type: 'super_key',
    name: 'سوبر كي',
    nameEn: 'Super Key',
    icon: <Smartphone className="w-6 h-6" />,
    gradient: 'from-orange-500/20 to-orange-500/5',
    iconBg: 'bg-orange-500 text-white',
    description: 'الدفع عبر سوبر كي'
  },
  {
    type: 'nas_wallet',
    name: 'ناس ولت',
    nameEn: 'NasWallet',
    icon: <Smartphone className="w-6 h-6" />,
    gradient: 'from-teal-500/20 to-teal-500/5',
    iconBg: 'bg-teal-500 text-white',
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
    <div className={`space-y-3 ${className}`}>
      {paymentOptions.map((option, index) => {
        const isSelected = selectedMethod === option.type;
        
        return (
          <motion.button
            key={option.type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelect(option.type)}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 relative overflow-hidden",
              isSelected 
                ? `bg-gradient-to-l ${option.gradient} border-2 border-primary shadow-lg` 
                : 'bg-secondary/50 border-2 border-transparent hover:bg-secondary hover:border-primary/20'
            )}
          >
            {/* Recommended badge */}
            {option.recommended && (
              <div className="absolute -top-1 -left-1 bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-br-lg rounded-tl-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                موصى به
              </div>
            )}

            {/* Payment icon */}
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg",
              isSelected ? option.iconBg : "bg-muted text-muted-foreground"
            )}>
              {option.icon}
            </div>
            
            {/* Payment info */}
            <div className="flex-1 text-right min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "font-bold text-base",
                  isSelected ? 'text-primary' : 'text-foreground'
                )}>
                  {option.name}
                </span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {option.nameEn}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {option.type === 'wallet' && walletBalance !== undefined 
                  ? `رصيدك: ${walletBalance.toLocaleString()} د.ع`
                  : option.description
                }
              </p>
            </div>
            
            {/* Selection indicator */}
            <div className={cn(
              "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300",
              isSelected 
                ? 'border-primary bg-primary shadow-lg shadow-primary/30' 
                : 'border-muted-foreground/30'
            )}>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  <Check className="w-4 h-4 text-primary-foreground" />
                </motion.div>
              )}
            </div>
          </motion.button>
        );
      })}

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3 mt-4">
        <Shield className="w-4 h-4 text-primary" />
        <span>جميع طرق الدفع آمنة ومشفرة</span>
      </div>
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
    <motion.button 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
        "bg-gradient-to-l border border-border/30 hover:border-primary/30",
        option.gradient
      )}
    >
      {/* Payment icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
        option.iconBg
      )}>
        {option.icon}
      </div>
      
      {/* Payment info */}
      <div className="flex-1 text-right min-w-0">
        <span className="font-bold text-foreground">{option.name}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
      </div>
      
      {/* Change button */}
      {showChangeButton && (
        <div className="flex items-center gap-1 text-primary text-sm font-bold bg-primary/10 px-3 py-1.5 rounded-lg">
          <span>تغيير</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}
    </motion.button>
  );
};

// Get payment method label
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const option = paymentOptions.find(o => o.type === method);
  return option?.name || 'نقداً';
};

export default PaymentMethodSelector;
