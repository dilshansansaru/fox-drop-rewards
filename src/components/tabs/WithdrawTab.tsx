import { useState } from "react";
import { Btn, Card, Num, SectionTitle, useToast } from "@/components/ui-kit";
import { NETWORK, REWARDS, TASKS, TOKEN_PRICE_USD } from "@/lib/config";
import { requestWithdraw, useWithdrawals, type UserDoc } from "@/lib/store";
import { openLink } from "@/lib/telegram";
import { BRAND } from "@/lib/config";
import { GuideBox } from "@/components/GuideBox";

export function WithdrawTab({ user }: { user: UserDoc }) {
  const [amount, setAmount] = useState(String(REWARDS.minWithdraw));
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const history = useWithdrawals(user.id);

  const adsToday = Object.values(user.adsToday ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const mainTasksDone = TASKS.filter((t) => t.category === "main" && user.tasks?.[t.id]).length;
  const mainTasksTotal = TASKS.filter((t) => t.category === "main").length;

  const requirements = [
    { label: `Complete all ${mainTasksTotal} main tasks`, ok: mainTasksDone >= mainTasksTotal },
    { label: `Invite ${REWARDS.dailyReferGoal} friends`, ok: (user.refCount ?? 0) >= REWARDS.dailyReferGoal },
    { label: `Watch ${REWARDS.dailyAdsGoal} ads today`, ok: adsToday >= REWARDS.dailyAdsGoal },
    { label: `Balance of at least ${REWARDS.minWithdraw} USDT`, ok: user.usdt >= REWARDS.minWithdraw },
  ];
  const eligible = requirements.every((r) => r.ok);

  const submit = async () => {
    const amt = Number(amount);
    if (!eligible) {
      toast.push({ kind: "error", title: "Requirements not met", desc: "Finish all requirements first." });
      return;
    }
    if (!Number.isFinite(amt) || amt < REWARDS.minWithdraw) {
      toast.push({ kind: "error", title: "Amount too low", desc: `Minimum is ${REWARDS.minWithdraw} USDT.` });
      return;
    }
    if (amt + REWARDS.withdrawFee > user.usdt) {
      toast.push({ kind: "error", title: "Insufficient balance", desc: "Fee included in total." });
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      toast.push({ kind: "error", title: "Invalid BEP-20 address", desc: "Must start with 0x (42 chars)." });
      return;
    }
    setBusy(true);
    try {
      await requestWithdraw(user, amt, address.trim());
      toast.push({
        kind: "success",
        title: "Withdraw request sent!",
        desc: "You will receive your payment within 24 hours.",
      });
      setAddress("");
    } catch {
      toast.push({ kind: "error", title: "Request failed", desc: "Please try again later." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <GuideBox
        icon="💰"
        title="Withdraw Guide"
        steps={[
          { do: "All main tasks complete කරන්න", reward: `FOX + ${REWARDS.mainTaskUsdt} USDT each` },
          { do: `Friends ${REWARDS.dailyReferGoal} ක් invite කරන්න`, reward: `${REWARDS.referralUsdt} USDT + ${REWARDS.referralTokens} FOX each` },
          { do: `Today ${REWARDS.dailyAdsGoal} ads බලන්න`, reward: "up to 100 FOX per ad" },
          { do: `USDT balance ${REWARDS.minWithdraw} වෙනකම් එකතු කරන්න`, reward: "Withdraw unlocks" },
          { do: "BEP-20 address දාලා withdraw request කරන්න", reward: `Paid in 24h (fee ${REWARDS.withdrawFee} USDT)` },
        ]}
        note={`FOX → USDT exchange (1 FOX = $${TOKEN_PRICE_USD}) opens in 2027 Q2 on ${NETWORK}.`}
      />
      <Card className="bg-hero-glow text-center">
        <SectionTitle icon="💰">Withdraw</SectionTitle>
        <Num className="text-4xl text-success">{user.usdt.toFixed(4)}</Num>
        <p className="text-xs text-muted-foreground">USDT available</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          FOX balance <Num className="text-gold">{Math.round(user.tokens).toLocaleString("en-US")}</Num> ≈{" "}
          <Num>${(user.tokens * TOKEN_PRICE_USD).toFixed(3)}</Num> — exchangeable in 2027 Q2
        </p>
      </Card>

      <Card>
        <SectionTitle icon="✅">Requirements</SectionTitle>
        <div className="space-y-2">
          {requirements.map((r) => (
            <div key={r.label} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span>{r.ok ? "✅" : "⬜"}</span>
              <span className={r.ok ? "" : "text-muted-foreground"}>{r.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon="🏦">Withdraw to {NETWORK}</SectionTitle>
        <label className="text-xs text-muted-foreground" htmlFor="amount">
          Amount (USDT)
        </label>
        <input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-num mt-1 mb-3 h-11 w-full rounded-xl border border-input bg-surface-2 px-3 text-sm outline-none focus:border-primary"
        />
        <label className="text-xs text-muted-foreground" htmlFor="address">
          BEP-20 wallet address
        </label>
        <input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="text-num mt-1 h-11 w-full rounded-xl border border-input bg-surface-2 px-3 text-xs outline-none focus:border-primary"
        />
        <div className="mt-3 space-y-1 rounded-xl bg-surface-2 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Minimum</span>
            <Num>{REWARDS.minWithdraw} USDT</Num>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee</span>
            <Num className="text-destructive">{REWARDS.withdrawFee} USDT</Num>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">You receive</span>
            <Num className="text-success">{(Number(amount) || 0).toFixed(4)} USDT</Num>
          </div>
        </div>
        <Btn className="mt-3" size="lg" full disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "💰 Request Withdraw"}
        </Btn>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          ⏱ Withdrawals are paid within 24 hours.
        </p>
        <Btn className="mt-2" size="sm" variant="outline" full onClick={() => openLink(BRAND.payment)}>
          💳 Payment Channel
        </Btn>
      </Card>

      <Card>
        <SectionTitle icon="🧾">History</SectionTitle>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((w) => (
              <div key={w.id} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <Num className="text-sm text-success">{w.amount.toFixed(4)} USDT</Num>
                  <span
                    className={`text-btn text-[11px] uppercase ${
                      w.status === "approved"
                        ? "text-success"
                        : w.status === "rejected"
                          ? "text-destructive"
                          : "text-gold"
                    }`}
                  >
                    {w.status === "approved" ? "✅ Paid" : w.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                  </span>
                </div>
                <p className="text-num text-[10px] break-all text-muted-foreground">{w.address}</p>
                {w.txid && (
                  <Btn
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    onClick={() => openLink(`https://bscscan.com/tx/${w.txid}`)}
                  >
                    📋 View Transaction
                  </Btn>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
