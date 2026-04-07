import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Phone, Lock, CheckCircle } from "lucide-react";
import OTPVerification from "@/components/OTPVerification";

interface PasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userType: 'rider' | 'driver';
}

type ResetStep = 'phone' | 'otp' | 'new-password' | 'success';

const PasswordResetDialog = ({ open, onOpenChange, userType }: PasswordResetDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<ResetStep>('phone');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetState = () => {
    setStep('phone');
    setPhone("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handlePhoneReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!phone || phone.length < 10) {
      setErrors({ phone: 'يرجى إدخال رقم هاتف صحيح' });
      return;
    }

    setStep('otp');
  };

  const handleOTPVerified = () => {
    setStep('new-password');
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!newPassword || newPassword.length < 8) {
      setErrors({ newPassword: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'كلمات المرور غير متطابقة' });
      return;
    }

    setLoading(true);

    try {
      // Call edge function to reset password
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { phone, newPassword, userType },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "خطأ",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "تم تغيير كلمة المرور ✅",
        description: "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة",
      });
      setStep('success');
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ في تغيير كلمة المرور",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'phone':
        return (
          <div className="space-y-4" dir="rtl">
            <DialogHeader className="flex flex-col items-center mb-2">
              <div className="w-14 h-14 bg-[#1a2333] rounded-2xl flex items-center justify-center border border-slate-700/50 mb-3 shadow-inner">
                 <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <DialogTitle className="text-white text-[20px] font-bold">استعادة كلمة المرور</DialogTitle>
              <DialogDescription className="text-slate-400 text-center text-[13px] pt-1">
                أدخل رقم هاتفك المسجل لاستعادة كلمة المرور
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePhoneReset} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-slate-300 text-[13px] font-medium ml-1">رقم الهاتف (WhatsApp)</Label>
                <div className="relative flex items-center bg-[#1a2333] rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50 transition-shadow">
                  <div className="absolute right-0 top-0 bottom-0 w-14 flex items-center justify-center bg-[#0d1321] border-l border-slate-700/50 pointer-events-none z-10 shadow-[-2px_0_10px_rgba(0,0,0,0.2)]">
                    <Phone className="w-[18px] h-[18px] text-emerald-400" />
                  </div>
                  <Input
                    type="tel"
                    placeholder="07xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`h-14 bg-transparent border-0 text-white placeholder:text-slate-500 placeholder:text-center rounded-none px-16 text-[16px] font-medium tracking-wide focus-visible:ring-0 w-full text-center ${errors.phone ? 'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]' : ''}`}
                    required
                    dir="ltr"
                  />
                </div>
                {errors.phone && <p className="text-[11px] text-red-400 mr-2">{errors.phone}</p>}
              </div>
              <Button type="submit" className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-black text-[16px] font-extrabold rounded-xl shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all mt-4" disabled={loading}>
                {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
              </Button>
            </form>
          </div>
        );

      case 'otp':
        return (
          <div className="space-y-4" dir="rtl">
            <DialogHeader className="flex flex-col items-center mb-2">
              <DialogTitle className="text-white text-[20px] font-bold">التحقق من الرقم</DialogTitle>
            </DialogHeader>
            <div className="bg-[#151f30] rounded-2xl px-5 py-5 border border-slate-700/50 mt-2">
              <OTPVerification
                phone={phone}
                purpose="password_reset"
                onVerified={handleOTPVerified}
                onBack={() => setStep('phone')}
              />
            </div>
          </div>
        );

      case 'new-password':
        return (
          <div className="space-y-4" dir="rtl">
            <DialogHeader className="flex flex-col items-center mb-2">
              <div className="w-14 h-14 bg-[#1a2333] rounded-2xl flex items-center justify-center border border-slate-700/50 mb-3 shadow-inner">
                 <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <DialogTitle className="text-white text-[20px] font-bold">كلمة مرور جديدة</DialogTitle>
              <DialogDescription className="text-slate-400 text-center text-[13px] pt-1">
                أدخل كلمة المرور الجديدة لحسابك
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSetNewPassword} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-slate-300 text-[13px] font-medium ml-1">كلمة المرور الجديدة</Label>
                <div className="relative flex items-center bg-[#1a2333] rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50 transition-shadow">
                  <div className="absolute right-0 top-0 bottom-0 w-14 flex items-center justify-center bg-[#0d1321] border-l border-slate-700/50 pointer-events-none z-10 shadow-[-2px_0_10px_rgba(0,0,0,0.2)]">
                    <Lock className="w-[18px] h-[18px] text-emerald-400" />
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`h-14 bg-transparent border-0 text-white placeholder:text-slate-500 placeholder:text-center rounded-none px-16 text-[15px] focus-visible:ring-0 w-full text-center ${errors.newPassword ? 'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]' : ''}`}
                    required
                    minLength={8}
                    dir="ltr"
                  />
                </div>
                {errors.newPassword && <p className="text-[11px] text-red-400 mr-2">{errors.newPassword}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-[13px] font-medium ml-1">تأكيد كلمة المرور</Label>
                <div className="relative flex items-center bg-[#1a2333] rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50 transition-shadow">
                  <div className="absolute right-0 top-0 bottom-0 w-14 flex items-center justify-center bg-[#0d1321] border-l border-slate-700/50 pointer-events-none z-10 shadow-[-2px_0_10px_rgba(0,0,0,0.2)]">
                    <Lock className="w-[18px] h-[18px] text-emerald-400" />
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`h-14 bg-transparent border-0 text-white placeholder:text-slate-500 placeholder:text-center rounded-none px-16 text-[15px] focus-visible:ring-0 w-full text-center ${errors.confirmPassword ? 'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.5)]' : ''}`}
                    required
                    minLength={8}
                    dir="ltr"
                  />
                </div>
                {errors.confirmPassword && <p className="text-[11px] text-red-400 mr-2">{errors.confirmPassword}</p>}
              </div>
              
              <Button type="submit" className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-black text-[16px] font-extrabold rounded-xl shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all mt-4" disabled={loading}>
                {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
              </Button>
            </form>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-4 text-center py-6" dir="rtl">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(52,211,153,0.2)]">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <DialogHeader className="flex flex-col items-center">
              <DialogTitle className="text-white text-[22px] font-bold mt-2">تم بنجاح! ✅</DialogTitle>
              <DialogDescription className="text-slate-400 text-[13px] pt-1">
                يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة
              </DialogDescription>
            </DialogHeader>
            <Button onClick={handleClose} className="w-full h-14 mt-6 bg-[#34d399] hover:bg-[#10b981] text-black text-[16px] font-extrabold rounded-xl shadow-[0_4px_16px_rgba(52,211,153,0.25)] transition-all">
              العودة لتسجيل الدخول
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#0a0f1c] border-slate-800/80 rounded-[24px] shadow-2xl p-6" dir="rtl">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

export default PasswordResetDialog;
