import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CreditCard, X } from 'lucide-react';
import PaymentMethodSelector from './PaymentMethodSelector';

type PaymentMethod = 'cash' | 'wallet' | 'card' | 'zain_cash' | 'super_key' | 'nas_wallet';

interface PaymentMethodSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  walletBalance?: number;
}

const PaymentMethodSheet: React.FC<PaymentMethodSheetProps> = ({
  open,
  onOpenChange,
  selectedMethod,
  onSelect,
  walletBalance
}) => {
  const handleSelect = (method: PaymentMethod) => {
    onSelect(method);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[2rem] pb-8 max-h-[85vh] overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <SheetHeader className="text-center mb-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-3 flex items-center justify-center"
          >
            <CreditCard className="w-8 h-8 text-primary" />
          </motion.div>
          <SheetTitle className="text-xl font-bold">اختر طريقة الدفع</SheetTitle>
          <p className="text-sm text-muted-foreground">اختر الطريقة المناسبة لك</p>
        </SheetHeader>
        
        <div className="overflow-y-auto max-h-[50vh] px-1">
          <PaymentMethodSelector
            selectedMethod={selectedMethod}
            onSelect={handleSelect}
            walletBalance={walletBalance}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PaymentMethodSheet;
