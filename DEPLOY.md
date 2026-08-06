# 🦊 FOXDROP — Deploy & Setup

## 1. Environment variables

Copy `.env.example` and fill it in (Vercel → Project → Settings → Environment Variables).

| Variable | Where | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | server | Bot API token (`@Fox_Drop_Bot`) |
| `ADMIN_CHAT_IDS` | server | Comma-separated admin chat ids for new-user / withdraw notifications |
| `PAYMENT_CHANNEL_ID` | server | `@FoxDroppayment` or numeric `-100…` id (bot must be admin) |
| `WELCOME_PHOTO_URL` | server | Public https photo used in `/start` + welcome message |
| `TELEGRAM_WEBHOOK_SECRET` | server | Secret token you also pass to `setWebhook` |
| `ALLOW_UNVERIFIED_TG` | server | `true` only for local testing |
| `VITE_ADMIN_CHAT_IDS` | client | Telegram user ids that see the Admin tab |
| `VITE_ADSGRAM_BLOCK_ID` | client | Adsgram block id |
| `VITE_MONETAG_ZONE` | client | Monetag zone id |
| `VITE_GIGAPUB_ID` | client | GigaPub project id |
| `VITE_TOWERADS_ID` | client | Tower Ads id |

Ad networks fall back to a built-in 5-second ad view when an id is missing, so rewards keep working.

## 2. Firebase

Firebase config is already embedded (`src/lib/firebase.ts`) — publishable values only.
Deploy the rules in `firestore.rules` (Firebase Console → Firestore → Rules) and create the
database in production mode. Collections used: `users`, `referrals`, `withdrawals`.
If Firestore is unreachable, the app automatically runs in offline mode with local storage.

## 3. Telegram bot webhook

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<your-domain>/api/public/telegram/webhook",
       "secret_token":"<TELEGRAM_WEBHOOK_SECRET>",
       "allowed_updates":["message"]}'
```

Also set the Mini App URL in BotFather → `/newapp` → short name `play`, so the referral link
`https://t.me/Fox_Drop_Bot/play?startapp=<userId>` opens the app.

## 4. Vercel

`bun run build` output is served by the TanStack Start server preset. On Vercel choose
"Other" framework preset, build command `bun run build`, and add all env vars above.
`/api/public/*` routes (bot webhook + notifications) are public by design and are protected by
the Telegram secret token and initData HMAC verification.

## 5. Reward configuration

Everything (ad rewards, limits, tasks, USDT milestones, allocation, roadmap) lives in
`src/lib/config.ts`.
