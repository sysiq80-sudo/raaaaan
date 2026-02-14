import DOMPurify from "dompurify";
import { z } from "zod";

// Input sanitization configuration
export const SANITIZATION_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
  ],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
};

// Text sanitization functions
export const sanitizeText = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  // Remove null bytes and other dangerous characters
  let sanitized = input.replace(/\0/g, "");

  // Remove potential script injections
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=/gi, "");

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  return sanitized;
};

export const sanitizeHtml = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  try {
    return DOMPurify.sanitize(input, SANITIZATION_CONFIG);
  } catch (error) {
    console.error("[Sanitization] HTML sanitization failed:", error);
    return sanitizeText(input);
  }
};

export const sanitizeEmail = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  const sanitized = sanitizeText(input).toLowerCase();

  // Basic email validation and sanitization
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error("Invalid email format");
  }

  return sanitized;
};

export const sanitizePhoneNumber = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  // Remove all non-digit characters except + at the beginning
  let sanitized = input.replace(/(?!^[\+])\D/g, "");

  // Ensure it starts with + or country code
  if (!sanitized.startsWith("+")) {
    // Assume Iraqi number if no country code
    if (sanitized.startsWith("0")) {
      sanitized = "+964" + sanitized.substring(1);
    } else {
      sanitized = "+964" + sanitized;
    }
  }

  // Validate length (Iraqi numbers are typically 10-13 digits with country code)
  const digitsOnly = sanitized.replace(/\D/g, "");
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    throw new Error("Invalid phone number length");
  }

  return sanitized;
};

export const sanitizeNumeric = (
  input: string | number,
  options: { min?: number; max?: number; decimals?: number } = {},
): number => {
  let num: number;

  if (typeof input === "string") {
    // Remove all non-numeric characters except decimal point and minus
    const sanitized = input.replace(/[^-0-9.]/g, "");
    num = parseFloat(sanitized);
  } else {
    num = input;
  }

  if (isNaN(num)) {
    throw new Error("Invalid numeric value");
  }

  // Apply constraints
  if (options.min !== undefined && num < options.min) {
    throw new Error(`Value must be at least ${options.min}`);
  }

  if (options.max !== undefined && num > options.max) {
    throw new Error(`Value must be at most ${options.max}`);
  }

  if (options.decimals !== undefined) {
    num = parseFloat(num.toFixed(options.decimals));
  }

  return num;
};

export const sanitizeAlphanumeric = (
  input: string,
  options: { allowSpaces?: boolean; allowSpecial?: string[] } = {},
): string => {
  if (!input || typeof input !== "string") return "";

  let sanitized = input;

  if (!options.allowSpaces) {
    sanitized = sanitized.replace(/\s/g, "");
  }

  // Remove non-alphanumeric characters
  const allowedSpecial = options.allowSpecial
    ? options.allowSpecial.join("")
    : "";
  const regex = new RegExp(
    `[^a-zA-Z0-9${options.allowSpaces ? "\\s" : ""}${allowedSpecial}]`,
    "g",
  );
  sanitized = sanitized.replace(regex, "");

  return sanitized;
};

// Validation schemas using Zod
export const validationSchemas = {
  // User registration/login
  email: z
    .string()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("البريد الإلكتروني غير صحيح")
    .transform(sanitizeEmail),

  password: z
    .string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .max(128, "كلمة المرور طويلة جداً")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم",
    ),

  phoneNumber: z
    .string()
    .min(1, "رقم الهاتف مطلوب")
    .transform(sanitizePhoneNumber)
    .refine((val) => val.length >= 10, "رقم الهاتف غير صحيح"),

  // Names and text fields
  name: z
    .string()
    .min(2, "الاسم يجب أن يكون حرفين على الأقل")
    .max(50, "الاسم طويل جداً")
    .transform(sanitizeText)
    .refine((val) => val.length > 0, "الاسم مطلوب"),

  description: z.string().max(500, "الوصف طويل جداً").transform(sanitizeText),

  // Location and addresses
  address: z
    .string()
    .min(5, "العنوان قصير جداً")
    .max(200, "العنوان طويل جداً")
    .transform(sanitizeText),

  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),

  // Ride booking
  rideRequest: z.object({
    pickupLocation: z.string().min(3).max(200).transform(sanitizeText),
    dropoffLocation: z.string().min(3).max(200).transform(sanitizeText),
    vehicleType: z.enum(["economy", "comfort", "premium", "women_only"]),
    paymentMethod: z.enum(["cash", "card", "wallet"]),
    notes: z.string().max(200).transform(sanitizeText).optional(),
  }),

  // Fare calculation
  fare: z.object({
    baseFare: z.number().min(0).max(1000),
    distance: z.number().min(0).max(1000),
    duration: z.number().min(0).max(1440), // 24 hours in minutes
    surgeMultiplier: z.number().min(1).max(2),
  }),

  // Admin inputs
  adminNote: z
    .string()
    .max(1000, "الملاحظة طويلة جداً")
    .transform(sanitizeText),

  // Search and filter inputs
  searchQuery: z
    .string()
    .max(100, "استعلام البحث طويل جداً")
    .transform(sanitizeText),

  // File uploads
  fileName: z
    .string()
    .max(255, "اسم الملف طويل جداً")
    .transform((val) =>
      sanitizeAlphanumeric(val, { allowSpecial: [".", "-", "_"] }),
    ),

  // OTP and verification codes
  otp: z
    .string()
    .length(6, "رمز التحقق يجب أن يكون 6 أرقام")
    .regex(/^\d{6}$/, "رمز التحقق يجب أن يحتوي على أرقام فقط"),

  // Monetary values
  amount: z
    .number()
    .min(0, "المبلغ يجب أن يكون موجباً")
    .max(1000000, "المبلغ كبير جداً")
    .transform((val) =>
      sanitizeNumeric(val, { min: 0, max: 1000000, decimals: 2 }),
    ),

  // Ratings
  rating: z
    .number()
    .min(1, "التقييم يجب أن يكون 1 على الأقل")
    .max(5, "التقييم يجب أن يكون 5 على الأكثر")
    .transform((val) => Math.round(val)),

  // IDs and references
  uuid: z.string().uuid("معرف غير صحيح"),

  id: z
    .string()
    .min(1, "المعرف مطلوب")
    .max(50, "المعرف طويل جداً")
    .transform(sanitizeAlphanumeric),
};

// Input sanitization wrapper for forms
export const sanitizeFormInput = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodError } => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
};

// XSS protection for dynamic content
export const sanitizeDynamicContent = (
  content: string,
  allowHtml: boolean = false,
): string => {
  if (allowHtml) {
    return sanitizeHtml(content);
  }
  return sanitizeText(content);
};

// SQL injection protection (additional layer)
export const sanitizeForDatabase = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  // Remove SQL injection patterns
  const sanitized = input
    .replace(/'/g, "''") // Escape single quotes for SQL
    .replace(/;/g, "") // Remove semicolons
    .replace(/--/g, "") // Remove SQL comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

  return sanitizeText(sanitized);
};

// URL sanitization
export const sanitizeUrl = (input: string): string => {
  if (!input || typeof input !== "string") return "";

  try {
    const url = new URL(input);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }

    // Sanitize the URL string
    return url.toString();
  } catch (error) {
    throw new Error("Invalid URL format");
  }
};

// Batch sanitization for arrays
export const sanitizeArray = <T>(
  items: T[],
  sanitizer: (item: T) => T,
): T[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    try {
      return sanitizer(item);
    } catch (error) {
      console.error("[Sanitization] Error sanitizing array item:", error);
      return item; // Return original if sanitization fails
    }
  });
};

// Validation error formatter for UI
export const formatValidationErrors = (
  errors: z.ZodError,
): Record<string, string> => {
  const formatted: Record<string, string> = {};

  errors.errors.forEach((error) => {
    const path = error.path.join(".");
    formatted[path] = error.message;
  });

  return formatted;
};

// Security audit logging
export const logSecurityEvent = (
  event: string,
  details: Record<string, any>,
  severity: "low" | "medium" | "high" = "low",
) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    details,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  console.warn(`[Security:${severity.toUpperCase()}]`, logEntry);

  // In production, this would send to a security monitoring service
  if (severity === "high") {
    // Send to security team or monitoring service
    // This could integrate with services like Datadog, Splunk, etc.
  }
};
