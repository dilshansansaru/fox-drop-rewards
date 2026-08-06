import { Btn, Card, Num, Progress, SectionTitle, useToast } from "@/components/ui-kit";
import { claimDayBonus, type UserDoc } from "@/lib/store";

export type MilestoneItem = {
  key: string;
  label: string;
  goal: number;
  usdt: number;
};

export function MilestoneList({
  user,
  title,
  icon,
  progress,
  unit,
  items,
}: {
  user: UserDoc;
  title: string;
  icon: string;
  /** current progress value used to unlock the milestones */
  progress: number;
  unit: string;
  items: MilestoneItem[];
}) {
  const toast = useToast();

  const claim = async (key: string, usdt: number, ok: boolean) => {
    if (!ok) {
      toast.push({ kind: "error", title: "Not unlocked yet", desc: "Keep going to unlock it." });
      return;
    }
    try {
      await claimDayBonus(user.id, key, usdt);
      toast.push({ kind: "success", title: `+${usdt} USDT claimed!` });
    } catch {
      toast.push({ kind: "error", title: "Claim failed", desc: "Please try again." });
    }
  };

  return (
    <Card>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <div className="space-y-2">
        {items.map((m) => {
          const claimed = !!user.dayBonusClaimed?.[m.key];
          const ok = progress >= m.goal;
          return (
            <div key={m.key} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{m.label}</p>
                  <Num className="text-xs text-success">+{m.usdt} USDT</Num>
                </div>
                <Btn
                  size="sm"
                  variant={claimed ? "ghost" : ok ? "success" : "outline"}
                  disabled={claimed}
                  onClick={() => claim(m.key, m.usdt, ok)}
                >
                  {claimed ? "Claimed" : ok ? "Claim" : "Locked"}
                </Btn>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={Math.min(progress, m.goal)} max={m.goal} />
                <Num className="text-[10px] text-muted-foreground">
                  {Math.min(progress, m.goal)}/{m.goal} {unit}
                </Num>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
