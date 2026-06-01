/**
 * ران - نظام حذف الحساب مع ضوابط
 * يسمح للمستخدمين بحذف حساباتهم مع التحققات الأمنية
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertTriangle, 
  Trash2, 
  Lock, 
  Clock, 
  Shield, 
  Loader2, 
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userType: "rider" | "driver";
  userEmail: string;
  onAccountDeleted: () => void;
}

export const DeleteAccountDialog = ({
  open,
  onOpenChange,
  userId,
  userType,
  userEmail,
  onAccountDeleted,
}: DeleteAccountDialogProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedWarning, setAcceptedWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState<boolean | null>(null);
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);
  const { toast } = useToast();

  const CONFIRM_PHRASE = "احذف حسابي نهائياً";

  // التحقق من إمكانية حذف الحساب
  const checkCanDelete = async () => {
    try {
      const reasons: string[] = [];

      if (userType === "driver") {
        // التحقق من الرحلات النشطة
        const { data: activeRides } = await supabase
          .from("rides")
          .select("id")
          .eq("driver_id", userId)
          .or("status.eq.accepted,status.eq.arrived,status.eq.in_progress")
          .limit(1);

        if (activeRides && activeRides.length > 0) {
          reasons.push("لديك رحلة نشطة - يجب إكمالها أولاً");
        }

        // التحقق من المستحقات المالية
        const { data: walletData } = await supabase
          .from("driver_wallets")
          .select("balance, pending_balance")
          .eq("driver_id", userId)
          .single();

        if (walletData) {
          const totalBalance = (walletData.balance || 0) + (walletData.pending_balance || 0);
          if (totalBalance > 0) {
            reasons.push(`لديك مستحقات مالية (${totalBalance.toLocaleString('en-US')} د.ع) - يجب سحبها أولاً`);
          }
        }
      } else {
        // راكب - التحقق من رحلات نشطة
        const { data: activeRides } = await supabase
          .from("rides")
          .select("id")
          .eq("rider_id", userId)
          .in("status", ["pending", "accepted", "arrived", "in_progress"])
          .limit(1);

        if (activeRides && activeRides.length > 0) {
          reasons.push("لديك رحلة نشطة - يجب إكمالها أولاً");
        }

        // التحقق من الرحلات المجدولة
        const { data: scheduledRides } = await supabase
          .from("scheduled_rides")
          .select("id")
          .eq("rider_id", userId)
          .eq("status", "pending")
          .limit(1);

        if (scheduledRides && scheduledRides.length > 0) {
          reasons.push("لديك رحلات مجدولة - يجب إلغاؤها أولاً");
        }
      }

      setBlockingReasons(reasons);
      setCanDelete(reasons.length === 0);
      
      if (reasons.length === 0) {
        setStep(2);
      }
    } catch (error) {
      console.error("Error checking delete eligibility:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التحقق من الحساب",
        variant: "destructive",
      });
    }
  };

  // حذف الحساب
  const handleDeleteAccount = async () => {
    if (confirmText !== CONFIRM_PHRASE) {
      toast({
        title: "خطأ في التأكيد",
        description: `يجب كتابة: "${CONFIRM_PHRASE}"`,
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "كلمة المرور مطلوبة",
        description: "يجب إدخال كلمة المرور للتأكيد",
        variant: "destructive",
      });
      return;
    }

    if (!acceptedWarning) {
      toast({
        title: "التأكيد مطلوب",
        description: "يجب الموافقة على التحذير",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      // التحقق من كلمة المرور
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });

      if (signInError) {
        throw new Error("كلمة المرور غير صحيحة");
      }

      // استدعاء Edge Function لحذف الحساب
      const { data, error } = await supabase.functions.invoke("delete-user-account", {
        body: {
          userId,
          userType,
          reason: reason || "لم يذكر سبب",
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "✅ تم حذف الحساب",
          description: "تم حذف حسابك بنجاح. سنفتقدك!",
        });
        
        // تسجيل الخروج
        await supabase.auth.signOut();
        
        onAccountDeleted();
      } else {
        throw new Error(data?.error || "فشل حذف الحساب");
      }
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        title: "خطأ في حذف الحساب",
        description: error.message || "حدث خطأ أثناء حذف الحساب",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !deleting) {
      // إعادة تعيين الحالة عند الإغلاق
      setStep(1);
      setReason("");
      setConfirmText("");
      setPassword("");
      setAcceptedWarning(false);
      setCanDelete(null);
      setBlockingReasons([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            حذف الحساب نهائياً
          </DialogTitle>
          <DialogDescription>
            عملية لا يمكن التراجع عنها
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* الخطوة 1: التحقق من الأهلية */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm">
                  <strong>تحذير:</strong> سيتم حذف جميع بياناتك بشكل نهائي:
                  <ul className="mt-2 mr-4 space-y-1 text-xs">
                    <li>• المعلومات الشخصية</li>
                    <li>• سجل الرحلات والتقييمات</li>
                    <li>• الأماكن المحفوظة</li>
                    {userType === "driver" && <li>• المستندات والصور</li>}
                    <li>• لن تتمكن من استعادة الحساب</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {canDelete === false && blockingReasons.length > 0 && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <XCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription>
                    <strong>لا يمكن حذف الحساب حالياً:</strong>
                    <ul className="mt-2 mr-4 space-y-1 text-sm">
                      {blockingReasons.map((reason, idx) => (
                        <li key={idx}>• {reason}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Textarea
                placeholder="لماذا تريد حذف حسابك؟ (اختياري)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="resize-none"
              />

              <DialogFooter className="gap-2">
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  disabled={deleting}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={checkCanDelete}
                  variant="destructive"
                  disabled={deleting || canDelete === false}
                >
                  {canDelete === false ? (
                    <>
                      <Lock className="w-4 h-4 ml-2" />
                      غير متاح
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 ml-2" />
                      التحقق والمتابعة
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* الخطوة 2: التأكيد النهائي */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Alert className="border-destructive/30 bg-destructive/5">
                <Info className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm">
                  للمتابعة، اكتب: <strong className="text-destructive">{CONFIRM_PHRASE}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Input
                  placeholder={CONFIRM_PHRASE}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="text-center font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">كلمة المرور للتأكيد</label>
                <Input
                  type="password"
                  placeholder="•••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="accept-warning"
                  checked={acceptedWarning}
                  onCheckedChange={(checked) => setAcceptedWarning(checked as boolean)}
                />
                <label
                  htmlFor="accept-warning"
                  className="text-sm cursor-pointer select-none"
                >
                  أفهم أن هذا الإجراء نهائي ولا يمكن التراجع عنه
                </label>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  disabled={deleting}
                >
                  رجوع
                </Button>
                <Button
                  onClick={handleDeleteAccount}
                  variant="destructive"
                  disabled={
                    deleting ||
                    confirmText !== CONFIRM_PHRASE ||
                    !password ||
                    !acceptedWarning
                  }
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 ml-2" />
                      حذف الحساب نهائياً
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
