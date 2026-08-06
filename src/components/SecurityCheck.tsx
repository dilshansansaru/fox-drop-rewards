import { useEffect, useState } from "react";
import logo from "@/assets/foxdrop-logo.png";
import { Btn, Num } from "@/components/ui-kit";
import { REWARDS } from "@/lib/config";
import { currentTgUser } from "@/lib/telegram";

const STEPS = [
  { label: "Connecting Telegram account", icon: "🔗" },
  { label: "Checking account age", icon: "📅" },
  { label: "Verifying account security", icon: "🛡️" },
  { label: "Scanning for bot activity", icon: "🤖" },
  { label: "Calculating eligibility score", icon: "📊" },
];

/** Estimates Telegram account age from the numeric user id. */
function accountAge(id: number) {
  const approx = [
    { id: 1000000, y: 2013 },
    { id: 100000000, y: 2015 },
    { id: 300000000, y: 2017 },
    { id: 700000000, y: 2019 },
    { id: 1200000000, y: 2020 },
    { id: 1700000000, y: 2021 },
    { id: 5000000000, y: 2022 },
    { id: 6000000000, y: 2023 },
    { id: 7000000000, y: 2024 },
    { id: 8000000000, y: 2025 },
  ];
  let year = 2026;
  for (const a of approx) if (id < a.id) return { year: a.y, years: 2026 - a.y };
  return { year, years: 0 };
}

export function SecurityCheck({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const user = currentTgUser();
  const age = accountAge(user.id);
  const score = Math.min(99, 62 + age.years * 6 + (user.username ? 8 : 0));

  useEffect(() => {
    if (step >= STEPS.length) {
      const t = setTimeout(() => setDone(true), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 850);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="bg-hero-glow flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="relative mb-8">
        <img
          src={logo}
          alt="FOXDROP logo"
          width={768}
          height={768}
          className="animate-glow h-28 w-28 object-contain"
        />
        {!done && (
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="animate-scan h-1/2 w-full bg-gradient-to-b from-transparent via-gold/60 to-transparent" />
          </div>
        )}
      </div>

      <h1 className="text-logo text-4xl text-primary">FOXDROP</h1>
      <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Account Verification
      </p>

      {!done ? (
        <div className="mt-8 w-full max-w-sm space-y-3">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${
                i < step
                  ? "border-success/40 bg-success/10"
                  : i === step
                    ? "animate-pop border-primary/50 bg-primary/10"
                    : "border-border bg-surface/40 opacity-50"
              }`}
            >
              <span className="text-lg">{s.icon}</span>
              <span className="flex-1 text-sm">{s.label}</span>
              <span className="text-sm">
                {i < step ? "✅" : i === step ? <span className="animate-pulse">⏳</span> : "•"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="animate-pop mt-8 w-full max-w-sm space-y-3 text-center">
          <div className="bg-panel rounded-2xl border border-success/40 p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Eligibility</p>
            <Num className="text-4xl text-success">{score}%</Num>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left text-xs">
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-muted-foreground">Account since</p>
                <Num className="text-gold">{age.year}</Num>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="text-muted-foreground">Security</p>
                <p className="text-btn text-success">PASSED</p>
              </div>
            </div>
          </div>
          <div className="bg-panel animate-float rounded-2xl border border-gold/40 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome bonus</p>
            <Num className="text-3xl text-gold">+{REWARDS.securityCheckTokens} FOX</Num>
          </div>
          <Btn variant="primary" size="lg" full onClick={onDone}>
            🎁 Claim & Continue
          </Btn>
        </div>
      )}
    </div>
  );
}
