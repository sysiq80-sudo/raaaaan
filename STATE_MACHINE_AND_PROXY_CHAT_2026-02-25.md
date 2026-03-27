# 🚕 ران (RAAN) — State Machine & Parallel Proxy Chat Documentation

## 📅 Update Date: 2026-02-25

---

## 🔒 Strict Ride State Machine

### State Transitions (Uninterruptible)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────┐
│  pending  │────▶│ accepted │────▶│ arrived  │────▶│ in_progress  │────▶│ completed │
└──────────┘     └──────────┘     └──────────┘     └──────────────┘     └───────────┘
     │                │                │                  │
     └────────┬───────┴────────┬───────┴──────────┬───────┘
              ▼                                   
        ┌───────────┐
        │ cancelled │
        └───────────┘
```

### Valid Transitions
| From | To | Trigger |
|---|---|---|
| `pending` | `accepted` | Driver accepts ride |
| `pending` | `cancelled` | System timeout / Rider cancels |
| `accepted` | `arrived` | Driver clicks "وصلت لموقع العميل" |
| `accepted` | `cancelled` | Driver / Rider cancels |
| `arrived` | `in_progress` | Driver clicks "العميل ركب" |
| `arrived` | `cancelled` | Driver / Rider cancels |
| `in_progress` | `completed` | Driver clicks "تم الوصول" |
| `in_progress` | `cancelled` | Emergency only |

### ⚠️ Invalid Transitions are LOGGED and REJECTED
Any attempt to jump states (e.g., `pending` → `in_progress`) is logged as a warning.

---

## 🔄 Parallel Actions (Independent of Ride State)

These actions run **completely independently** from the ride state machine. They do NOT modify `rides.status`.

### 1. 📍 Live Driver Location (Tracking)

**Flow:**
1. When ride is `accepted`, the bot sends inline buttons: `[📍 موقع السائق]` and `[💬 راسل السائق]`
2. When passenger clicks `📍 موقع السائق`:
   - The bot generates a tracking token via `generate_ride_tracking_token` RPC
   - Sends a tracking link: `https://[domain]/track/[token]`
   - **Ride status is NOT changed**

**WhatsApp:** Interactive button with `id: track_{ride_id}`
**Telegram:** Inline button with `url: tracking_link` (direct link)

### 2. 💬 Proxy Chat (Bidirectional Messaging)

**Flow:**
1. When passenger clicks `💬 راسل السائق`:
   - Bot sets temporary sub-state: `bot_customers.last_intent = 'chatting_with_driver:{ride_id}'`
   - Bot replies: "اكتب رسالتك أدناه وراح تصل للكابتن فوراً"
2. **Next text input** from passenger is **intercepted**:
   - Saved to `ride_messages` table
   - Pushed to Driver App via Supabase Realtime (postgres_changes)
   - Bot confirms: "✅ تم إرسال رسالتك للكابتن"
3. **Driver responds** inside Capacitor app's `RideChat` component:
   - Message saved to `ride_messages` table
   - `relay-chat-message` Edge Function sends message to bot (WhatsApp/Telegram)
4. **Exit commands**: "خلص", "انتهيت", "خروج", "stop", "exit", "done"
   - Clears sub-state and returns to normal flow

**Key Points:**
- Chat loop is **completely independent** of `rides.status`
- Messages are stored in `ride_messages` table
- Supabase Realtime subscription on `ride_messages` ensures real-time delivery to Driver App
- `relay-chat-message` Edge Function handles Driver → Bot direction

### 3. ⭐ Rating System

**Flow:**
1. When ride reaches `completed`:
   - Bot sends receipt (fare breakdown)
   - Bot sends rating buttons (1-5 stars)
2. Passenger clicks a star rating:
   - Rating saved to `ride_ratings` table (upsert on `ride_id, rider_id`)
   - Driver's average rating is recalculated
   - `drivers.rating` field is updated

**WhatsApp:** Interactive buttons with `id: rate_{ride_id}_{1|3|5}` (3 options due to WhatsApp limit)
**Telegram:** Inline keyboard with 5 buttons `callback_data: rate_{ride_id}_{1-5}`

---

## 📁 Files Modified

### Edge Functions (Supabase/Deno)

| File | Description |
|---|---|
| `supabase/functions/whatsapp-ride-updates/index.ts` | ✅ Strict state machine + inline buttons (track/chat) + receipt + rating buttons |
| `supabase/functions/telegram-ride-updates/index.ts` | ✅ Strict state machine + inline buttons + receipt + rating buttons (5 stars) |
| `supabase/functions/whatsapp-webhook/index.ts` | ✅ Handlers for `track_*`, `chat_*`, `rate_*` buttons + Proxy Chat sub-state |
| `supabase/functions/relay-chat-message/index.ts` | ✅ Existing — relays driver messages to passenger's bot |

### Mobile App (React/Capacitor)

| File | Description |
|---|---|
| `src/components/ride/RideChat.tsx` | ✅ Chat now stays open during `accepted`/`arrived`/`in_progress` (parallel action). Auto-relays driver messages to bot via `relay-chat-message` Edge Function. |
| `src/components/driver/ActiveRideCard.tsx` | ✅ Existing state machine (accepted → arrived → in_progress → completed) |

---

## 🗄️ Database Tables Used

| Table | Purpose |
|---|---|
| `rides` | Main ride table. `status` field enforces strict state machine. |
| `ride_messages` | Chat messages between driver & rider. `sender_type`: 'rider' / 'driver'. |
| `ride_ratings` | Star ratings (1-5). Unique constraint on `(ride_id, rider_id)`. |
| `bot_customers` | Stores `last_intent` for proxy chat sub-state (`chatting_with_driver:{ride_id}`). |
| `drivers` | `rating` field updated with average when new rating is submitted. |

---

## 🔗 API/Webhook Flow Diagram

```
┌────────────────┐                    ┌──────────────────┐
│  Driver App    │                    │  WhatsApp/TG Bot │
│  (Capacitor)   │                    │  (Passenger)     │
└───────┬────────┘                    └────────┬─────────┘
        │                                      │
        │  Driver Accepts Ride                 │
        │  ─── (DB: pending → accepted) ──▶    │
        │         │                            │
        │    [DB Webhook Trigger]              │
        │         │                            │
        │    whatsapp-ride-updates /            │
        │    telegram-ride-updates             │
        │         │                            │
        │         └──── Message + Buttons ────▶│ "الكابتن X في الطريق!"
        │                                      │ [📍 موقع] [💬 محادثة]
        │                                      │
        │                ◀── [💬 محادثة] ──────│ Passenger clicks chat
        │                                      │
        │                                      │  sub-state = chatting_with_driver
        │                                      │
        │                ◀── Text Message ─────│ Passenger types message
        │                                      │
        │    [ride_messages INSERT]             │
        │    [Supabase Realtime]               │
        │         │                            │
        │  ◀──────┘                            │
        │  Driver sees message in chat UI      │
        │                                      │
        │  Driver replies in app ──▶           │
        │    [ride_messages INSERT]             │
        │    [relay-chat-message EF]           │
        │         │                            │
        │         └──── "💬 رسالة من الكابتن" ▶│
        │                                      │
        │  Driver clicks "وصلت"                │
        │  ─── (DB: accepted → arrived) ──▶    │
        │         │                            │
        │    [DB Webhook → ride-updates]       │
        │         └──── "🚨 الكابتن وصل!" ───▶│
        │                                      │
        │  Driver clicks "إنهاء الرحلة"        │
        │  ─── (DB: → completed) ──▶           │
        │         │                            │
        │    [ride-updates EF]                 │
        │         └──── Receipt + ⭐ Buttons ─▶│
        │                                      │
        │                ◀── [⭐ 5] ───────────│ Passenger rates
        │    [ride_ratings UPSERT]             │
        │    [drivers.rating UPDATE]           │
        │                                      │
```

---

## 🧪 Testing Checklist

- [ ] Passenger books ride via WhatsApp → receives confirmation with buttons
- [ ] Click `📍 موقع السائق` → receives tracking link (ride status unchanged)
- [ ] Click `💬 راسل السائق` → enters chat sub-state
- [ ] Type message → appears in Driver App chat
- [ ] Driver replies in app → message appears in WhatsApp
- [ ] Type "خلص" → exits chat sub-state
- [ ] Driver clicks "وصلت" → passenger receives alert
- [ ] Driver clicks "إنهاء الرحلة" → passenger receives receipt
- [ ] Click rating button → rating saved, driver average updated
- [ ] Same flow for Telegram bot
- [ ] Chat remains open during arrived/in_progress states (parallel)
- [ ] Invalid state transitions are logged as warnings

---

*Document Author: Antigravity AI / RAAN Development Team*
*Last Updated: 2026-02-25*
