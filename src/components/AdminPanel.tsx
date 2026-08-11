import { useEffect, useMemo, useState } from "react";
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
  adminDeletePromoCode,
  adminDeleteVisitSite,
  adminSavePromoCode,
  adminSaveVisitSite,
  usePromoCodes,
  useVisitSites,
  type PromoCode,
  type VisitSite,
  approveWithdrawal,
  
  rejectWithdrawal,
  useAllReferrals,
  useAllUsers,
  useWithdrawals,
  type Referral,
  type UserDoc,
  type Withdrawal,
} from "@/lib/store";
import {
  saveAppSettings,
  saveLiveTasks,
  useAppSettings,
  useLiveTasks,
  type AppSettings,
} from "@/lib/app-config";
import type { Task } from "@/lib/config";

type AdminTab =
  | "overview"
  | "payouts"
  | "users"
  | "referrals"
  | "broadcast"
  | "tasks"
  | "codes"
  | "sites"
  | "system";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "📊 Stats" },
  { id: "payouts", label: "💰 Payouts" },
  { id: "users", label: "👤 Users" },
  { id: "referrals", label: "👥 Referrals" },
  { id: "broadcast", label: "📢 Broadcast" },
  { id: "tasks", label: "📋 Tasks" },
  { id: "codes", label: "🎟️ Codes" },
  { id: "sites", label: "🌐 Sites" },
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
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const withdrawals = useWithdrawals();
  const users = useAllUsers(true);
  const referrals = useAllReferrals(true);
  const toast = useToast();
  const { settings } = useAppSettings();
  const promoCodes = usePromoCodes();
  const visitSites = useVisitSites();
  const [newCode, setNewCode] = useState<PromoCode>({ id: "", tokens: 100, usdt: 0, maxUses: 0, uses: 0, active: true });
  const [newSite, setNewSite] = useState<VisitSite>({ id: "", title: "", url: "", tokens: 50, usdt: 0, seconds: 10, active: true });
  const liveTasks = useLiveTasks();
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [draftTasks, setDraftTasks] = useState<Task[]>(liveTasks);

  useEffect(() => setDraftSettings(settings), [settings]);
  useEffect(() => setDraftTasks(liveTasks), [liveTasks]);

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
      const res = await adminBroadcast(targets.map((u) => u.id), text, {
        imageUrl: imageUrl.trim(),
        buttonText: buttonText.trim(),
        buttonUrl: buttonUrl.trim(),
      });
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

  const saveSettings = async () => {
    try {
      await saveAppSettings(draftSettings);
      toast.push({ kind: "success", title: "Settings saved", desc: "All open apps update in real time." });
    } catch {
      toast.push({ kind: "error", title: "Settings save failed" });
    }
  };

  const saveTasks = async () => {
    try {
      await saveLiveTasks(draftTasks);
      toast.push({ kind: "success", title: "Tasks saved", desc: "Task Center updated in real time." });
    } catch {
      toast.push({ kind: "error", title: "Task save failed" });
    }
  };

  const saveCode = async (promo: PromoCode) => {
    try {
      await adminSavePromoCode(promo);
      toast.push({ kind: "success", title: `Code ${promo.id.toUpperCase()} saved` });
      if (promo === newCode) setNewCode({ id: "", tokens: 100, usdt: 0, maxUses: 0, uses: 0, active: true });
    } catch (e) {
      toast.push({ kind: "error", title: "Code save failed", desc: e instanceof Error ? e.message : "" });
    }
  };

  const removeCode = async (id: string) => {
    try {
      await adminDeletePromoCode(id);
      toast.push({ kind: "info", title: "Code removed" });
    } catch {
      toast.push({ kind: "error", title: "Delete failed" });
    }
  };

  const saveSite = async (site: VisitSite) => {
    if (!site.title.trim() || !site.url.trim()) {
      toast.push({ kind: "error", title: "Title and URL are required" });
      return;
    }
    try {
      await adminSaveVisitSite(site);
      toast.push({ kind: "success", title: "Website saved" });
      if (site === newSite) setNewSite({ id: "", title: "", url: "", tokens: 50, usdt: 0, seconds: 10, active: true });
    } catch {
      toast.push({ kind: "error", title: "Website save failed" });
    }
  };

  const removeSite = async (id: string) => {
    try {
      await adminDeleteVisitSite(id);
      toast.push({ kind: "info", title: "Website removed" });
    } catch {
      toast.push({ kind: "error", title: "Delete failed" });
    }
  };

  const field = (key: keyof AppSettings, label: string, step = "0.001") => (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        min="0"
        step={step}
        value={String(draftSettings[key])}
        onChange={(e) => setDraftSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}
        className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-foreground outline-none focus:border-primary"
      />
    </label>
  );

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
          <div className="mt-3 space-y-2">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Image URL (https://...) — optional"
              className="h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="Button label"
                className="h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs outline-none focus:border-primary"
              />
              <input
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                placeholder="https://..."
                className="h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
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

      {tab === "tasks" && (
        <div className="space-y-3">
          <Card>
            <SectionTitle icon="📋">Task manager</SectionTitle>
            <p className="text-xs text-muted-foreground">Add, edit or remove tasks. Save publishes them to every open Mini App in real time.</p>
          </Card>
          {draftTasks.map((task, index) => (
            <Card key={`${task.id}-${index}`}>
              <div className="grid grid-cols-2 gap-2">
                <input value={task.title} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="Task title" className="col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                <input value={task.id} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, id: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() } : item))} placeholder="task-id" className="h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                <input value={task.icon} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, icon: e.target.value } : item))} placeholder="Icon" className="h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                <select value={task.category} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, category: e.target.value as Task["category"] } : item))} className="h-10 rounded-lg border border-input bg-surface-2 px-2 text-xs">
                  <option value="main">Main</option><option value="partner">Partner</option><option value="community">Community</option>
                </select>
                <select value={task.kind} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, kind: e.target.value as Task["kind"] } : item))} className="h-10 rounded-lg border border-input bg-surface-2 px-2 text-xs">
                  <option value="telegram">Telegram</option><option value="miniapp">Mini app</option><option value="link">Link</option>
                </select>
                <input type="number" value={task.reward} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, reward: Number(e.target.value) } : item))} placeholder="FOX reward" className="text-num h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                <input type="number" step="0.0001" value={task.rewardUsdt ?? 0} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, rewardUsdt: Number(e.target.value) } : item))} placeholder="USDT reward" className="text-num h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                <input value={task.url} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, url: e.target.value } : item))} placeholder="Task URL" className="col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                {task.kind === "telegram" && <input value={task.chat ?? ""} onChange={(e) => setDraftTasks((items) => items.map((item, i) => i === index ? { ...item, chat: e.target.value } : item))} placeholder="@channel username" className="col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />}
              </div>
              <Btn className="mt-2" size="sm" variant="danger" onClick={() => setDraftTasks((items) => items.filter((_, i) => i !== index))}>Remove</Btn>
            </Card>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="outline" onClick={() => setDraftTasks((items) => [...items, { id: `task-${Date.now()}`, category: "main", title: "New Task", reward: 0, rewardUsdt: 0, icon: "🎯", kind: "link", url: "https://t.me/Fox_Drop_Bot/play" }])}>+ Add task</Btn>
            <Btn onClick={saveTasks}>Save tasks</Btn>
          </div>
        </div>
      )}

      {tab === "codes" && (
        <div className="space-y-3">
          <Card>
            <SectionTitle icon="🎟️">Create reward code</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <input value={newCode.id} onChange={(e) => setNewCode((c) => ({ ...c, id: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))} placeholder="CODE" className="text-num col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs uppercase" />
              <label className="text-[10px] text-muted-foreground">FOX reward
                <input type="number" min="0" value={newCode.tokens} onChange={(e) => setNewCode((c) => ({ ...c, tokens: Number(e.target.value) }))} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
              </label>
              <label className="text-[10px] text-muted-foreground">USDT reward
                <input type="number" min="0" step="0.0001" value={newCode.usdt} onChange={(e) => setNewCode((c) => ({ ...c, usdt: Number(e.target.value) }))} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
              </label>
              <label className="col-span-2 text-[10px] text-muted-foreground">Max uses (0 = unlimited)
                <input type="number" min="0" value={newCode.maxUses} onChange={(e) => setNewCode((c) => ({ ...c, maxUses: Number(e.target.value) }))} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
              </label>
            </div>
            <Btn className="mt-3" full disabled={!newCode.id.trim()} onClick={() => saveCode(newCode)}>+ Create code</Btn>
          </Card>
          {promoCodes.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Num className="text-sm text-primary">{c.id}</Num>
                  <p className="text-num text-[10px] text-muted-foreground">
                    {c.tokens} FOX · {c.usdt} USDT · used {c.uses ?? 0}/{c.maxUses || "∞"}
                  </p>
                </div>
                <span className={`text-btn text-[10px] uppercase ${c.active === false ? "text-destructive" : "text-success"}`}>
                  {c.active === false ? "off" : "live"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn size="sm" variant={c.active === false ? "success" : "ghost"} onClick={() => saveCode({ ...c, active: c.active === false })}>
                  {c.active === false ? "Enable" : "Disable"}
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => removeCode(c.id)}>Remove</Btn>
              </div>
            </Card>
          ))}
          {!promoCodes.length && (
            <Card><p className="text-center text-xs text-muted-foreground">No reward codes yet.</p></Card>
          )}
        </div>
      )}

      {tab === "sites" && (
        <div className="space-y-3">
          <Card>
            <SectionTitle icon="🌐">Add website</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <input value={newSite.title} onChange={(e) => setNewSite((s2) => ({ ...s2, title: e.target.value }))} placeholder="Website name" className="col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
              <input value={newSite.url} onChange={(e) => setNewSite((s2) => ({ ...s2, url: e.target.value }))} placeholder="https://..." className="col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
              <label className="text-[10px] text-muted-foreground">FOX reward
                <input type="number" min="0" value={newSite.tokens} onChange={(e) => setNewSite((s2) => ({ ...s2, tokens: Number(e.target.value) }))} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
              </label>
              <label className="text-[10px] text-muted-foreground">USDT reward
                <input type="number" min="0" step="0.0001" value={newSite.usdt} onChange={(e) => setNewSite((s2) => ({ ...s2, usdt: Number(e.target.value) }))} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
              </label>
              <label className="col-span-2 text-[10px] text-muted-foreground">View seconds
                <input type="number" min="5" value={newSite.seconds} onChange={(e) => setNewSite((s2) => ({ ...s2, seconds: Number(e.target.value) }))} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
              </label>
            </div>
            <Btn className="mt-3" full onClick={() => saveSite(newSite)}>+ Add website</Btn>
          </Card>
          {visitSites.map((s2, index) => (
            <Card key={s2.id}>
              <p className="text-btn text-sm">Website {index + 1}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={s2.title} onChange={(e) => saveSite({ ...s2, title: e.target.value })} className="col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                <input value={s2.url} onChange={(e) => saveSite({ ...s2, url: e.target.value })} className="col-span-2 h-10 rounded-lg border border-input bg-surface-2 px-3 text-xs" />
                <label className="text-[10px] text-muted-foreground">FOX
                  <input type="number" min="0" value={s2.tokens} onChange={(e) => saveSite({ ...s2, tokens: Number(e.target.value) })} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
                </label>
                <label className="text-[10px] text-muted-foreground">USDT
                  <input type="number" min="0" step="0.0001" value={s2.usdt} onChange={(e) => saveSite({ ...s2, usdt: Number(e.target.value) })} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
                </label>
                <label className="col-span-2 text-[10px] text-muted-foreground">Seconds
                  <input type="number" min="5" value={s2.seconds} onChange={(e) => saveSite({ ...s2, seconds: Number(e.target.value) })} className="text-num mt-1 h-10 w-full rounded-lg border border-input bg-surface-2 px-3 text-xs text-foreground" />
                </label>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn size="sm" variant={s2.active === false ? "success" : "ghost"} onClick={() => saveSite({ ...s2, active: s2.active === false })}>
                  {s2.active === false ? "Enable" : "Disable"}
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => removeSite(s2.id)}>Remove</Btn>
              </div>
            </Card>
          ))}
          {!visitSites.length && (
            <Card><p className="text-center text-xs text-muted-foreground">No websites yet.</p></Card>
          )}
        </div>
      )}

      {tab === "system" && (
        <>
          <Card>
            <SectionTitle icon="⚙️">Reward configuration</SectionTitle>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-2 p-3">
              <div><p className="text-sm">Eligibility check</p><p className="text-[10px] text-muted-foreground">Default OFF; applies live to first-time users.</p></div>
              <Btn size="sm" variant={draftSettings.eligibilityEnabled ? "success" : "ghost"} onClick={() => setDraftSettings((s) => ({ ...s, eligibilityEnabled: !s.eligibilityEnabled }))}>{draftSettings.eligibilityEnabled ? "ON" : "OFF"}</Btn>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("securityCheckTokens", "Eligibility bonus FOX", "1")}
              {field("referralTokens", "Referral FOX", "1")}
              {field("referralUsdt", "Referral USDT", "0.0001")}
              {field("mainTaskUsdt", "Main task USDT", "0.0001")}
              {field("dailyAdsGoal", "Daily ads goal", "1")}
              {field("dailyReferGoal", "Daily referral goal", "1")}
              {field("minWithdraw", "Minimum withdraw", "0.01")}
              {field("withdrawFee", "Withdraw fee", "0.001")}
              {field("tokenPriceUsd", "FOX price USD", "0.0001")}
            </div>
            <div className="mt-3 rounded-xl bg-surface-2 p-3 text-xs"><span className="text-muted-foreground">Daily reset</span><Num className="float-right text-success">00:00:00 UTC</Num></div>
            <Btn className="mt-4" full onClick={saveSettings}>Save all settings</Btn>
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
              {draftSettings.adProviders.map((p, index) => {
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
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-muted-foreground">FOX / ad
                        <input type="number" min="0" value={p.reward} onChange={(e) => setDraftSettings((s) => ({ ...s, adProviders: s.adProviders.map((provider, i) => i === index ? { ...provider, reward: Number(e.target.value) } : provider) }))} className="text-num mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground" />
                      </label>
                      <label className="text-[10px] text-muted-foreground">Daily limit
                        <input type="number" min="0" value={p.dailyLimit} onChange={(e) => setDraftSettings((s) => ({ ...s, adProviders: s.adProviders.map((provider, i) => i === index ? { ...provider, dailyLimit: Number(e.target.value) } : provider) }))} className="text-num mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground" />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <Btn className="mt-3" full onClick={saveSettings}>Save provider settings</Btn>
          </Card>
        </>
      )}
    </div>
  );
}
