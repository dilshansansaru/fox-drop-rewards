import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCV6T12khKyN4JxYcnpQ0N8dDy6F5ZUw2o",
  authDomain: "foxdrop-e9cad.firebaseapp.com",
  projectId: "foxdrop-e9cad",
  storageBucket: "foxdrop-e9cad.firebasestorage.app",
  messagingSenderId: "780712618382",
  appId: "1:780712618382:web:1ef6e948e76e617b6e5cdf",
  measurementId: "G-PXQYYFTQSG",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

/** Analytics is browser-only and optional; never block the app on it. */
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(getFirebaseApp());
  } catch {
    /* analytics blocked — ignore */
  }
}
