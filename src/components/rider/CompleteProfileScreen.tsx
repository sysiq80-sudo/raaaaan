/**
 * ران - شاشة إكمال الملف الشخصي
 * تظهر للمستخدمين الذين ليس لديهم اسم صحيح
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User, Check, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

// قائمة الأسماء المحظورة
const BANNED_NAMES = [
    // عربي
    'مستخدم', 'راكب', 'سائق', 'مجهول', 'اسم', 'بدون اسم', 'لا يوجد',
    'تجربة', 'تيست', 'اختبار', 'فلان', 'علان', 'شخص', 'أنا',
    'زائر', 'ضيف', 'عميل', 'مشترك', 'جديد', 'الاسم', 'اكتب اسمك',
    // إنجليزي
    'user', 'rider', 'driver', 'test', 'testing', 'unknown', 'anonymous',
    'guest', 'customer', 'new', 'name', 'your name', 'enter name',
    'null', 'undefined', 'none', 'n/a', 'na', 'admin', 'support',
    // أرقام فقط
    '123', '1234', '12345', '123456', '0000', '1111',
];

// دالة التحقق من صحة الاسم
export const isValidName = (name: string | null | undefined): boolean => {
    if (!name || typeof name !== 'string') return false;

    const trimmedName = name.trim();

    // يجب أن يكون طول الاسم بين 3 و 50 حرف
    if (trimmedName.length < 3 || trimmedName.length > 50) return false;

    // يجب أن يحتوي على حروف فقط (عربي أو إنجليزي) مع مسافات
    const validCharsRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;
    if (!validCharsRegex.test(trimmedName)) return false;

    // يجب أن يحتوي على كلمتين على الأقل
    const words = trimmedName.split(/\s+/).filter(w => w.length >= 2);
    if (words.length < 2) return false;

    // التحقق من الأسماء المحظورة
    const lowerName = trimmedName.toLowerCase();
    for (const banned of BANNED_NAMES) {
        if (lowerName === banned.toLowerCase()) return false;
        if (lowerName.includes(banned.toLowerCase()) && trimmedName.length < 10) return false;
    }

    // التحقق من أن الاسم لا يحتوي على أرقام الهاتف
    if (/\d{5,}/.test(trimmedName)) return false;

    // التحقق من أن الاسم لا يحتوي على بريد إلكتروني
    if (/@/.test(trimmedName)) return false;

    return true;
};

// دالة للحصول على رسالة خطأ الاسم
export const getNameError = (name: string): string | null => {
    if (!name || name.trim().length === 0) {
        return 'الرجاء إدخال اسمك';
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
        return 'الاسم قصير جداً';
    }

    if (trimmedName.length > 50) {
        return 'الاسم طويل جداً';
    }

    const validCharsRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;
    if (!validCharsRegex.test(trimmedName)) {
        return 'الاسم يجب أن يحتوي على حروف فقط';
    }

    const words = trimmedName.split(/\s+/).filter(w => w.length >= 2);
    if (words.length < 2) {
        return 'الرجاء إدخال الاسم الأول واسم العائلة';
    }

    const lowerName = trimmedName.toLowerCase();
    for (const banned of BANNED_NAMES) {
        if (lowerName === banned.toLowerCase() ||
            (lowerName.includes(banned.toLowerCase()) && trimmedName.length < 10)) {
            return 'هذا الاسم غير مسموح به';
        }
    }

    if (/\d{5,}/.test(trimmedName)) {
        return 'الاسم لا يجب أن يحتوي على أرقام';
    }

    if (/@/.test(trimmedName)) {
        return 'الاسم لا يجب أن يحتوي على بريد إلكتروني';
    }

    return null;
};

interface CompleteProfileScreenProps {
    userId: string;
    currentName?: string | null;
    onComplete: (newName: string) => void;
}

const CompleteProfileScreen = ({ userId, currentName, onComplete }: CompleteProfileScreenProps) => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validationError = getNameError(name);
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // تحديث الاسم في profiles
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: name.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (profileError) throw profileError;

            // تحديث الاسم في auth metadata
            await supabase.auth.updateUser({
                data: { full_name: name.trim() }
            });

            toast({
                title: "تم حفظ الاسم بنجاح! ✅",
                description: `مرحباً ${name.trim()}`,
            });

            onComplete(name.trim());
        } catch (err: any) {
            console.error('Error updating name:', err);
            setError('حدث خطأ أثناء حفظ الاسم');
            toast({
                title: "خطأ",
                description: "فشل في حفظ الاسم، حاول مرة أخرى",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNameChange = (value: string) => {
        setName(value);
        if (error) setError(null);
    };

    const nameError = name.length > 0 ? getNameError(name) : null;
    const isValid = name.length > 0 && !nameError;

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-40 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            <motion.div
                className="relative z-10 w-full max-w-sm text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                {/* Logo */}
                <motion.img
                    src={logo}
                    alt="RAAN"
                    className="w-20 h-20 mx-auto mb-6"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                />

                {/* Title */}
                <h1 className="text-2xl font-bold mb-2">أكمل ملفك الشخصي</h1>
                <p className="text-muted-foreground mb-8">
                    أدخل اسمك الحقيقي ليظهر للسائقين
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                            <User className="w-5 h-5" />
                        </div>
                        <Input
                            type="text"
                            placeholder="الاسم الأول واسم العائلة"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className={`pr-12 pl-12 h-14 text-lg rounded-2xl bg-card border-2 transition-all ${nameError ? 'border-destructive focus:border-destructive' :
                                    isValid ? 'border-primary focus:border-primary' :
                                        'border-border focus:border-primary'
                                }`}
                            disabled={loading}
                            autoFocus
                        />
                        {isValid && (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                                <Check className="w-5 h-5" />
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {(error || nameError) && (
                        <motion.div
                            className="flex items-center gap-2 text-destructive text-sm"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <AlertCircle className="w-4 h-4" />
                            <span>{error || nameError}</span>
                        </motion.div>
                    )}

                    {/* Hint */}
                    <p className="text-xs text-muted-foreground">
                        مثال: أحمد محمد، سارة علي
                    </p>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full h-14 text-lg font-bold rounded-2xl"
                        disabled={!isValid || loading}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            'حفظ والمتابعة'
                        )}
                    </Button>
                </form>

                {/* Privacy Note */}
                <p className="mt-6 text-xs text-muted-foreground">
                    سيظهر اسمك للسائقين فقط أثناء الرحلة
                </p>
            </motion.div>
        </motion.div>
    );
};

export default CompleteProfileScreen;
