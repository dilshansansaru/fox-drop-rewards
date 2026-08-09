/** Server-only Telegram bot helpers (never imported from client code). */
import { BRAND } from "./config";

const API = "https://api.telegram.org/bot";

function token() {
  const t = process.env["TELEGRAM_BOT_TOKEN"];
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return t;
}

export function adminIds(): string[] {
  return (process.env["ADMIN_CHAT_IDS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function paymentChannelId() {
  return process.env["PAYMENT_CHANNEL_ID"] ?? "";
}

export function welcomePhoto() {
  return process.env["WELCOME_PHOTO_URL"] ?? "";
}

async function call(method: string, body: unknown) {
  const res = await fetch(`${API}${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!res.ok || !json.ok) {
    console.error(`Telegram ${method} failed [${res.status}]: ${json.description ?? "unknown"}`);
  }
  return json;
}

export type Btn = { text: string; url: string };

export function mainButtons(extra: Btn[] = []) {
  return {
    inline_keyboard: [
      [{ text: "🚀 Open Mini App", url: BRAND.miniAppUrl }],
      [
        { text: "🌐 Community", url: BRAND.community },
        { text: "💳 Payment Channel", url: BRAND.payment },
      ],
      ...(extra.length ? [extra] : []),
    ],
  };
}

export async function sendMessage(chatId: string | number, text: string, buttons?: unknown) {
  const response = await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: buttons } : {}),
  });
  if (!response.ok) {
    throw new Error(response.description ?? `Telegram could not deliver a message to ${chatId}`);
  }
  return response;
}

export async function sendPhotoOrText(
  chatId: string | number,
  caption: string,
  buttons?: unknown,
) {
  const photo = welcomePhoto();
  if (photo) {
    const r = await call("sendPhoto", {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: "HTML",
      ...(buttons ? { reply_markup: buttons } : {}),
    });
    if (r.ok) return r;
  }
  return sendMessage(chatId, caption, buttons);
}

export async function sendPhoto(
  chatId: string | number,
  photo: string,
  caption: string,
  buttons?: unknown,
) {
  const response = await call("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...(buttons ? { reply_markup: buttons } : {}),
  });
  if (!response.ok) throw new Error(response.description ?? "Telegram could not deliver the photo");
  return response;
}

export async function getChatMember(chat: string, userId: number) {
  const r = (await call("getChatMember", { chat_id: chat, user_id: userId })) as {
    ok: boolean;
    result?: { status?: string };
  };
  const status = r.result?.status ?? "left";
  return r.ok && ["creator", "administrator", "member"].includes(status);
}

export async function notifyAdmins(text: string, buttons?: unknown) {
  const ids = adminIds();
  if (ids.length === 0) {
    console.error("ADMIN_CHAT_IDS is not configured");
    return;
  }
  const results = await Promise.allSettled(ids.map((id) => sendMessage(id, text, buttons)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Admin notification failed for ${ids[index]}`, result.reason);
    }
  });
}

/** Validates Telegram WebApp initData (HMAC-SHA256) and returns the user id. */
export async function verifyInitData(initData: string): Promise<number | null> {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    enc.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(token()));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dataCheckString));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== hash) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "{}") as { id?: number };
    return user.id ?? null;
  } catch {
    return null;
  }
}

export const fmt = {
  usdt: (n: number) => `${n.toFixed(4)} USDT`,
  fox: (n: number) => `${Math.round(n).toLocaleString("en-US")} FOX`,
};
