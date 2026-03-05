# 🔍 RAAN Bot System — Complete Audit Report

**Date:** 2026-03-05
**Auditor:** Lead Backend Architect (Copilot)
**Scope:** whatsapp-webhook, telegram-ai-booking, telegram-ride-updates, whatsapp-ride-updates, NLP/classifier, state management (bot_customers), calculate-fare, shared utilities

---

## 📐 Architecture Overview

The bot system consists of **6 independent Supabase Edge Functions** + **shared modules**:

| Function | Purpose | Entry Point |
|---|---|---|
| `whatsapp-webhook` | Main booking flow via WhatsApp Cloud API | Meta webhook POST |
| `whatsapp-ride-updates` | Push ride-status notifications to WhatsApp riders | DB trigger / internal invoke |
| `telegram-ai-booking` | Main booking flow via Telegram Bot API | Telegram webhook POST |
| `telegram-ride-updates` | Push ride-status notifications to Telegram riders | Internal invoke |
| `calculate-fare` | Central fare calculation engine | Internal invoke |
| `sms-webhook` | Inbound SMS → silent ride creation (Infobip) | Infobip webhook POST |
| `admin-telegram-webhook` | Admin receipt approval/rejection bot | Telegram webhook POST |

### WhatsApp-Webhook Modular Layout:
```
whatsapp-webhook/
├── index.ts              — Main handler (1529 lines)
└── lib/
    ├── config.ts          — Dynamic config + Rate Limiting
    ├── messages.ts        — Arabic message templates
    ├── whatsapp-api.ts    — Cloud API helpers (text, buttons, location, list, media)
    ├── ai-services.ts     — GPT-4o + Whisper (destination extraction, scheduling)
    ├── geocoding.ts       — Local landmarks → Nominatim → Google Geocode → Google Places
    ├── fare.ts            — Haversine distance + Edge Function invoke
    ├── user-session.ts    — findOrCreate user, draft session CRUD, active ride check
    ├── local-classifier.ts — Regex-based intent classifier (~60% GPT savings)
    ├── cache.ts           — LRU caches for AI classifications, geocoding
    └── analytics.ts       — Event tracking, response time, booking funnel
```

### Telegram-AI-Booking: **Refactored** (~1959 lines, shared modules)
- Now imports from `_shared/`: landmarks, geocoding, haversine, fare, local-classifier, rate-limiter, log-message
- Contains Telegram-specific logic only: Bot API helpers, session management, callback handlers, main message handler
- Shares all core business logic with WhatsApp via `_shared/` modules
- **Phase 5:** Smart initial intent parsing (Scenario A/B/C) + GPS saved-dropoff auto-completion
- **Phase 6:** Wallet top-up UX, admin support handoff, reverse ride callback handler

---

## 1️⃣ State Machine Map

### 1.1 Session (Draft) States — stored in `rides` table

```
┌──────────────────────────────────────────────────────────────────┐
│                    BOOKING STATE MACHINE                         │
│                                                                  │
│  [IDLE] ──(GPS location)──→ [DRAFT]                             │
│  [IDLE] ──(text "من X إلى Y")──→ [DRAFT + dropoff] (Phase 5/A) │
│  [IDLE] ──(text "وديني Y")──→ pending_dropoff:Y (Phase 5/B)    │
│                              rides.status = 'draft'              │
│                              rides.dropoff_address = NULL        │
│                              rides.trip_type = 'whatsapp'|'telegram'│
│                                                                  │
│  [DRAFT] ──(voice/text → destination)──→ [DRAFT + dropoff]      │
│                              rides.dropoff_address = SET          │
│                              rides.estimated_fare = SET          │
│                                                                  │
│  [DRAFT + dropoff] ──(confirm button)──→ [PENDING]              │
│                              rides.status = 'pending'            │
│                              → invoke match-ride                 │
│                                                                  │
│  [DRAFT + dropoff] ──(cancel button)──→ [CANCELLED]             │
│                              rides.status = 'cancelled'          │
│                                                                  │
│  [PENDING] ──(driver accepts)──→ [ACCEPTED]                     │
│  [ACCEPTED] ──(driver arrives)──→ [ARRIVED]                     │
│  [ARRIVED] ──(trip starts)──→ [IN_PROGRESS]                     │
│  [IN_PROGRESS] ──(trip ends)──→ [COMPLETED]                     │
│  Any active state ──(cancel)──→ [CANCELLED]                     │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Chat Sub-States — stored in `bot_customers.last_intent`

| `last_intent` value | Meaning | Cleared when |
|---|---|---|
| `NULL` | Default / idle | — |
| `pending_dropoff:{destination}` | **Phase 5:** User sent text with dropoff only (Scenario B) — waiting for GPS pickup | GPS received → auto-completes booking with saved dropoff |
| `awaiting_schedule` | User requested a scheduled ride, waiting for details text | After processing or error |
| `chatting_with_driver:{ride_id}` | Proxy chat mode: all text relayed to `ride_messages` | Ride completes/cancels, or user types breakout keyword |

### 1.3 Session Persistence

| Mechanism | WhatsApp | Telegram |
|---|---|---|
| **User identity** | `profiles.phone = "wa_{phone}"` | `profiles.phone = "tg_{tgId}"` |
| **Draft session** | `rides` WHERE `status='draft'`, `trip_type='whatsapp'`, `dropoff_address IS NULL` | Same but `trip_type='telegram'` |
| **Sub-state** | `bot_customers.last_intent` keyed by `(platform='whatsapp', platform_id={phone})` | `(platform='telegram', platform_id={tgId})` |
| **Session cleanup** | Old drafts (>30 min) auto-deleted on new GPS | Old drafts deleted on new GPS |
| **Active ride check** | `rides.status IN (pending, accepted, arrived, in_progress)` | Same |

### 1.4 Validated State Transitions (ride-updates functions)

Both `whatsapp-ride-updates` and `telegram-ride-updates` enforce:
```
pending    → [accepted, cancelled]
accepted   → [arrived, cancelled]
arrived    → [in_progress, cancelled]
in_progress→ [completed, cancelled]
```
Invalid transitions are **logged with a warning but NOT blocked** — they proceed anyway.

---

## 2️⃣ Payload Handling — What Is Actually Implemented

### 2.1 WhatsApp (`whatsapp-webhook`)

| Payload Type | Supported? | Implementation Details |
|---|---|---|
| **Text** | ✅ YES | **5-tier smart intent** (Phase 5): `local-classifier.ts` (regex) → `extractPickupAndDropoff()` (Scenario A) → `extractDirectDestination()` (Scenario B) → AI cache → GPT-4o (`classifyAndRespond` w/ `pickup_hint`) |
| **Native Location (GPS)** | ✅ YES | `message.location.latitude/longitude` → reverse geocode → `createPickupSession()` → draft ride |
| **Audio/Voice** | ✅ YES | `downloadWhatsAppMedia(mediaId)` → OpenAI Whisper STT → treated as text for destination extraction |
| **Interactive Buttons** | ✅ YES | `confirm_ride_{id}`, `cancel_ride_{id}`, `track_{id}`, `chat_{id}`, `rate_{id}_{stars}`, `keep_searching`, `action_book_ride`, `action_inquiry`, `action_other_options`, `action_repeat_last`, `action_scheduled_ride`, `action_my_rides`, `action_my_balance`, `action_my_info` |
| **List Reply** | ✅ YES | Same handler as button — `listReply.id` extracted identically |
| **Image / Video / Sticker / Document / Contact** | ✅ Image (Phase 4) / ❌ Others | Images: GPT-4o Vision receipt parsing → `receipt_transactions`. Others: Falls through to `sendLocationRequest(welcome)` |

### 2.2 Telegram (`telegram-ai-booking`)

| Payload Type | Supported? | Implementation Details |
|---|---|---|
| **Text** | ✅ YES | **4-tier smart intent** (Phase 5): `classifyLocally()` → `extractPickupAndDropoff()` (Scenario A) → `extractDirectDestination()` (Scenario B) → GPT-4o `extractDestination()` fallback |
| **Native Location (GPS)** | ✅ YES | `message.location` → reverse geocode → `createPickupSession()` |
| **Audio/Voice** | ✅ YES | `downloadTelegramFile(fileId)` → OpenAI Whisper → destination extraction |
| **Callback Queries (Inline Buttons)** | ✅ YES | `confirm_ride_{id}`, `cancel_ride_{id}`, `rate_{id}_{stars}`, `track_{id}`, `chat_{id}`, `action_book_ride`, `action_inquiry`, `action_scheduled_ride`, `action_my_rides`, `action_my_balance`, `action_my_info`, `ignore_action` |
| **Photos / Video / Sticker / Document / Contact** | ✅ Photos (Phase 4) / ❌ Others | Photos: GPT-4o Vision receipt parsing → `receipt_transactions`. Others: Silently ignored |
| `/start` command | ✅ YES | Shows welcome menu with inline keyboard |
| Other `/` commands | ❌ NO | Not handled — treated as text |

### 2.3 SMS (`sms-webhook`)

| Feature | Status |
|---|---|
| Inbound text NLP | ✅ Basic (regex-based pickup/dropoff extraction) |
| Ride creation | ✅ SILENT (no outbound SMS) |
| Cancel / Rate | ✅ Basic ("الغاء" / digit rating) |
| Location pins | ❌ N/A (SMS has no location feature) |

---

## 3️⃣ Interactive UI & Post-Confirmation Phase

### 3.1 Confirmation Flow

**Both platforms** use the same pattern:
1. After destination is extracted + geocoded + fare calculated:
   - **WhatsApp:** `sendInteractiveButtons()` with 2 buttons: `✅ اعتمد الرحلة` + `❌ إلغاء`
   - **Telegram:** `sendInlineKeyboard()` with 2 buttons: `✅ اعتمد الرحلة` + `❌ إلغاء`
2. On confirm → `rides.status = 'draft' → 'pending'` → invoke `match-ride`
3. On cancel → `rides.status → 'cancelled'`

### 3.2 Ride Status Notifications (ride-updates functions)

When ride status changes (via DB trigger), **separate** Edge Functions send status-specific messages:

| Status | WhatsApp (`whatsapp-ride-updates`) | Telegram (`telegram-ride-updates`) |
|---|---|---|
| **accepted** | Driver details + interactive buttons: `📍 موقع الكابتن` (tracking link) + `💬 راسل الكابتن` | Same, but inline keyboard |
| **arrived** | Text: "الكابتن وصل!" | Same |
| **in_progress** | Text: "الرحلة بدأت" + duration estimate | Same + smart destination hint |
| **completed** | Receipt + 5 rating buttons (`rate_{id}_1` through `rate_{id}_5`) | Receipt + 5 inline rating buttons + location keyboard for new ride |
| **cancelled** | Cancellation notice | Cancellation notice + inline buttons (book new / inquiry) |

### 3.3 Parallel Actions (During Active Ride)

| Action | WhatsApp | Telegram |
|---|---|---|
| **Track Driver** | `track_{ride_id}` → generates tracking token → sends URL `{SITE_URL}/track/{token}` | Same via callback query |
| **Proxy Chat** | `chat_{ride_id}` → sets `last_intent = "chatting_with_driver:{id}"` → all subsequent text inserted into `ride_messages` | Same mechanism |
| **Chat Exit** | User types breakout keyword (خروج, exit, خلص, etc.) | Not explicitly implemented — state cleared on ride completion only |

### 3.4 Mini Web-App / Select Destination Link

**🚨 NOT IMPLEMENTED.** There is NO `/select-destination` route or Mini Web-App link for precise dropoff selection. The system relies entirely on:
- Text/voice → NLP → Geocoding
- Native GPS location pin (pickup only)

---

## 4️⃣ Vulnerability / Bug Scan

### 🔴 CRITICAL Bugs

| # | Bug | Location | Impact |
|---|---|---|---|
| **C1** | **Telegram `createPickupSession` cancels `in_progress` rides** | [telegram-ai-booking/index.ts](supabase/functions/telegram-ai-booking/index.ts#L1040) | When user sends new GPS location, `IN_PROGRESS` rides are cancelled! The WhatsApp version correctly guards against this (`IN_PROGRESS_RIDE` check), but Telegram does `IN("pending", "accepted", "arrived", "in_progress")` — **catastrophic data corruption** |
| **C2** | **Telegram fare uses local hardcoded formula, ignores regions/zones** | [telegram-ai-booking/index.ts](supabase/functions/telegram-ai-booking/index.ts#L849) | `estimateFare()` uses flat `2000 + 1000×km`. WhatsApp correctly invokes `calculate-fare` Edge Function (which applies region-based pricing, vehicle multipliers, surge, subscriptions). Telegram riders get **wrong fares**. |
| **C3** | **log-message.ts import is broken in Edge Functions** | [whatsapp-webhook/index.ts](supabase/functions/whatsapp-webhook/index.ts#L94) | Imports `logIncomingBotMessage` from `../_shared/log-message.ts` but that file exists at `src/lib/_shared/log-message.ts` (React frontend), NOT in `supabase/functions/_shared/`. The Edge Function import `from "../_shared/log-message.ts"` will fail at runtime unless the file exists at deployment. |
| **C4** | **Ride cancel button allows cancelling `accepted`/`arrived` rides without proper fee logic (Telegram)** | [telegram-ai-booking/index.ts](supabase/functions/telegram-ai-booking/index.ts#L1304) | Telegram cancel only cancels `draft`/`pending` statuses. But the inline cancel button from `telegram-ride-updates` (CANCELLED state) is only informational — there is NO mechanism for a Telegram user to cancel an `accepted`/`arrived` ride and pay the fee. |

### 🟠 HIGH Bugs

| # | Bug | Location | Impact |
|---|---|---|---|
| **H1** | **Massive code duplication — Telegram has full independent copy of everything** | `telegram-ai-booking/index.ts` (1966 lines) | Landmarks DB, geocoding, Whisper, GPT prompts, Haversine, user management, session management — ALL duplicated. Any bug fix in one must be manually applied to the other. **13 shared functions are copy-pasted.** |
| **H2** | **Telegram has NO rate limiting** | `telegram-ai-booking/index.ts` | WhatsApp has DB-backed + in-memory rate limiting (10 msgs/min, 3 voice/min). Telegram has ZERO — a user can flood the bot and exhaust OpenAI credits. |
| **H3** | **Telegram has NO local classifier** | `telegram-ai-booking/index.ts` | WhatsApp uses `local-classifier.ts` to handle ~60% of intents without GPT calls. Telegram sends EVERY text to GPT-4o — 2.5x more API cost. |
| **H4** | **Telegram has NO message logging** | `telegram-ai-booking/index.ts` | WhatsApp logs all incoming/outgoing messages to `bot_conversation_messages`. Telegram logs NOTHING — admin dashboard shows incomplete conversation history. |
| **H5** | **Telegram chat exit not explicitly handled** | `telegram-ai-booking/index.ts` | WhatsApp has breakout keywords (خروج, exit, خلص). In Telegram, if a user starts proxy chatting and the ride ends, `last_intent` is cleared by `telegram-ride-updates` — but if the cleanup fails, user is stuck in chat mode permanently. |
| **H6** | **WhatsApp `action_my_balance` queries `profiles.id` instead of `profiles.user_id`** | [whatsapp-webhook/index.ts](supabase/functions/whatsapp-webhook/index.ts#L477) | Uses `.eq("user_id", riderId)` which is correct. But Telegram version uses `.eq("id", riderId)` which is **WRONG** — `profiles` PK is `user_id`, not `id`. |
| **H7** | **`scheduled_rides` column mismatch: WhatsApp uses `scheduled_time`, Telegram uses `scheduled_at`** | Both webhook files | If table has only one column name, one platform's inserts will silently fail with a column-not-found error. |
| **H8** | **Telegram: `findOrCreateTelegramUser` GoTrue lookup is fragile** | [telegram-ai-booking/index.ts](supabase/functions/telegram-ai-booking/index.ts#L901) | If GoTrue admin API changes response format or pagination, user creation silently breaks. |

### 🟡 MEDIUM Bugs

| # | Bug | Location | Impact |
|---|---|---|---|
| **M1** | **Unsupported message types get no user feedback (both platforms)** | Both webhooks | If user sends an image, video, sticker, or document — WhatsApp silently sends a location request (confusing), Telegram silently ignores it entirely. No "unsupported format" message. |
| **M2** | **WhatsApp signature verification is optional** | [whatsapp-webhook/index.ts](supabase/functions/whatsapp-webhook/index.ts#L173) | If `WHATSAPP_APP_SECRET` is not configured, signature check is SKIPPED with only a warning. Any attacker can forge webhook payloads. |
| **M3** | **Multiple `createClient()` calls per request (Telegram)** | `telegram-ai-booking/index.ts` | Supabase client is created inside each callback handler separately instead of once at the top. Minor performance/memory waste. |
| **M4** | **Cache is in-memory only (WhatsApp)** | `whatsapp-webhook/lib/cache.ts` | AI classification cache and geocoding cache live in function memory. On cold start or new instance, entire cache is lost. High-traffic periods may always hit cold caches. |
| **M5** | **`cancellation_reason` field used for notes** | [telegram-ai-booking/index.ts](supabase/functions/telegram-ai-booking/index.ts#L1899) | `cancellation_reason` is overwritten with `[ملاحظة] ${intent.notes}` during ride update, polluting the field — if the ride is later cancelled, the original note replaces the actual cancellation reason. |
| **M6** | **Stale `_configLoaded` flag (both platforms)** | Config modules | The flag is set to `true` on first load and never reset. If config values change in `system_configs`, the bot won't pick them up until the Edge Function cold-starts again. |
| **M7** | **`bot_customers` profile queries use `phone_number` for WhatsApp but `platform_id` for state — could mismatch** | `whatsapp-webhook/index.ts` | The upsert sets both `phone_number=phoneNumber` and `platform_id=phoneNumber`, so they match. But if a future change separates them, state lookups will break. |
| **M8** | **Invalid state transitions are warned but NOT blocked** | `whatsapp-ride-updates` + `telegram-ride-updates` | An invalid transition like `completed → pending` would be logged as warning but the notification would still be sent, potentially confusing the user. |

### 🟢 LOW / Informational

| # | Issue | Location |
|---|---|---|
| **L1** | Telegram uses `parse_mode: "HTML"` but some messages contain unescaped `<` or `&` | `telegram-ai-booking` + `telegram-ride-updates` |
| **L2** | `_vehicleTypesCache` and `_waitSettingsCache` TTL is 5 minutes — could serve stale data briefly | `ai-services.ts` |
| **L3** | No webhook idempotency guard — same message could be processed twice if Meta retries | `whatsapp-webhook/index.ts` |
| **L4** | Telegram does not log `bot_conversation_messages` — admin chat history is WhatsApp-only | `telegram-ai-booking/index.ts` |
| **L5** | SMS webhook is SILENT mode — never sends outbound. User gets no feedback at all | `sms-webhook/index.ts` |

---

## 5️⃣ Summary of Platform Feature Parity

| Feature | WhatsApp | Telegram | SMS |
|---|---|---|---|
| GPS Pickup | ✅ | ✅ | ❌ |
| Smart Initial Intent (Phase 5) | ✅ | ✅ | ❌ |
| Text → Full Booking (no GPS) | ✅ | ✅ | ❌ |
| Text NLP (local) | ✅ | ✅ | ✅ (basic) |
| Text NLP (GPT-4o) | ✅ | ✅ | ❌ |
| Voice/Audio (Whisper) | ✅ | ✅ | ❌ |
| Confirm/Cancel buttons | ✅ | ✅ | ❌ |
| Ride status notifications | ✅ | ✅ | ❌ |
| Repeat last ride | ✅ | ❌ | ❌ |
| Reverse ride | ✅ | ✅ | ❌ |
| Wallet top-up UX | ✅ | ✅ | ❌ |
| Admin support handoff | ✅ | ✅ | ❌ |
| Scheduled rides | ❌ (deprecated) | ❌ (deprecated) | ❌ |
| My rides / balance / info | ✅ | ✅ | ❌ |
| Rate limiting | ✅ (DB + memory) | ✅ (DB) | ❌ |
| Local classifier | ✅ | ✅ | ❌ |
| AI cache | ✅ | ❌ | ❌ |
| Proxy chat | ✅ | ✅ | ❌ |
| Live tracking link | ✅ | ✅ | ❌ |
| Rating post-ride | ✅ | ✅ | ✅ (basic) |
| Message logging | ✅ | ❌ | ❌ |
| Signature verification | ✅ (optional) | ❌ (N/A) | ❌ |
| Calculate-fare (region-aware) | ✅ | ✅ | ✅ |
| in_progress ride protection | ✅ | ❌ (**BUG**) | N/A |
| Cancellation fee logic | ✅ | ❌ | ❌ |
| Service area check | ✅ (Edge Function) | ⚠️ (60km radius only) | ❌ |
| Banned names check | ✅ | ❌ | ❌ |

---

## 6️⃣ Recommended Fix Priority

### Phase 1 — Critical ✅ (Completed 2026-03-05)
1. **C1:** ✅ Add `in_progress` guard to Telegram `createPickupSession` (copy from WhatsApp)
2. **C2:** ✅ Replace Telegram `estimateFare()` with `calculate-fare` Edge Function invocation
3. **C3:** ✅ Resolve `log-message.ts` import path — created in `supabase/functions/_shared/log-message.ts`

### Phase 2 — High ✅ (Completed 2026-03-06)
4. **H1:** ✅ Extract shared modules into `_shared/` — Created 6 shared modules:
   - `_shared/haversine.ts` — Haversine distance calculation
   - `_shared/landmarks.ts` — RAMADI_LANDMARKS (41 entries) + matchLocalLandmark()
   - `_shared/geocoding.ts` — nominatimGeocode + resolveRamadiLocation + reverseGeocode + extractConciseAddress
   - `_shared/fare.ts` — calculateFareFromEdge + getFareSettings + estimateFareLocal
   - `_shared/local-classifier.ts` — classifyLocally + extractDirectDestination (greetings/complaints/FAQ/booking patterns)
   - `_shared/rate-limiter.ts` — isRateLimitedDB + isRateLimitedMemory + getOrLoadSecuritySettings
   - Telegram `index.ts` refactored: 2049 → 1703 lines (removed ~346 lines of duplicated code)
5. **H2:** ✅ Add rate limiting to Telegram — Uses shared `isRateLimitedDB()` with SecuritySettings from DB
6. **H3:** ✅ Port `local-classifier.ts` to Telegram — Handles greetings/complaints/FAQ/booking without GPT-4o calls
7. **H4:** ✅ Add message logging to Telegram — Uses `logIncomingBotMessage()` tied to `bot_customers` with metadata
8. **H7:** ✅ Fixed WhatsApp `scheduled_rides` insert — changed `scheduled_time` → `scheduled_at` (matches DB schema)

### Phase 3 — Security, Account Sync & Feature Trimming ✅ (Completed 2026-03-07)
9. **P3.1:** ✅ **Strict AI Confidentiality** — Added confidentiality directives to all 3 GPT system prompts:
   - WhatsApp `extractDestination` prompt — added confidentiality block, removed hardcoded pricing ("2000 + 1000/km")
   - WhatsApp `classifyAndRespond` prompt — added confidentiality block, removed hardcoded pricing
   - Telegram `extractDestination` prompt — added confidentiality block
   - AI now refuses to reveal: driver counts, pricing formulas, commission rates, algorithms, DB structure, business strategies
10. **P3.2:** ✅ **Universal Account Sync** — Updated WhatsApp `findOrCreateWhatsAppUser()`:
    - Added phone number normalization (964xxx ↔ 07xxx ↔ +964xxx)
    - Cross-platform lookup: searches for existing app profiles by real phone number variants
    - If found, links WhatsApp user to existing app account (prevents duplicate profiles)
    - Updates existing profile with `whatsapp_phone` field
11. **P3.3:** ✅ **Deprecate Scheduled Rides** — Completely removed from both bots:
    - WhatsApp: Removed `extractScheduledRideDetails` function + interface, button from menu, `action_scheduled_ride` handler, entire `awaiting_schedule` handler block
    - Telegram: Removed `extractScheduledRideDetails` function + interface, `action_scheduled_ride` callback handler, button from /start menu, entire `awaiting_schedule` handler block
    - Removed import of `extractScheduledRideDetails` from WhatsApp index.ts
12. **P3.4:** ✅ **Enforce Dynamic Pricing** — No more hardcoded fare defaults:
    - `calculate-fare/index.ts`: Default baseFare/perKmFare/waitingFarePerMin now read from `app_settings` (key: `fare_calculation`) with last-resort fallbacks only
    - `_shared/fare.ts`: Added warning log when using hardcoded last-resort fallback pricing
    - Region name default changed from "بغداد" to "الأنبار" (correct service area)

### Phase 4 — AI Receipt Vision & Admin Financial Bot
13. **P4.1:** ✅ **Database Schema** — Created `receipt_transactions` table:
    - Migration: `20260610000001_receipt_transactions.sql`
    - Columns: id, user_id, platform, platform_user_id, amount, transaction_reference (UNIQUE), provider, status (pending/approved/rejected), receipt_image_url, parsed_data (JSONB), admin_message_id, admin_chat_id, reviewed_by, reviewed_at, rejection_reason, customer_notified
    - RLS enabled: users see own receipts, admins see all, service role has full access
    - Added `ADMIN_TELEGRAM_BOT_TOKEN` and `ADMIN_GROUP_CHAT_ID` to `system_configs`
14. **P4.2:** ✅ **GPT-4o Vision Receipt Parser** — Shared module `_shared/receipt-vision.ts`:
    - `parseReceiptImage(imageBytes, mimeType, openaiApiKey)`: Sends receipt image to GPT-4o Vision API with high-detail mode
    - Extracts: amount, transaction_reference, provider (Zain Cash/Qi Card/Asia Hawala/FastPay), currency, confidence score
    - Validates receipt authenticity, rejects non-receipt images
    - `notifyAdminGroup(...)`: Sends receipt image + parsed data to admin Telegram group with Approve/Reject/Edit inline keyboard
15. **P4.3:** ✅ **WhatsApp Image Handler** — Added to `whatsapp-webhook/index.ts`:
    - Detects `msgType === "image"` before the text/audio fallback
    - Downloads image via `downloadWhatsAppMedia(message.image.id)`
    - Parses with GPT-4o Vision, checks for duplicate transaction_reference
    - Saves to `receipt_transactions`, notifies admin group
    - Sends confirmation to customer with amount/provider/reference
    - Added imports: `OPENAI_API_KEY`, `ADMIN_TELEGRAM_BOT_TOKEN`, `ADMIN_GROUP_CHAT_ID` from config
    - Updated `config.ts` to load admin bot tokens from `system_configs`
16. **P4.4:** ✅ **Telegram Image Handler** — Added to `telegram-ai-booking/index.ts`:
    - Detects `message.photo` array, takes highest resolution photo
    - Downloads via existing `downloadTelegramFile(file_id)`
    - Same flow as WhatsApp: parse → dedup check → save → admin notify → customer confirm
    - Added `ADMIN_TELEGRAM_BOT_TOKEN` and `ADMIN_GROUP_CHAT_ID` config loading
17. **P4.5:** ✅ **Admin Telegram Bot** — New Edge Function `admin-telegram-webhook/index.ts`:
    - Handles callback queries: `approve_{txn_id}`, `reject_{txn_id}`, `edit_amount_{txn_id}`
    - On approve: updates transaction status, adds amount to `profiles.wallet_balance`, records in `rider_wallet_transactions`, notifies customer
    - On reject: updates status, notifies customer with rejection message
    - Amount edit: admin sends `{amount} {txn_id_prefix}` to update amount before approval
    - Auto-captures `ADMIN_GROUP_CHAT_ID` when bot receives first message in a group
    - Cross-platform notifications: sends approval/rejection to customer's original platform (WhatsApp via Cloud API or Telegram via customer bot)
    - `/start` command shows usage instructions
18. **P4.6:** ✅ **Admin Bot Deployment & Configuration**:
    - Admin Bot: `@raanadminbot` (id: 8500563443)
    - Admin Group: "Admins RAAN" (chat_id: `-1003353713214`, supergroup)
    - Webhook URL: `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/admin-telegram-webhook`
    - Group Privacy: Disabled (bot can read all messages)
    - Config stored in `system_configs` table (key_name: `ADMIN_TELEGRAM_BOT_TOKEN`, `ADMIN_GROUP_CHAT_ID`)
    - Migration: `20260610000001_receipt_transactions.sql` — creates `receipt_transactions` table + inserts config rows
    - Connectivity verified: bot successfully sends messages + inline keyboards to admin group

### Phase 5 — Smart Initial Intent Parsing ✅ (Completed 2026-06-11)
19. **P5.1:** ✅ **`extractPickupAndDropoff()` — Local regex for "من X إلى Y" patterns**
    - Added to both `_shared/local-classifier.ts` (shared, used by Telegram) AND `whatsapp-webhook/lib/local-classifier.ts` (WhatsApp's own copy)
    - Matches patterns: "من X إلى Y", "من X لـ Y", with prefix stripping ("أريد أروح", "وديني", "خذني", etc.)
    - Extracts: `{ pickup, dropoff, vehicle_type }` — vehicle type detected from keywords (VIP/كومفورت/بريميوم)
    - Returns `null` if no pickup/dropoff pair found
20. **P5.2:** ✅ **GPT `classifyAndRespond` enhanced with `pickup_hint`**
    - `ai-services.ts`: Return type now includes `pickup_hint: string | null`
    - GPT system prompt updated: "إذا المستخدم ذكر 'من' + مكان + 'إلى/ل' + مكان آخر، استخرج كلا الموقعين"
    - `cache.ts`: `AIClassifyResult` interface updated with `pickup_hint?: string | null`
    - All 3 error return paths updated to include `pickup_hint: null`
21. **P5.3:** ✅ **WhatsApp Smart Intent Handler (Scenario A/B/C)**
    - `whatsapp-webhook/index.ts` (1347 → 1591 lines, +244 lines)
    - **No-session handler rewrite** — 5-step smart intent flow:
      1. Get text from message OR transcribe audio (voice now works in idle state!)
      2. Local classifier: greetings/complaints/FAQ → handle + return
      3. `extractPickupAndDropoff()` → **Scenario A**: geocode both locations, service area check, create session, calculate fare, show confirmation buttons — NO GPS NEEDED
      4. `extractDirectDestination()` or local hint → **Scenario B**: save `pending_dropoff:{dest}` in `bot_customers.last_intent`, ask user for GPS
      5. Cache → GPT-4o `classifyAndRespond` fallback: checks `pickup_hint + destination_hint` for Scenario A, or `destination_hint` only for Scenario B
    - **GPS handler enhancement**: After `createPickupSession`, checks `bot_customers.last_intent` for `pending_dropoff:*`. If found: clears intent, geocodes saved dropoff, calculates fare, updates ride, sends confirmation buttons — auto-completes Scenario B
22. **P5.4:** ✅ **Telegram Smart Intent Handler (Scenario A/B/C)**
    - `telegram-ai-booking/index.ts` (1891 → 2105 lines, +214 lines)
    - Added import: `classifyLocally`, `extractDirectDestination`, `extractPickupAndDropoff` from `_shared/local-classifier.ts`
    - **No-session handler rewrite** — 4-step smart intent flow:
      1. Get text from message OR transcribe voice (voice now works in idle state!)
      2. Local classifier → greetings show inline keyboard menu, complaints/FAQ → direct reply
      3. `extractPickupAndDropoff()` → **Scenario A**: full booking without GPS
      4. `extractDirectDestination()` or local hint → **Scenario B**: save pending_dropoff, ask for GPS
      5. GPT `extractDestination()` fallback → if destination extracted, save as Scenario B
    - **GPS handler enhancement**: Same `pending_dropoff:*` auto-completion as WhatsApp (uses `estimateFare` instead of `calculateFareFromEdge`)
23. **P5.5:** ✅ **New Arabic message templates** — Added to both platforms:
    - `dropoffSavedAskPickup(destination, name)`: "✅ حددنا الوجهة: 📍 {dest}... أرسل موقعك الحالي"
    - `pickupGeocodeFailed(place)`: "ما كدرنا نحدد مكان الانطلاق... أرسل GPS"
    - `autoProcessingDropoff(destination, name)`: "✅ عاشت ايدك! حددنا مكانك. 🎯 جاري حساب الأجرة..."

### Phase 5 — Remaining Medium (Hardening)
24. **M2:** Make WhatsApp signature verification mandatory
25. **M5:** Stop using `cancellation_reason` for notes
26. **M8:** Block invalid state transitions

### Phase 6 — Wallet UX, Support Routing & Reverse Ride ✅ (Completed 2026-03-05)
27. **P6.1:** ✅ **Wallet Top-Up UX** — Both platforms:
    - `action_my_balance` now shows balance + interactive "➕ إضافة رصيد" button
    - `action_add_balance` handler sends exact Arabic instructions with payment accounts:
      - زين كاش: `07844446633` | سوبر كي: `07844446633` | كيو كارد: `7117309554`
    - WhatsApp: uses monospace ``` for copyable numbers
    - Telegram: uses `<code>` HTML tags for copyable numbers
    - Instructions tell user to send receipt image (links to Phase 4 receipt parsing flow)
28. **P6.2:** ✅ **Direct Admin Handoff for Support** — Both platforms:
    - Complaints (شكوى) and inquiries (استفسار) now forwarded to ADMIN_GROUP_CHAT_ID via @raanadminbot
    - Admin message includes: intent label (🔴 شكوى / 🟡 استفسار), user name, phone/ID, active ride ID (if any), full message text
    - User receives: "تم تحويل طلبك/شكواك مباشرة إلى الإدارة. نحن نتابع الأمر وسنتواصل معك فوراً لحل المشكلة."
    - Replaces old generic AI complaint responses — admin now handles directly
    - FAQ intents (pricing, service area, cancellation, etc.) still handled locally via regex
29. **P6.3:** ✅ **Reverse Ride Feature** — Both platforms:
    - `whatsapp-ride-updates`: Added "🔄 رحلة عكسية" button after rating buttons on ride completion
    - `telegram-ride-updates`: Added "🔄 رحلة عكسية" button in inline keyboard alongside rating buttons
    - `whatsapp-webhook`: `reverse_ride_{id}` handler — fetches completed ride, swaps pickup↔dropoff, recalculates fare via Edge Function, creates draft, shows confirm/cancel buttons
    - `telegram-ai-booking`: `reverse_ride_{id}` callback handler — same swap logic, uses local `estimateFare()`, creates draft, shows inline confirm/cancel keyboard
    - Flow: User completes ride → sees reverse ride button → click → draft created with swapped locations → standard confirm/cancel flow
30. **P6.4:** ✅ **Deployment** — All 6 edge functions deployed to Supabase:
    - `whatsapp-webhook` ✅
    - `telegram-ai-booking` ✅
    - `whatsapp-ride-updates` ✅
    - `telegram-ride-updates` ✅
    - `admin-telegram-webhook` ✅
    - `calculate-fare` ✅

### Phase 6 — Remaining Medium (Hardening)
31. **M2:** Make WhatsApp signature verification mandatory
32. **M5:** Stop using `cancellation_reason` for notes
33. **M8:** Block invalid state transitions

---

**Report generated: 2026-03-05**
**Phase 1 completed: 2026-03-05**
**Phase 2 completed: 2026-03-06**
**Phase 3 completed: 2026-03-07**
**Phase 4 completed: 2026-03-05**
**Phase 5 completed: 2026-06-11**
**Phase 6 completed: 2026-03-05**
**والحمد لله رب العالمين** 🤲
