import type { AdProviderId } from "./config";
import { getLatestSettings } from "./app-config";

/**
 * Ad network adapters.
 *
 * AdsGram moderation compliance:
 *  - the AdsGram SDK is loaded and the block is initialised as soon as the app
 *    opens, so the placement is detectable by moderators;
 *  - every ad is user-initiated (button tap), never auto-played on launch;
 *  - only ONE ad can run at a time and a cooldown is enforced between views;
 *  - there is NO simulated/fake ad view — if the network SDK cannot serve an
 *    ad, no impression and no reward is produced;
 *  - rewards are credited only after the network reports a completed view.
 *
 * Network ids come from Admin → System (Firestore app_config/settings) with
 * VITE_* env variables as fallback.
 */

const ids = () => {
  const s = getLatestSettings();
  return {
    adsgram: s.adsgramBlockId?.trim() ?? "",
    monetag: s.monetagZone?.trim() ?? "",
    gigapub: s.gigapubId?.trim() ?? "",
    towerads: s.toweradsId?.trim() ?? "",
  };
};

/** Minimum time between two ad views (ms) — anti-spam / anti-fraud. */
export const AD_COOLDOWN_MS = 15_000;

export class AdError extends Error {
  constructor(
    message: string,
    readonly code: "not-configured" | "no-fill" | "cooldown" | "busy" | "skipped",
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
  return Boolean(ids()[provider]);
}

function loadScript(src: string, attrs: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.getAttribute("data-loaded") === "1") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new AdError(`Failed to load ${src}`, "no-fill")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = () => {
      s.setAttribute("data-loaded", "1");
      resolve();
    };
    s.onerror = () => reject(new AdError(`Failed to load ${src}`, "no-fill"));
    document.head.appendChild(s);
  });
}

type W = Window & Record<string, unknown>;

type AdsgramController = {
  show: () => Promise<{ done?: boolean; error?: boolean; state?: string; description?: string }>;
  addEventListener?: (event: string, cb: () => void) => void;
};
type AdsgramSdk = { init: (o: { blockId: string; debug?: boolean }) => AdsgramController };

let adsgramController: AdsgramController | null = null;
let adsgramBlock = "";

/** Loads the AdsGram SDK and initialises the block once. Safe to call repeatedly. */
export async function initAdsgram(): Promise<AdsgramController | null> {
  const block = ids().adsgram;
  if (!block) return null;
  if (adsgramController && adsgramBlock === block) return adsgramController;
  await loadScript("https://sad.adsgram.ai/js/sad.min.js");
  const sdk = (window as unknown as W)["Adsgram"] as AdsgramSdk | undefined;
  if (!sdk) return null;
  adsgramController = sdk.init({ blockId: block });
  adsgramBlock = block;
  return adsgramController;
}

/** Pre-warms the AdsGram SDK on app start so the placement is verifiable. Never shows an ad. */
export function preloadAdSdks() {
  if (typeof window === "undefined") return;
  void initAdsgram().catch(() => null);
}

async function showAdsgram() {
  if (!ids().adsgram) throw new AdError("Adsgram block id is missing", "not-configured");
  const controller = await initAdsgram();
  if (!controller) throw new AdError("Adsgram SDK unavailable", "no-fill");
  const result = await controller.show().catch((r: { description?: string; error?: boolean }) => {
    throw new AdError(r?.description ?? "No ad available", "no-fill");
  });
  // AdsGram resolves with done=true only after the user watched the whole ad.
  if (result && result.done === false) throw new AdError("Ad was not watched fully", "skipped");
}

async function showMonetag() {
  const zone = ids().monetag;
  if (!zone) throw new AdError("Monetag zone is missing", "not-configured");
  await loadScript(`https://libtl.com/sdk.js`, { "data-zone": zone, "data-sdk": "show_monetag" });
  const w = window as unknown as W;
  const fn = w["show_monetag"] as (() => Promise<unknown>) | undefined;
  if (!fn) throw new AdError("Monetag SDK unavailable", "no-fill");
  await fn();
}

async function showGigapub() {
  const id = ids().gigapub;
  if (!id) throw new AdError("GigaPub id is missing", "not-configured");
  await loadScript(`https://ad.gigapub.tech/script?id=${id}`);
  const w = window as unknown as W;
  const api = w["showGiga"] as (() => Promise<unknown>) | undefined;
  if (!api) throw new AdError("GigaPub SDK unavailable", "no-fill");
  await api();
}

async function showTowerAds() {
  const id = ids().towerads;
  if (!id) throw new AdError("Tower Ads id is missing", "not-configured");
  await loadScript(`https://cdn.towerads.io/sdk.js?id=${id}`);
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
