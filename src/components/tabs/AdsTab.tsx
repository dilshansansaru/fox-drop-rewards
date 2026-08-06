import { useState } from "react";
import { Btn, Card, Num, Progress, SectionTitle, useToast } from "@/components/ui-kit";
import { AD_PROVIDERS, REWARDS, type AdProviderId } from "@/lib/config";
import { showAd } from "@/lib/ads";
import { awardAd, type UserDoc } from "@/lib/store";

export function AdsTab({ user }: { user: UserDoc }) {
  const [busy, setBusy] = useState<AdProviderId | null>(null);
  const toast = useToast();

  const total = Object.values(user.adsToday ?? {}).reduce((a, b) => a + (b ?? 0), 0);

  const watch = async (id: AdProviderId, reward: number, limit: number) => {
    const seen = user.adsToday?.[id] ?? 0;
    if (seen >= limit) {
      toast.push({ kind: "error", title: "Daily limit reached", desc: "Come back tomorrow." });
      return;
    }
    setBusy(id);
    try {
      const mode = await showAd(id);
      await awardAd(user, id, reward);
      toast.push({
        kind: "success",
        title: `+${reward} FOX earned!`,
        desc: mode === "fallback" ? "Ad view completed" : "Sponsored ad completed",
      });
    } catch {
      toast.push({ kind: "error", title: "Ad not completed", desc: "Reward was not credited." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <SectionTitle icon="📺">Watch Ads</SectionTitle>
        <Num className="text-3xl text-gold">
          {total}/{REWARDS.dailyAdsGoal}
        </Num>
        <p className="mb-3 text-xs text-muted-foreground">ads watched today</p>
        <Progress value={total} max={REWARDS.dailyAdsGoal} />
      </Card>

      {AD_PROVIDERS.map((p) => {
        const seen = user.adsToday?.[p.id] ?? 0;
        const full = seen >= p.dailyLimit;
        return (
          <Card key={p.id} className="animate-rise">
            <div className="flex items-center gap-3">
              <div className="bg-brand-gradient flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
                {p.icon}
              </div>
              <div className="flex-1">
                <p className="text-btn text-sm">{p.name}</p>
                <Num className="text-xs text-gold">+{p.reward} FOX / ad</Num>
                <p className="text-[11px] text-muted-foreground">
                  <Num>
                    {seen}/{p.dailyLimit}
                  </Num>{" "}
                  daily ads
                </p>
              </div>
              <Btn
                size="sm"
                variant={full ? "ghost" : "primary"}
                disabled={full || busy !== null}
                onClick={() => watch(p.id, p.reward, p.dailyLimit)}
              >
                {busy === p.id ? "Loading…" : full ? "Done" : "Watch"}
              </Btn>
            </div>
            <div className="mt-3">
              <Progress value={seen} max={p.dailyLimit} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
