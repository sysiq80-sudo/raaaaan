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
    colorClass: "text-amber-400",
    borderClass: "border-amber-500/40",
    selectedBg: "bg-amber-500/10",
    selectedShadow: "shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    iconBorderClass: "border-amber-500/30"
  },
  {
    id: "price_high",
    label: "السعر مرتفع",
    icon: DollarSign,
    colorClass: "text-red-400",
    borderClass: "border-red-500/40",
    selectedBg: "bg-red-500/10",
    selectedShadow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
    iconBorderClass: "border-red-500/30"
  },
  {
    id: "no_drivers",
    label: "لا يوجد سائقين متاحين",
    icon: Car,
    colorClass: "text-cyan-400",
    borderClass: "border-cyan-500/40",
    selectedBg: "bg-cyan-500/10",
    selectedShadow: "shadow-[0_0_12px_rgba(6,182,212,0.15)]",
    iconBorderClass: "border-cyan-500/30"
  },
  {
    id: "changed_destination",
    label: "تغيرت وجهتي",
    icon: MapPin,
    colorClass: "text-blue-400",
    borderClass: "border-blue-500/40",
    selectedBg: "bg-blue-500/10",
    selectedShadow: "shadow-[0_0_12px_rgba(59,130,246,0.15)]",
    iconBorderClass: "border-blue-500/30"
  },
  {
    id: "changed_mind",
    label: "غيرت رأيي",
    icon: HelpCircle,
    colorClass: "text-indigo-400",
    borderClass: "border-indigo-500/40",
    selectedBg: "bg-indigo-500/10",
    selectedShadow: "shadow-[0_0_12px_rgba(99,102,241,0.15)]",
    iconBorderClass: "border-indigo-500/30"
  },
  {
    id: "other",
    label: "سبب آخر",
    icon: X,
    colorClass: "text-slate-400",
    borderClass: "border-slate-500/40",
    selectedBg: "bg-slate-500/10",
    selectedShadow: "shadow-[0_0_12px_rgba(148,163,184,0.15)]",
    iconBorderClass: "border-slate-500/30"
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
      <AlertDialogContent className="max-w-md border border-slate-800/40 bg-[#1a2333] text-white rounded-none sm:rounded-none p-0 overflow-visible shadow-xl" dir="rtl">
        <AlertDialogTitle className="sr-only">سبب الإلغاء</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">مربع حوار لاختيار سبب إلغاء الرحلة الحالي.</AlertDialogDescription>
        <div className="p-5 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-black tracking-wide text-center text-white">سبب إلغاء الرحلة</h2>
            <p className="text-xs text-slate-400 text-center">ساعدنا بفهم السبب لنحسن تجربتك القادمة</p>
          </div>

          {/* Cancellation Fee Warning */}
          {driverAccepted && feeEnabled && cancellationFee > 0 && (
            <div className="bg-[#F04438]/5 border border-[#F04438]/20 rounded-none p-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#F04438]/10 rounded-none">
                  <AlertTriangle className="w-5 h-5 text-[#F04438]" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-[#F04438] text-sm mb-1">تنبيه: غرامة إلغاء</h4>
                  <p className="text-sm text-slate-400">بعد قبول السائق سيتم خصم:</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-[#F04438]" />
                    <span className="text-base font-black text-[#F04438]">{cancellationFee.toLocaleString('en-US')} د.ع</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="rounded-none bg-[#0d1321] border border-slate-800/40 p-3 space-y-2.5">
            <div className="space-y-3">
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="grid grid-cols-2 gap-2">
                {CANCELLATION_REASONS.map((reason) => {
                  const Icon = reason.icon;
                  return (
                    <label
                      key={reason.id}
                      htmlFor={reason.id}
                      className={cn(
                        "block cursor-pointer rounded-none border p-2.5 transition-all min-h-[72px]",
                        selectedReason === reason.id
                          ? `${reason.borderClass} ${reason.selectedBg} ${reason.selectedShadow}`
                          : "border-slate-700/50 bg-[#1a2333]/50 hover:border-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-2.5 h-full">
                        <RadioGroupItem value={reason.id} id={reason.id} className="border-slate-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-white leading-tight">{reason.label}</p>
                        </div>
                        <div className={cn(
                          "w-8 h-8 rounded-full border flex items-center justify-center shrink-0 bg-transparent transition-all",
                          selectedReason === reason.id
                            ? reason.iconBorderClass
                            : "border-slate-700/50"
                        )}>
                          <Icon className={cn("w-4 h-4 transition-all duration-200", reason.colorClass, selectedReason === reason.id ? "opacity-100 scale-110" : "opacity-45")} />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
              <p className="text-[11px] text-slate-400">اختر السبب الأقرب لحالتك الحالية.</p>
            </div>

            {selectedReason === "other" && (
              <div className="space-y-2.5 pt-1">
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <Textarea
                    placeholder="اكتب سبب الإلغاء بالتفصيل..."
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    className="min-h-[90px] resize-none pr-10 rounded-none bg-[#0d1321] border-slate-700/50 text-white placeholder:text-slate-500"
                    maxLength={200}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
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
              className="flex-1 min-h-[48px] rounded-none bg-[#F04438] hover:bg-[#D92D20] text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(240,68,56,0.3)]"
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
              className="flex-1 min-h-[48px] rounded-none bg-[#0d1321] hover:bg-slate-800/50 text-white font-bold transition-all border border-slate-700/50"
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
