import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  runTransaction,
  updateDoc,
  where,
  addDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getDb } from "./firebase";
import { REFERRAL_MILESTONES, REWARDS, type AdProviderId } from "./config";
import { currentTgUser, startParam, tg } from "./telegram";
import { localGet, localPatch, localSubscribe } from "./local";

export type ReferralStatus = "pending" | "verified" | "credited" | "blocked";

export type Referral = {
  id: string;
  inviterId: string;
  userId: string;
  name: string;
  username: string;
  status: ReferralStatus;
  reason?: string;
  tokens: number;
  usdt: number;
  /** live ad progress of the referred Telegram user */
  ads?: number;
  dayIndex?: number;
  milestones?: Record<string, boolean>;
  createdAt?: unknown;
};

export type UserDoc = {
  id: string;
  name: string;
  username: string;
  tokens: number;
  usdt: number;
  refCount: number;
  referredBy: string | null;
  tasks: Record<string, boolean>;
  adsToday: Partial<Record<AdProviderId, number>>;
  adsDate: string;
  totalAds: number;
  dayIndex: number;
  dayBonusClaimed: Record<string, boolean>;
  securityChecked: boolean;
  ip: string;
  blocked: boolean;
  createdAt?: unknown;
};

export type Withdrawal = {
  id: string;
  userId: string;
  name: string;
  username: string;
  amount: number;
  fee: number;
  address: string;
  status: "pending" | "approved" | "rejected";
  txid?: string;
  createdAt?: unknown;
};

export const today = () => new Date().toISOString().slice(0, 10);

function timestampMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value) {
    const toMillis = (value as { toMillis?: () => number }).toMillis;
    return typeof toMillis === "function" ? toMillis.call(value) : 0;
  }
  return 0;
}

const userRef = (id: string) => doc(getDb(), "users", id);

async function fetchIp(): Promise<string> {
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { ip?: string };
    return j.ip ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function callBot(action: string, payload: Record<string, unknown>) {
  try {
    const response = await fetch("/api/public/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg()?.initData ?? "", action, payload }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Bot notification failed [${response.status}]: ${body}`);
    }
  } catch (error) {
    console.error("Bot notification request failed", error);
  }
}

export async function verifyTelegramMembership(chat: string, userId: string) {
  try {
    const res = await fetch("/api/public/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData: tg()?.initData ?? "",
        action: "verify-task",
        payload: { chat, userId },
      }),
    });
    const j = (await res.json()) as { verified?: boolean };
    return !!j.verified;
  } catch {
    return false;
  }
}

let localMode = false;
export const isLocalMode = () => localMode;

/** Creates the user document on first open and handles referral crediting + IP fraud checks. */
export async function ensureUser(): Promise<UserDoc> {
  const tgu = currentTgUser();
  const id = String(tgu.id);
  const inviter = startParam();
  const name = [tgu.first_name, tgu.last_name].filter(Boolean).join(" ") || "Fox";

  const fresh: UserDoc = {
    id,
    name,
    username: tgu.username ?? "",
    tokens: 0,
    usdt: 0,
    refCount: 0,
    referredBy: inviter && inviter !== id ? inviter : null,
    tasks: {},
    adsToday: {},
    adsDate: today(),
    totalAds: 0,
    dayIndex: 1,
    dayBonusClaimed: {},
    securityChecked: false,
    ip: "unknown",
    blocked: false,
  };

  try {
    const ref = userRef(id);
    const snap = await Promise.race([
      getDoc(ref),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("Firebase connection timed out")), 8000),
      ),
    ]);
    const ip = await fetchIp();

    if (snap.exists()) {
      const data = snap.data() as UserDoc;
      if (data.adsDate !== today()) {
        await updateDoc(ref, { adsDate: today(), adsToday: {}, dayIndex: (data.dayIndex ?? 0) + 1 });
      }
      return { ...data, id };
    }

    fresh.ip = ip;
    await setDoc(ref, { ...fresh, createdAt: serverTimestamp() });
    void callBot("new-user", { userId: id, name, username: tgu.username, ref: inviter });
    if (fresh.referredBy) {
      try {
        await creditReferral(fresh.referredBy, fresh, ip);
      } catch (error) {
        console.error("Referral credit failed", error);
      }
    }
    return fresh;
  } catch (e) {
    console.warn("Firestore unavailable — using offline mode", e);
    localMode = true;
    return localGet(fresh);
  }
}


async function creditReferral(inviterId: string, invitee: UserDoc, ip: string) {
  const db = getDb();
  const settingsSnap = await getDoc(doc(db, "app_config", "settings")).catch(() => null);
  const liveSettings = settingsSnap?.data() as { referralTokens?: number; referralUsdt?: number } | undefined;
  const referralTokens = liveSettings?.referralTokens ?? REWARDS.referralTokens;
  const referralUsdt = liveSettings?.referralUsdt ?? REWARDS.referralUsdt;
  // Fraud guard: same IP already used by another account → block, keep history.
  const dupes = await getDocs(
    query(collection(db, "users"), where("ip", "==", ip), limit(5)),
  ).catch(() => null);
  const suspicious = ip !== "unknown" && !!dupes && dupes.docs.some((d) => d.id !== invitee.id);

  const status: ReferralStatus = suspicious ? "blocked" : "credited";
  // Doc id = referred Telegram user id, so milestones can be updated live.
  const created = await runTransaction(db, async (transaction) => {
    const referralRef = doc(db, "referrals", invitee.id);
    const inviterRef = userRef(inviterId);
    const [existingReferral, inviterSnap] = await Promise.all([
      transaction.get(referralRef),
      transaction.get(inviterRef),
    ]);
    if (existingReferral.exists()) return false;
    if (!inviterSnap.exists()) throw new Error("Inviter account was not found");

    transaction.set(referralRef, {
      inviterId,
      userId: invitee.id,
      name: invitee.name,
      username: invitee.username,
      status,
      reason: suspicious ? "Duplicate IP detected" : "",
       tokens: suspicious ? 0 : referralTokens,
       usdt: suspicious ? 0 : referralUsdt,
      ads: 0,
      dayIndex: 1,
      milestones: {},
      ip,
      createdAt: serverTimestamp(),
    });
    if (!suspicious) {
      transaction.update(inviterRef, {
         tokens: increment(referralTokens),
         usdt: increment(referralUsdt),
        refCount: increment(1),
      });
    }
    return true;
  });

  if (suspicious || !created) return;

  void callBot("referral-joined", {
    inviterId,
    tokens: referralTokens,
    usdt: referralUsdt,
  });
}

export function useUser() {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const u = await ensureUser();
        setUser(u);
        if (isLocalMode()) {
          const off = localSubscribe(setUser);
          unsub = () => {
            off();
          };
        } else {
          unsub = onSnapshot(userRef(u.id), (snap) => {
            if (snap.exists()) setUser({ ...(snap.data() as UserDoc), id: u.id });
          });
        }
      } catch (e) {
        console.error("ensureUser failed", e);
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub();
  }, []);

  return { user, loading };
}

/**
 * Credits the inviter when the referred Telegram user hits an ad milestone
 * (day 1 → 10 ads, day 2 → 15 ads). Runs live on every ad view.
 */
async function creditReferralMilestones(user: UserDoc, adsToday: number) {
  if (!user.referredBy || isLocalMode()) return;
  const inviterId = user.referredBy;
  const day = user.dayIndex ?? 1;
  const m = REFERRAL_MILESTONES.find(
    (x) => (x.day === 1 ? day <= 1 : day >= x.day) && adsToday >= x.ads,
  );
  if (!m) return;

  const refDoc = doc(getDb(), "referrals", user.id);
  const credited = await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(refDoc);
    if (!snap.exists()) return false;
    const data = snap.data() as Referral;
    if (data.status === "blocked" || data.milestones?.[m.key]) {
      transaction.update(refDoc, { ads: adsToday, dayIndex: day });
      return false;
    }
    transaction.update(refDoc, {
      ads: adsToday,
      dayIndex: day,
      [`milestones.${m.key}`]: true,
      usdt: increment(m.usdt),
    });
    transaction.update(userRef(inviterId), { usdt: increment(m.usdt) });
    return true;
  }).catch((error) => {
    console.error("Referral milestone credit failed", error);
    return false;
  });
  if (!credited) return;
  void callBot("referral-milestone", {
    inviterId,
    name: user.name,
    ads: m.ads,
    usdt: m.usdt,
  });
}

export async function awardAd(user: UserDoc, provider: AdProviderId, reward: number) {
  const currentDate = today();
  const isNewUtcDay = user.adsDate !== currentDate;
  const currentAds = isNewUtcDay ? {} : user.adsToday ?? {};
  const adsToday = Object.values(currentAds).reduce((a, b) => a + (b ?? 0), 0) + 1;
  if (isLocalMode()) {
    localPatch((u) => ({
      ...u,
      tokens: u.tokens + reward,
      totalAds: (u.totalAds ?? 0) + 1,
      adsDate: today(),
      adsToday: { ...currentAds, [provider]: (currentAds[provider] ?? 0) + 1 },
    }));
    return;
  }
  await runTransaction(getDb(), async (transaction) => {
    const ref = userRef(user.id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("User account was not found");
    const live = snapshot.data() as UserDoc;
    const reset = live.adsDate !== currentDate;
    transaction.update(ref, {
      tokens: increment(reward),
      totalAds: increment(1),
      ...(reset
        ? { adsToday: { [provider]: 1 }, dayIndex: increment(1) }
        : { [`adsToday.${provider}`]: increment(1) }),
      adsDate: currentDate,
    });
  });
  await creditReferralMilestones(user, adsToday);
}

export async function completeTask(userId: string, taskId: string, tokens: number, usdt = 0) {
  if (isLocalMode()) {
    localPatch((u) => ({
      ...u,
      tokens: u.tokens + tokens,
      usdt: u.usdt + usdt,
      tasks: { ...u.tasks, [taskId]: true },
    }));
    return;
  }
  await updateDoc(userRef(userId), {
    [`tasks.${taskId}`]: true,
    tokens: increment(tokens),
    ...(usdt ? { usdt: increment(usdt) } : {}),
  });
}

export async function claimSecurityBonus(userId: string, reward = REWARDS.securityCheckTokens) {
  if (isLocalMode()) {
    localPatch((u) => ({
      ...u,
      securityChecked: true,
      tokens: u.tokens + reward,
    }));
    return;
  }
  await updateDoc(userRef(userId), {
    securityChecked: true,
    tokens: increment(reward),
  });
}

export async function claimDayBonus(userId: string, key: string, usdt: number) {
  if (isLocalMode()) {
    localPatch((u) => ({
      ...u,
      usdt: u.usdt + usdt,
      dayBonusClaimed: { ...u.dayBonusClaimed, [key]: true },
    }));
    return;
  }
  await updateDoc(userRef(userId), {
    [`dayBonusClaimed.${key}`]: true,
    usdt: increment(usdt),
  });
}

export async function requestWithdraw(
  user: UserDoc,
  amount: number,
  address: string,
  fee = REWARDS.withdrawFee,
) {
  if (isLocalMode()) {
    localPatch((u) => ({ ...u, usdt: u.usdt - (amount + fee) }));
    void callBot("withdraw-request", {
      id: "offline",
      amount,
      address,
      name: user.name,
      username: user.username,
    });
    return "offline";
  }
  const db = getDb();
  const ref = await addDoc(collection(db, "withdrawals"), {
    userId: user.id,
    name: user.name,
    username: user.username,
    amount,
    fee,
    address,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  await updateDoc(userRef(user.id), { usdt: increment(-(amount + fee)) });
  void callBot("withdraw-request", {
    id: ref.id,
    amount,
    address,
    name: user.name,
    username: user.username,
  });
  return ref.id;
}

export function useReferrals(inviterId: string | undefined) {
  const [items, setItems] = useState<Referral[]>([]);
  useEffect(() => {
    if (!inviterId) return;
    const q = query(
      collection(getDb(), "referrals"),
      where("inviterId", "==", inviterId),
      limit(50),
    );
    return onSnapshot(
      q,
      (s) => setItems(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Referral)
          .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt)),
      ),
      (error) => console.error("Referral subscription failed", error),
    );
  }, [inviterId]);
  return items;
}

export function useWithdrawals(userId?: string) {
  const [items, setItems] = useState<Withdrawal[]>([]);
  useEffect(() => {
    const base = collection(getDb(), "withdrawals");
    const q = userId ? query(base, where("userId", "==", userId), limit(100)) : query(base, limit(300));
    return onSnapshot(
      q,
      (s) => setItems(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Withdrawal)
          .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt)),
      ),
      (error) => console.error("Withdrawal subscription failed", error),
    );
  }, [userId]);
  return items;
}

export async function approveWithdrawal(w: Withdrawal, txid: string) {
  await updateDoc(doc(getDb(), "withdrawals", w.id), { status: "approved", txid });
  void callBot("withdraw-approved", {
    targetId: w.userId,
    username: w.username,
    amount: w.amount,
    txid,
  });
}

export async function rejectWithdrawal(w: Withdrawal) {
  await updateDoc(doc(getDb(), "withdrawals", w.id), { status: "rejected" });
  await updateDoc(userRef(w.userId), { usdt: increment(w.amount + w.fee) }).catch(() => null);
  void callBot("withdraw-rejected", {
    targetId: w.userId,
    username: w.username,
    amount: w.amount,
    id: w.id,
  });
}

export function useAllUsers(enabled = true) {
  const [items, setItems] = useState<UserDoc[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(getDb(), "users"), limit(500));
    return onSnapshot(
      q,
      (s) => setItems(
        s.docs
          .map((d) => ({ ...(d.data() as UserDoc), id: d.id }))
          .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt)),
      ),
      (error) => console.error("Users subscription failed", error),
    );
  }, [enabled]);
  return items;
}

export function useLeaderboard(max = 20) {
  const users = useAllUsers(true);
  return [...users].sort((a, b) => (b.refCount ?? 0) - (a.refCount ?? 0)).slice(0, max);
}

export function useAllReferrals(enabled = true) {
  const [items, setItems] = useState<Referral[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(getDb(), "referrals"), limit(500));
    return onSnapshot(
      q,
      (s) => setItems(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Referral)
          .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt)),
      ),
      (error) => console.error("Referral audit subscription failed", error),
    );
  }, [enabled]);
  return items;
}

/* ---------------- Admin actions ---------------- */

export async function adminAdjustBalance(
  userId: string,
  delta: { tokens?: number; usdt?: number },
  notify = true,
) {
  const patch: Record<string, unknown> = {};
  if (delta.tokens) patch["tokens"] = increment(delta.tokens);
  if (delta.usdt) patch["usdt"] = increment(delta.usdt);
  if (!Object.keys(patch).length) return;
  await updateDoc(userRef(userId), patch);
  if (notify) {
    void callBot("admin-message", {
      targetId: userId,
      text:
        `🛠️ <b>Balance updated by admin</b>\n\n` +
        `${delta.tokens ? `🦊 ${delta.tokens > 0 ? "+" : ""}${delta.tokens} FOX\n` : ""}` +
        `${delta.usdt ? `💵 ${delta.usdt > 0 ? "+" : ""}${delta.usdt} USDT\n` : ""}`,
    });
  }
}

export async function adminSetBlocked(userId: string, blocked: boolean) {
  await updateDoc(userRef(userId), { blocked });
  void callBot("admin-message", {
    targetId: userId,
    text: blocked
      ? "🚫 <b>Your FOXDROP account has been suspended</b>\n\nSuspicious activity was detected. Contact support if you think this is a mistake."
      : "✅ <b>Your FOXDROP account has been re-activated</b>\n\nYou can keep earning now.",
  });
}

export async function adminResetDailyAds(userId: string) {
  await updateDoc(userRef(userId), { adsToday: {}, adsDate: today() });
}

export async function adminSetReferralStatus(referral: Referral, status: ReferralStatus) {
  const db = getDb();
  await runTransaction(db, async (t) => {
    const refDoc = doc(db, "referrals", referral.id);
    const snap = await t.get(refDoc);
    if (!snap.exists()) return;
    const data = snap.data() as Referral;
    const wasPaid = data.status !== "blocked" && data.status !== "pending";
    const willPay = status !== "blocked" && status !== "pending";
    t.update(refDoc, { status, reason: status === "blocked" ? "Blocked by admin" : "" });
    if (!wasPaid && willPay) {
      t.update(userRef(data.inviterId), {
        tokens: increment(REWARDS.referralTokens),
        usdt: increment(REWARDS.referralUsdt),
        refCount: increment(1),
      });
      t.update(refDoc, { tokens: REWARDS.referralTokens, usdt: REWARDS.referralUsdt });
    }
    if (wasPaid && !willPay) {
      t.update(userRef(data.inviterId), {
        tokens: increment(-(data.tokens ?? 0)),
        usdt: increment(-(data.usdt ?? 0)),
        refCount: increment(-1),
      });
      t.update(refDoc, { tokens: 0, usdt: 0 });
    }
  });
}

export async function adminBroadcast(
  ids: string[],
  text: string,
  options?: { imageUrl?: string; buttonText?: string; buttonUrl?: string },
) {
  const res = await fetch("/api/public/bot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      initData: tg()?.initData ?? "",
      action: "broadcast",
      payload: { ids, text, ...options },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { sent?: number; failed?: number };
}

