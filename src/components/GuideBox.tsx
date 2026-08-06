import { useState } from "react";
import { Card, Num, SectionTitle } from "@/components/ui-kit";

export type GuideStep = {
  /** what the user has to do */
  do: string;
  /** what they get for it */
  reward: string;
};

export function GuideBox({
  title = "How this works",
  icon = "📖",
  steps,
  note,
}: {
  title?: string;
  icon?: string;
  steps: GuideStep[];
  note?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <SectionTitle icon={icon}>{title}</SectionTitle>
        <span className={`text-xs text-primary transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {open && (
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s.do} className="flex gap-3 rounded-xl bg-surface-2 p-3">
              <Num className="text-primary">{i + 1}</Num>
              <div className="flex-1">
                <p className="text-sm">{s.do}</p>
                <Num className="text-xs text-success">🎁 {s.reward}</Num>
              </div>
            </li>
          ))}
          {note && <p className="pt-1 text-xs text-muted-foreground">{note}</p>}
        </ol>
      )}
    </Card>
  );
}
