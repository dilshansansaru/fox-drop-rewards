import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "@/lib/config";
import { REWARDS } from "@/lib/config";
import { mainButtons, sendPhotoOrText, sendMessage, notifyAdmins } from "@/lib/bot.server";

const WELCOME = `🦊 <b>FOXDROP AIRDROP</b>

Welcome to the official FOXDROP airdrop bot!

🎁 <b>Instant Referral Reward:</b> ${REWARDS.referralTokens} FOX + ${REWARDS.referralUsdt} USDT
📺 <b>Daily Ads:</b> up to ${REWARDS.dailyAdsGoal} ads / day
💰 <b>Withdraw:</b> min ${REWARDS.minWithdraw} USDT (BEP-20) — fee ${REWARDS.withdrawFee} USDT
💎 <b>1 FOX = $0.001</b> · Token exchange & full withdraw opens <b>2027 Q2</b>

Tap <b>🚀 Open Mini App</b> to start earning.`;

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
