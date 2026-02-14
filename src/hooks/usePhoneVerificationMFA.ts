// ران RAAN - Multi-Factor Authentication (MFA)
// نظام التحقق الثنائي العامل مع SMS OTP و TOTP

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MFASession {
  id: string;
  user_id: string;
  method: "sms" | "totp";
  code: string;
  expires_at: string;
  verified: boolean;
}

interface BackupCode {
  id: string;
  user_id: string;
  code: string;
  used: boolean;
  created_at: string;
}

export const usePhoneVerificationMFA = (userId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);

  // طلب رمز OTP عبر SMS
  const requestOTP = useCallback(
    async (phone: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // التحقق من عدم إرسال رمز حديث
        if (lastSent && Date.now() - lastSent.getTime() < 60000) {
          throw new Error("يرجى الانتظار دقيقة قبل طلب رمز جديد");
        }

        const { data, error } = await supabase.functions.invoke("send-otp", {
          body: {
            phone,
            userId,
            type: "mfa",
          },
        });

        if (error) throw error;

        setLastSent(new Date());
        return { success: true, message: "تم إرسال رمز التحقق" };
      } catch (err: any) {
        setError(err.message || "فشل في إرسال رمز التحقق");
        return { success: false, message: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [userId, lastSent],
  );

  // التحقق من رمز OTP
  const verifyOTP = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase.rpc("verify_mfa_otp", {
          p_user_id: userId,
          p_code: code,
        });

        if (error) throw error;

        if (data?.verified) {
          // تحديث حالة MFA للمستخدم
          await supabase.from("user_mfa_settings").upsert({
            user_id: userId,
            phone_verified: true,
            last_verification: new Date().toISOString(),
          });

          return { success: true, message: "تم التحقق بنجاح" };
        } else {
          throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");
        }
      } catch (err: any) {
        setError(err.message || "فشل في التحقق من الرمز");
        return { success: false, message: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  // إعادة إرسال رمز OTP
  const resendOTP = useCallback(
    async (phone: string) => {
      return requestOTP(phone);
    },
    [requestOTP],
  );

  return {
    requestOTP,
    verifyOTP,
    resendOTP,
    isLoading,
    error,
    canResend: !lastSent || Date.now() - lastSent.getTime() >= 60000,
  };
};

// نظام TOTP (Time-based One-Time Password) للنسخ الاحتياطية
export const useTOTPBackupCodes = (userId: string) => {
  const [backupCodes, setBackupCodes] = useState<BackupCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // توليد أكواد احتياطية جديدة
  const generateBackupCodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // توليد 10 أكواد عشوائية
      const codes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).substring(2, 8).toUpperCase(),
      );

      // حفظ الأكواد في قاعدة البيانات
      const { data, error } = await supabase
        .from("backup_codes")
        .insert(
          codes.map((code) => ({
            user_id: userId,
            code: code,
            used: false,
          })),
        )
        .select();

      if (error) throw error;

      setBackupCodes(data || []);

      // إلغاء صلاحية الأكواد القديمة
      await supabase
        .from("backup_codes")
        .update({ used: true })
        .eq("user_id", userId)
        .lt(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ); // أقدم من 24 ساعة

      return { success: true, codes };
    } catch (err: any) {
      setError(err.message || "فشل في توليد الأكواد الاحتياطية");
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // التحقق من كود احتياطي
  const verifyBackupCode = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("backup_codes")
          .select("*")
          .eq("user_id", userId)
          .eq("code", code.toUpperCase())
          .eq("used", false)
          .single();

        if (error || !data) {
          throw new Error("كود احتياطي غير صحيح أو مستخدم سابقاً");
        }

        // تحديث حالة الكود ليصبح مستخدماً
        await supabase
          .from("backup_codes")
          .update({ used: true })
          .eq("id", data.id);

        // تحديث حالة MFA للمستخدم
        await supabase.from("user_mfa_settings").upsert({
          user_id: userId,
          backup_code_used: true,
          last_verification: new Date().toISOString(),
        });

        return { success: true, message: "تم التحقق من الكود الاحتياطي" };
      } catch (err: any) {
        setError(err.message || "فشل في التحقق من الكود الاحتياطي");
        return { success: false, message: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  // تحميل الأكواد الاحتياطية النشطة
  const loadBackupCodes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("backup_codes")
        .select("*")
        .eq("user_id", userId)
        .eq("used", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBackupCodes(data || []);
    } catch (err: any) {
      setError(err.message || "فشل في تحميل الأكواد الاحتياطية");
    }
  }, [userId]);

  return {
    backupCodes,
    generateBackupCodes,
    verifyBackupCode,
    loadBackupCodes,
    isLoading,
    error,
  };
};

// إعدادات MFA الرئيسية
export const useMFASettings = (userId: string) => {
  const [settings, setSettings] = useState({
    phone_verified: false,
    backup_codes_enabled: false,
    mfa_required: false,
    last_verification: null as string | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تحميل إعدادات MFA
  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_mfa_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found

      setSettings(
        data || {
          phone_verified: false,
          backup_codes_enabled: false,
          mfa_required: false,
          last_verification: null,
        },
      );
    } catch (err: any) {
      setError(err.message || "فشل في تحميل إعدادات MFA");
    }
  }, [userId]);

  // تفعيل/إلغاء MFA
  const toggleMFA = useCallback(
    async (enabled: boolean) => {
      setIsLoading(true);
      setError(null);

      try {
        const { error } = await supabase.from("user_mfa_settings").upsert({
          user_id: userId,
          mfa_required: enabled,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        setSettings((prev) => ({ ...prev, mfa_required: enabled }));
        return { success: true };
      } catch (err: any) {
        setError(err.message || "فشل في تحديث إعدادات MFA");
        return { success: false, message: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  // إعادة تعيين MFA (للطوارئ)
  const resetMFA = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // حذف جميع إعدادات MFA
      await supabase.from("user_mfa_settings").delete().eq("user_id", userId);

      // حذف جميع الأكواد الاحتياطية
      await supabase.from("backup_codes").delete().eq("user_id", userId);

      // حذف جلسات MFA النشطة
      await supabase.from("mfa_sessions").delete().eq("user_id", userId);

      setSettings({
        phone_verified: false,
        backup_codes_enabled: false,
        mfa_required: false,
        last_verification: null,
      });

      return { success: true, message: "تم إعادة تعيين MFA بنجاح" };
    } catch (err: any) {
      setError(err.message || "فشل في إعادة تعيين MFA");
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    settings,
    loadSettings,
    toggleMFA,
    resetMFA,
    isLoading,
    error,
  };
};
