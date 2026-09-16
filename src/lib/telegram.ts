export type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  is_premium?: boolean;
  language_code?: string;
};

type TgWebApp = {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string };
  ready: () => void;
  expand: () => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (s: "light" | "medium" | "heavy") => void;
    notificationOccurred: (t: "success" | "warning" | "error") => void;
  };
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

export function tg(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;
}

export function initTelegram() {
  const w = tg();
  if (!w) return;
  w.ready();
  w.expand();
  w.setHeaderColor?.("#0F1115");
  w.setBackgroundColor?.("#0F1115");
}

export function haptic(kind: "light" | "success" | "error" = "light") {
  const w = tg();
  if (!w?.HapticFeedback) return;
  if (kind === "light") w.HapticFeedback.impactOccurred("light");
  else w.HapticFeedback.notificationOccurred(kind);
}

export function openLink(url: string) {
  const w = tg();
  if (w) {
    if (url.includes("t.me")) w.openTelegramLink(url);
    else w.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Local development only — never available in the deployed mini app. */
const DEV_USER: TgUser = { id: 999000001, first_name: "Guest", username: "guest_dev" };
const ALLOW_DEV_USER = import.meta.env.DEV;

/**
 * The Telegram user of the current session. Outside Telegram the app must not
 * work at all, so the id stays 0 and the UI shows the "Open in Telegram" gate.
 */
export function currentTgUser(): TgUser {
  const user = tg()?.initDataUnsafe?.user;
  if (user) return user;
  return ALLOW_DEV_USER ? DEV_USER : { id: 0, first_name: "" };
}

export function startParam(): string | null {
  const w = tg();
  const p = w?.initDataUnsafe?.start_param;
  if (p) return p;
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get("ref");
  }
  return null;
}

export function isInsideTelegram() {
  return !!tg();
}
