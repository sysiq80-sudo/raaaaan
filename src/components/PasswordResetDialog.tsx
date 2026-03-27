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

    if (!newPassword || newPassword.length < 6) {
      setErrors({ newPassword: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
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
        body: { phone, newPassword },
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
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>استعادة كلمة المرور</DialogTitle>
              <DialogDescription>
                أدخل رقم هاتفك المسجل لاستعادة كلمة المرور
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePhoneReset} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>رقم الهاتف (WhatsApp)</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="07xxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`pr-10 ${errors.phone ? 'border-destructive' : ''}`}
                    required
                    dir="ltr"
                  />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
              </Button>
            </form>
          </div>
        );

      case 'otp':
        return (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>التحقق من الرقم</DialogTitle>
            </DialogHeader>
            <OTPVerification
              phone={phone}
              purpose="password_reset"
              onVerified={handleOTPVerified}
              onBack={() => setStep('phone')}
            />
          </div>
        );

      case 'new-password':
        return (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>كلمة مرور جديدة</DialogTitle>
              <DialogDescription>
                أدخل كلمة المرور الجديدة
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSetNewPassword} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`pr-10 ${errors.newPassword ? 'border-destructive' : ''}`}
                    required
                    minLength={6}
                    dir="ltr"
                  />
                </div>
                {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword}</p>}
              </div>
              <div className="space-y-2">
                <Label>تأكيد كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                    required
                    minLength={6}
                    dir="ltr"
                  />
                </div>
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
              </Button>
            </form>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-4 text-center py-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <DialogHeader>
              <DialogTitle>تم بنجاح! ✅</DialogTitle>
              <DialogDescription>
                يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة
              </DialogDescription>
            </DialogHeader>
            <Button onClick={handleClose} className="w-full mt-4">
              العودة لتسجيل الدخول
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

export default PasswordResetDialog;
