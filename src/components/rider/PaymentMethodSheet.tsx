import React, { forwardRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import PaymentMethodSelector from './PaymentMethodSelector';

type PaymentMethod = 'cash' | 'wallet' | 'card' | 'zain_cash' | 'super_key' | 'nas_wallet';

interface PaymentMethodSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  walletBalance?: number;
}

const PaymentMethodSheet = forwardRef<HTMLDivElement, PaymentMethodSheetProps>(({
  open,
  onOpenChange,
  selectedMethod,
  onSelect,
  walletBalance
}, ref) => {
  const handleSelect = (method: PaymentMethod) => {
    onSelect(method);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ref={ref} side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader className="text-center mb-4">
          <SheetTitle className="text-lg font-bold">اختر طريقة الدفع</SheetTitle>
        </SheetHeader>
        
        <PaymentMethodSelector
          selectedMethod={selectedMethod}
          onSelect={handleSelect}
          walletBalance={walletBalance}
        />
      </SheetContent>
    </Sheet>
  );
});

PaymentMethodSheet.displayName = 'PaymentMethodSheet';

export default PaymentMethodSheet;
