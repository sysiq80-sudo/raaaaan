/**
 * ════════════════════════════════════════
 * 🧾 GPT-4o Vision — تحليل إيصالات الدفع
 * ════════════════════════════════════════
 * يستخدم GPT-4o Vision لاستخراج بيانات الإيصال:
 * - المبلغ (amount)
 * - رقم المعاملة (transaction_reference)
 * - مزود الخدمة (provider): Zain Cash, Qi Card, Asia Hawala, etc.
 */

export interface ParsedReceipt {
  amount: number | null;
  transaction_reference: string | null;
  provider: string | null;
  currency: string;
  is_valid_receipt: boolean;
  confidence: number;
  error_message: string | null;
  raw_text: string | null;
}

/**
 * تحليل صورة إيصال دفع باستخدام GPT-4o Vision
 * @param imageBytes - بيانات الصورة كـ Uint8Array
 * @param mimeType - نوع الصورة (image/jpeg, image/png, etc.)
 * @param openaiApiKey - مفتاح OpenAI API
 * @returns بيانات الإيصال المستخرجة
 */
export async function parseReceiptImage(
  imageBytes: Uint8Array,
  mimeType: string,
  openaiApiKey: string
): Promise<ParsedReceipt> {
  // تحويل الصورة إلى Base64
  const base64Image = btoa(
    Array.from(imageBytes)
      .map((b) => String.fromCharCode(b))
      .join("")
  );

  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const systemPrompt = `You are a financial receipt parser for an Iraqi taxi service called "RAAN" (ران).
Your job is to extract payment details from mobile payment screenshots/receipts.

Common Iraqi payment providers:
- **زين كاش (Zain Cash)**: Mobile money by Zain Iraq
- **كي كارد (Qi Card)**: Iraqi payment card system  
- **آسيا حوالة (Asia Hawala)**: Money transfer service
- **فاست باي (FastPay)**: Mobile payment
- **ماستر كارد/فيزا**: International cards
- **نقداً (Cash)**: If receipt shows cash payment

Extract these fields:
1. **amount**: The transferred/paid AMOUNT in Iraqi Dinars (IQD). Look for numbers near "المبلغ", "Amount", "تم التحويل", etc. MUST be a number only (no currency symbols). If the receipt shows a decimal amount less than 100, it may be in USD — convert by multiplying by 1500.
2. **transaction_reference**: The unique transaction ID/reference number. Look for "رقم العملية", "Transaction ID", "Ref", "رقم المرجع", serial numbers, etc.
3. **provider**: The payment service name (Arabic preferred): "زين كاش", "كي كارد", "آسيا حوالة", "فاست باي", or other.
4. **currency**: "IQD" for Iraqi Dinar (default), "USD" if clearly in dollars.
5. **is_valid_receipt**: true if this looks like a legitimate payment receipt/screenshot. false if it's a random image, edited, or unclear.
6. **confidence**: 0.0 to 1.0 — how confident you are in the extracted data.
7. **raw_text**: All readable text from the receipt (for audit purposes).

CRITICAL RULES:
- If the image is NOT a payment receipt, set is_valid_receipt to false.
- If you can't read the amount clearly, set amount to null.
- If you can't find a transaction reference, set transaction_reference to null.
- NEVER fabricate or guess transaction references.
- Be strict about validation — blurry or suspicious images should get low confidence.

Respond in JSON ONLY:
{
  "amount": 25000,
  "transaction_reference": "TXN123456789",
  "provider": "زين كاش",
  "currency": "IQD",
  "is_valid_receipt": true,
  "confidence": 0.95,
  "error_message": null,
  "raw_text": "..."
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "حلل هذا الإيصال واستخرج بيانات الدفع:",
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                  detail: "high",
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[receipt-vision] OpenAI API error:", response.status, errText);
      return {
        amount: null,
        transaction_reference: null,
        provider: null,
        currency: "IQD",
        is_valid_receipt: false,
        confidence: 0,
        error_message: `OpenAI API error: ${response.status}`,
        raw_text: null,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        amount: null,
        transaction_reference: null,
        provider: null,
        currency: "IQD",
        is_valid_receipt: false,
        confidence: 0,
        error_message: "No response content from GPT-4o",
        raw_text: null,
      };
    }

    const parsed = JSON.parse(content);
    return {
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      transaction_reference: parsed.transaction_reference || null,
      provider: parsed.provider || null,
      currency: parsed.currency || "IQD",
      is_valid_receipt: parsed.is_valid_receipt === true,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      error_message: parsed.error_message || null,
      raw_text: parsed.raw_text || null,
    };
  } catch (err) {
    console.error("[receipt-vision] Parse error:", err);
    return {
      amount: null,
      transaction_reference: null,
      provider: null,
      currency: "IQD",
      is_valid_receipt: false,
      confidence: 0,
      error_message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      raw_text: null,
    };
  }
}

/**
 * إرسال إشعار للأدمن عبر بوت تليجرام الإداري
 * @param adminBotToken - توكن بوت الأدمن
 * @param adminChatId - معرف مجموعة الأدمن
 * @param receiptData - بيانات الإيصال
 * @param transactionId - معرف المعاملة في قاعدة البيانات
 * @param customerName - اسم العميل
 * @param platform - المنصة (whatsapp/telegram)
 * @returns معرف الرسالة المرسلة
 */
export async function notifyAdminGroup(
  adminBotToken: string,
  adminChatId: string,
  receiptData: ParsedReceipt,
  transactionId: string,
  customerName: string,
  platform: string,
  imageBytes?: Uint8Array,
  mimeType?: string
): Promise<string | null> {
  const ADMIN_API = `https://api.telegram.org/bot${adminBotToken}`;

  const caption =
    `🧾 *طلب شحن رصيد جديد*\n\n` +
    `👤 العميل: ${customerName}\n` +
    `📱 المنصة: ${platform === "whatsapp" ? "واتساب" : "تليجرام"}\n` +
    `💰 المبلغ: ${receiptData.amount ? receiptData.amount.toLocaleString() + " د.ع" : "غير محدد"}\n` +
    `🏦 المزود: ${receiptData.provider || "غير محدد"}\n` +
    `🔢 رقم المعاملة: ${receiptData.transaction_reference || "غير موجود"}\n` +
    `📊 الثقة: ${Math.round((receiptData.confidence || 0) * 100)}%\n` +
    `🆔 معرف الطلب: \`${transactionId.substring(0, 8)}\``;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ موافقة", callback_data: `approve_${transactionId}` },
        { text: "❌ رفض", callback_data: `reject_${transactionId}` },
      ],
      [
        { text: "💰 تعديل المبلغ", callback_data: `edit_amount_${transactionId}` },
      ],
    ],
  };

  try {
    let messageId: string | null = null;

    // إرسال الصورة مع الأزرار إذا متوفرة
    if (imageBytes && mimeType) {
      const formData = new FormData();
      formData.append("chat_id", adminChatId);
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");
      formData.append("reply_markup", JSON.stringify(inlineKeyboard));

      const ext = mimeType.includes("png") ? "png" : "jpg";
      const blob = new Blob([imageBytes], { type: mimeType });
      formData.append("photo", blob, `receipt.${ext}`);

      const resp = await fetch(`${ADMIN_API}/sendPhoto`, {
        method: "POST",
        body: formData,
      });

      if (resp.ok) {
        const result = await resp.json();
        messageId = String(result.result?.message_id || "");
      } else {
        const errText = await resp.text();
        console.error("[admin-notify] sendPhoto failed:", errText);
      }
    }

    // Fallback: إرسال نص فقط إذا فشل إرسال الصورة
    if (!messageId) {
      const resp = await fetch(`${ADMIN_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: caption,
          parse_mode: "Markdown",
          reply_markup: inlineKeyboard,
        }),
      });

      if (resp.ok) {
        const result = await resp.json();
        messageId = String(result.result?.message_id || "");
      } else {
        const errText = await resp.text();
        console.error("[admin-notify] sendMessage failed:", errText);
      }
    }

    return messageId;
  } catch (err) {
    console.error("[admin-notify] Error:", err);
    return null;
  }
}
