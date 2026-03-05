/**
 * ران — التصنيف المحلي الذكي (بدون GPT) — Shared Module
 * RAAN Smart Local Classifier — Handles common patterns without AI calls
 * يُستخدم من: whatsapp-webhook, telegram-ai-booking
 *
 * يوفّر ~60% من استدعاءات GPT-4o عبر معالجة:
 * - التحيات الشائعة
 * - الشكاوى المتكررة
 * - الوجهات المعروفة مباشرة
 * - الأسئلة المتكررة (FAQ)
 */

// ════════════════════════════════════════
// أنماط التحيات
// ════════════════════════════════════════
const GREETING_PATTERNS = [
  /^(مرحب|هلا|اهلا|أهلا|السلام|وعليكم|هلو|hello|hi|سلام|مساء|صباح)/i,
  /^(ران|raan|start|شلونك|كيفك|هاي)$/i,
];

// ════════════════════════════════════════
// أنماط الشكاوى
// ════════════════════════════════════════
const COMPLAINT_PATTERNS = [
  { pattern: /تأخر|تاخر|متأخر|وين الكابتن|اسرع|أسرع|بطيء|بطيئ/, icon: "🙏" },
  { pattern: /زعلان|متضايق|شكوى|اشتكي|مستاء/, icon: "😔" },
  { pattern: /سيء|سيئ|خراب|فشل|مو زين/, icon: "😞" },
];

const COMPLAINT_RESPONSES = [
  "حقك علينا أستاذ {name}، ثواني وأستعجل الكابتن، تدلل وما يصير خاطرك إلا طيب 🙏",
  "عيوني أستاذ {name}، نعتذر من هذا الشي. إن شاء الله ما يتكرر وحق تدلل 🙏",
  "على راسي أستاذ {name}، ملاحظتك مهمة عدنا ونشتغل عليها فوراً 💚",
];

// ════════════════════════════════════════
// الأسئلة المتكررة (FAQ)
// ════════════════════════════════════════
const FAQ_PATTERNS: Array<{ pattern: RegExp; response: string }> = [
  {
    pattern: /كم السع|شكد|سعر|اسعار|أسعار|كلفة|تكلفة/,
    response: "أسعارنا تبدأ من 2,000 دينار عراقي + 1,000 دينار لكل كيلومتر 💰\n\nللحجز دز موقعك وبنحسبلك السعر بالضبط! 📍",
  },
  {
    pattern: /وين تخدم|منطقة الخدمة|تشتغل|وين تشتغل|نطاق/,
    response: "حالياً نخدم مدينة الرمادي وضواحيها وقضاء الفلوجة وهيت وحديثة 📍\n\nإن شاء الله بالقريب نتوسع أكثر! 🚀",
  },
  {
    pattern: /شنو ران|ران شنو|شنو هذا|شنو التطبيق|كيف استخدم|كيف أستخدم/,
    response: "ران هو تطبيق تكسي ذكي في الرمادي! 🚕\n\n1️⃣ دز موقعك\n2️⃣ كول وين تريد تروح\n3️⃣ أكد الرحلة\n4️⃣ الكابتن يوصلك!\n\nبسيطة وسهلة 😊",
  },
  {
    pattern: /دفع|طريقة الدفع|كاش|نقد|الكتروني|زين كاش/,
    response: "حالياً الدفع نقداً (كاش) للكابتن 💵\n\nقريباً إن شاء الله نضيف الدفع الإلكتروني 📱",
  },
  {
    pattern: /الغاء|إلغاء|كنسل|cancel/,
    response: "تكدر تلغي الرحلة بأي وقت قبل ما يوصل الكابتن ❌\n\nملاحظة: إذا الكابتن صار بالطريق، ممكن تنطبق غرامة إلغاء بسيطة ⚠️",
  },
  {
    pattern: /تقييم|تقيم|ريتنغ|نجوم/,
    response: "بعد كل رحلة تكدر تقيّم الكابتن من 1 إلى 5 نجوم ⭐\n\nتقييمك يساعدنا نحسّن الخدمة! 🙏",
  },
  {
    pattern: /شكرا|شكراً|مشكور|ممنون|الله يحفظ/,
    response: "العفو والله! 😊 إحنا بالخدمة دائماً. تدلل! 💚",
  },
];

// ════════════════════════════════════════
// أنماط الحجز المباشر (بدون GPT)
// ════════════════════════════════════════
const BOOKING_INTENT_PATTERNS = [
  /أريد أروح|اريد اروح|وديني|خذني|ودني|ابي اروح|ابغى اروح|يلا على|رحلة|حجز|احجز|أحجز|بوك/i,
  /^(لـ|ل |إلى |الى |على |ع )/i,
];

// ════════════════════════════════════════
// تصنيف سريع محلي
// ════════════════════════════════════════
export interface LocalClassification {
  handled: boolean;
  intent?: "greeting" | "complaint" | "inquiry" | "booking" | "thanks";
  reply?: string;
  destination_hint?: string | null;
}

export function classifyLocally(text: string, userName: string): LocalClassification {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. تحيات
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(lower)) {
      return { handled: true, intent: "greeting" };
    }
  }

  // 2. شكاوى
  for (const complaint of COMPLAINT_PATTERNS) {
    if (complaint.pattern.test(trimmed)) {
      const response = COMPLAINT_RESPONSES[Math.floor(Math.random() * COMPLAINT_RESPONSES.length)]
        .replace("{name}", userName);
      return { handled: true, intent: "complaint", reply: response };
    }
  }

  // 3. أسئلة متكررة
  for (const faq of FAQ_PATTERNS) {
    if (faq.pattern.test(trimmed)) {
      return { handled: true, intent: "inquiry", reply: faq.response };
    }
  }

  // 4. نية حجز واضحة (لا نرد — نطلب الموقع)
  for (const pattern of BOOKING_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      let hint: string | null = null;
      const match = trimmed.match(/(?:أريد أروح|اريد اروح|وديني|خذني|ودني|لـ|إلى|الى|على|ع)\s+(.+)/i);
      if (match) {
        hint = match[1].trim();
      }
      return { handled: true, intent: "booking", destination_hint: hint };
    }
  }

  // 5. لم يتم التصنيف محلياً
  return { handled: false };
}

// ════════════════════════════════════════
// Phase 5: استخراج نقطة الانطلاق والوجهة معاً (بدون GPT)
// يتعامل مع أنماط مثل "من X إلى Y" / "وديني من X لـ Y"
// ════════════════════════════════════════
export function extractPickupAndDropoff(text: string): { pickup: string; dropoff: string; vehicle_type: string } | null {
  const trimmed = text.trim();

  // إزالة بادئات الحجز الشائعة قبل استخراج "من X إلى Y"
  const cleaned = trimmed
    .replace(/^(أريد|اريد|ابي|ابغى|اريد)\s+(أروح|اروح)\s*/i, "")
    .replace(/^(وديني|خذني|ودني|خذوني|خلني اروح|يلا|رحلة|حجز)\s*/i, "")
    .trim();

  // مطابقة نمط "من X إلى/لـ Y"
  const pattern = /^(?:من|م)\s+(.+?)\s+(?:إلى|الى|لـ|ل|حتى|على)\s+(.+)$/i;
  const match = cleaned.match(pattern);

  if (match && match[1].trim().length >= 2 && match[2].trim().length >= 2) {
    let pickup = match[1].trim();
    let dropoff = match[2].trim();

    // اكتشاف نوع المركبة
    let vehicle_type = "economy";
    const combined = pickup + " " + dropoff;
    if (/فخم|فاخر|بريميوم|premium/i.test(combined)) { vehicle_type = "premium"; }
    else if (/مريح|كمفورت|comfort/i.test(combined)) { vehicle_type = "comfort"; }
    else if (/نسائي|بنات|women/i.test(combined)) { vehicle_type = "women_only"; }

    // تنظيف كلمات نوع المركبة من الأسماء
    const vehicleWords = /\s*(فخم|فاخر|بريميوم|premium|مريح|كمفورت|comfort|نسائي|بنات|women)\s*/gi;
    pickup = pickup.replace(vehicleWords, " ").trim();
    dropoff = dropoff.replace(vehicleWords, " ").trim();

    if (pickup.length >= 2 && dropoff.length >= 2) {
      return { pickup, dropoff, vehicle_type };
    }
  }

  return null;
}

// ════════════════════════════════════════
// استخراج الوجهة المباشرة (بدون GPT)
// ════════════════════════════════════════
export function extractDirectDestination(text: string): { destination: string; vehicle_type: string } | null {
  const trimmed = text.trim();

  const prefixes = [
    /^(أريد أروح|اريد اروح|وديني|خذني|ودني|ابي اروح|يلا على|خلني اروح)\s+(لـ|ل|إلى|الى|على|ع)?\s*/i,
    /^(لـ|ل |إلى |الى |على |ع )\s*/i,
    /^(رحلة|حجز)\s+(لـ|ل|إلى|الى|على|ع)?\s*/i,
  ];

  let destination = trimmed;
  for (const prefix of prefixes) {
    destination = destination.replace(prefix, "").trim();
  }

  if (destination.length < 2) return null;

  let vehicle_type = "economy";
  if (/فخم|فاخر|بريميوم|premium/i.test(destination)) {
    vehicle_type = "premium";
    destination = destination.replace(/فخم|فاخر|بريميوم|premium/gi, "").trim();
  } else if (/مريح|كمفورت|comfort/i.test(destination)) {
    vehicle_type = "comfort";
    destination = destination.replace(/مريح|كمفورت|comfort/gi, "").trim();
  } else if (/نسائي|بنات|women/i.test(destination)) {
    vehicle_type = "women_only";
    destination = destination.replace(/نسائي|بنات|women/gi, "").trim();
  }

  if (destination.length < 2) return null;

  return { destination, vehicle_type };
}
