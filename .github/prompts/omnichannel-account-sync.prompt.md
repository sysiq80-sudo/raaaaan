---
description: "Implement omnichannel account sync between App and Bot (WhatsApp/Telegram). Handles Ghost Accounts, phone E.164 normalization, wallet sync, and cross-platform user binding."
agent: "agent"
---
# Omnichannel Account Sync & Ghost Accounts (App ↔ Bot)

Role: Lead Backend Architect.

## Context
The RAAN taxi app requires seamless, omnichannel account architecture. A user must share the EXACT same profile, wallet balance, and ride history regardless of whether they registered via the Mobile App (requires password) or the Bot (passwordless).

## Action Items

### 1. Phone Number Standardization (Core Rule)
- ALL phone numbers saved in `profiles` and `auth.users` must be in E.164 format (`+96478...`)
- Use `_shared/phoneUtils.ts` (backend) or `src/lib/phoneUtils.ts` (frontend)
- This is crucial for matching WhatsApp numbers with App numbers

### 2. Ghost Account Logic (Bot-First Users)
In `whatsapp-webhook` and `telegram-ai-booking`, the `findOrCreateUser` function must:
- Search profiles by **all phone format variants** (E.164, local, legacy wa_ prefix)
- If user exists → bind session to existing `user_id` (no duplicate!)
- If user does NOT exist → use `supabase.auth.admin.createUser` with:
  - `phone`: E.164 format
  - `password`: `crypto.randomUUID()` (Ghost Password)
  - `phone_confirm: true`
  - `user_metadata.is_ghost_account: true`
- Insert profile with E.164 phone

### 3. App-First Users Sync
- Bot must search profiles by multiple phone formats before creating
- If phone matches existing App user → bind, don't create duplicate
- Update `user_metadata` with `whatsapp_linked: true`

### 4. Wallet Single Source of Truth
- ALL wallet queries must use `profiles.wallet_balance` with unified `user_id`
- Fix any queries using `.eq("id", riderId)` → `.eq("user_id", riderId)`

### 5. Frontend App Auth (For Flutter/React Native)
- When `is_phone_registered` returns true for a Ghost Account:
  - Send OTP to verify identity
  - After verification: `supabase.auth.updateUser({ password: new_password })`
  - Clear ghost flag: `user_metadata.is_ghost_account = false`

## Key Files
- [supabase/functions/_shared/phoneUtils.ts](supabase/functions/_shared/phoneUtils.ts) — E.164 normalization
- [supabase/functions/whatsapp-webhook/lib/user-session.ts](supabase/functions/whatsapp-webhook/lib/user-session.ts) — WhatsApp user creation
- [supabase/functions/telegram-ai-booking/index.ts](supabase/functions/telegram-ai-booking/index.ts) — Telegram user creation
- [src/pages/Auth.tsx](src/pages/Auth.tsx) — App auth flow
- [src/lib/phoneUtils.ts](src/lib/phoneUtils.ts) — Frontend phone normalization

## Critical Rules
- Never create duplicate profiles for the same phone number
- Never modify `final_fare` after ride is `completed`
- Always use E.164 for phone storage
- Document all changes in project documentation with date
