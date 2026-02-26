/**
 * ران — WhatsApp Cloud API Helpers
 * RAAN WhatsApp API Functions
 * مع Retry Logic + Analytics Tracking
 */

import { WHATSAPP_ACCESS_TOKEN, GRAPH_API } from "./config.ts";
import { trackEvent } from "./analytics.ts";

// ════════════════════════════════════════
// 🔄 Retry Helper — إعادة المحاولة مع تأخير تصاعدي
// ════════════════════════════════════════
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  initialDelayMs = 500
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // 429 = Rate limited by Meta — ننتظر ونعيد
      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
        const delay = Math.max(retryAfter * 1000, initialDelayMs * Math.pow(2, attempt));
        console.warn(`[wa] ⏳ Rate limited by Meta, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      // 500+ = Meta server error — ننتظر ونعيد
      if (res.status >= 500 && attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.warn(`[wa] ⚠️ Meta server error ${res.status}, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.warn(`[wa] 🔄 Network error, retrying in ${delay}ms:`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("fetchWithRetry: max retries exceeded");
}

// ════════════════════════════════════════
// WhatsApp Cloud API: إرسال رسالة نصية
// ════════════════════════════════════════
export async function sendTextMessage(to: string, text: string) {
  try {
    const res = await fetchWithRetry(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const result = await res.text();
    if (!res.ok) {
      console.error(`[wa] sendText FAILED (${res.status}):`, result.substring(0, 300));
      trackEvent("wa_send_failed", { to, type: "text", status: res.status });
    } else {
      console.log(`[wa] sendText (${res.status}): ${result.substring(0, 200)}`);
    }
  } catch (e) {
    console.error("[wa] sendTextMessage failed:", e);
    trackEvent("wa_send_error", { to, type: "text", error: String(e) });
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: طلب الموقع (زر إرسال الموقع الأصلي)
// ════════════════════════════════════════
export async function sendLocationRequest(to: string, bodyText: string) {
  try {
    const res = await fetchWithRetry(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "location_request_message",
          body: { text: bodyText },
          action: { name: "send_location" },
        },
      }),
    });
    const result = await res.text();
    console.log(`[wa] sendLocationRequest (${res.status}): ${result.substring(0, 300)}`);
  } catch (e) {
    console.error("[wa] sendLocationRequest failed:", e);
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: إرسال رسالة مع أزرار (Interactive)
// ════════════════════════════════════════
export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id.substring(0, 256), title: b.title.substring(0, 20) },
          })),
        },
      },
    };

    console.log(`[wa] sendButtons payload to ${to}:`, JSON.stringify(payload).substring(0, 500));

    const res = await fetchWithRetry(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await res.text();
    if (!res.ok) {
      console.error(`[wa] sendButtons FAILED (${res.status}) to ${to}:`, result);
      trackEvent("wa_send_failed", { to, type: "buttons", status: res.status });
    } else {
      console.log(`[wa] ✅ sendButtons OK to ${to}:`, result.substring(0, 200));
    }
  } catch (e) {
    console.error("[wa] sendInteractiveButtons failed:", e);
    trackEvent("wa_send_error", { to, type: "buttons", error: String(e) });
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: إرسال قائمة تفاعلية (List Message)
// ════════════════════════════════════════
export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
) {
  try {
    const res = await fetchWithRetry(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections,
          },
        },
      }),
    });
    const result = await res.text();
    console.log(`[wa] sendListMessage (${res.status}): ${result.substring(0, 300)}`);
  } catch (e) {
    console.error("[wa] sendListMessage failed:", e);
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: إرسال موقع
// ════════════════════════════════════════
export async function sendLocationMessage(
  to: string,
  lat: number,
  lng: number,
  name: string,
  address: string
) {
  try {
    const res = await fetchWithRetry(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "location",
        location: {
          latitude: lat,
          longitude: lng,
          name: name.substring(0, 100),
          address: address.substring(0, 200),
        },
      }),
    });
    const result = await res.text();
    console.log(`[wa] sendLocation (${res.status}): ${result.substring(0, 200)}`);
  } catch (e) {
    console.error("[wa] sendLocationMessage failed:", e);
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: تحميل ملف صوتي (خطوتين)
// ════════════════════════════════════════
export async function downloadWhatsAppMedia(mediaId: string): Promise<Uint8Array> {
  // الخطوة 1: جلب URL الملف
  const metaRes = await fetchWithRetry(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });

  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Failed to get media URL (${metaRes.status}): ${err}`);
  }

  const metaData = await metaRes.json();
  const mediaUrl = metaData.url;

  if (!mediaUrl) {
    throw new Error("No media URL returned from Meta");
  }

  console.log(`[wa] Media URL retrieved: ${mediaUrl.substring(0, 80)}...`);

  // الخطوة 2: تحميل الملف الفعلي
  const audioRes = await fetchWithRetry(mediaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });

  if (!audioRes.ok) {
    const err = await audioRes.text();
    throw new Error(`Failed to download media (${audioRes.status}): ${err}`);
  }

  return new Uint8Array(await audioRes.arrayBuffer());
}
