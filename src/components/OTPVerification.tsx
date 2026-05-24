import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, RefreshCw, Phone } from "lucide-react";

interface OTPVerificationProps {
  phone: string;
  purpose: 'rider_registration' | 'driver_registration' | 'login' | 'password_reset';
  onVerified: () => void;
  onBack?: () => void;
}

const OTPVerification = ({ phone, purpose, onVerified, onBack }: OTPVerificationProps) => {
  const { toast } = useToast();
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sent, setSent] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Send OTP on mount
  useEffect(() => {
    if (!sent) {
      sendOTP();
    }
  }, []);

  const sendOTP = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { action: 'send', phone, purpose }
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

      setSent(true);
      setCountdown(60);
      toast({
        title: "تم الإرسال",
        description: "تم إرسال رمز التحقق عبر WhatsApp",
      });
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast({
        title: "خطأ في الإرسال",
        description: error.message || "فشل في إرسال رمز التحقق",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const resendOTP = async () => {
    if (countdown > 0) return;
    setOtp("");
    await sendOTP();
  };

  const verifyOTP = async (overrideCode?: string) => {
    const code = typeof overrideCode === 'string' ? overrideCode : otp;
    if (code.length !== 6) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال الرمز كاملاً",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { action: 'verify', phone, purpose, code }
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

      if (data.verified) {
        toast({
          title: "تم التحقق! ✅",
          description: "تم التحقق من رقم هاتفك بنجاح",
        });
        onVerified();
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      // FunctionsHttpError: try to read the response body for the Arabic error message
      let errorMsg = 'فشل في التحقق من الرمز';
      try {
        // Supabase JS v2: FunctionsHttpError has .context with the raw Response
        if (error?.context) {
          const body = await error.context.json();
          errorMsg = body?.error || errorMsg;
        } else if (error?.message) {
          errorMsg = error.message;
        }
      } catch (_) {
        errorMsg = error?.message || errorMsg;
      }
      toast({
        title: 'خطأ في التحقق',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('964')) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      {/* Phone Display */}
      <div className="flex flex-col items-center justify-center text-center space-y-3 mb-8 pt-2">
        <div className="w-20 h-20 bg-[#1a2333] rounded-[24px] flex items-center justify-center border border-slate-700/50 shadow-inner">
           <Phone className="w-[34px] h-[34px] text-emerald-400" />
        </div>
        <div className="pt-2">
           <h3 className="text-[22px] font-bold text-white mb-2">التحقق من رقم الهاتف</h3>
           <p className="text-slate-400 text-[14px]">
             أدخل الرمز المكون من 6 أرقام المرسل إلى واتساب
           </p>
           <div className="bg-[#0a0f1c] inline-block px-5 py-2.5 rounded-xl border border-slate-800/80 mt-3 shadow-inner">
             <span className="font-semibold text-[17px] text-emerald-400 tracking-widest" dir="ltr">
               {formatPhoneDisplay(phone)}
             </span>
           </div>
        </div>
      </div>

      {/* OTP Input */}
      <div className="space-y-6 mb-8 mt-4">
        <div className="flex justify-center" dir="ltr" style={{ direction: 'ltr' }}>
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(val) => {
              setOtp(val);
              if (val.length === 6) {
                setTimeout(() => verifyOTP(val), 200);
              }
            }}
            disabled={loading}
          >
            <InputOTPGroup className="gap-2.5 sm:gap-3">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <InputOTPSlot key={idx} index={idx} className="w-[45px] h-[58px] sm:w-[50px] sm:h-[60px] text-[24px] font-extrabold bg-[#1a2333] border border-slate-700/50 text-white rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder-slate-600" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      </div>

      {/* Verify Button */}
      <Button 
        className="w-full h-14 bg-[#34d399] hover:bg-[#10b981] active:bg-[#059669] text-black text-[16px] font-extrabold rounded-xl shadow-[0_0_24px_rgba(52,211,153,0.3)] transition-all disabled:opacity-50" 
        onClick={() => verifyOTP()} 
        disabled={loading || otp.length !== 6}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
            جاري التحقق...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 ml-2" />
            تأكيد الرمز
          </>
        )}
      </Button>

      {/* Resend */}
      <div className="text-center">
        {countdown > 0 ? (
          <p className="text-muted-foreground text-sm">
            إعادة الإرسال خلال <span className="font-mono font-bold">{countdown}</span> ثانية
          </p>
        ) : (
          <Button 
            variant="ghost" 
            onClick={resendOTP} 
            disabled={sending}
            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 font-bold"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            ) : (
              <RefreshCw className="w-4 h-4 ml-2" />
            )}
            إعادة إرسال الرمز
          </Button>
        )}
      </div>

      {/* Back Button */}
      {onBack && (
        <Button variant="outline" className="w-full h-14 bg-transparent border border-slate-700 hover:bg-[#1a2333] hover:text-white text-slate-300 font-bold rounded-xl transition-all cursor-pointer" onClick={onBack}>
          تغيير رقم الهاتف
        </Button>
      )}
    </div>
  );
};

export default OTPVerification;
