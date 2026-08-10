import type { AdProviderId } from "./config";

/**
 * Ad network adapters.
 *
 * AdsGram moderation compliance:
 *  - every ad is user-initiated (button tap), never auto-played on launch;
 *  - only ONE ad can run at a time and a cooldown is enforced between views;
 *  - there is NO simulated/fake ad view — if the network SDK cannot serve an
 *    ad, no impression and no reward is produced;
 *  - rewards are credited only after the network reports a completed view.
 */

const ADSGRAM_BLOCK = import.meta.env["VITE_ADSGRAM_BLOCK_ID"] as string | undefined;
const MONETAG_ZONE = import.meta.env["VITE_MONETAG_ZONE"] as string | undefined;
const GIGAPUB_ID = import.meta.env["VITE_GIGAPUB_ID"] as string | undefined;
const TOWER_ID = import.meta.env["VITE_TOWERADS_ID"] as string | undefined;

/** Minimum time between two ad views (ms) — anti-spam / anti-fraud. */
export const AD_COOLDOWN_MS = 15_000;

export class AdError extends Error {
  constructor(
    message: string,
    readonly code: "not-configured" | "no-fill" | "cooldown" | "busy",
  ) {
    super(message);
  }
}

let lastAdAt = 0;
let running = false;

export function adCooldownLeft() {
  return Math.max(0, AD_COOLDOWN_MS - (Date.now() - lastAdAt));
}

export function isProviderConfigured(provider: AdProviderId) {
  return Boolean(
    { adsgram: ADSGRAM_BLOCK, monetag: MONETAG_ZONE, gigapub: GIGAPUB_ID, towerads: TOWER_ID }[
      provider
    ],
  );
}

function loadScript(src: string, attrs: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = () => resolve();
    s.onerror = () => reject(new AdError(`Failed to load ${src}`, "no-fill"));
    document.head.appendChild(s);
  });
}

type W = Window & Record<string, unknown>;

async function showAdsgram() {
  if (!ADSGRAM_BLOCK) throw new AdError("Adsgram block id is missing", "not-configured");
  await loadScript("https://sad.adsgram.ai/js/sad.min.js");
  const w = window as unknown as W;
  const init = w["Adsgram"] as
    | { init: (o: { blockId: string }) => { show: () => Promise<unknown> } }
    | undefined;
  if (!init) throw new AdError("Adsgram SDK unavailable", "no-fill");
  await init.init({ blockId: ADSGRAM_BLOCK }).show();
}

async function showMonetag() {
  if (!MONETAG_ZONE) throw new AdError("Monetag zone is missing", "not-configured");
  await loadScript(`https://libtl.com/sdk.js`, {
    "data-zone": MONETAG_ZONE,
    "data-sdk": "show_monetag",
  });
  const w = window as unknown as W;
  const fn = w["show_monetag"] as (() => Promise<unknown>) | undefined;
  if (!fn) throw new AdError("Monetag SDK unavailable", "no-fill");
  await fn();
}

async function showGigapub() {
  if (!GIGAPUB_ID) throw new AdError("GigaPub id is missing", "not-configured");
  await loadScript(`https://ad.gigapub.tech/script?id=${GIGAPUB_ID}`);
  const w = window as unknown as W;
  const api = w["showGiga"] as (() => Promise<unknown>) | undefined;
  if (!api) throw new AdError("GigaPub SDK unavailable", "no-fill");
  await api();
}

async function showTowerAds() {
  if (!TOWER_ID) throw new AdError("Tower Ads id is missing", "not-configured");
  await loadScript(`https://cdn.towerads.io/sdk.js?id=${TOWER_ID}`);
  const w = window as unknown as W;
  const api = w["TowerAds"] as { show: () => Promise<unknown> } | undefined;
  if (!api) throw new AdError("Tower Ads SDK unavailable", "no-fill");
  await api.show();
}

/** Shows one real rewarded ad. Resolves only when the network confirms a full view. */
export async function showAd(provider: AdProviderId): Promise<"network"> {
  if (running) throw new AdError("An ad is already playing", "busy");
  const left = adCooldownLeft();
  if (left > 0) throw new AdError(`Please wait ${Math.ceil(left / 1000)}s`, "cooldown");

  const runners: Record<AdProviderId, () => Promise<void>> = {
    adsgram: showAdsgram,
    monetag: showMonetag,
    gigapub: showGigapub,
    towerads: showTowerAds,
  };
  running = true;
  try {
    await runners[provider]();
    lastAdAt = Date.now();
    return "network";
  } finally {
    running = false;
  }
}
