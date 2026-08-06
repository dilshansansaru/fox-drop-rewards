import type { UserDoc } from "./store";

/**
 * Offline fallback store. Used when Firestore is unreachable or its rules are
 * not deployed yet, so the mini app keeps working for the current user.
 */
const KEY = "foxdrop:user";
const listeners = new Set<(u: UserDoc) => void>();

export function localGet(seed: UserDoc): UserDoc {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...seed, ...(JSON.parse(raw) as UserDoc) };
  } catch {
    /* ignore */
  }
  localSet(seed);
  return seed;
}

export function localSet(user: UserDoc) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(user));
}

export function localPatch(patch: (u: UserDoc) => UserDoc) {
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return;
  localSet(patch(JSON.parse(raw) as UserDoc));
}

export function localSubscribe(cb: (u: UserDoc) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
