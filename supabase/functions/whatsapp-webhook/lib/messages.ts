/**
 * ران — قوالب الرسائل العربية
 * RAAN WhatsApp Arabic Message Templates
 */

export const MESSAGES = {
  welcome: `هلا بيك عميلنا العزيز! 🚕\nعلمود نحسب لك السعر المضبوط، دز لنا موقعك الحالي بالضغط على الزر الموجود جوة هذه الرسالة 👇`,

  welcomeMenu: (name: string) =>
    `أهلاً بك أستاذ ${name} في تكسي ران! 🚕\nشلون نكدر نخدمك اليوم؟`,

  inquiryPrompt: (name: string) =>
    `تفضل أستاذ ${name}، اسأل أي سؤال أو اكتب شكواك وإن شاء الله نساعدك 🙏`,

  askForLocation: (name: string) =>
    `على راسي أستاذ ${name}! 🚕\nعلمود نحسب لك السعر المضبوط، دز لنا موقعك الحالي بالضغط على الزر الموجود جوة هذه الرسالة 👇`,

  locationReceived: (address: string, name?: string) =>
    `✅ عاشت ايدك${name ? ` أستاذ ${name}` : ""}, حددنا مكانك في: 📍 ${address}\n\nهسة دز رسالة صوتية 🎙️ وكول وين تريد تروح؟\nأو اكتب اسم الوجهة بالنص.`,

  needLocationFirst: `عفواً، لازم تدز موقعك أول شي! 📍\nاضغط على الزر أدناه لمشاركة موقعك 👇`,

  needLocationWithButton: (name?: string) =>
    `عفواً${name ? ` أستاذ ${name}` : ""}, لازم تدز موقعك أول شي! 📍\nاضغط على الزر أدناه لمشاركة موقعك 👇`,

  processing: "جاري تحليل طلبك... 🤖",

  noTranscript: "❌ ما كدرت أفهم الصوت. جرب مرة ثانية بصوت أوضح.",

  noDestination: `❌ ما فهمت الوجهة. كول مثلاً:\n"أريد أروح لجامعة الأنبار"\nأو اكتبها بالنص.`,

  geocodeFailed: (place: string, name?: string) =>
    `على راسي${name ? ` أستاذ ${name}` : ""}, بس ما كدرت ألاقي "${place}" على الخريطة 🗺️\nيا ريت تنطيني أقرب نقطة دالة أو تضغط على زر إرسال الموقع حتى الكابتن يوصلك للباب بدون تأخير 🙏`,

  confirmationPrompt: (origin: string, destination: string, fare: number, distanceKm: number) =>
    `🚕 *تأكيد الرحلة*\n\n📍 *من:* ${origin}\n🏁 *إلى:* ${destination}\n📏 *المسافة:* ${distanceKm.toFixed(1)} كم\n💰 *السعر التقديري:* ${fare.toLocaleString()} د.ع\n\nهل تريد تأكيد الرحلة؟ 👇`,

  rideConfirmed: `✅ *تم تأكيد الطلب!*\nجاري البحث عن أقرب كابتن لك... 🚗`,

  rideCancelled: `🚫 *تم إلغاء الطلب.*\nتكدر تطلب رحلة جديدة بأي وقت! 🚕`,

  activeRidePending: (pickup: string, dropoff: string) =>
    `⏳ أنت في رحلة حالياً (جاري البحث عن كابتن).\n\n📍 من: ${pickup}\n🏁 إلى: ${dropoff}\n\nهل تريد إلغاء الرحلة؟`,

  activeRideWithDriver: (status: string) =>
    `🚕 لديك رحلة نشطة حالياً مع الكابتن.\n📍 الحالة: ${status}\n\nالرجاء إتمامها أولاً.`,

  error: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى. ⚠️",

  locationTooFar: "⚠️ موقعك يبين بعيد عن الرمادي. التطبيق حالياً يخدم الرمادي فقط.\n\nدز موقعك من داخل الرمادي 📍",
};
