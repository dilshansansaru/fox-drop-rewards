import type { AdProviderId } from "./config";

/**
 * Ad network adapters. Each network is loaded lazily; when a network SDK is
 * unavailable (outside Telegram, blocked, no zone id configured) we fall back
 * to a timed in-app ad view so rewards still work end to end.
 */

const ADSGRAM_BLOCK = import.meta.env["VITE_ADSGRAM_BLOCK_ID"] as string | undefined;
const MONETAG_ZONE = import.meta.env["VITE_MONETAG_ZONE"] as string | undefined;
const GIGAPUB_ID = import.meta.env["VITE_GIGAPUB_ID"] as string | undefined;
const TOWER_ID = import.meta.env["VITE_TOWERADS_ID"] as string | undefined;

function loadScript(src: string, attrs: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type W = Window & Record<string, unknown>;

async function showAdsgram() {
  if (!ADSGRAM_BLOCK) throw new Error("no-sdk");
  await loadScript("https://sad.adsgram.ai/js/sad.min.js");
  const w = window as unknown as W;
  const init = w["Adsgram"] as { init: (o: { blockId: string }) => { show: () => Promise<unknown> } };
  await init.init({ blockId: ADSGRAM_BLOCK }).show();
}

async function showMonetag() {
  if (!MONETAG_ZONE) throw new Error("no-sdk");
  await loadScript(`https://libtl.com/sdk.js`, { "data-zone": MONETAG_ZONE, "data-sdk": "show_monetag" });
  const w = window as unknown as W;
  const fn = w["show_monetag"] as (() => Promise<unknown>) | undefined;
  if (!fn) throw new Error("no-sdk");
  await fn();
}

async function showGigapub() {
  if (!GIGAPUB_ID) throw new Error("no-sdk");
  await loadScript(`https://ad.gigapub.tech/script?id=${GIGAPUB_ID}`);
  const w = window as unknown as W;
  const api = w["showGiga"] as (() => Promise<unknown>) | undefined;
  if (!api) throw new Error("no-sdk");
  await api();
}

async function showTowerAds() {
  if (!TOWER_ID) throw new Error("no-sdk");
  await loadScript(`https://cdn.towerads.io/sdk.js?id=${TOWER_ID}`);
  const w = window as unknown as W;
  const api = w["TowerAds"] as { show: () => Promise<unknown> } | undefined;
  if (!api) throw new Error("no-sdk");
  await api.show();
}

/** Returns "network" when a real ad was shown, "fallback" for the in-app view. */
export async function showAd(provider: AdProviderId): Promise<"network" | "fallback"> {
  const runners: Record<AdProviderId, () => Promise<void>> = {
    adsgram: showAdsgram,
    monetag: showMonetag,
    gigapub: showGigapub,
    towerads: showTowerAds,
  };
  try {
    await runners[provider]();
    return "network";
  } catch {
    await wait(5000);
    return "fallback";
  }
}
