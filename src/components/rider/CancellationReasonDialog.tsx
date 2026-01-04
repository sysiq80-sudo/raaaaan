import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, DollarSign, Car, MapPin, HelpCircle, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CancellationReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, category: string) => void;
  isLoading?: boolean;
  rideStatus?: string; // To check if driver already accepted
  estimatedFare?: number;
}

const CANCELLATION_REASONS = [
  {
    id: "long_wait",
    label: "وقت الانتظار طويل",
    icon: Clock,
    color: "text-warning"
  },
  {
    id: "price_high",
    label: "السعر مرتفع",
    icon: DollarSign,
    color: "text-destructive"
  },
  {
    id: "no_drivers",
    label: "لا يوجد سائقين متاحين",
    icon: Car,
    color: "text-muted-foreground"
  },
  {
    id: "changed_destination",
    label: "تغيرت وجهتي",
    icon: MapPin,
    color: "text-info"
  },
  {
    id: "changed_mind",
    label: "غيرت رأيي",
    icon: HelpCircle,
    color: "text-muted-foreground"
  },
  {
    id: "other",
    label: "سبب آخر",
    icon: X,
    color: "text-muted-foreground"
  }
];

export const CancellationReasonDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  rideStatus,
  estimatedFare
}: CancellationReasonDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");
  const [cancellationFee, setCancellationFee] = useState<number>(0);
  const [feeEnabled, setFeeEnabled] = useState(false);

  // Check if driver already accepted - cancellation fee applies
  const driverAccepted = rideStatus === 'accepted' || rideStatus === 'arrived';

  // Fetch cancellation fee settings
  useEffect(() => {
    const fetchCancellationFee = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'cancellation_fee')
        .single();
      
      if (data?.value) {
        const settings = data.value as { amount: number; enabled: boolean; applies_after_acceptance: boolean };
        if (settings.enabled && settings.applies_after_acceptance) {
          setCancellationFee(settings.amount);
          setFeeEnabled(true);
        }
      }
    };
    
    if (open && driverAccepted) {
      fetchCancellationFee();
    }
  }, [open, driverAccepted]);

  const handleConfirm = () => {
    if (!selectedReason) return;
    
    const reason = selectedReason === "other" 
      ? otherReason || "سبب آخر" 
      : CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
    
    onConfirm(reason, selectedReason);
    setSelectedReason("");
    setOtherReason("");
  };

  const handleClose = () => {
    setSelectedReason("");
    setOtherReason("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-xl">
            لماذا تريد إلغاء الرحلة؟
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            اختر سبب الإلغاء لمساعدتنا في تحسين الخدمة
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Cancellation Fee Warning */}
        {driverAccepted && feeEnabled && cancellationFee > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-destructive/20 rounded-full">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-destructive text-sm mb-1">
                  تنبيه: غرامة إلغاء
                </h4>
                <p className="text-sm text-muted-foreground">
                  بما أن السائق قَبِل الطلب، سيتم خصم غرامة إلغاء بقيمة:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-destructive" />
                  <span className="text-lg font-bold text-destructive">
                    {cancellationFee.toLocaleString()} د.ع
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  سيتم إضافة هذا المبلغ تلقائياً لحساب السائق كتعويض
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="py-4">
          <RadioGroup
            value={selectedReason}
            onValueChange={setSelectedReason}
            className="space-y-3"
          >
            {CANCELLATION_REASONS.map((reason) => {
              const Icon = reason.icon;
              return (
                <div
                  key={reason.id}
                  className={`flex items-center space-x-3 space-x-reverse p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                    selectedReason === reason.id
                      ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary)/0.2)]"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50"
                  }`}
                  onClick={() => setSelectedReason(reason.id)}
                >
                  <RadioGroupItem value={reason.id} id={reason.id} />
                  <Icon className={`w-5 h-5 ${reason.color}`} />
                  <Label
                    htmlFor={reason.id}
                    className="flex-1 cursor-pointer font-medium"
                  >
                    {reason.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {/* Other reason textarea */}
          {selectedReason === "other" && (
            <div className="mt-4 animate-fade-in">
              <Textarea
                placeholder="اكتب سبب الإلغاء..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                className="min-h-[80px] resize-none"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1 text-left">
                {otherReason.length}/200
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel
            onClick={handleClose}
            className="flex-1"
          >
            تراجع
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!selectedReason || isLoading}
            className="flex-1 bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                جاري الإلغاء...
              </span>
            ) : (
              "تأكيد الإلغاء"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancellationReasonDialog;
