import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/telegram";

/* ---------------- Buttons ---------------- */

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "gold" | "ghost" | "outline" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  full?: boolean;
};

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
  full,
}: BtnProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-brand-gradient text-primary-foreground shadow-brand-glow hover:brightness-110 active:scale-[0.97]",
    gold: "bg-gold text-gold-foreground hover:brightness-110 active:scale-[0.97]",
    ghost: "bg-surface-2 text-foreground hover:bg-surface-2/70 active:scale-[0.97]",
    outline: "border border-primary/50 text-primary hover:bg-primary/10 active:scale-[0.97]",
    success: "bg-success text-success-foreground hover:brightness-110 active:scale-[0.97]",
    danger: "bg-destructive text-destructive-foreground hover:brightness-110 active:scale-[0.97]",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-xs rounded-lg",
    md: "h-11 px-4 text-sm rounded-xl",
    lg: "h-14 px-6 text-base rounded-2xl",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic("light");
        onClick?.();
      }}
      className={cn(
        "text-btn inline-flex items-center justify-center gap-2 uppercase tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-panel rounded-2xl border border-border p-4", className)}>{children}</div>
  );
}

export function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg uppercase">
      <span>{icon}</span>
      {children}
    </h2>
  );
}

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-num", className)}>{children}</span>;
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="bg-brand-gradient h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ---------------- Toast ---------------- */

type Toast = { id: number; kind: "success" | "error" | "info"; title: string; desc?: string };
type ToastCtx = { push: (t: Omit<Toast, "id">) => void };

const Ctx = createContext<ToastCtx>({ push: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    haptic(t.kind === "error" ? "error" : t.kind === "success" ? "success" : "light");
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-100 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-pop w-full max-w-sm rounded-2xl border p-3 backdrop-blur-md",
              t.kind === "success" && "border-success/40 bg-success/15",
              t.kind === "error" && "border-destructive/40 bg-destructive/15",
              t.kind === "info" && "border-primary/40 bg-primary/15",
            )}
          >
            <p className="text-btn text-sm">
              {t.kind === "success" ? "✅ " : t.kind === "error" ? "⚠️ " : "ℹ️ "}
              {t.title}
            </p>
            {t.desc && <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/* ---------------- Sheet / Modal ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-90 flex items-end justify-center bg-background/80 backdrop-blur-sm">
      <div className="animate-rise bg-panel max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg uppercase">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
