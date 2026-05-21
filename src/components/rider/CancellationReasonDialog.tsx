import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  DollarSign,
  Car,
  MapPin,
  HelpCircle,
  X,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

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
    color: "text-amber-500"
  },
  {
    id: "price_high",
    label: "السعر مرتفع",
    icon: DollarSign,
    color: "text-red-500"
  },
  {
    id: "no_drivers",
    label: "لا يوجد سائقين متاحين",
    icon: Car,
    color: "text-[#475467]"
  },
  {
    id: "changed_destination",
    label: "تغيرت وجهتي",
    icon: MapPin,
    color: "text-blue-500"
  },
  {
    id: "changed_mind",
    label: "غيرت رأيي",
    icon: HelpCircle,
    color: "text-[#475467]"
  },
  {
    id: "other",
    label: "سبب آخر",
    icon: X,
    color: "text-[#475467]"
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

  const canSubmit = Boolean(selectedReason) && (selectedReason !== "other" || otherReason.trim().length >= 3);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className="max-w-md border border-[#E4E7EC] bg-white text-[#101828] rounded-3xl p-0 overflow-visible shadow-xl" dir="rtl">
        <AlertDialogTitle className="sr-only">سبب الإلغاء</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">مربع حوار لاختيار سبب إلغاء الرحلة الحالي.</AlertDialogDescription>
        <div className="p-5 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#F04438]/10 border border-[#F04438]/20 flex items-center justify-center">
              <img src={logo} alt="RAAN" className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black tracking-wide text-center text-[#101828]">سبب إلغاء الرحلة</h2>
            <p className="text-xs text-[#475467] text-center">ساعدنا بفهم السبب لنحسن تجربتك القادمة</p>
          </div>

          {/* Cancellation Fee Warning */}
          {driverAccepted && feeEnabled && cancellationFee > 0 && (
            <div className="bg-[#F04438]/5 border border-[#F04438]/20 rounded-2xl p-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#F04438]/10 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-[#F04438]" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-[#F04438] text-sm mb-1">تنبيه: غرامة إلغاء</h4>
                  <p className="text-sm text-[#475467]">بعد قبول السائق سيتم خصم:</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-[#F04438]" />
                    <span className="text-base font-black text-[#F04438]">{cancellationFee.toLocaleString()} د.ع</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="rounded-2xl bg-[#F9FAFB] border border-[#E4E7EC] p-3 space-y-2.5">
            <div className="space-y-3">
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="grid grid-cols-2 gap-2">
                {CANCELLATION_REASONS.map((reason) => {
                  const Icon = reason.icon;
                  return (
                    <label
                      key={reason.id}
                      htmlFor={reason.id}
                      className={cn(
                        "block cursor-pointer rounded-xl border p-2.5 transition-all min-h-[72px]",
                        selectedReason === reason.id
                          ? "border-[#00B3B0] bg-[#00B3B0]/5 shadow-sm"
                          : "border-[#E4E7EC] bg-white hover:border-[#D0D5DD]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 h-full">
                        <RadioGroupItem value={reason.id} id={reason.id} className="border-[#D0D5DD]" />
                        <div className={cn(
                          "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                          selectedReason === reason.id
                            ? "bg-[#00B3B0]/10 border-[#00B3B0]/20"
                            : "bg-[#F2F4F7] border-[#E4E7EC]"
                        )}>
                          <Icon className={cn("w-4 h-4", selectedReason === reason.id ? "text-[#00B3B0]" : "text-[#475467]")} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-[#101828] leading-tight">{reason.label}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
              <p className="text-[11px] text-[#475467]">اختر السبب الأقرب لحالتك الحالية.</p>
            </div>

            {selectedReason === "other" && (
              <div className="space-y-2.5 pt-1">
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-[#98A2B3] absolute right-3 top-3.5" />
                  <Textarea
                    placeholder="اكتب سبب الإلغاء بالتفصيل..."
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    className="min-h-[90px] resize-none pr-10 rounded-xl bg-white border-[#E4E7EC] text-[#101828] placeholder:text-[#98A2B3]"
                    maxLength={200}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#475467]">
                  <span>الحد الأدنى 3 أحرف.</span>
                  <span>{otherReason.length}/200</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 pt-0.5" dir="rtl">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || !canSubmit}
              className="flex-1 min-h-[48px] rounded-2xl bg-[#F04438] hover:bg-[#D92D20] text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    جاري الإلغاء...
                  </>
                ) : (
                  <>
                    تأكيد الإلغاء
                  </>
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="flex-1 min-h-[48px] rounded-2xl bg-[#F2F4F7] hover:bg-[#E4E7EC] text-[#101828] font-bold transition-all border border-[#E4E7EC]"
            >
              <span className="inline-flex items-center gap-1.5">
                <>
                  إغلاق
                  <X className="w-4 h-4" />
                </>
              </span>
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancellationReasonDialog;
