/**
 * Admin authentication.
 *
 * The admin panel is protected by a real Firebase Auth account (not a password
 * kept in the app code), and the Firestore security rules only allow
 * admin-level writes when the signed-in account is exactly this one. So even if
 * someone opens the admin screen or calls Firestore directly, no admin write
 * goes through without a valid Firebase login.
 */
import { useEffect, useState } from "react";
import type { Auth, User } from "firebase/auth";
import { getFirebaseApp } from "./firebase";

/** Admin account. Create it in Firebase Console → Authentication → Users. */
export const ADMIN_USERNAME = "hasanbuddika1";
export const ADMIN_EMAIL = "hasanbuddika1@foxdrop.app";

let authInstance: Auth | null = null;

async function getAuthInstance(): Promise<Auth> {
  if (!authInstance) {
    const { getAuth } = await import("firebase/auth");
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

function friendly(code: string) {
  if (code.includes("wrong-password") || code.includes("invalid-credential"))
    return "Wrong username or password.";
  if (code.includes("user-not-found"))
    return "Admin account not found. Create it in Firebase Authentication first.";
  if (code.includes("too-many-requests")) return "Too many attempts — try again in a few minutes.";
  if (code.includes("operation-not-allowed"))
    return "Enable Email/Password sign-in in Firebase Authentication.";
  return "Login failed. Please try again.";
}

export async function adminLogin(username: string, password: string) {
  const email = username.includes("@") ? username.trim() : ADMIN_EMAIL;
  if (username.trim().toLowerCase() !== ADMIN_USERNAME && !username.includes("@")) {
    throw new Error("Wrong username or password.");
  }
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  try {
    const cred = await signInWithEmailAndPassword(await getAuthInstance(), email, password);
    if (cred.user.email !== ADMIN_EMAIL) {
      const { signOut } = await import("firebase/auth");
      await signOut(await getAuthInstance());
      throw new Error("This account has no admin access.");
    }
    return cred.user;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code) throw new Error(friendly(code));
    throw e;
  }
}

export async function adminLogout() {
  const { signOut } = await import("firebase/auth");
  await signOut(await getAuthInstance());
}

/** Live admin session state. `isAdmin` is true only for the admin account. */
export function useAdminSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop = () => {};
    (async () => {
      const { onAuthStateChanged } = await import("firebase/auth");
      stop = onAuthStateChanged(await getAuthInstance(), (u) => {
        setUser(u);
        setReady(true);
      });
    })().catch(() => setReady(true));
    return () => stop();
  }, []);

  return { user, ready, isAdmin: user?.email === ADMIN_EMAIL };
}
