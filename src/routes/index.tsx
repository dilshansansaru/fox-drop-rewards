import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { SecurityCheck } from "@/components/SecurityCheck";
import { AdsTab } from "@/components/tabs/AdsTab";
import { HomeTab } from "@/components/tabs/HomeTab";
import { ReferralTab } from "@/components/tabs/ReferralTab";
import { TasksTab } from "@/components/tabs/TasksTab";
import { WithdrawTab } from "@/components/tabs/WithdrawTab";
import { Num, ToastHost } from "@/components/ui-kit";
import { ADMIN_TG_IDS } from "@/lib/config";
import { initAnalytics } from "@/lib/firebase";
import { useAppSettings } from "@/lib/app-config";

import { claimSecurityBonus, useUser } from "@/lib/store";
import { currentTgUser, initTelegram } from "@/lib/telegram";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FOXDROP Airdrop — Earn FOX & USDT on Telegram" },
      {
        name: "description",
        content:
          "Join the FOXDROP airdrop: earn FOX tokens from daily ads, tasks and referrals, and withdraw USDT rewards to your BEP-20 wallet.",
      },
      { property: "og:title", content: "FOXDROP Airdrop — Earn FOX & USDT" },
      {
        property: "og:description",
        content:
          "350 FOX + 0.015 USDT per referral, daily ad rewards and USDT withdrawals from 0.1 USDT on BEP-20.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type TabId = "home" | "ads" | "tasks" | "frens" | "wallet" | "admin";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "ads", label: "Ads", icon: "📺" },
  { id: "tasks", label: "Tasks", icon: "📋" },
  { id: "frens", label: "Frens", icon: "👥" },
  { id: "wallet", label: "Wallet", icon: "💰" },
];

function adminIds() {
  return [
    ...ADMIN_TG_IDS,
    ...String(import.meta.env["VITE_ADMIN_CHAT_IDS"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
}


function App() {
  return (
    <ToastHost>
      <Shell />
    </ToastHost>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabId>("home");
  const { user, loading } = useUser();
  const { settings, loading: settingsLoading } = useAppSettings();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    initTelegram();
    void initAnalytics();
  }, []);

  const isAdmin = adminIds().includes(String(currentTgUser().id));
  const tabs = isAdmin ? [...TABS, { id: "admin" as TabId, label: "Admin", icon: "🛠️" }] : TABS;

  if (loading || settingsLoading || !user) {
    return (
      <main className="bg-hero-glow flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="animate-glow text-logo text-5xl text-primary">FOXDROP</div>
        <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Loading airdrop…
        </p>
      </main>
    );
  }

  if (settings.eligibilityEnabled && !user.securityChecked && !checked) {
    return (
      <main>
        <SecurityCheck
          onDone={async () => {
            setChecked(true);
            await claimSecurityBonus(user.id).catch(() => null);
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pt-4 pb-28">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-logo text-2xl text-primary">FOXDROP</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {user.name}
          </p>
        </div>
        <div className="bg-panel rounded-xl border border-gold/30 px-3 py-2 text-right">
          <Num className="text-sm text-gold">{Math.round(user.tokens).toLocaleString("en-US")} FOX</Num>
          <Num className="block text-[10px] text-success">{user.usdt.toFixed(4)} USDT</Num>
        </div>
      </header>

      <div className="animate-rise">
        {tab === "home" && <HomeTab user={user} />}
        {tab === "ads" && <AdsTab user={user} />}
        {tab === "tasks" && <TasksTab user={user} />}
        {tab === "frens" && <ReferralTab user={user} />}
        {tab === "wallet" && <WithdrawTab user={user} />}
        {tab === "admin" && isAdmin && <AdminPanel />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-stretch">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-3 transition-all ${
                tab === t.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className={`text-lg ${tab === t.id ? "animate-pop" : ""}`}>{t.icon}</span>
              <span className="text-btn text-[10px] uppercase">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
