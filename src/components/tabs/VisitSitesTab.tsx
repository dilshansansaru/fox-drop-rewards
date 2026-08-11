import { useEffect, useRef, useState } from "react";
import { Btn, Card, Num, Progress, SectionTitle, useToast } from "@/components/ui-kit";
import { GuideBox } from "@/components/GuideBox";
import { claimSiteVisit, today, useVisitSites, type UserDoc } from "@/lib/store";

type Timer = { left: number; done: boolean };

export function VisitSitesTab({ user }: { user: UserDoc }) {
  const sites = useVisitSites().filter((s) => s.active !== false);
  const [timers, setTimers] = useState<Record<string, Timer>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const intervals = useRef<Record<string, number>>({});
  const toast = useToast();

  useEffect(
    () => () => Object.values(intervals.current).forEach((i) => window.clearInterval(i)),
    [],
  );

  const visit = (id: string, url: string, seconds: number) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setTimers((t) => ({ ...t, [id]: { left: seconds, done: false } }));
    window.clearInterval(intervals.current[id] ?? 0);
    intervals.current[id] = window.setInterval(() => {
      setTimers((t) => {
        const left = (t[id]?.left ?? 1) - 1;
        if (left <= 0) window.clearInterval(intervals.current[id] ?? 0);
        return { ...t, [id]: { left: Math.max(left, 0), done: left <= 0 } };
      });
    }, 1000);
  };

  const claim = async (id: string) => {
    const site = sites.find((s) => s.id === id);
    if (!site) return;
    setBusy(id);
    try {
      await claimSiteVisit(user.id, site);
      toast.push({
        kind: "success",
        title: "Visit reward claimed!",
        desc: `+${site.tokens} FOX${site.usdt ? ` · +${site.usdt} USDT` : ""}`,
      });
      setTimers((t) => ({ ...t, [id]: { left: 0, done: false } }));
    } catch (e) {
      toast.push({
        kind: "error",
        title: "Claim failed",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <GuideBox
        icon="🌐"
        title="View Site Guide"
        steps={[
          { do: "Tap View to open the sponsored website", reward: "Timer starts" },
          { do: "Stay on the site until the countdown ends", reward: "Claim unlocks" },
          { do: "Come back and tap Claim", reward: "FOX + USDT instantly" },
        ]}
        note="Each website can be claimed once per day. Counters reset at 00:00:00 UTC."
      />
      {!sites.length && (
        <Card>
          <p className="text-center text-xs text-muted-foreground">
            No websites available right now. Check back soon.
          </p>
        </Card>
      )}
      {sites.map((s, index) => {
        const seconds = s.seconds || 10;
        const timer = timers[s.id];
        const claimedToday = user.sitesClaimed?.[s.id] === today();
        return (
          <Card key={s.id} className="animate-rise">
            <div className="flex items-center gap-3">
              <div className="bg-brand-gradient flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
                🌐
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-btn truncate text-sm">
                  Website {index + 1} · {s.title}
                </p>
                <Num className="text-xs text-gold">
                  +{s.tokens} FOX{s.usdt ? ` · +${s.usdt} USDT` : ""}
                </Num>
                <p className="text-[11px] text-muted-foreground">
                  View for <Num>{seconds}s</Num>
                </p>
              </div>
              {claimedToday ? (
                <Btn size="sm" variant="ghost" disabled>
                  Done
                </Btn>
              ) : timer?.done ? (
                <Btn size="sm" variant="success" disabled={busy === s.id} onClick={() => claim(s.id)}>
                  {busy === s.id ? "…" : "Claim"}
                </Btn>
              ) : timer ? (
                <Btn size="sm" variant="outline" disabled>
                  {timer.left}s
                </Btn>
              ) : (
                <Btn size="sm" onClick={() => visit(s.id, s.url, seconds)}>
                  View
                </Btn>
              )}
            </div>
            {timer && !timer.done && (
              <div className="mt-3">
                <Progress value={seconds - timer.left} max={seconds} />
              </div>
            )}
          </Card>
        );
      })}
      <Card>
        <SectionTitle icon="ℹ️">Note</SectionTitle>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Sponsored websites open only when you tap View. FOX are in-app reward points with no
          guaranteed value.
        </p>
      </Card>
    </div>
  );
}
