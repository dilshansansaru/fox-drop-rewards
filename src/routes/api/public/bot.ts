import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  adminIds,
  fmt,
  getChatMember,
  mainButtons,
  notifyAdmins,
  paymentChannelId,
  sendMessage,
  verifyInitData,
} from "@/lib/bot.server";
import { BRAND } from "@/lib/config";

const schema = z.object({
  initData: z.string().default(""),
  action: z.enum([
    "new-user",
    "verify-task",
    "referral-joined",
    "referral-milestone",
    "withdraw-request",
    "withdraw-approved",
    "withdraw-rejected",
    "admin-message",
    "broadcast",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});


const txButtons = (txid?: string) => ({
  inline_keyboard: [
    [
      {
        text: "📋 View Transaction",
        url: txid ? `https://bscscan.com/tx/${txid}` : "https://bscscan.com",
      },
    ],
    [{ text: "🚀 Open Mini App", url: BRAND.miniAppUrl }],
    [{ text: "💳 Payment Channel", url: BRAND.payment }],
  ],
});

export const Route = createFileRoute("/api/public/bot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
        const { initData, action, payload } = parsed.data;

        const verifiedId = await verifyInitData(initData);
        const devMode = process.env["ALLOW_UNVERIFIED_TG"] === "true";
        if (!verifiedId && !devMode) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const uid = verifiedId ?? Number(payload["userId"] ?? 0);
        const p = payload as Record<string, string | number | undefined>;

        try {
          switch (action) {
            case "new-user": {
              await notifyAdmins(
                `🆕 <b>New FOXDROP user</b>\n👤 ${p["name"] ?? "-"} (@${p["username"] ?? "none"})\n🆔 <code>${uid}</code>\n🔗 Ref: <code>${p["ref"] ?? "direct"}</code>`,
              );
              return Response.json({ ok: true });
            }
            case "verify-task": {
              const chat = String(p["chat"] ?? "");
              if (!chat) return Response.json({ verified: false });
              const verified = await getChatMember(chat, uid);
              return Response.json({ verified });
            }
            case "referral-joined": {
              const inviter = String(p["inviterId"] ?? "");
              if (inviter) {
                await sendMessage(
                  inviter,
                  `🎉 <b>NEW REFERRAL REWARD</b>\n\nA verified friend joined FOXDROP with your link.\n\n🦊 +${fmt.fox(Number(p["tokens"] ?? 350))}\n💵 +${fmt.usdt(Number(p["usdt"] ?? 0.0025))}\n\n✅ The rewards were credited instantly.\n📺 Earn another ${fmt.usdt(0.005)} when this friend watches 10 ads on day 1, and ${fmt.usdt(0.005)} after 15 ads on day 2.`,
                  mainButtons(),
                );
              }
              return Response.json({ ok: true });
            }
            case "referral-milestone": {
              const inviter = String(p["inviterId"] ?? "");
              if (inviter) {
                await sendMessage(
                  inviter,
                  `🎯 <b>Referral milestone reached!</b>\n\n👤 ${p["name"] ?? "Your friend"} watched ${Number(p["ads"] ?? 0)} ads\n+${fmt.usdt(Number(p["usdt"] ?? 0))} credited to you`,
                  mainButtons(),
                );
              }
              return Response.json({ ok: true });
            }
            case "withdraw-request": {
              const body = `💰 <b>WITHDRAW REQUEST</b>\n\n👤 ${p["name"] ?? "-"} (@${p["username"] ?? "none"})\n🆔 <code>${uid}</code>\n💵 ${fmt.usdt(Number(p["amount"] ?? 0))}\n🏦 ${"BEP-20"}\n📮 <code>${p["address"] ?? "-"}</code>\n🧾 ID: <code>${p["id"] ?? "-"}</code>`;
              await notifyAdmins(body);
              await sendMessage(
                uid,
                `💰 <b>Withdraw request received</b>\n\n💵 ${fmt.usdt(Number(p["amount"] ?? 0))}\n📮 <code>${p["address"] ?? "-"}</code>\n\n⏱ You will receive your payment within <b>24 hours</b>.`,
                mainButtons(),
              );
              return Response.json({ ok: true });
            }
            case "withdraw-approved": {
              if (!adminIds().includes(String(uid)) && !devMode) {
                return Response.json({ error: "Forbidden" }, { status: 403 });
              }
              const txid = p["txid"] ? String(p["txid"]) : undefined;
              const target = String(p["targetId"] ?? "");
              const text = `✅ <b>WITHDRAW APPROVED</b>\n\n👤 @${p["username"] ?? "user"}\n💵 ${fmt.usdt(Number(p["amount"] ?? 0))}\n🏦 ${"BEP-20"}\n🧾 TX: <code>${txid ?? "-"}</code>`;
              if (target) await sendMessage(target, text, txButtons(txid));
              await notifyAdmins(`🛠️ <b>ADMIN PAYMENT CONFIRMATION</b>\n\n${text}`, txButtons(txid));
              const channel = paymentChannelId();
              if (channel) await sendMessage(channel, `💸 <b>PAYMENT SENT</b>\n\n${text}`, txButtons(txid));
              return Response.json({ ok: true });
            }
            case "withdraw-rejected": {
              if (!adminIds().includes(String(uid)) && !devMode) {
                return Response.json({ error: "Forbidden" }, { status: 403 });
              }
              const target = String(p["targetId"] ?? "");
              const text = `❌ <b>WITHDRAWAL REJECTED</b>\n\n🧾 Request: <code>${p["id"] ?? "-"}</code>\n💵 ${fmt.usdt(Number(p["amount"] ?? 0))}\n\nThe withdrawal amount and fee have been refunded to your FOXDROP balance. Please check your wallet details before trying again.`;
              if (target) await sendMessage(target, text, mainButtons());
              await notifyAdmins(`🛠️ <b>WITHDRAWAL REJECTED & REFUNDED</b>\n\n👤 @${p["username"] ?? "user"}\n${text}`);
              return Response.json({ ok: true });
            }
            case "admin-message": {
              if (!adminIds().includes(String(uid)) && !devMode) {
                return Response.json({ error: "Forbidden" }, { status: 403 });
              }
              const target = String(p["targetId"] ?? "");
              const text = String(p["text"] ?? "");
              if (target && text) await sendMessage(target, text, mainButtons());
              return Response.json({ ok: true });
            }
            case "broadcast": {
              if (!adminIds().includes(String(uid)) && !devMode) {
                return Response.json({ error: "Forbidden" }, { status: 403 });
              }
              const text = String(p["text"] ?? "");
              const raw = payload["ids"];
              const ids = Array.isArray(raw) ? raw.map(String).filter(Boolean).slice(0, 500) : [];
              if (!text || !ids.length) {
                return Response.json({ error: "text and ids are required" }, { status: 400 });
              }
              const results = await Promise.allSettled(
                ids.map((id) => sendMessage(id, `📢 <b>FOXDROP ANNOUNCEMENT</b>\n\n${text}`, mainButtons())),
              );
              const sent = results.filter((r) => r.status === "fulfilled").length;
              return Response.json({ ok: true, sent, failed: results.length - sent });
            }
          }

        } catch (e) {
          console.error("bot action failed", e);
          return Response.json({ error: (e as Error).message }, { status: 502 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
