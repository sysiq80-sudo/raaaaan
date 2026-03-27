## ران - Phase 4 & 5 Planning

### المراحل المتبقية

---

## Phase 4️⃣ - UI Polish & RTL (1-2 ساعات)

### 4.1 تحسينات RTL الشاملة

#### أ) تعديلات CSS الأساسية

```css
/* في index.css أو tailwind.config.ts */
html {
  direction: rtl;
  text-direction: rtl;
}

/* عكس الـ margins و paddings حيث لزم */
.ml-4 {
  margin-left: 1rem;
} /* RTL: يصبح margin-right */
.mr-4 {
  margin-right: 1rem;
} /* RTL: يصبح margin-left */
.text-left {
  text-align: right;
}
.text-right {
  text-align: left;
}
```

#### ب) مكونات بحاجة تحديث

- [ ] GoPage.tsx: Flip map controls، search input
- [ ] RideWaitingScreen.tsx: Driver card layout
- [ ] DriverHome.tsx: Navigation drawer
- [ ] Admin pages: Sidebar ← Right side

#### ج) مكتبات RTL

- shadcn/ui: دعم RTL مدمج ✓
- Tailwind: يدعم RTL عبر `ltr:` و `rtl:` prefixes
- Framer Motion: compatible مع RTL

### 4.2 Arabic Typography

لننشئ `src/styles/typography.css`:

```css
@font-face {
  font-family: "Cairo";
  src: url("/fonts/Cairo-Regular.woff2") format("woff2");
  font-weight: 400;
}

@font-face {
  font-family: "Cairo";
  src: url("/fonts/Cairo-Bold.woff2") format("woff2");
  font-weight: 700;
}

body {
  font-family:
    "Cairo",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI";
  font-size: 16px;
  line-height: 1.6; /* زيادة line-height للنصوص العربية */
  letter-spacing: 0.3px;
}

h1,
h2,
h3 {
  line-height: 1.4;
  font-weight: 700;
}

p {
  text-align: justify; /* محاذاة النصوص الطويلة */
}
```

**الخطوط المقترحة:**

- Cairo (Headings + Body)
- Tajawal (Alternative)
- GE Dinar One (Premium feel)

### 4.3 Admin AI Assistant

**الملف:** `src/components/admin/AIAssistant.tsx`

```typescript
interface AdminAIAssistant {
  // يستقبل تذاكر الدعم
  ticketId: string;
  issue: string;
  logs: string[];

  // يرسل اقتراحات الحل
  suggestedSolution: string;
  estimatedResolutionTime: number;
  confidenceScore: number; // 0-100
}
```

**الخطوات:**

1. استقبل تذكرة دعم من open tickets
2. اجمع context: logs, user info, ride history
3. أرسل لـ OpenAI API: "قدم حل لهذه المشكلة"
4. عرض الحل مع زر "نسخ" و "أرسل للمستخدم"

**API Integration:**

```typescript
const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_KEY });

const suggestFix = async (issue: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "user",
        content: `أنت دعم فني متخصص في تطبيق التاكسي. اقترح حل لـ: "${issue}"`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });
  return response.choices[0].message.content;
};
```

### 4.4 i18n (Localization)

**الملف:** `src/lib/i18n.ts`

```typescript
type Language = 'ar' | 'en' | 'ku';

export const translations = {
  ar: { /* نصوص عربية */ },
  en: { /* English text */ },
  ku: { /* کردی متن */ },
};

export const useTranslation = (lang: Language = 'ar') => {
  return (key: string) => translations[lang][key];
};

// استخدام:
const t = useTranslation('ar');
<h1>{t('ride.waitingForDriver')}</h1>
```

---

## Phase 5️⃣ - Security & Stability (1.5-2 ساعات)

### 5.1 MFA (Multi-Factor Authentication)

**الملف:** `src/hooks/usePhoneVerificationMFA.ts`

```typescript
export const usePhoneVerificationMFA = (userId: string) => {
  // الخطوة 1: طلب OTP
  const requestOTP = async (phone: string) => {
    const { error } = await supabase.functions.invoke("send-otp", {
      body: { phone, userId },
    });
    return { error };
  };

  // الخطوة 2: التحقق
  const verifyOTP = async (code: string) => {
    const { data, error } = await supabase.rpc("verify_otp", {
      p_user_id: userId,
      p_code: code,
    });
    return { isValid: data?.valid, error };
  };

  // TOTP Backup Codes
  const generateBackupCodes = async () => {
    const codes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 8).toUpperCase(),
    );
    // احفظها في DB
    return codes;
  };

  return { requestOTP, verifyOTP, generateBackupCodes };
};
```

**SMS Service** (استخدم Twilio أو similiar):

```typescript
// supabase/functions/send-otp/index.ts
export const sendOTP = async (phone: string, code: string) => {
  const client = new Twilio(account_sid, auth_token);
  await client.messages.create({
    body: `رمز التحقق الخاص بك: ${code}`,
    from: "+1234567890",
    to: phone,
  });
};
```

### 5.2 Advanced Error Boundaries

**مستويات الخطأ:**

- `component`: Card-level fallback
- `page`: Full-page error screen
- `critical`: App-wide crash handler

```typescript
<ErrorBoundary level="page" onError={reportToSentry}>
  <GoPage />
</ErrorBoundary>

<ErrorBoundary level="component">
  <RideWaitingScreen />
</ErrorBoundary>
```

**Error Reporting:**

```typescript
const reportToSentry = (error: Error, info: ErrorInfo) => {
  Sentry.captureException(error, {
    contexts: {
      react: { componentStack: info.componentStack },
    },
  });
};
```

### 5.3 Rate Limiting

**في Supabase:**

```sql
-- Prevent brute-force
CREATE POLICY "rate_limit_auth" ON auth.users
FOR SELECT
USING (auth.uid() = id);

-- Trigger لتسجيل محاولات الدخول
CREATE TABLE auth_attempts (
  id UUID PRIMARY KEY,
  user_id UUID,
  ip_address INET,
  timestamp TIMESTAMP DEFAULT NOW(),
  success BOOLEAN
);

CREATE TRIGGER log_auth_attempt
AFTER INSERT ON auth_attempts
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM auth_attempts
      WHERE ip_address = NEW.ip_address
      AND timestamp > NOW() - INTERVAL '15 minutes') > 5
THEN raise_exception('Too many attempts');
```

**في Edge Functions:**

```typescript
// Rate limit per IP/User
const rateLimit = new Map<string, { count: number; reset: number }>();

const checkRateLimit = (
  key: string,
  limit: number = 10,
  window: number = 60000,
) => {
  const now = Date.now();
  const entry = rateLimit.get(key);

  if (!entry || now > entry.reset) {
    rateLimit.set(key, { count: 1, reset: now + window });
    return true;
  }

  if (entry.count < limit) {
    entry.count++;
    return true;
  }

  return false;
};
```

### 5.4 Input Sanitization

```typescript
// src/lib/sanitization.ts
import DOMPurify from "dompurify";

export const sanitizeText = (text: string): string => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
};

export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html);
};

// Zod validation for all inputs
import { z } from "zod";

const CreateRideSchema = z.object({
  pickup_address: z.string().min(3).max(255),
  dropoff_address: z.string().min(3).max(255),
  vehicle_type: z.enum(["economy", "comfort", "premium", "women_only"]),
  stops: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        address: z.string().min(1).max(255),
      }),
    )
    .optional(),
});

export const validateRideCreation = (data: unknown) => {
  return CreateRideSchema.parse(data);
};
```

### 5.5 Session Management

```typescript
// تحديد مدة الـ session
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 دقيقة

export const useSessionTimeout = () => {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      localStorage.removeItem("session");
      navigate("/login");
    }, SESSION_TIMEOUT);
  }, []);

  // استمع لأي activity
  useEffect(() => {
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
    };
  }, [resetTimer]);
};
```

---

## خطة التنفيذ المقترحة

### Week 1 (Phase 4):

- **Day 1**: RTL CSS + Typography setup
- **Day 2**: Admin AI Assistant integration
- **Day 3**: i18n implementation + testing

### Week 2 (Phase 5):

- **Day 1**: MFA + Phone verification
- **Day 2**: Error Boundaries + Sentry
- **Day 3**: Rate limiting + Input sanitization

---

## الموارد المطلوبة

### APIs:

- OpenAI API (Admin AI): ~$0.01/request
- Twilio (SMS OTP): ~$0.0075/SMS
- Sentry (Error tracking): Free tier كافي

### Libraries:

```json
{
  "openai": "^4.x",
  "twilio": "^4.x",
  "dompurify": "^3.x",
  "zod": "^3.x",
  "@sentry/react": "^7.x"
}
```

### Environment Variables:

```env
VITE_OPENAI_KEY=sk-...
VITE_TWILIO_ACCOUNT_SID=...
VITE_TWILIO_AUTH_TOKEN=...
SENTRY_DSN=...
```

---

## ملاحظات مهمة

### ⚠️ RTL Considerations:

- تأكد من أن جميع animations تحترم direction
- اختبر على جميع العناصر (inputs, modals, popovers)
- تأكد من أن icons تُعكس حيث لزم (left arrow ← becomes right arrow →)

### 🔒 Security Best Practices:

- **لا تخزن** أي PII في localStorage
- **استخدم** HTTPS فقط للـ API calls
- **فعّل** CORS على الـ Edge Functions
- **راقب** failed auth attempts

### 📱 Mobile Considerations:

- Phone input مع country code selector
- SMS delivery reliability in Iraq
- Screen reader compatibility للـ RTL

---

## الخلاصة

✅ **Phase 3** اكتمل بنجاح
⏳ **Phase 4 & 5** جاهزة للتطبيق دون توقف
🚀 **Timeline**: 4-5 أيام عمل
