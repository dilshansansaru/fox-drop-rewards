import { useMemo, useState } from "react";
import { Btn, Card, Num, Progress, SectionTitle, useToast } from "@/components/ui-kit";
import {
  AD_PROVIDERS,
  AD_TASK_MILESTONES,
  NETWORK,
  REFERRAL_MILESTONES,
  REFER_TASK_MILESTONES,
  REWARDS,
  TASKS,
  TOKEN_PRICE_USD,
} from "@/lib/config";
import {
  adminAdjustBalance,
  adminBroadcast,
  adminResetDailyAds,
  adminSetBlocked,
  adminSetReferralStatus,
  approveWithdrawal,
  rejectWithdrawal,
  useAllReferrals,
  useAllUsers,
  useWithdrawals,
  type Referral,
  type UserDoc,
  type Withdrawal,
} from "@/lib/store";

type AdminTab = "overview" | "payouts" | "users" | "referrals" | "broadcast" | "system";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "📊 Stats" },
  { id: "payouts", label: "💰 Payouts" },
  { id: "users", label: "👤 Users" },
  { id: "referrals", label: "👥 Referrals" },
  { id: "broadcast", label: "📢 Broadcast" },
  { id: "system", label: "⚙️ System" },
];

function Stat({ label, value, tone = "text-gold" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <Num className={`text-lg ${tone}`}>{value}</Num>
    </div>
  );
}

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [txids, setTxids] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const withdrawals = useWithdrawals();
  const users = useAllUsers(true);
  const referrals = useAllReferrals(true);
  const toast = useToast();

  const stats = useMemo(() => {
    const pending = withdrawals.filter((w) => w.status === "pending");
    const approved = withdrawals.filter((w) => w.status === "approved");
    return {
      users: users.length,
      blocked: users.filter((u) => u.blocked).length,
      tokens: users.reduce((a, u) => a + (u.tokens ?? 0), 0),
      usdt: users.reduce((a, u) => a + (u.usdt ?? 0), 0),
      ads: users.reduce((a, u) => a + (u.totalAds ?? 0), 0),
      refs: referrals.length,
      refsBlocked: referrals.filter((r) => r.status === "blocked").length,
      pending: pending.length,
      pendingUsdt: pending.reduce((a, w) => a + w.amount, 0),
      paid: approved.length,
      paidUsdt: approved.reduce((a, w) => a + w.amount, 0),
      requests: withdrawals.length,
    };
  }, [users, referrals, withdrawals]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users.slice(0, 60);
    return users
      .filter(
        (u) =>
          u.id.includes(q) ||
          (u.name ?? "").toLowerCase().includes(q) ||
          (u.username ?? "").toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [users, search]);

  const filteredPayouts = useMemo(
    () => (payoutFilter === "all" ? withdrawals : withdrawals.filter((w) => w.status === payoutFilter)),
    [withdrawals, payoutFilter],
  );

  const approve = async (w: Withdrawal) => {
    const txid = (txids[w.id] ?? "").trim();
    if (!txid) {
      toast.push({ kind: "error", title: "TX ID required", desc: "Paste the transaction hash first." });
      return;
    }
    try {
      await approveWithdrawal(w, txid);
      toast.push({ kind: "success", title: "Withdraw approved", desc: "User, admin & channel notified." });
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

  const adjust = async (u: UserDoc, tokens: number, usdt: number) => {
    try {
      await adminAdjustBalance(u.id, { tokens, usdt });
      toast.push({ kind: "success", title: "Balance updated", desc: `${u.name} notified via bot.` });
    } catch {
      toast.push({ kind: "error", title: "Update failed" });
    }
  };

  const toggleBlock = async (u: UserDoc) => {
    try {
      await adminSetBlocked(u.id, !u.blocked);
      toast.push({ kind: "info", title: u.blocked ? "User unblocked" : "User blocked" });
    } catch {
      toast.push({ kind: "error", title: "Action failed" });
    }
  };

  const resetAds = async (u: UserDoc) => {
    try {
      await adminResetDailyAds(u.id);
      toast.push({ kind: "success", title: "Daily ads reset" });
    } catch {
      toast.push({ kind: "error", title: "Reset failed" });
    }
  };

  const setRefStatus = async (r: Referral, status: Referral["status"]) => {
    try {
      await adminSetReferralStatus(r, status);
      toast.push({ kind: "success", title: `Referral ${status}` });
    } catch {
      toast.push({ kind: "error", title: "Referral update failed" });
    }
  };

  const broadcast = async (targets: UserDoc[]) => {
    const text = message.trim();
    if (!text) {
      toast.push({ kind: "error", title: "Message is empty" });
      return;
    }
    setSending(true);
    try {
      const res = await adminBroadcast(targets.map((u) => u.id), text);
      toast.push({
        kind: "success",
        title: `Sent to ${res.sent ?? 0} users`,
        desc: res.failed ? `${res.failed} failed (blocked bot)` : "All messages delivered.",
      });
      setMessage("");
    } catch {
      toast.push({ kind: "error", title: "Broadcast failed" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-hero-glow text-center">
        <SectionTitle icon="🛠️">Admin Control Center</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Users" value={String(stats.users)} tone="text-primary" />
          <Stat label="Pending" value={String(stats.pending)} />
          <Stat label="Paid USDT" value={stats.paidUsdt.toFixed(4)} tone="text-success" />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-btn rounded-xl py-2.5 text-[11px] uppercase ${
              tab === t.id ? "bg-brand-gradient text-primary-foreground" : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <Card>
            <SectionTitle icon="👥">Community</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total users" value={String(stats.users)} tone="text-primary" />
              <Stat label="Blocked users" value={String(stats.blocked)} tone="text-destructive" />
              <Stat label="Referrals" value={String(stats.refs)} tone="text-secondary" />
              <Stat label="Fraud blocked" value={String(stats.refsBlocked)} tone="text-destructive" />
            </div>
          </Card>

          <Card>
            <SectionTitle icon="💎">Economy</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="FOX distributed" value={Math.round(stats.tokens).toLocaleString("en-US")} />
              <Stat label="FOX value" value={`$${(stats.tokens * TOKEN_PRICE_USD).toFixed(2)}`} />
              <Stat label="USDT in wallets" value={stats.usdt.toFixed(4)} tone="text-success" />
              <Stat label="Ads watched" value={stats.ads.toLocaleString("en-US")} tone="text-primary" />
            </div>
          </Card>

          <Card>
            <SectionTitle icon="💰">Payout pipeline</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Requests" value={String(stats.requests)} tone="text-primary" />
              <Stat label="Pending USDT" value={stats.pendingUsdt.toFixed(4)} />
              <Stat label="Approved" value={String(stats.paid)} tone="text-success" />
              <Stat label="Paid USDT" value={stats.paidUsdt.toFixed(4)} tone="text-success" />
            </div>
            {stats.pending > 0 && (
              <Btn className="mt-3" full size="sm" onClick={() => setTab("payouts")}>
                Review {stats.pending} pending payout{stats.pending > 1 ? "s" : ""}
              </Btn>
            )}
          </Card>

          <Card>
            <SectionTitle icon="🏆">Top referrers</SectionTitle>
            <div className="space-y-2">
              {[...users]
                .sort((a, b) => (b.refCount ?? 0) - (a.refCount ?? 0))
                .slice(0, 5)
                .map((u, i) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                    <p className="truncate text-sm">
                      <Num className="text-primary">#{i + 1}</Num> {u.name}
                    </p>
                    <Num className="text-xs text-secondary">{u.refCount ?? 0} refs</Num>
                  </div>
                ))}
              {!users.length && <p className="text-xs text-muted-foreground">No users yet.</p>}
            </div>
          </Card>
        </>
      )}

      {tab === "payouts" && (
        <>
          <div className="flex gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPayoutFilter(f)}
                className={`text-btn flex-1 rounded-lg py-2 text-[10px] uppercase ${
                  payoutFilter === f ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {!filteredPayouts.length && (
            <Card>
              <p className="text-center text-xs text-muted-foreground">No {payoutFilter} withdrawals.</p>
            </Card>
          )}
          {filteredPayouts.map((w) => (
            <Card key={w.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    {w.name} <span className="text-muted-foreground">@{w.username || "none"}</span>
                  </p>
                  <Num className="text-xs text-success">{w.amount.toFixed(4)} USDT</Num>
                  <p className="text-num text-[10px] text-muted-foreground">
                    ID {w.userId} · fee {w.fee?.toFixed?.(4) ?? REWARDS.withdrawFee}
                  </p>
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
        </>
      )}

      {tab === "users" && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, @username or Telegram ID"
            className="h-11 w-full rounded-xl border border-input bg-surface-2 px-3 text-xs outline-none focus:border-primary"
          />
          <p className="text-[10px] uppercase text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
          </p>
          {filteredUsers.map((u) => (
            <Card key={u.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {u.name} <span className="text-muted-foreground">@{u.username || "none"}</span>
                    {u.blocked && <span className="text-btn ml-1 text-[10px] text-destructive">BLOCKED</span>}
                  </p>
                  <p className="text-num text-[10px] text-muted-foreground">
                    ID {u.id} · IP {u.ip} · day {u.dayIndex ?? 1}
                  </p>
                  <p className="text-num text-[10px] text-muted-foreground">
                    📺 {u.totalAds ?? 0} ads · 📋 {Object.values(u.tasks ?? {}).filter(Boolean).length}/
                    {TASKS.length} tasks
                  </p>
                </div>
                <div className="text-right">
                  <Num className="text-xs text-gold">{Math.round(u.tokens ?? 0)} FOX</Num>
                  <Num className="block text-[11px] text-success">{(u.usdt ?? 0).toFixed(4)} USDT</Num>
                  <Num className="block text-[10px] text-secondary">{u.refCount ?? 0} refs</Num>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <Btn size="sm" variant="outline" onClick={() => adjust(u, 350, 0)}>
                  +350 FOX
                </Btn>
                <Btn size="sm" variant="success" onClick={() => adjust(u, 0, 0.01)}>
                  +0.01 $
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => resetAds(u)}>
                  ♻️ Ads
                </Btn>
                <Btn size="sm" variant={u.blocked ? "success" : "danger"} onClick={() => toggleBlock(u)}>
                  {u.blocked ? "Unblock" : "Block"}
                </Btn>
              </div>
            </Card>
          ))}
          {!filteredUsers.length && (
            <Card>
              <p className="text-center text-xs text-muted-foreground">No users found.</p>
            </Card>
          )}
        </>
      )}

      {tab === "referrals" && (
        <>
          <p className="text-[10px] uppercase text-muted-foreground">
            {referrals.length} referrals · {stats.refsBlocked} blocked for fraud
          </p>
          {referrals.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {r.name} <span className="text-muted-foreground">@{r.username || "none"}</span>
                  </p>
                  <p className="text-num text-[10px] text-muted-foreground">Inviter {r.inviterId}</p>
                  <p className="text-num text-[10px] text-muted-foreground">User {r.userId}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-btn text-[11px] uppercase ${
                      r.status === "blocked" ? "text-destructive" : "text-success"
                    }`}
                  >
                    {r.status}
                  </p>
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
              <div className="mt-2 grid grid-cols-2 gap-2">
                {r.status === "blocked" ? (
                  <Btn size="sm" variant="success" onClick={() => setRefStatus(r, "credited")}>
                    ✅ Approve & pay
                  </Btn>
                ) : (
                  <Btn size="sm" variant="danger" onClick={() => setRefStatus(r, "blocked")}>
                    🚫 Block & revert
                  </Btn>
                )}
                <Btn size="sm" variant="ghost" onClick={() => { setSearch(r.inviterId); setTab("users"); }}>
                  👤 Inviter
                </Btn>
              </div>
            </Card>
          ))}
          {!referrals.length && (
            <Card>
              <p className="text-center text-xs text-muted-foreground">No referrals yet.</p>
            </Card>
          )}
        </>
      )}

      {tab === "broadcast" && (
        <Card>
          <SectionTitle icon="📢">Broadcast via bot</SectionTitle>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Announcement text (HTML supported: <b>bold</b>)"
            className="w-full rounded-xl border border-input bg-surface-2 p-3 text-xs outline-none focus:border-primary"
          />
          <p className="mt-2 text-[10px] text-muted-foreground">
            Sent through @Fox_Drop_Bot with Mini App buttons. Max 500 users per send.
          </p>
          <div className="mt-3 space-y-2">
            <Btn full disabled={sending} onClick={() => broadcast(users.filter((u) => !u.blocked))}>
              {sending ? "Sending…" : `📢 Send to all (${users.filter((u) => !u.blocked).length})`}
            </Btn>
            <Btn
              full
              variant="outline"
              disabled={sending}
              onClick={() => broadcast(users.filter((u) => !u.blocked && (u.refCount ?? 0) > 0))}
            >
              🏆 Send to referrers only
            </Btn>
            <Btn
              full
              variant="ghost"
              disabled={sending}
              onClick={() => broadcast(users.filter((u) => !u.blocked && (u.totalAds ?? 0) === 0))}
            >
              😴 Send to inactive users
            </Btn>
          </div>
        </Card>
      )}

      {tab === "system" && (
        <>
          <Card>
            <SectionTitle icon="⚙️">Reward configuration</SectionTitle>
            <div className="space-y-1.5 text-xs">
              {[
                ["Security check bonus", `${REWARDS.securityCheckTokens} FOX`],
                ["Referral reward", `${REWARDS.referralTokens} FOX + ${REWARDS.referralUsdt} USDT`],
                ["Main task reward", `${REWARDS.mainTaskUsdt} USDT`],
                ["Daily ads goal", `${REWARDS.dailyAdsGoal} ads`],
                ["Min withdraw", `${REWARDS.minWithdraw} USDT`],
                ["Withdraw fee", `${REWARDS.withdrawFee} USDT`],
                ["Token price", `1 FOX = $${TOKEN_PRICE_USD}`],
                ["Network", NETWORK],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="text-muted-foreground">{k}</span>
                  <Num className="text-gold">{v}</Num>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="🎯">Milestones</SectionTitle>
            <div className="space-y-1.5 text-xs">
              {REFERRAL_MILESTONES.map((m) => (
                <div key={m.key} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="text-muted-foreground">Referral day {m.day} · {m.ads} ads</span>
                  <Num className="text-success">{m.usdt} USDT</Num>
                </div>
              ))}
              {AD_TASK_MILESTONES.map((m) => (
                <div key={m.key} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="text-muted-foreground">Ad task · {m.ads} ads</span>
                  <Num className="text-success">{m.usdt} USDT</Num>
                </div>
              ))}
              {REFER_TASK_MILESTONES.map((m) => (
                <div key={m.key} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="text-muted-foreground">Refer task · {m.count} friends</span>
                  <Num className="text-success">{m.usdt} USDT</Num>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="📺">Ad providers</SectionTitle>
            <div className="space-y-2">
              {AD_PROVIDERS.map((p) => {
                const watched = users.reduce((a, u) => a + (u.adsToday?.[p.id] ?? 0), 0);
                return (
                  <div key={p.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex justify-between text-xs">
                      <span>
                        {p.icon} {p.name}
                      </span>
                      <Num className="text-gold">
                        +{p.reward} FOX · limit {p.dailyLimit}
                      </Num>
                    </div>
                    <div className="mt-2">
                      <Progress value={watched} max={Math.max(p.dailyLimit * Math.max(users.length, 1), 1)} />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      <Num>{watched}</Num> ads watched today
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
