/**
 * ران - نافذة إضافة بطاقة جديدة
 * يفتح بوابة NasWallet لترميز البطاقة (tokenization)
 * ثم يحفظ الرمز في saved_cards
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, X, Loader2, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAddCard } from "@/hooks/useSavedCards";
import { useToast } from "@/hooks/use-toast";

interface AddCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCardAdded?: () => void;
}

type ModalStep = "intro" | "loading" | "redirect" | "success" | "error";

const AddCardModal: React.FC<AddCardModalProps> = ({
  open,
  onOpenChange,
  onCardAdded,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const addCard = useAddCard();
  const [step, setStep] = useState<ModalStep>("intro");
  const [errorMessage, setErrorMessage] = useState("");

  const handleClose = useCallback(() => {
    setStep("intro");
    setErrorMessage("");
    onOpenChange(false);
  }, [onOpenChange]);

  /**
   * بدء عملية إضافة البطاقة
   * يتم إنشاء معاملة تحقق ($0) عبر بوابة ناس
   * ثم يتم فتح صفحة الدفع لإدخال بيانات البطاقة
   */
  const handleAddCard = async () => {
    if (!user?.id) {
      toast({
        title: "خطأ",
        description: "يرجى تسجيل الدخول أولاً",
        variant: "destructive",
      });
      return;
    }

    setStep("loading");

    try {
      // استدعاء Edge Function لإنشاء معاملة تحقق
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("لا يوجد رمز مصادقة");
      }

      const { data, error } = await supabase.functions.invoke("nass-init-payment", {
        body: {
          amount: 250, // الحد الأدنى لعملية التحقق (250 د.ع)
          orderDesc: "RAAN Card Verification - تحقق البطاقة",
          backRef: `${window.location.origin}/rider/payments?card_added=true`,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "فشل الاتصال ببوابة الدفع");
      }

      const paymentUrl = data.data?.paymentUrl;
      if (!paymentUrl) {
        throw new Error("لم يتم استلام رابط الدفع");
      }

      setStep("redirect");

      // حفظ معلومات المعاملة مؤقتاً في localStorage
      localStorage.setItem(
        "raan_pending_card",
        JSON.stringify({
          orderId: data.data.orderId,
          timestamp: Date.now(),
        })
      );

      // فتح صفحة الدفع في نافذة جديدة أو إعادة توجيه
      setTimeout(() => {
        window.location.href = paymentUrl;
      }, 1500);
    } catch (err: any) {
      console.error("❌ Card add error:", err);
      setErrorMessage(err.message || "حدث خطأ غير متوقع");
      setStep("error");
    }
  };

  /**
   * إعادة المحاولة بعد فشل
   */
  const handleRetry = () => {
    setStep("intro");
    setErrorMessage("");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8 px-6">
        <SheetHeader className="text-center mb-6">
          <SheetTitle className="text-lg font-bold">
            {step === "success" ? "تمت الإضافة بنجاح!" : "إضافة بطاقة جديدة"}
          </SheetTitle>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {/* === مرحلة المقدمة === */}
          {step === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* أيقونة البطاقة */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-primary/20 flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-primary" />
                </div>
              </div>

              {/* الوصف */}
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  سيتم تحويلك إلى بوابة الدفع الآمنة لإدخال بيانات بطاقتك.
                  <br />
                  سيتم خصم مبلغ رمزي (250 د.ع) للتحقق من البطاقة.
                </p>
              </div>

              {/* شارة الأمان */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
                <Shield className="w-4 h-4 text-primary" />
                <span>بياناتك محمية ومشفرة بالكامل</span>
              </div>

              {/* البطاقات المدعومة */}
              <div className="flex items-center justify-center gap-4">
                <div className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-500 text-xs font-bold">
                  VISA
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold">
                  Mastercard
                </div>
              </div>

              {/* زر الإضافة */}
              <Button
                onClick={handleAddCard}
                className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90"
              >
                <CreditCard className="w-5 h-5 ml-2" />
                إضافة بطاقة
              </Button>
            </motion.div>
          )}

          {/* === مرحلة التحميل === */}
          {step === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">جاري الاتصال ببوابة الدفع...</p>
            </motion.div>
          )}

          {/* === مرحلة إعادة التوجيه === */}
          {step === "redirect" && (
            <motion.div
              key="redirect"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Shield className="w-12 h-12 text-primary" />
              </motion.div>
              <p className="text-sm text-muted-foreground text-center">
                جاري التحويل إلى صفحة الدفع الآمنة...
                <br />
                <span className="text-xs">لا تغلق التطبيق</span>
              </p>
            </motion.div>
          )}

          {/* === مرحلة النجاح === */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10 }}
              >
                <CheckCircle2 className="w-16 h-16 text-primary" />
              </motion.div>
              <p className="text-sm font-medium">تمت إضافة البطاقة بنجاح!</p>
              <Button onClick={handleClose} variant="outline" className="mt-2">
                إغلاق
              </Button>
            </motion.div>
          )}

          {/* === مرحلة الخطأ === */}
          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <AlertCircle className="w-12 h-12 text-destructive" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-destructive">فشل إضافة البطاقة</p>
                <p className="text-xs text-muted-foreground">{errorMessage}</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleRetry} variant="outline" size="sm">
                  إعادة المحاولة
                </Button>
                <Button onClick={handleClose} variant="ghost" size="sm">
                  إلغاء
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
};

export default AddCardModal;
