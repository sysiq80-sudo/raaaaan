/**
 * ران - نظام أكواد الخصم (Promo Codes)
 * مثل Uber/Careem: إدخال كود خصم للحصول على تخفيضات
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Loader2, Check, X, Gift, Percent, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { playSound } from "@/utils/sounds";

interface PromoResult {
  valid: boolean;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount?: number;
  message: string;
  expires_at?: string;
}

interface PromoCodeSheetProps {
  userId?: string;
  onApplyPromo: (promo: PromoResult) => void;
  appliedPromo?: PromoResult | null;
  onRemovePromo?: () => void;
  children?: React.ReactNode;
}

const PromoCodeSheet: React.FC<PromoCodeSheetProps> = ({
  userId,
  onApplyPromo,
  appliedPromo,
  onRemovePromo,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<PromoResult | null>(
    null,
  );
  const { toast } = useToast();

  const validatePromo = useCallback(async () => {
    if (!code.trim()) {
      toast({
        title: "أدخل الكود",
        description: "الرجاء إدخال كود الخصم",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      // محاولة التحقق من الكود عبر Supabase
      const { data, error } = await supabase
        .from("promo_codes" as any)
        .select("*")
        .eq("code", code.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        // إذا الجدول غير موجود أو لا يوجد كود
        setValidationResult({
          valid: false,
          code: code.toUpperCase(),
          discount_type: "percentage",
          discount_value: 0,
          message: "كود الخصم غير صالح أو منتهي الصلاحية",
        });
        playSound("error");
        return;
      }

      // التحقق من تاريخ الصلاحية
      if ((data as any).expires_at && new Date((data as any).expires_at) < new Date()) {
        setValidationResult({
          valid: false,
          code: code.toUpperCase(),
          discount_type: "percentage",
          discount_value: 0,
          message: "كود الخصم منتهي الصلاحية",
        });
        playSound("error");
        return;
      }

      // التحقق من عدد الاستخدامات
      if ((data as any).max_uses && (data as any).used_count >= (data as any).max_uses) {
        setValidationResult({
          valid: false,
          code: code.toUpperCase(),
          discount_type: "percentage",
          discount_value: 0,
          message: "تم استنفاد كود الخصم",
        });
        playSound("error");
        return;
      }

      const d = data as any;
      const result: PromoResult = {
        valid: true,
        code: d.code,
        discount_type: d.discount_type || "percentage",
        discount_value: d.discount_value || 0,
        max_discount: d.max_discount,
        message: `خصم ${d.discount_type === "percentage" ? `${d.discount_value}%` : `${d.discount_value.toLocaleString()} د.ع`}`,
        expires_at: d.expires_at,
      };

      setValidationResult(result);
      playSound("success");
    } catch (err) {
      console.error("Promo validation error:", err);
      setValidationResult({
        valid: false,
        code: code.toUpperCase(),
        discount_type: "percentage",
        discount_value: 0,
        message: "حدث خطأ في التحقق من الكود",
      });
    } finally {
      setIsValidating(false);
    }
  }, [code, toast]);

  const applyPromo = useCallback(() => {
    if (validationResult?.valid) {
      onApplyPromo(validationResult);
      playSound("booking_confirmed");
      toast({
        title: "تم تطبيق الخصم! 🎉",
        description: validationResult.message,
      });
      setOpen(false);
      setCode("");
      setValidationResult(null);
    }
  }, [validationResult, onApplyPromo, toast]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <button className="flex items-center gap-2 w-full p-3 bg-card/50 rounded-xl border border-border/40 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 active:scale-[0.98]">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Tag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-right flex-1">
              {appliedPromo ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 font-bold">
                      {appliedPromo.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      كود: {appliedPromo.code}
                    </p>
                  </div>
                  {onRemovePromo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePromo();
                      }}
                      className="p-1 rounded-full hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold">كود خصم</p>
                  <p className="text-[10px] text-muted-foreground">
                    أدخل كود للحصول على خصم
                  </p>
                </>
              )}
            </div>
          </button>
        )}
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center flex items-center justify-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            كود الخصم
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* حقل إدخال الكود */}
          <div className="relative">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setValidationResult(null);
              }}
              placeholder="أدخل كود الخصم هنا"
              className="h-14 text-center text-lg font-bold tracking-widest uppercase pr-12 rounded-xl border-2 border-border/50 focus:border-primary"
              dir="ltr"
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === "Enter") validatePromo();
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Tag className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          {/* نتيجة التحقق */}
          <AnimatePresence>
            {validationResult && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                className={`flex items-center gap-3 p-4 rounded-xl border ${
                  validationResult.valid
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-destructive/10 border-destructive/30"
                }`}
              >
                {validationResult.valid ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-green-700 dark:text-green-400">
                        كود صالح! 🎉
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-300">
                        {validationResult.message}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                      <X className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-destructive">كود غير صالح</p>
                      <p className="text-sm text-destructive/70">
                        {validationResult.message}
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* أزرار */}
          <div className="flex gap-3">
            {validationResult?.valid ? (
              <Button
                onClick={applyPromo}
                className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
              >
                <Sparkles className="w-5 h-5 ml-2" />
                تطبيق الخصم
              </Button>
            ) : (
              <Button
                onClick={validatePromo}
                disabled={!code.trim() || isValidating}
                className="flex-1 h-12 text-base font-bold"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <Percent className="w-5 h-5 ml-2" />
                    تحقق من الكود
                  </>
                )}
              </Button>
            )}
          </div>

          {/* أكواد متاحة (عروض) */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground text-center mb-3">
              هل لديك كود خصم؟ أدخله أعلاه
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PromoCodeSheet;
