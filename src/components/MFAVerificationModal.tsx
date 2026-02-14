import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Smartphone, Key, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface MFAVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string, method: "sms" | "backup") => Promise<boolean>;
  phoneNumber?: string;
  method: "sms" | "backup";
  onSwitchMethod: (method: "sms" | "backup") => void;
  maxAttempts?: number;
}

export const MFAVerificationModal: React.FC<MFAVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerify,
  phoneNumber,
  method,
  onSwitchMethod,
  maxAttempts = 3,
}) => {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode("");
      setAttempts(0);
      setTimeLeft(60); // 60 seconds cooldown
      setCanResend(false);
    }
  }, [isOpen]);

  // Countdown timer for resend
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const handleVerify = async () => {
    if (!code.trim()) {
      toast.error("يرجى إدخال رمز التحقق");
      return;
    }

    if (code.length !== 6) {
      toast.error("رمز التحقق يجب أن يكون 6 أرقام");
      return;
    }

    if (attempts >= maxAttempts) {
      toast.error("تم تجاوز عدد المحاولات المسموحة");
      onClose();
      return;
    }

    setIsVerifying(true);
    try {
      const success = await onVerify(code, method);

      if (success) {
        toast.success("تم التحقق بنجاح");
        onClose();
      } else {
        setAttempts((prev) => prev + 1);
        toast.error(
          `رمز التحقق غير صحيح. المحاولة ${attempts + 1} من ${maxAttempts}`,
        );

        if (attempts + 1 >= maxAttempts) {
          toast.error("تم تجاوز عدد المحاولات المسموحة. يرجى المحاولة لاحقاً");
          onClose();
        }
      }
    } catch (error) {
      console.error("MFA verification error:", error);
      toast.error("حدث خطأ في التحقق. يرجى المحاولة مرة أخرى");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
    if (!canResend) return;

    // Reset timer and allow resend
    setTimeLeft(60);
    setCanResend(false);
    toast.success("تم إرسال رمز تحقق جديد");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  const getMaskedPhoneNumber = (phone: string) => {
    if (!phone) return "";
    return phone.replace(/(\+964\d{2})\d{4}(\d{3})/, "$1****$2");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle>التحقق بخطوتين</DialogTitle>
              <DialogDescription>أدخل رمز التحقق المرسل إليك</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method Selection */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Button
              variant={method === "sms" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSwitchMethod("sms")}
              className="flex-1"
              disabled={!phoneNumber}
            >
              <Smartphone className="w-4 h-4 ml-2" />
              رسالة نصية
            </Button>
            <Button
              variant={method === "backup" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSwitchMethod("backup")}
              className="flex-1"
            >
              <Key className="w-4 h-4 ml-2" />
              رمز احتياطي
            </Button>
          </div>

          {/* Method Description */}
          {method === "sms" && phoneNumber && (
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                تم إرسال رمز التحقق إلى رقم الهاتف{" "}
                {getMaskedPhoneNumber(phoneNumber)}
              </AlertDescription>
            </Alert>
          )}

          {method === "backup" && (
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                أدخل أحد أكواد الأمان الاحتياطية المحفوظة لديك
              </AlertDescription>
            </Alert>
          )}

          {/* Code Input */}
          <div className="space-y-2">
            <Label htmlFor="mfa-code">
              {method === "sms"
                ? "رمز التحقق من الرسالة"
                : "رمز الأمان الاحتياطي"}
            </Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                // Only allow numbers and limit to 6 digits
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(value);
              }}
              onKeyPress={handleKeyPress}
              className="text-center text-lg tracking-widest font-mono"
              autoFocus
            />
          </div>

          {/* Attempts Warning */}
          {attempts > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                محاولة {attempts} من {maxAttempts}
                {attempts >= maxAttempts - 1 && " - المحاولة الأخيرة"}
              </AlertDescription>
            </Alert>
          )}

          {/* Resend Option */}
          {method === "sms" && (
            <div className="text-center">
              {canResend ? (
                <Button
                  variant="link"
                  onClick={handleResend}
                  className="text-sm"
                >
                  إرسال رمز جديد
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  يمكنك إرسال رمز جديد خلال {timeLeft} ثانية
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 6}
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 ml-2" />
                  تحقق
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={isVerifying}>
              إلغاء
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center text-xs text-muted-foreground">
            {method === "sms" ? (
              <p>لم تستلم الرسالة؟ تحقق من مجلد الرسائل غير المرغوبة</p>
            ) : (
              <p>استخدم أحد الأكواد الاحتياطية التي حفظتها مسبقاً</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Backup Codes Display Component
interface BackupCodesDisplayProps {
  codes: string[];
  onClose: () => void;
}

export const BackupCodesDisplay: React.FC<BackupCodesDisplayProps> = ({
  codes,
  onClose,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      toast.success("تم نسخ الرمز");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      toast.error("فشل في نسخ الرمز");
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Key className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle>أكواد الأمان الاحتياطية</DialogTitle>
              <DialogDescription>
                احفظ هذه الأكواد في مكان آمن. يمكن استخدام كل رمز مرة واحدة فقط.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>تحذير مهم:</strong> لا تشارك هذه الأكواد مع أي شخص. احفظها
              في مكان آمن ولا تحتفظ بها في هاتفك.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2">
            {codes.map((code, index) => (
              <Button
                key={index}
                variant="outline"
                className="font-mono text-sm justify-between"
                onClick={() => copyCode(code, index)}
              >
                {code}
                {copiedIndex === index && (
                  <span className="text-green-600 ml-2">✓</span>
                )}
              </Button>
            ))}
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              بمجرد استخدام جميع الأكواد، ستحتاج إلى إعادة إعداد التحقق بخطوتين.
            </AlertDescription>
          </Alert>

          <Button onClick={onClose} className="w-full">
            فهمت، احفظت الأكواد
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
