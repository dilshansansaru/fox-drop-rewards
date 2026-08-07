import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "@/lib/config";
import { REWARDS } from "@/lib/config";
import { mainButtons, sendPhotoOrText, sendMessage, notifyAdmins } from "@/lib/bot.server";

const WELCOME = `🦊 <b>WELCOME TO FOXDROP AIRDROP</b>

Earn FOX tokens and real USDT rewards from the official FOXDROP Telegram Mini App.

🎁 <b>WELCOME & TASK REWARDS</b>
• Pass the security check and complete Telegram tasks
• Watch ads from multiple providers and collect FOX
• Ad tasks: 10 / 20 / 50 total ads → 0.002 / 0.005 / 0.01 USDT

👥 <b>REFERRAL SYSTEM</b>
• Every verified friend → ${REWARDS.referralTokens} FOX + ${REWARDS.referralUsdt} USDT instantly
• Friend watches ${REWARDS.day1AdsGoal} ads on day 1 → +${REWARDS.day1Usdt} USDT
• Friend watches ${REWARDS.day2AdsGoal} ads on day 2 → +${REWARDS.day2Usdt} USDT
• Invite 5 / 10 / 25 / 75 friends → 0.005 / 0.01 / 0.03 / 0.1 USDT

💰 <b>WITHDRAWALS</b>
• Minimum: ${REWARDS.minWithdraw} USDT
• Network: BEP-20 (BSC)
• Fee: ${REWARDS.withdrawFee} USDT
• Processing: within 24 hours
• Bot notifications are sent for request, approval, rejection and payment proof

💎 <b>FOX TOKEN</b>
1 FOX = $0.001 · FOX exchange and full token withdrawal open in <b>2027 Q2</b>.

Tap <b>🚀 Open Mini App</b> now. Your live balance, referral progress, leaderboard and withdrawal history are available inside.`;

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: {
          message?: {
            chat?: { id?: number };
            from?: { id?: number; first_name?: string; username?: string };
            text?: string;
          };
        };
        try {
          update = await request.json();
        } catch {
          return Response.json({ ok: true, ignored: true });
        }

        const msg = update.message;
        const chatId = msg?.chat?.id;
        const text = msg?.text ?? "";
        if (!chatId) return Response.json({ ok: true, ignored: true });

        if (text.startsWith("/start")) {
          const ref = text.split(" ")[1];
          await sendPhotoOrText(chatId, WELCOME, mainButtons());
          if (ref) {
            await sendMessage(
              chatId,
              `👥 You joined via referral code <code>${ref}</code>. Open the mini app to lock in your bonus.`,
              mainButtons(),
            );
          }
          await notifyAdmins(
            `🆕 <b>New user started the bot</b>\n👤 ${msg?.from?.first_name ?? "-"} (@${msg?.from?.username ?? "none"})\n🆔 <code>${msg?.from?.id}</code>`,
          );
          return Response.json({ ok: true });
        }

        if (text.startsWith("/help") || text.startsWith("/guide")) {
          await sendMessage(
            chatId,
            `📖 <b>FOXDROP GUIDE</b>\n\n1️⃣ Open the mini app & pass the security check\n2️⃣ Complete Main / Partner / Community tasks\n3️⃣ Watch daily ads (${REWARDS.dailyAdsGoal}/day)\n4️⃣ Invite friends → ${REWARDS.referralTokens} FOX + ${REWARDS.referralUsdt} USDT instantly\n5️⃣ Withdraw from ${REWARDS.minWithdraw} USDT to your ${"BEP-20"} address\n\n⏱ Withdrawals are processed within 24 hours.`,
            mainButtons(),
          );
          return Response.json({ ok: true });
        }

        await sendMessage(chatId, `🦊 Use <b>🚀 Open Mini App</b> to earn.\n${BRAND.miniAppUrl}`, mainButtons());
        return Response.json({ ok: true });
      },
    },
  },
});
