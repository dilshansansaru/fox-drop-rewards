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
  updateDoc,
  where,
  addDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getDb } from "./firebase";
import { REWARDS, type AdProviderId } from "./config";
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

const userRef = (id: string) => doc(getDb(), "users", id);

async function fetchIp(): Promise<string> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = (await r.json()) as { ip?: string };
    return j.ip ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function callBot(action: string, payload: Record<string, unknown>) {
  try {
    await fetch("/api/public/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg()?.initData ?? "", action, payload }),
    });
  } catch {
    /* notifications are best-effort */
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
    const snap = await getDoc(ref);
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
    if (fresh.referredBy) await creditReferral(fresh.referredBy, fresh, ip);
    return fresh;
  } catch (e) {
    console.warn("Firestore unavailable — using offline mode", e);
    localMode = true;
    return localGet(fresh);
  }
}


async function creditReferral(inviterId: string, invitee: UserDoc, ip: string) {
  const db = getDb();
  // Fraud guard: same IP already used by another account → block, keep history.
  const dupes = await getDocs(
    query(collection(db, "users"), where("ip", "==", ip), limit(5)),
  ).catch(() => null);
  const suspicious = !!dupes && dupes.docs.filter((d) => d.id !== invitee.id).length > 0;

  const status: ReferralStatus = suspicious ? "blocked" : "credited";
  // Doc id = referred Telegram user id, so milestones can be updated live.
  await setDoc(doc(db, "referrals", invitee.id), {
    inviterId,
    userId: invitee.id,
    name: invitee.name,
    username: invitee.username,
    status,
    reason: suspicious ? "Duplicate IP detected" : "",
    tokens: suspicious ? 0 : REWARDS.referralTokens,
    usdt: suspicious ? 0 : REWARDS.referralUsdt,
    ads: 0,
    dayIndex: 1,
    milestones: {},
    ip,
    createdAt: serverTimestamp(),
  });

  if (suspicious) return;

  await updateDoc(userRef(inviterId), {
    tokens: increment(REWARDS.referralTokens),
    usdt: increment(REWARDS.referralUsdt),
    refCount: increment(1),
  }).catch(() => null);

  void callBot("referral-joined", {
    inviterId,
    tokens: REWARDS.referralTokens,
    usdt: REWARDS.referralUsdt,
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

export async function awardAd(userId: string, provider: AdProviderId, reward: number) {
  if (isLocalMode()) {
    localPatch((u) => ({
      ...u,
      tokens: u.tokens + reward,
      totalAds: (u.totalAds ?? 0) + 1,
      adsDate: today(),
      adsToday: { ...u.adsToday, [provider]: (u.adsToday?.[provider] ?? 0) + 1 },
    }));
    return;
  }
  await updateDoc(userRef(userId), {
    tokens: increment(reward),
    totalAds: increment(1),
    [`adsToday.${provider}`]: increment(1),
    adsDate: today(),
  });
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

export async function claimSecurityBonus(userId: string) {
  if (isLocalMode()) {
    localPatch((u) => ({
      ...u,
      securityChecked: true,
      tokens: u.tokens + REWARDS.securityCheckTokens,
    }));
    return;
  }
  await updateDoc(userRef(userId), {
    securityChecked: true,
    tokens: increment(REWARDS.securityCheckTokens),
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

export async function requestWithdraw(user: UserDoc, amount: number, address: string) {
  if (isLocalMode()) {
    localPatch((u) => ({ ...u, usdt: u.usdt - (amount + REWARDS.withdrawFee) }));
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
    fee: REWARDS.withdrawFee,
    address,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  await updateDoc(userRef(user.id), { usdt: increment(-(amount + REWARDS.withdrawFee)) });
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
      orderBy("createdAt", "desc"),
      limit(50),
    );
    return onSnapshot(
      q,
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Referral)),
      () => setItems([]),
    );
  }, [inviterId]);
  return items;
}

export function useWithdrawals(userId?: string) {
  const [items, setItems] = useState<Withdrawal[]>([]);
  useEffect(() => {
    const base = collection(getDb(), "withdrawals");
    const q = userId
      ? query(base, where("userId", "==", userId), orderBy("createdAt", "desc"), limit(50))
      : query(base, orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(
      q,
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Withdrawal)),
      () => setItems([]),
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
}

export function useAllUsers(enabled: boolean) {
  const [items, setItems] = useState<UserDoc[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(getDb(), "users"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(
      q,
      (s) => setItems(s.docs.map((d) => ({ ...(d.data() as UserDoc), id: d.id }))),
      () => setItems([]),
    );
  }, [enabled]);
  return items;
}
