import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { AD_PROVIDERS, REWARDS, TASKS, TOKEN_PRICE_USD, type Task } from "./config";
import { getDb } from "./firebase";

export type AppSettings = {
  eligibilityEnabled: boolean;
  securityCheckTokens: number;
  referralTokens: number;
  referralUsdt: number;
  mainTaskUsdt: number;
  minWithdraw: number;
  withdrawFee: number;
  dailyAdsGoal: number;
  dailyReferGoal: number;
  tokenPriceUsd: number;
  resetTimezone: "UTC";
  adProviders: typeof AD_PROVIDERS;
  /** Ad network ids (editable from Admin → System). */
  adsgramBlockId: string;
  monetagZone: string;
  gigapubId: string;
  toweradsId: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  eligibilityEnabled: false,
  securityCheckTokens: REWARDS.securityCheckTokens,
  referralTokens: REWARDS.referralTokens,
  referralUsdt: REWARDS.referralUsdt,
  mainTaskUsdt: REWARDS.mainTaskUsdt,
  minWithdraw: REWARDS.minWithdraw,
  withdrawFee: REWARDS.withdrawFee,
  dailyAdsGoal: REWARDS.dailyAdsGoal,
  dailyReferGoal: REWARDS.dailyReferGoal,
  tokenPriceUsd: TOKEN_PRICE_USD,
  resetTimezone: "UTC",
  adProviders: AD_PROVIDERS,
  adsgramBlockId: (import.meta.env["VITE_ADSGRAM_BLOCK_ID"] as string | undefined) ?? "",
  monetagZone: (import.meta.env["VITE_MONETAG_ZONE"] as string | undefined) ?? "",
  gigapubId: (import.meta.env["VITE_GIGAPUB_ID"] as string | undefined) ?? "",
  toweradsId: (import.meta.env["VITE_TOWERADS_ID"] as string | undefined) ?? "",
};

/** Latest settings snapshot, readable outside React (ads.ts). */
let latestSettings: AppSettings = DEFAULT_SETTINGS;
export const getLatestSettings = () => latestSettings;

export function useAppSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        doc(getDb(), "app_config", "settings"),
        (snapshot) => {
          const merged = { ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<AppSettings> | undefined) };
          latestSettings = merged;
          setSettings(merged);
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [],
  );
  return { settings, loading };
}

export async function saveAppSettings(settings: AppSettings) {
  await setDoc(doc(getDb(), "app_config", "settings"), settings, { merge: true });
}

export function useLiveTasks() {
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  useEffect(
    () =>
      onSnapshot(
        doc(getDb(), "app_config", "tasks"),
        (snapshot) => {
          const data = snapshot.data() as { items?: Task[] } | undefined;
          // An existing empty array means the admin intentionally removed every task.
          // Only use the bundled defaults before a task configuration document exists.
          setTasks(Array.isArray(data?.items) ? data.items : TASKS);
        },
        () => setTasks(TASKS),
      ),
    [],
  );
  return tasks;
}

export async function saveLiveTasks(tasks: Task[]) {
  await setDoc(doc(getDb(), "app_config", "tasks"), { items: tasks });
}