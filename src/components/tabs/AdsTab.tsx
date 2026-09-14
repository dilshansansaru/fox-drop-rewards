import { useEffect, useState } from "react";
import { Btn, Card, Num, Progress, SectionTitle, useToast } from "@/components/ui-kit";
import { AD_TASK_MILESTONES, BRAND, type AdProviderId } from "@/lib/config";
import { showAd, type AdError } from "@/lib/ads";
import { adsTodayOf, adsTodayTotal, awardAd, today, type UserDoc } from "@/lib/store";
import { GuideBox } from "@/components/GuideBox";
import { MilestoneList } from "@/components/MilestoneList";
import { useAppSettings } from "@/lib/app-config";
import { VisitSitesTab } from "@/components/tabs/VisitSitesTab";

const CONSENT_KEY = "foxdrop-ads-consent";

export function AdsTab({ user }: { user: UserDoc }) {
  const [section, setSection] = useState<"ads" | "sites">("ads");
  const [busy, setBusy] = useState<AdProviderId | null>(null);
  const [consent, setConsent] = useState(true);
  const toast = useToast();
  const { settings } = useAppSettings();

  useEffect(() => {
    setConsent(window.localStorage.getItem(CONSENT_KEY) === "1");
  }, []);

  const acceptAds = () => {
    window.localStorage.setItem(CONSENT_KEY, "1");
    setConsent(true);
  };

  const revokeAds = () => {
    window.localStorage.removeItem(CONSENT_KEY);
    setConsent(false);
  };

  const adsToday = adsTodayOf(user);
  const total = adsTodayTotal(user);
  const day = today();

  const watch = async (id: AdProviderId, reward: number, limit: number) => {
    const seen = adsToday[id] ?? 0;
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
      <div className="grid grid-cols-2 gap-2">
        {([
          { id: "ads", label: "📺 Watch Ads" },
          { id: "sites", label: "🌐 View Site" },
        ] as const).map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`text-btn rounded-xl py-2.5 text-[11px] uppercase ${
              section === s.id
                ? "bg-brand-gradient text-primary-foreground"
                : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "sites" && <VisitSitesTab user={user} />}

      {section === "ads" && (
      <>
      <GuideBox
        icon="📺"
        title="Ads Guide"
        steps={[
          { do: "Watch an Adsgram AI ad (daily limit 20)", reward: "10 FOX per ad" },
          { do: "Watch a Monetag ad (daily limit 15)", reward: "8 FOX per ad" },
          { do: "Watch a GigaPub ad (daily limit 10)", reward: "8 FOX per ad" },
          { do: "Watch a Tower Ads ad (daily limit 50)", reward: "5 FOX per ad" },
          { do: "Daily ad task: watch 10 ads today", reward: "0.002 USDT" },
          { do: "Daily ad task: watch 20 ads today", reward: "0.005 USDT" },
          { do: "Daily ad task: watch 50 ads today", reward: "0.01 USDT" },
        ]}
         note={`Daily goal ${settings.dailyAdsGoal} ads. Ad tasks and their USDT rewards reset every day at 00:00:00 UTC, together with the ad counters. Watching ads is optional — every other part of FOXDROP stays fully usable.`}
      />

      <Card>
        <SectionTitle icon="📍">Where ads are shown</SectionTitle>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sponsored rewarded video ads appear only on this screen — Earn → Watch Ads → the
          “Watch” button of a network card below. Nothing else in FOXDROP shows an ad: there are no
          ads on Home, Tasks, Referral or Withdraw, no ads on app launch, no ads between clicks and
          no ad click is ever required. Viewing an ad fully is enough to earn.
        </p>
      </Card>

      {!consent ? (
        <Card className="text-center">
          <SectionTitle icon="✅">Your consent is required</SectionTitle>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            This screen shows sponsored rewarded video ads from Adsgram, Monetag, GigaPub and Tower
            Ads. Ads are entirely optional: if you do not agree, simply keep this screen off — tasks,
            referrals, reward codes and withdrawals continue to work normally.
          </p>
          <Btn full onClick={acceptAds}>
            I agree to watch sponsored ads
          </Btn>
          <p className="mt-2 text-[10px] text-muted-foreground">
            See our{" "}
            <a className="text-gold" href="/terms">
              advertising &amp; privacy policy
            </a>
            .
          </p>
        </Card>
      ) : (
        <>
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
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Ads are shown only when you tap Watch. One ad at a time, with a short cooldown between
          views. FOX are in-app reward points — nothing is auto-played and no reward is given for an
          ad that is not fully watched.
        </p>
        <button onClick={revokeAds} className="mt-3 text-[10px] uppercase text-muted-foreground underline">
          Turn off sponsored ads
        </button>
      </Card>


      <MilestoneList
        user={user}
        icon="🎯"
        title="Daily Ad Tasks"
        progress={total}
        unit="ads"
        items={AD_TASK_MILESTONES.map((m) => ({
          key: `${m.key}:${day}`,
          label: `Watch ${m.ads} ads today`,
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

      <Card>
        <SectionTitle icon="🧾">Payout proofs</SectionTitle>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Every approved USDT payout is posted with its transaction hash in our public payment
          channel, and top earners are listed on the public leaderboard in the Referral tab.
        </p>
        <a className="text-btn mt-2 inline-block text-xs uppercase text-gold" href={BRAND.payment}>
          View payout channel →
        </a>
      </Card>
      </>
      )}
      </>
      )}
    </div>
  );
}
