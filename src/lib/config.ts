export const BRAND = {
  name: "FOXDROP",
  botUsername: "Fox_Drop_Bot",
  miniAppUrl: "https://t.me/Fox_Drop_Bot/play",
  community: "https://t.me/FoxDropcommunity",
  payment: "https://t.me/FoxDroppayment",
};

/** 1 FOX = $0.001 */
export const TOKEN_PRICE_USD = 0.001;

export const REWARDS = {
  /** instant on join via referral link */
  referralTokens: 350,
  referralUsdt: 0.0025,
  mainTaskUsdt: 0.0025,
  day1AdsGoal: 10,
  day1Usdt: 0.005,
  day2AdsGoal: 15,
  day2Usdt: 0.005,
  securityCheckTokens: 25,
  minWithdraw: 0.1,
  withdrawFee: 0.01,
  dailyAdsGoal: 20,
  dailyReferGoal: 2,
};

/** Extra USDT the inviter earns when a referred friend watches ads. */
export const REFERRAL_MILESTONES = [
  { key: "day1", day: 1, ads: REWARDS.day1AdsGoal, usdt: REWARDS.day1Usdt },
  { key: "day2", day: 2, ads: REWARDS.day2AdsGoal, usdt: REWARDS.day2Usdt },
] as const;

export type AdProviderId = "adsgram" | "monetag" | "gigapub" | "towerads";

export type AdProvider = {
  id: AdProviderId;
  name: string;
  reward: number;
  dailyLimit: number;
  icon: string;
};

export const AD_PROVIDERS: AdProvider[] = [
  { id: "adsgram", name: "Adsgram AI", reward: 100, dailyLimit: 20, icon: "🤖" },
  { id: "monetag", name: "Monetag", reward: 50, dailyLimit: 15, icon: "📡" },
  { id: "gigapub", name: "GigaPub", reward: 50, dailyLimit: 10, icon: "🛰️" },
  { id: "towerads", name: "Tower Ads", reward: 10, dailyLimit: 50, icon: "🗼" },
];

export type TaskCategory = "main" | "partner" | "community";

export type Task = {
  id: string;
  category: TaskCategory;
  title: string;
  reward: number;
  rewardUsdt?: number;
  icon: string;
  kind: "telegram" | "miniapp" | "link";
  /** channel/group username used for Telegram membership verification */
  chat?: string;
  url: string;
};

export const TASKS: Task[] = [
  {
    id: "join-community",
    category: "main",
    title: "Join FOXDROP Community",
    reward: 500,
    rewardUsdt: REWARDS.mainTaskUsdt,
    icon: "🌐",
    kind: "telegram",
    chat: "@FoxDropcommunity",
    url: BRAND.community,
  },
  {
    id: "join-payment",
    category: "main",
    title: "Join Payment Proof Channel",
    reward: 300,
    icon: "💳",
    kind: "telegram",
    chat: "@FoxDroppayment",
    url: BRAND.payment,
  },
  {
    id: "add-miniapp",
    category: "main",
    title: "Add FOXDROP Mini App",
    reward: 250,
    icon: "📲",
    kind: "miniapp",
    url: BRAND.miniAppUrl,
  },
  {
    id: "partner-1",
    category: "partner",
    title: "Join Partner Airdrop Channel",
    reward: 200,
    icon: "🤝",
    kind: "telegram",
    chat: "@FoxDropcommunity",
    url: BRAND.community,
  },
  {
    id: "partner-2",
    category: "partner",
    title: "Open Partner Mini App",
    reward: 150,
    icon: "🚀",
    kind: "miniapp",
    url: BRAND.miniAppUrl,
  },
  {
    id: "community-invite-2",
    category: "community",
    title: "Invite 2 Friends Today",
    reward: 700,
    icon: "👥",
    kind: "link",
    url: BRAND.miniAppUrl,
  },
  {
    id: "community-ads-20",
    category: "community",
    title: "Watch 20 Ads Today",
    reward: 400,
    icon: "📺",
    kind: "link",
    url: BRAND.miniAppUrl,
  },
];

export const ALLOCATION = [
  { label: "Community", pct: 65 },
  { label: "Developer Team", pct: 20 },
  { label: "Other", pct: 15 },
];

export const ROADMAP = [
  { q: "2026 Q3", title: "Airdrop Launch", desc: "Mini app, tasks, referral & daily ads live." },
  { q: "2026 Q4", title: "Community Growth", desc: "Partner campaigns and USDT reward pool." },
  { q: "2027 Q1", title: "Token Generation", desc: "BEP-20 FOX contract audit & snapshot." },
  {
    q: "2027 Q2",
    title: "Token Exchange & Withdraw",
    desc: "FOX exchange to USDT and full token withdraw open.",
  },
];

export const NETWORK = "BEP-20 (BSC)";
