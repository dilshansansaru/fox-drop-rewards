import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { SecurityCheck } from "@/components/SecurityCheck";
import { AdsTab } from "@/components/tabs/AdsTab";
import { HomeTab } from "@/components/tabs/HomeTab";
import { ReferralTab } from "@/components/tabs/ReferralTab";
import { TasksTab } from "@/components/tabs/TasksTab";
import { WithdrawTab } from "@/components/tabs/WithdrawTab";
import { Num, ToastHost } from "@/components/ui-kit";
import { ADMIN_TG_IDS, BRAND } from "@/lib/config";
import { initAnalytics } from "@/lib/firebase";
import { useAppSettings } from "@/lib/app-config";

import { preloadAdSdks } from "@/lib/ads";
import { claimSecurityBonus, useUser } from "@/lib/store";
import { currentTgUser, initTelegram, isInsideTelegram } from "@/lib/telegram";

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
  const [outside, setOutside] = useState<boolean | null>(null);

  useEffect(() => {
    // The mini app runs only inside Telegram (@Fox_Drop_Bot). A browser session
    // has no verified Telegram identity, so nothing can be earned or changed.
    const inside = isInsideTelegram() && Number(currentTgUser().id) > 0;
    setOutside(!inside && !import.meta.env.DEV);
  }, []);

  if (outside === null) return null;

  if (outside) {
    return (
      <main className="bg-hero-glow flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-logo text-4xl text-primary">FOXDROP</div>
        <p className="text-btn text-sm text-gold">Telegram only</p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          This airdrop mini app works only inside Telegram, through the official bot
          <b> @Fox_Drop_Bot</b>. Open it there to see your balance and earn rewards.
        </p>
        <a
          href={BRAND.miniAppUrl}
          className="text-btn rounded-xl bg-primary px-5 py-2.5 text-xs uppercase text-primary-foreground"
        >
          🚀 Open in Telegram
        </a>
      </main>
    );
  }

  return (
    <ToastHost>
      <Shell />
    </ToastHost>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabId>("home");
  const { user, loading, error } = useUser();
  const { settings } = useAppSettings();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    initTelegram();
    void initAnalytics();
    // Initialise the AdsGram placement on launch (no ad is shown until the user taps).
    preloadAdSdks();
  }, []);

  const isAdmin = adminIds().includes(String(currentTgUser().id));
  const tabs = isAdmin ? [...TABS, { id: "admin" as TabId, label: "Admin", icon: "🛠️" }] : TABS;

  if (loading) {
    return (
      <main className="bg-hero-glow flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="animate-glow text-logo text-5xl text-primary">FOXDROP</div>
        <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Loading airdrop…
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="bg-hero-glow flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-logo text-4xl text-primary">FOXDROP</div>
        <p className="text-btn text-sm text-destructive">Connection failed</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          We could not reach the FOXDROP database. Check your internet connection and reopen the mini
          app.
        </p>
        {error && <p className="text-[10px] text-muted-foreground/70">{error}</p>}
        <button
          onClick={() => window.location.reload()}
          className="text-btn mt-2 rounded-xl bg-primary px-5 py-2 text-xs uppercase text-primary-foreground"
        >
          Retry
        </button>
      </main>
    );
  }


  if (settings.eligibilityEnabled && !user.securityChecked && !checked) {
    return (
      <main>
        <SecurityCheck
          onDone={async () => {
            setChecked(true);
            await claimSecurityBonus(user.id, settings.securityCheckTokens).catch(() => null);
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

      <footer className="mt-6 text-center text-[10px] leading-relaxed text-muted-foreground/80">
        <p>FOX are in-app reward points. No earnings are guaranteed.</p>
        <Link to="/terms" className="text-gold underline">
          Terms of Use &amp; Privacy Policy
        </Link>
      </footer>



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
