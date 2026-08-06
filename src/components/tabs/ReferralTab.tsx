import { Btn, Card, Num, SectionTitle, useToast } from "@/components/ui-kit";
import { BRAND, REWARDS } from "@/lib/config";
import { useReferrals, type ReferralStatus, type UserDoc } from "@/lib/store";
import { openLink } from "@/lib/telegram";

const STATUS: Record<ReferralStatus, { label: string; cls: string }> = {
  pending: { label: "⏳ Pending", cls: "text-muted-foreground" },
  verified: { label: "🔍 Verified", cls: "text-secondary" },
  credited: { label: "✅ Credited", cls: "text-success" },
  blocked: { label: "🚫 Blocked", cls: "text-destructive" },
};

export function ReferralTab({ user }: { user: UserDoc }) {
  const toast = useToast();
  const refs = useReferrals(user.id);
  const link = `${BRAND.miniAppUrl}?startapp=${user.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.push({ kind: "success", title: "Referral link copied!" });
    } catch {
      toast.push({ kind: "error", title: "Copy failed", desc: "Long-press the link to copy." });
    }
  };

  const share = () =>
    openLink(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
        `🦊 Join FOXDROP airdrop and get ${REWARDS.referralTokens} FOX + ${REWARDS.referralUsdt} USDT instantly!`,
      )}`,
    );

  return (
    <div className="space-y-4">
      <Card className="bg-hero-glow text-center">
        <SectionTitle icon="👥">Referral Program</SectionTitle>
        <Num className="text-4xl text-gold">{user.refCount ?? 0}</Num>
        <p className="text-xs text-muted-foreground">verified friends</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Per friend</p>
            <Num className="text-lg text-primary">{REWARDS.referralTokens} FOX</Num>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Instant USDT</p>
            <Num className="text-lg text-success">{REWARDS.referralUsdt}</Num>
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Your link</p>
        <p className="text-num break-all rounded-xl bg-surface-2 p-3 text-xs text-primary">{link}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn size="sm" variant="ghost" onClick={copy}>
            📎 Copy
          </Btn>
          <Btn size="sm" onClick={share}>
            👥 Invite Friends
          </Btn>
        </div>
        <Btn className="mt-2" size="sm" variant="outline" full onClick={() => openLink(BRAND.miniAppUrl)}>
          🚀 Open Mini App
        </Btn>
        <p className="mt-3 text-[11px] text-muted-foreground">
          ⚠️ Fake or same-IP referrals are blocked automatically and receive no reward.
        </p>
      </Card>

      <Card>
        <SectionTitle icon="🧾">Referral History</SectionTitle>
        {refs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No referrals yet — share your link to start.</p>
        ) : (
          <div className="space-y-2">
            {refs.map((r) => {
              const s = STATUS[r.status] ?? STATUS.pending;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm">{r.name || `User ${r.userId.slice(-4)}`}</p>
                    <p className={`text-[11px] ${s.cls}`}>{s.label}</p>
                    <p className="text-num text-[10px] text-muted-foreground">
                      📺 {r.ads ?? 0} ads · day {r.dayIndex ?? 1}
                    </p>
                    <p className="text-[10px]">
                      <span className={r.milestones?.["day1"] ? "text-success" : "text-muted-foreground"}>
                        D1 {REWARDS.day1AdsGoal} ads
                      </span>
                      {" · "}
                      <span className={r.milestones?.["day2"] ? "text-success" : "text-muted-foreground"}>
                        D2 {REWARDS.day2AdsGoal} ads
                      </span>
                    </p>
                    {r.reason && <p className="text-[10px] text-destructive">{r.reason}</p>}
                  </div>
                  <div className="text-right">
                    <Num className="text-xs text-gold">+{r.tokens} FOX</Num>
                    <Num className="block text-[11px] text-success">+{r.usdt.toFixed(4)} USDT</Num>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
