import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sent, setSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    setOtp(Array(6).fill(""));
    await sendOTP();
  };

  const verifyOTP = async () => {
    const code = otp.join("");
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

  const handleChange = (index: number, rawValue: string) => {
    // Extract only digits (handles multi-char input when box is pre-filled: "1"+"2"="12")
    const digits = rawValue.replace(/\D/g, '');

    // If multiple digits entered at once (e.g. box had '1', user typed '2' → '12')
    // distribute them sequentially starting at current index
    if (digits.length > 1) {
      const newOtp = [...otp];
      digits.split('').forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      const fullCode = newOtp.join('');
      if (/^\d{6}$/.test(fullCode)) setTimeout(() => verifyOTP(), 200);
      return;
    }

    const digit = digits; // single digit or empty string (backspace)
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when last box filled
    if (digit && index === 5) {
      const fullCode = newOtp.join('');
      if (/^\d{6}$/.test(fullCode)) setTimeout(() => verifyOTP(), 200);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setOtp(pastedData.split(''));
      inputRefs.current[5]?.focus();
      setTimeout(verifyOTP, 100);
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
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">التحقق من رقم الهاتف</h3>
        <p className="text-muted-foreground text-sm">
          تم إرسال رمز التحقق إلى
        </p>
        <p className="font-mono text-lg font-semibold" dir="ltr">
          {formatPhoneDisplay(phone)}
        </p>
      </div>

      {/* OTP Input */}
      <div className="space-y-2">
        <Label className="text-center block">أدخل رمز التحقق</Label>
        <div className="flex justify-center gap-2" dir="ltr" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold"
              disabled={loading}
            />
          ))}
        </div>
      </div>

      {/* Verify Button */}
      <Button 
        className="w-full" 
        onClick={verifyOTP} 
        disabled={loading || otp.some(d => !d)}
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
            className="text-primary"
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
        <Button variant="outline" className="w-full" onClick={onBack}>
          تغيير رقم الهاتف
        </Button>
      )}
    </div>
  );
};

export default OTPVerification;
