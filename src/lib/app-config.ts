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
};

export function useAppSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        doc(getDb(), "app_config", "settings"),
        (snapshot) => {
          setSettings({ ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<AppSettings> | undefined) });
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
          setTasks(data?.items?.length ? data.items : TASKS);
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