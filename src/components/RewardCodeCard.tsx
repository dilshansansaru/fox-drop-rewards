import { useState } from "react";
import { Btn, Card, Num, SectionTitle, useToast } from "@/components/ui-kit";
import { redeemPromoCode, type UserDoc } from "@/lib/store";

export function RewardCodeCard({ user }: { user: UserDoc }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const claimed = Object.keys(user.promoClaimed ?? {}).filter((k) => user.promoClaimed?.[k]);

  const redeem = async () => {
    setBusy(true);
    try {
      const res = await redeemPromoCode(user.id, code);
      toast.push({
        kind: "success",
        title: "Reward code claimed!",
        desc: `+${res.tokens} FOX${res.usdt ? ` · +${res.usdt} USDT` : ""}`,
      });
      setCode("");
    } catch (e) {
      toast.push({
        kind: "error",
        title: "Code not accepted",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle icon="🎟️">Reward Code</SectionTitle>
      <p className="mb-3 text-xs text-muted-foreground">
        Enter a code shared in our Telegram community to instantly receive FOX and USDT.
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="FOXDROP2026"
          className="text-num h-11 flex-1 rounded-xl border border-input bg-surface-2 px-3 text-sm uppercase text-foreground outline-none focus:border-primary"
        />
        <Btn disabled={busy || !code.trim()} onClick={redeem}>
          {busy ? "…" : "Claim"}
        </Btn>
      </div>
      {claimed.length > 0 && (
        <p className="text-num mt-2 text-[10px] text-muted-foreground">
          Claimed codes: <Num className="text-gold">{claimed.join(", ")}</Num>
        </p>
      )}
    </Card>
  );
}
