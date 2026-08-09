import { useState } from "react";
import { Btn, Card, Num, SectionTitle, useToast } from "@/components/ui-kit";
import { REWARDS, TASKS, type Task, type TaskCategory } from "@/lib/config";
import { completeTask, verifyTelegramMembership, type UserDoc } from "@/lib/store";
import { openLink } from "@/lib/telegram";
import { GuideBox } from "@/components/GuideBox";
import { useLiveTasks } from "@/lib/app-config";

const CATEGORIES: { id: TaskCategory; label: string; icon: string }[] = [
  { id: "main", label: "Main", icon: "⭐" },
  { id: "partner", label: "Partner", icon: "🤝" },
  { id: "community", label: "Community", icon: "🌐" },
];

export function TasksTab({ user }: { user: UserDoc }) {
  const [cat, setCat] = useState<TaskCategory>("main");
  const [busy, setBusy] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, number>>({});
  const toast = useToast();
  const tasks = useLiveTasks();

  const handle = async (task: Task) => {
    if (user.tasks?.[task.id]) return;

    if (task.kind === "miniapp") {
      const openedAt = opened[task.id];
      if (!openedAt) {
        openLink(task.url);
        setOpened((o) => ({ ...o, [task.id]: Date.now() }));
        toast.push({ kind: "info", title: "Mini app opened", desc: "Come back in 5 seconds to claim." });
        return;
      }
      if (Date.now() - openedAt < 5000) {
        toast.push({ kind: "error", title: "Almost there", desc: "Wait 5 seconds before claiming." });
        return;
      }
      setBusy(task.id);
      try {
        await completeTask(user.id, task.id, task.reward, task.rewardUsdt ?? 0);
        toast.push({ kind: "success", title: `+${task.reward} FOX claimed!` });
      } finally {
        setBusy(null);
      }
      return;
    }

    if (task.kind === "telegram" && task.chat) {
      setBusy(task.id);
      try {
        openLink(task.url);
        const ok = await verifyTelegramMembership(task.chat, user.id);
        if (!ok) {
          toast.push({
            kind: "error",
            title: "Not joined yet",
            desc: "Join the channel, then tap Verify again.",
          });
          return;
        }
        await completeTask(user.id, task.id, task.reward, task.rewardUsdt ?? 0);
        toast.push({
          kind: "success",
          title: `+${task.reward} FOX${task.rewardUsdt ? ` +${task.rewardUsdt} USDT` : ""}`,
          desc: "Membership verified",
        });
      } finally {
        setBusy(null);
      }
      return;
    }

    openLink(task.url);
    toast.push({ kind: "info", title: "Task in progress", desc: "Reward is credited automatically." });
  };

  const list = tasks.filter((t) => t.category === cat);
  const done = tasks.filter((t) => user.tasks?.[t.id]).length;

  return (
    <div className="space-y-4">
      <GuideBox
        icon="📋"
        title="Tasks Guide"
        steps={[
          { do: "⭐ Main tasks: join community & payment channel, add mini app", reward: `250–500 FOX + ${REWARDS.mainTaskUsdt} USDT` },
          { do: "🤝 Partner tasks: join partner channel / open partner mini app", reward: "150–200 FOX" },
          { do: "🌐 Community tasks: invite friends & watch daily ads", reward: "400–700 FOX" },
          { do: "Finish the task, then tap the Verify button", reward: "Instant reward credit" },
          { do: "Ad tasks: 10 / 20 / 50 ads watched (Ads tab)", reward: "0.002 / 0.005 / 0.01 USDT" },
          { do: "Referral tasks: 5 / 10 / 25 / 75 friends (Frens tab)", reward: "0.005 / 0.01 / 0.03 / 0.1 USDT" },
        ]}
        note="Telegram tasks are verified by real channel membership — leaving the channel can void the reward."
      />
      <Card className="text-center">
        <SectionTitle icon="📋">Task Center</SectionTitle>
        <Num className="text-3xl text-gold">
          {done}/{tasks.length}
        </Num>
        <p className="text-xs text-muted-foreground">tasks completed</p>
      </Card>

      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`text-btn flex-1 rounded-xl py-2.5 text-xs uppercase transition-all ${
              cat === c.id
                ? "bg-brand-gradient text-primary-foreground shadow-brand-glow"
                : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {list.map((t) => {
        const complete = !!user.tasks?.[t.id];
        const waiting = t.kind === "miniapp" && opened[t.id] && !complete;
        return (
          <Card key={t.id} className="animate-rise">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-xl">
                {t.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm">{t.title}</p>
                <Num className="text-xs text-gold">
                  +{t.reward} FOX{t.rewardUsdt ? ` · +${t.rewardUsdt} USDT` : ""}
                </Num>
              </div>
              <Btn
                size="sm"
                variant={complete ? "success" : "primary"}
                disabled={complete || busy === t.id}
                onClick={() => handle(t)}
              >
                {complete
                  ? "✅"
                  : busy === t.id
                    ? "…"
                    : waiting
                      ? "Claim"
                      : t.kind === "telegram"
                        ? "Verify"
                        : "Start"}
              </Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
