import { z } from "zod";

// Iraqi phone number regex (07xxxxxxxxx or +9647xxxxxxxxx)
const iraqiPhoneRegex = /^(\+964|0)?7[3-9]\d{8}$/;

// Common validation messages in Arabic
export const validationMessages = {
  required: "هذا الحقل مطلوب",
  invalidEmail: "البريد الإلكتروني غير صحيح",
  invalidPhone: "رقم الهاتف غير صحيح (07xxxxxxxxx)",
  passwordMin: "كلمة المرور يجب أن تكون 8 أحرف على الأقل، مع رقم وحرف",
  nameMin: "الاسم يجب أن يكون 3 أحرف على الأقل",
  nameMax: "الاسم يجب أن يكون أقل من 100 حرف",
};

// Phone number schema
export const phoneSchema = z
  .string()
  .min(1, validationMessages.required)
  .regex(iraqiPhoneRegex, validationMessages.invalidPhone);

// Email schema
export const emailSchema = z
  .string()
  .min(1, validationMessages.required)
  .email(validationMessages.invalidEmail)
  .max(255);

// Password schema — 8+ أحرف مع رقم واحد على الأقل وحرف واحد
export const passwordSchema = z
  .string()
  .min(8, validationMessages.passwordMin)
  .regex(/[A-Za-z\u0600-\u06FF]/, "يجب أن تحتوي على حرف واحد على الأقل")
  .regex(/[0-9]/, "يجب أن تحتوي على رقم واحد على الأقل");

// دالة مساعدة للتحقق من كلمة المرور (تُستخدم في الصفحات)
export const validatePassword = (password: string): string | null => {
  if (!password || password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (!/[0-9]/.test(password)) return "يجب أن تحتوي على رقم واحد على الأقل";
  if (!/[A-Za-z\u0600-\u06FF]/.test(password)) return "يجب أن تحتوي على حرف واحد على الأقل";
  return null;
};

// Full name schema
export const fullNameSchema = z
  .string()
  .min(3, validationMessages.nameMin)
  .max(100, validationMessages.nameMax);

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, validationMessages.required),
});

// Email signup schema
export const emailSignupSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

// Phone signup schema
export const phoneSignupSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
});

// مدن الأنبار
export const ANBAR_CITIES = [
  'الرمادي',
  'الفلوجة',
  'الحبانية',
  'الصقلاوية',
  'الكرمة',
  'هيت',
  'عانة',
  'راوة',
  'حديثة',
  'القائم',
  'العامرية',
  'البغدادي',
  'النخيب',
  'الرمانة'
] as const;

// Driver registration schema (step 2 - personal info)
export const driverPersonalInfoSchema = z.object({
  fullName: z.string()
    .min(1, "يرجى إدخال الاسم")
    .refine((val) => val.trim().split(' ').length >= 3, {
      message: "يرجى إدخال الاسم الثلاثي كاملاً (الاسم الأول، اسم الأب، اسم الجد)"
    })
    .refine((val) => val.length <= 100, {
      message: "الاسم طويل جداً"
    }),
  phone: phoneSchema,
  gender: z.enum(['male', 'female'], {
    required_error: "يرجى اختيار الجنس"
  }),
  email: z.string().email(validationMessages.invalidEmail).optional().or(z.literal('')),
  workCity: z.enum(ANBAR_CITIES, {
    required_error: "يرجى اختيار مدينة العمل"
  }),
});

// Driver password schema
export const driverPasswordSchema = z.object({
  password: z.string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .max(50, "كلمة المرور طويلة جداً")
    .regex(/[A-Za-z\u0600-\u06FF]/, "يجب أن تحتوي على حرف واحد على الأقل")
    .regex(/[0-9]/, "يجب أن تحتوي على رقم واحد على الأقل"),
  confirmPassword: z.string().min(1, "يرجى تأكيد كلمة المرور"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

// Driver vehicle info schema
export const driverVehicleInfoSchema = z.object({
  vehicleType: z.enum(["economy", "comfort", "premium", "women_only"]),
  vehicleModel: z.string()
    .min(1, "يرجى إدخال موديل السيارة")
    .max(100, "موديل السيارة طويل جداً"),
  vehicleColor: z.string()
    .min(1, "يرجى إدخال لون السيارة")
    .max(50, "لون السيارة طويل جداً"),
  vehiclePlate: z.string()
    .min(1, "يرجى إدخال رقم اللوحة")
    .max(20, "رقم اللوحة طويل جداً"),
});

// Driver email account schema
export const driverEmailAccountSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Admin login schema
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, validationMessages.required),
});

// Helper function to format phone for display
export const formatPhoneDisplay = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('964')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

// Helper function to convert fake email to phone number
export const formatEmailToPhone = (email: string | undefined | null): string => {
  if (!email) return '';

  // Check if it's a fake email from phone number
  if (email.endsWith('@raan.app')) {
    const phoneNumber = email.replace('@raan.app', '');
    // Format as 0XXX-XXX-XXXX
    if (phoneNumber.length === 11 && phoneNumber.startsWith('0')) {
      return `${phoneNumber.slice(0, 4)}-${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7)}`;
    }
    // Format numbers starting with 964
    if (phoneNumber.length === 12 && phoneNumber.startsWith('964')) {
      return `+${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 5)}-${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8)}`;
    }
    return phoneNumber;
  }

  return email;
};

// Helper function to normalize Iraqi phone number
export const normalizeIraqiPhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');

  // Remove leading 964 if present
  if (cleaned.startsWith('964')) {
    cleaned = '0' + cleaned.slice(3);
  }

  // Add leading 0 if not present
  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
};

export type LoginFormData = z.infer<typeof loginSchema>;
export type EmailSignupFormData = z.infer<typeof emailSignupSchema>;
export type PhoneSignupFormData = z.infer<typeof phoneSignupSchema>;
export type DriverPersonalInfoData = z.infer<typeof driverPersonalInfoSchema>;
export type DriverPasswordData = z.infer<typeof driverPasswordSchema>;
export type DriverVehicleInfoData = z.infer<typeof driverVehicleInfoSchema>;
export type DriverEmailAccountData = z.infer<typeof driverEmailAccountSchema>;
export type AdminLoginData = z.infer<typeof adminLoginSchema>;
