import { useEffect, useState } from "react";
import logo from "@/assets/foxdrop-logo.png";
import { Btn, Card, Num, Progress, SectionTitle, Sheet } from "@/components/ui-kit";
import { GuideBox } from "@/components/GuideBox";
import { RewardCodeCard } from "@/components/RewardCodeCard";
import { ALLOCATION, NETWORK, REWARDS, ROADMAP, TASKS, TOKEN_PRICE_USD } from "@/lib/config";
import { claimDayBonus, type UserDoc } from "@/lib/store";
import { useToast } from "@/components/ui-kit";
import { useAppSettings } from "@/lib/app-config";

export function HomeTab({ user }: { user: UserDoc }) {
  const [guide, setGuide] = useState(false);
  const toast = useToast();
  const { settings } = useAppSettings();

  const adsToday = Object.values(user.adsToday ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const tasksDone = TASKS.filter((t) => user.tasks?.[t.id]).length;
  const usdValue = user.tokens * TOKEN_PRICE_USD;

  const dayBonuses = [
    { key: "day1", label: "Day 1 · Watch 10 ads", goal: REWARDS.day1AdsGoal, usdt: REWARDS.day1Usdt },
    { key: "day2", label: "Day 2 · Watch 15 ads", goal: REWARDS.day2AdsGoal, usdt: REWARDS.day2Usdt },
  ];

  useEffect(() => {
    if (window.localStorage.getItem("foxdrop-guide-seen") === "1") return;
    const timer = window.setTimeout(() => setGuide(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  const closeGuide = () => {
    window.localStorage.setItem("foxdrop-guide-seen", "1");
    setGuide(false);
  };

  const claim = async (key: string, usdt: number, ok: boolean) => {
    if (!ok) return toast.push({ kind: "error", title: "Not completed yet", desc: "Watch more ads to unlock." });
    try {
      await claimDayBonus(user.id, key, usdt);
      toast.push({ kind: "success", title: `+${usdt} USDT claimed!` });
    } catch {
      toast.push({ kind: "error", title: "Claim failed", desc: "Please try again." });
    }
  };

  return (
    <div className="space-y-5">
      <GuideBox
        icon="📖"
        title="How FOXDROP works"
        defaultOpen
        steps={[
          ...(settings.eligibilityEnabled
            ? [{ do: "Pass the eligibility check on first open", reward: `${settings.securityCheckTokens} FOX` }]
            : []),
          { do: "Complete main tasks (join channel & group)", reward: `${settings.mainTaskUsdt} USDT each` },
          { do: `Watch up to ${settings.dailyAdsGoal} ads every day`, reward: "10-100 FOX per ad + USDT ad tasks" },
          { do: "Invite friends with your referral link", reward: `${settings.referralTokens} FOX + ${settings.referralUsdt} USDT each` },
          { do: "Friend watches 10 ads on day 1 / 15 ads on day 2", reward: "+0.005 USDT each milestone" },
          { do: `Withdraw USDT from ${settings.minWithdraw} USDT to BEP-20`, reward: `Paid within 24h (fee ${settings.withdrawFee} USDT)` },
        ]}
        note="FOX to USDT exchange unlocks in 2027 Q2. USDT rewards are withdrawable now."
      />
      <section className="bg-hero-glow animate-rise rounded-3xl p-5 text-center">
        <img
          src={logo}
          alt="FOXDROP fox logo"
          width={768}
          height={768}
          className="animate-float mx-auto h-20 w-20 object-contain"
        />
        <h1 className="text-logo mt-2 text-3xl text-primary">FOXDROP</h1>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">🚀 Airdrop Season 1</p>

        <div className="bg-panel mt-4 rounded-2xl border border-primary/30 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Your balance</p>
          <Num className="text-4xl text-gold">{Math.round(user.tokens).toLocaleString("en-US")}</Num>
          <p className="text-btn text-sm text-primary">FOX</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ≈ <Num>${usdValue.toFixed(3)}</Num> · 1 FOX = <Num>$0.001</Num>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">USDT Balance</p>
              <Num className="text-lg text-success">{user.usdt.toFixed(4)}</Num>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">Referrals</p>
              <Num className="text-lg text-secondary">{user.refCount ?? 0}</Num>
            </div>
          </div>
        </div>

        <Btn className="mt-4" variant="outline" size="sm" onClick={() => setGuide(true)}>
          📖 How it works
        </Btn>
      </section>

      <RewardCodeCard user={user} />

      <Card>
        <SectionTitle icon="🎁">Daily Rewards</SectionTitle>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>📺 Ads watched</span>
              <Num>
                {adsToday}/{settings.dailyAdsGoal}
              </Num>
            </div>
            <Progress value={adsToday} max={settings.dailyAdsGoal} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>👥 Referrals today goal</span>
              <Num>
                {Math.min(user.refCount ?? 0, settings.dailyReferGoal)}/{settings.dailyReferGoal}
              </Num>
            </div>
            <Progress value={user.refCount ?? 0} max={settings.dailyReferGoal} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>📋 All tasks</span>
              <Num>
                {tasksDone}/{TASKS.length}
              </Num>
            </div>
            <Progress value={tasksDone} max={TASKS.length} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="💵">USDT Milestones</SectionTitle>
        <div className="space-y-2">
          {dayBonuses.map((b) => {
            const claimed = user.dayBonusClaimed?.[b.key];
            const ok = adsToday >= b.goal;
            return (
              <div
                key={b.key}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm">{b.label}</p>
                  <Num className="text-xs text-success">+{b.usdt} USDT</Num>
                </div>
                <Btn
                  size="sm"
                  variant={claimed ? "ghost" : ok ? "success" : "outline"}
                  disabled={!!claimed}
                  onClick={() => claim(b.key, b.usdt, ok)}
                >
                  {claimed ? "Claimed" : ok ? "Claim" : "Locked"}
                </Btn>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            ✅ Main task completion instantly rewards <Num>{settings.mainTaskUsdt} USDT</Num>.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="💎">Token Exchange</SectionTitle>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
            <span>Exchange rate</span>
            <Num className="text-gold">1 FOX = ${settings.tokenPriceUsd}</Num>
          </div>
          <div className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
            <span>Network</span>
            <span className="text-btn text-primary">{NETWORK}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            In <b className="text-gold">2027 Q2</b> your FOX tokens can be exchanged to USDT at the
            listed rate and withdrawn to your BEP-20 wallet. USDT rewards are withdrawable now.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="📊">Allocation</SectionTitle>
        <div className="space-y-3">
          {ALLOCATION.map((a) => (
            <div key={a.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{a.label}</span>
                <Num className="text-gold">{a.pct}%</Num>
              </div>
              <Progress value={a.pct} max={100} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon="📈">Roadmap</SectionTitle>
        <ol className="space-y-3">
          {ROADMAP.map((r, i) => (
            <li key={r.q} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`h-3 w-3 rounded-full ${i < 1 ? "bg-success" : "bg-brand-gradient"}`}
                />
                {i < ROADMAP.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="pb-1">
                <Num className="text-xs text-primary">{r.q}</Num>
                <p className="text-btn text-sm">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Sheet open={guide} onClose={closeGuide} title="📖 FOXDROP Guide">
        <ol className="space-y-3 text-sm">
          {[
            ...(settings.eligibilityEnabled ? ["Pass the eligibility check and claim your welcome FOX."] : []),
            `Complete Main, Partner and Community tasks — main tasks pay ${REWARDS.mainTaskUsdt} USDT.`,
            `Watch up to ${REWARDS.dailyAdsGoal} ads daily across Adsgram, Monetag, GigaPub and Tower Ads.`,
            `Invite friends: ${REWARDS.referralTokens} FOX + ${REWARDS.referralUsdt} USDT instantly per verified friend.`,
            `Withdraw USDT from ${REWARDS.minWithdraw} USDT (fee ${REWARDS.withdrawFee} USDT) to BEP-20 — paid within 24h.`,
            "FOX → USDT exchange & withdraw unlocks in 2027 Q2.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3 rounded-xl bg-surface-2 p-3">
              <Num className="text-primary">{i + 1}</Num>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <Btn className="mt-4" full onClick={closeGuide}>
          Got it
        </Btn>
      </Sheet>
    </div>
  );
}
