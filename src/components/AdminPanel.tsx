import { useState } from "react";
import { Btn, Card, Num, SectionTitle, useToast } from "@/components/ui-kit";
import {
  approveWithdrawal,
  rejectWithdrawal,
  useAllReferrals,
  useAllUsers,
  useWithdrawals,
  type Withdrawal,
} from "@/lib/store";

export function AdminPanel() {
  const [tab, setTab] = useState<"withdrawals" | "referrals" | "users">("withdrawals");
  const [txids, setTxids] = useState<Record<string, string>>({});
  const withdrawals = useWithdrawals();
  const users = useAllUsers(tab === "users");
  const referrals = useAllReferrals(tab === "referrals");
  const toast = useToast();

  const approve = async (w: Withdrawal) => {
    const txid = (txids[w.id] ?? "").trim();
    if (!txid) {
      toast.push({ kind: "error", title: "TX ID required", desc: "Paste the transaction hash first." });
      return;
    }
    try {
      await approveWithdrawal(w, txid);
      toast.push({ kind: "success", title: "Withdraw approved", desc: "User & channel notified." });
    } catch {
      toast.push({ kind: "error", title: "Approve failed" });
    }
  };

  const reject = async (w: Withdrawal) => {
    try {
      await rejectWithdrawal(w);
      toast.push({ kind: "info", title: "Withdraw rejected", desc: "Balance refunded." });
    } catch {
      toast.push({ kind: "error", title: "Reject failed" });
    }
  };

  const pending = withdrawals.filter((w) => w.status === "pending");

  return (
    <div className="space-y-4">
      <Card className="bg-hero-glow text-center">
        <SectionTitle icon="🛠️">Admin Panel</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Pending</p>
            <Num className="text-xl text-gold">{pending.length}</Num>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Paid</p>
            <Num className="text-lg text-success">
              {withdrawals.filter((w) => w.status === "approved").length}
            </Num>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Requests</p>
            <Num className="text-xl text-primary">{withdrawals.length}</Num>
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        {(["withdrawals", "referrals", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-btn flex-1 rounded-xl py-2.5 text-xs uppercase ${
              tab === t ? "bg-brand-gradient text-primary-foreground" : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {t === "withdrawals" ? "💰 Payouts" : t === "referrals" ? "👥 Referrals" : "👤 Users"}
          </button>
        ))}
      </div>

      {tab === "withdrawals" &&
        withdrawals.map((w) => (
          <Card key={w.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  {w.name} <span className="text-muted-foreground">@{w.username || "none"}</span>
                </p>
                <Num className="text-xs text-success">{w.amount.toFixed(4)} USDT</Num>
              </div>
              <span
                className={`text-btn text-[11px] uppercase ${
                  w.status === "approved"
                    ? "text-success"
                    : w.status === "rejected"
                      ? "text-destructive"
                      : "text-gold"
                }`}
              >
                {w.status}
              </span>
            </div>
            <p className="text-num mt-2 text-[10px] break-all text-muted-foreground">{w.address}</p>
            {w.status === "pending" ? (
              <>
                <input
                  value={txids[w.id] ?? ""}
                  onChange={(e) => setTxids((s) => ({ ...s, [w.id]: e.target.value }))}
                  placeholder="Transaction ID (0x...)"
                  className="text-num mt-3 h-10 w-full rounded-xl border border-input bg-surface-2 px-3 text-xs outline-none focus:border-primary"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Btn size="sm" variant="success" onClick={() => approve(w)}>
                    ✅ Approve
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => reject(w)}>
                    ❌ Reject
                  </Btn>
                </div>
              </>
            ) : (
              w.txid && <p className="text-num mt-2 text-[10px] text-primary">TX: {w.txid}</p>
            )}
          </Card>
        ))}

      {tab === "users" &&
        users.map((u) => (
          <Card key={u.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  {u.name} <span className="text-muted-foreground">@{u.username || "none"}</span>
                </p>
                <p className="text-num text-[10px] text-muted-foreground">
                  ID {u.id} · IP {u.ip}
                </p>
              </div>
              <div className="text-right">
                <Num className="text-xs text-gold">{Math.round(u.tokens)} FOX</Num>
                <Num className="block text-[11px] text-success">{(u.usdt ?? 0).toFixed(4)} USDT</Num>
                <Num className="block text-[10px] text-secondary">{u.refCount ?? 0} refs</Num>
              </div>
            </div>
          </Card>
        ))}

      {tab === "referrals" &&
        referrals.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{r.name} <span className="text-muted-foreground">@{r.username || "none"}</span></p>
                <p className="text-num text-[10px] text-muted-foreground">Inviter {r.inviterId}</p>
                <p className="text-num text-[10px] text-muted-foreground">User {r.userId}</p>
              </div>
              <div className="text-right">
                <p className={`text-btn text-[11px] uppercase ${r.status === "blocked" ? "text-destructive" : "text-success"}`}>{r.status}</p>
                <Num className="block text-[10px] text-gold">{r.tokens} FOX</Num>
                <Num className="block text-[10px] text-success">{r.usdt.toFixed(4)} USDT</Num>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="rounded-lg bg-surface-2 p-2">📺 {r.ads ?? 0}</div>
              <div className="rounded-lg bg-surface-2 p-2">D1 {r.milestones?.["day1"] ? "✅" : "⬜"}</div>
              <div className="rounded-lg bg-surface-2 p-2">D2 {r.milestones?.["day2"] ? "✅" : "⬜"}</div>
            </div>
            {r.reason && <p className="mt-2 text-[10px] text-destructive">⚠️ {r.reason}</p>}
          </Card>
        ))}
    </div>
  );
}
