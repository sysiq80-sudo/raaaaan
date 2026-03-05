/**
 * ران — قاعدة بيانات أماكن الرمادي المحلية
 * RAAN Local Landmarks Database — Shared Module
 * يُستخدم من كل الـ webhooks: whatsapp, telegram, sms
 */

// ════════════════════════════════════════
// واجهة الموقع المُحلّل
// ════════════════════════════════════════
export interface ResolvedLocation {
  lat: number;
  lng: number;
  address: string;
}

// ════════════════════════════════════════
// قاعدة بيانات أماكن الرمادي المحلية
// ════════════════════════════════════════
export const RAMADI_LANDMARKS: Record<string, { lat: number; lng: number; address: string; aliases: string[] }> = {
  "جامعة الأنبار": { lat: 33.4350, lng: 43.2650, address: "جامعة الأنبار، الرمادي", aliases: ["جامعة الانبار", "الجامعة", "جامعة انبار", "university of anbar", "جامعة"] },
  "مستشفى الرمادي التعليمي": { lat: 33.4280, lng: 43.3050, address: "مستشفى الرمادي التعليمي", aliases: ["المستشفى", "مستشفى الرمادي", "المستشفى التعليمي", "رمادي تعليمي"] },
  "دائرة صحة الأنبار": { lat: 33.4260, lng: 43.3010, address: "دائرة صحة الأنبار، الرمادي", aliases: ["صحة الانبار", "دائرة الصحة", "صحة الأنبار"] },
  "حي التأميم": { lat: 33.4350, lng: 43.3100, address: "حي التأميم، الرمادي", aliases: ["التأميم", "تأميم", "التاميم", "تاميم"] },
  "حي الحوز": { lat: 33.4200, lng: 43.3150, address: "حي الحوز، الرمادي", aliases: ["الحوز", "حوز"] },
  "حي الملعب": { lat: 33.4300, lng: 43.2900, address: "حي الملعب، الرمادي", aliases: ["الملعب", "ملعب الرمادي", "ملعب"] },
  "حي الضباط": { lat: 33.4150, lng: 43.2850, address: "حي الضباط، الرمادي", aliases: ["الضباط", "ضباط"] },
  "حي العزيزية": { lat: 33.4180, lng: 43.3200, address: "حي العزيزية، الرمادي", aliases: ["العزيزية", "عزيزية"] },
  "حي 5 كيلو": { lat: 33.4100, lng: 43.2750, address: "حي خمسة كيلو، الرمادي", aliases: ["5 كيلو", "خمسة كيلو", "خمس كيلو", "٥ كيلو", "5كيلو", "خمسه كيلو"] },
  "حي العشرين": { lat: 33.4220, lng: 43.2800, address: "حي العشرين، الرمادي", aliases: ["العشرين", "عشرين"] },
  "حي البكر": { lat: 33.4280, lng: 43.2950, address: "حي البكر، الرمادي", aliases: ["البكر", "بكر"] },
  "حي الورار": { lat: 33.4320, lng: 43.3200, address: "حي الورار، الرمادي", aliases: ["الورار", "ورار"] },
  "حي السلام": { lat: 33.4250, lng: 43.2700, address: "حي السلام، الرمادي", aliases: ["السلام", "سلام"] },
  "تقاطع الزيوت": { lat: 33.4240, lng: 43.3000, address: "تقاطع الزيوت، الرمادي", aliases: ["الزيوت", "زيوت", "تقاطع زيوت"] },
  "شارع المستودع": { lat: 33.4200, lng: 43.2950, address: "شارع المستودع، الرمادي", aliases: ["المستودع", "مستودع"] },
  "الشارع العام": { lat: 33.4230, lng: 43.3000, address: "الشارع العام، الرمادي", aliases: ["شارع عام"] },
  "السوق المركزي": { lat: 33.4235, lng: 43.3020, address: "السوق المركزي، الرمادي", aliases: ["السوق", "سوق الرمادي", "سوق مركزي"] },
  "البوعلوان": { lat: 33.4400, lng: 43.2800, address: "البوعلوان، الرمادي", aliases: ["بوعلوان", "بو علوان"] },
  "حي المعلمين": { lat: 33.4150, lng: 43.3050, address: "حي المعلمين، الرمادي", aliases: ["المعلمين", "معلمين"] },
  "حي الأندلس": { lat: 33.4100, lng: 43.3100, address: "حي الأندلس، الرمادي", aliases: ["الأندلس", "الاندلس", "أندلس", "اندلس"] },
  "الجسر الحديدي": { lat: 33.4230, lng: 43.3080, address: "الجسر الحديدي، الرمادي", aliases: ["جسر حديدي", "الجسر"] },
  "مبنى المحافظة": { lat: 33.4240, lng: 43.3040, address: "مبنى المحافظة، الرمادي", aliases: ["المحافظة", "محافظة الأنبار", "محافظة الانبار", "محافظة"] },
  "حي الثيلة": { lat: 33.4300, lng: 43.3150, address: "حي الثيلة، الرمادي", aliases: ["الثيلة", "ثيلة"] },
  "حي القطانة": { lat: 33.4270, lng: 43.3180, address: "حي القطانة، الرمادي", aliases: ["القطانة", "قطانة"] },
  "حي السفحة": { lat: 33.4350, lng: 43.3050, address: "حي السفحة، الرمادي", aliases: ["السفحة", "سفحة"] },
  "حي البوذياب": { lat: 33.4380, lng: 43.2900, address: "حي البوذياب، الرمادي", aliases: ["البوذياب", "بوذياب", "بو ذياب"] },
  "شارع 60": { lat: 33.4200, lng: 43.2700, address: "شارع 60، الرمادي", aliases: ["شارع ستين", "ستين"] },
  "شارع فلسطين": { lat: 33.4250, lng: 43.2950, address: "شارع فلسطين، الرمادي", aliases: ["فلسطين"] },
  "حي الروضة": { lat: 33.4180, lng: 43.2900, address: "حي الروضة، الرمادي", aliases: ["الروضة", "روضة"] },
  "حي الجزيرة": { lat: 33.4300, lng: 43.2800, address: "حي الجزيرة، الرمادي", aliases: ["الجزيرة", "جزيرة"] },
  "مكتب الرؤية": { lat: 33.4230, lng: 43.3010, address: "مكتب الرؤية، الرمادي", aliases: ["الرؤية", "رؤية", "مكتب رؤية"] },
  "حي التقدم": { lat: 33.4100, lng: 43.2650, address: "حي التقدم، الرمادي", aliases: ["التقدم", "تقدم"] },
  "حي الطيران": { lat: 33.4050, lng: 43.2800, address: "حي الطيران، الرمادي", aliases: ["الطيران", "طيران"] },
  "حي الصوفية": { lat: 33.4280, lng: 43.3100, address: "حي الصوفية، الرمادي", aliases: ["الصوفية", "صوفية"] },
  "حي الجمهوري": { lat: 33.4210, lng: 43.3060, address: "حي الجمهوري، الرمادي", aliases: ["الجمهوري", "جمهوري"] },
  "حي الشرطة": { lat: 33.4190, lng: 43.2980, address: "حي الشرطة، الرمادي", aliases: ["الشرطة", "شرطة"] },
  "حي المعاضيد": { lat: 33.4330, lng: 43.2970, address: "حي المعاضيد، الرمادي", aliases: ["المعاضيد", "معاضيد"] },
  "مجمع ران التجاري": { lat: 33.4225, lng: 43.2990, address: "مجمع ران التجاري، الرمادي", aliases: ["مجمع ران", "ران التجاري"] },
  "قضاء الفلوجة": { lat: 33.3530, lng: 43.7830, address: "الفلوجة، الأنبار", aliases: ["الفلوجة", "فلوجة"] },
  "قضاء هيت": { lat: 33.6390, lng: 42.8270, address: "هيت، الأنبار", aliases: ["هيت"] },
  "قضاء حديثة": { lat: 34.1370, lng: 42.3790, address: "حديثة، الأنبار", aliases: ["حديثة"] },
};

// ════════════════════════════════════════
// مطابقة المعالم المحلية
// ════════════════════════════════════════
export function matchLocalLandmark(query: string): ResolvedLocation | null {
  const q = query.trim().toLowerCase().replace(/[.,،\-_]/g, "");

  // مطابقة مباشرة
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    if (q === name.toLowerCase() || q === name.toLowerCase().replace("حي ", "")) {
      console.log(`[geocode] LOCAL MATCH (exact): "${query}" → ${name}`);
      return { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
  }

  // مطابقة بالاسماء البديلة
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    for (const alias of loc.aliases) {
      if (q === alias.toLowerCase() || q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) {
        console.log(`[geocode] LOCAL MATCH (alias "${alias}"): "${query}" → ${name}`);
        return { lat: loc.lat, lng: loc.lng, address: loc.address };
      }
    }
  }

  // مطابقة جزئية بالكلمات
  const words = q.split(/\s+/).filter((w: string) => w.length > 2);
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    const nameLower = name.toLowerCase();
    const allAliases = [nameLower, ...loc.aliases.map((a: string) => a.toLowerCase())];
    for (const target of allAliases) {
      if (words.every((w: string) => target.includes(w))) {
        console.log(`[geocode] LOCAL MATCH (partial): "${query}" → ${name}`);
        return { lat: loc.lat, lng: loc.lng, address: loc.address };
      }
    }
  }

  return null;
}
