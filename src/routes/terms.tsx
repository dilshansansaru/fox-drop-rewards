import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, NETWORK, REWARDS } from "@/lib/config";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "FOXDROP Terms & Privacy Policy" },
      {
        name: "description",
        content:
          "FOXDROP terms of use, advertising policy and privacy policy: what data the Telegram mini app stores, how FOX reward points work and how USDT payouts are handled.",
      },
      { property: "og:title", content: "FOXDROP Terms & Privacy Policy" },
      {
        property: "og:description",
        content:
          "How FOXDROP rewards, advertising and user data work inside the Telegram mini app.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-panel mb-4 rounded-2xl border border-border p-4">
      <h2 className="text-head mb-2 text-sm uppercase tracking-wide text-primary">{title}</h2>
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Terms() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <h1 className="text-logo mb-1 text-3xl text-primary">FOXDROP</h1>
      <p className="mb-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Terms of Use &amp; Privacy Policy
      </p>

      <Section title="About the app">
        <p>
          FOXDROP is a free Telegram mini app where users collect FOX reward points by watching
          sponsored ads, completing community tasks and inviting friends. FOX points are in-app
          reward units only — they are not a security, not an investment product and carry no
          guaranteed monetary value.
        </p>
      </Section>

      <Section title="Advertising policy">
        <p>
          Ads are supplied by third-party networks (Adsgram, Monetag, GigaPub, Tower Ads). An ad is
          shown only after you tap a “Watch” button — no ad opens automatically, and only one ad can
          run at a time with a short cooldown in between.
        </p>
        <p>
          <b>Ad placement:</b> rewarded video ads appear in exactly one place — the Earn → Watch Ads
          screen, launched by the “Watch” button on a network card. No ads are shown on Home, Tasks,
          Referral, Withdraw or the site-visit list, none on app launch, none between clicks or
          screens, and none in any other moment of the app.
        </p>
        <p>
          <b>Consent:</b> the ad screen asks for your explicit agreement before the first ad is
          requested, and you can turn sponsored ads off again at any time from the same screen. All
          other features — tasks, referrals, reward codes, balances and withdrawals — remain fully
          available whether or not you watch ads. App functionality is never locked behind an ad.
        </p>
        <p>
          Rewards are credited only when the ad network confirms a completed view. Viewing is
          enough — we never require or reward a click on advertiser content, never simulate ad views,
          never hide or auto-click ads, and never gate a click behind an ad.
        </p>
        <p>
          <b>Realistic rewards:</b> a completed ad view pays 5–10 FOX points (about $0.005–$0.01 of
          in-app value) with per-network daily limits, plus small daily USDT ad tasks (0.002–0.01
          USDT). We do not promise or pay unrealistic amounts, and we do not buy, inflate or
          artificially grow traffic or statistics of any kind.
        </p>
        <p>
          <b>Payout proof:</b> each approved USDT payout is published with its BEP-20 transaction
          hash, recipient and amount in our public payout channel, and a public leaderboard is shown
          inside the app, so payouts can be independently verified.
        </p>
        <p>
          We do not publish adult, gambling, betting, hateful, deceptive or financial-investment
          content, and we do not promise earnings.
        </p>
      </Section>

      <Section title="Rewards & withdrawals">
        <p>
          Referral bonus: 350 FOX + {REWARDS.referralUsdt} USDT per verified friend, plus ad
          milestone bonuses. Ad counters and the daily USDT ad tasks reset at 00:00:00 UTC every day.
        </p>
        <p>
          USDT withdrawals open from {REWARDS.minWithdraw} USDT on {NETWORK} with a{" "}
          {REWARDS.withdrawFee} USDT network fee, usually processed within 24 hours. Requests from
          accounts using multiple accounts, emulators, VPN farms, bots or auto-clickers may be
          rejected and the account suspended.
        </p>
      </Section>

      <Section title="Privacy policy">
        <p>
          We store only what the reward system needs: your Telegram user id, first/last name,
          username, reward balances, ad and task counters, referral relations, the wallet address you
          submit for a withdrawal, and an IP address used once for duplicate-account detection.
        </p>
        <p>
          We never collect your phone number, contacts, messages, private keys or seed phrases. Data
          is stored in Google Firebase (Firestore) and is never sold. Third-party ad networks may
          process technical device data under their own privacy policies.
        </p>
        <p>
          Deletion request: message the support account in our community channel with your Telegram
          id and we will remove your record.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Community: <a className="text-gold" href={BRAND.community}>{BRAND.community}</a>
          <br />
          Payment proofs: <a className="text-gold" href={BRAND.payment}>{BRAND.payment}</a>
        </p>
      </Section>

      <Link to="/" className="text-btn text-xs uppercase text-primary">
        ← Back to app
      </Link>
    </main>
  );
}
