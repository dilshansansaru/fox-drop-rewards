import { useState } from "react";
import { Btn, Card, Num, Progress, SectionTitle, useToast } from "@/components/ui-kit";
import { AD_TASK_MILESTONES, type AdProviderId } from "@/lib/config";
import { showAd, type AdError } from "@/lib/ads";
import { awardAd, type UserDoc } from "@/lib/store";
import { GuideBox } from "@/components/GuideBox";
import { MilestoneList } from "@/components/MilestoneList";
import { useAppSettings } from "@/lib/app-config";

export function AdsTab({ user }: { user: UserDoc }) {
  const [busy, setBusy] = useState<AdProviderId | null>(null);
  const toast = useToast();
  const { settings } = useAppSettings();

  const total = Object.values(user.adsToday ?? {}).reduce((a, b) => a + (b ?? 0), 0);

  const watch = async (id: AdProviderId, reward: number, limit: number) => {
    const seen = user.adsToday?.[id] ?? 0;
    if (seen >= limit) {
      toast.push({ kind: "error", title: "Daily limit reached", desc: "Come back tomorrow." });
      return;
    }
    setBusy(id);
    try {
      await showAd(id);
      await awardAd(user, id, reward);
      toast.push({
        kind: "success",
        title: `+${reward} FOX earned!`,
        desc: "Sponsored ad watched fully",
      });
    } catch (e) {
      const err = e as AdError;
      toast.push({
        kind: "error",
        title:
          err?.code === "cooldown"
            ? "Please wait a moment"
            : err?.code === "not-configured"
              ? "Ad network not available"
              : "No ad available right now",
        desc:
          err?.code === "cooldown"
            ? err.message
            : "No reward was credited. Please try again later.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <GuideBox
        icon="📺"
        title="Ads Guide"
        steps={[
          { do: "Watch an Adsgram AI ad (daily limit 20)", reward: "100 FOX per ad" },
          { do: "Watch a Monetag ad (daily limit 15)", reward: "50 FOX per ad" },
          { do: "Watch a GigaPub ad (daily limit 10)", reward: "50 FOX per ad" },
          { do: "Watch a Tower Ads ad (daily limit 50)", reward: "10 FOX per ad" },
          { do: "Ad task: watch 10 ads in total", reward: "0.002 USDT" },
          { do: "Ad task: watch 20 ads in total", reward: "0.005 USDT" },
          { do: "Ad task: watch 50 ads in total", reward: "0.01 USDT" },
        ]}
         note={`Daily goal ${settings.dailyAdsGoal} ads. Each ad must be watched fully — rewards credit instantly. Counters reset at 00:00:00 UTC.`}
      />
      <Card className="text-center">
        <SectionTitle icon="📺">Watch Ads</SectionTitle>
        <Num className="text-3xl text-gold">
           {total}/{settings.dailyAdsGoal}
        </Num>
        <p className="mb-3 text-xs text-muted-foreground">ads watched today</p>
         <Progress value={total} max={settings.dailyAdsGoal} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Total ads watched: <Num>{user.totalAds ?? 0}</Num>
        </p>
      </Card>

      <MilestoneList
        user={user}
        icon="🎯"
        title="Ad Tasks"
        progress={user.totalAds ?? 0}
        unit="ads"
        items={AD_TASK_MILESTONES.map((m) => ({
          key: m.key,
          label: `Watch ${m.ads} ads`,
          goal: m.ads,
          usdt: m.usdt,
        }))}
      />

       {settings.adProviders.map((p) => {
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
