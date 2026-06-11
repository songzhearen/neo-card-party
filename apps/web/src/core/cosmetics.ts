import type { AppStateData } from "./state";

export type AccessoryColorId = "black" | "white" | "red" | "blue" | "green" | "yellow" | "pink" | "rainbow";
export type TitleColorId = AccessoryColorId | "gray" | "bronze" | "silver" | "rainbow";

export interface AccessoryColor {
  id: AccessoryColorId;
  nameZh: string;
  nameEn: string;
  hex: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  lootOnly?: boolean;
}

export interface AccessoryDefinition {
  id: string;
  shape: "crown" | "halo" | "visor" | "spark" | "cap";
  icon: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  basePrice: number;
}

export interface EquippedAccessory {
  id: string;
  color: AccessoryColorId;
}

export interface TitleDefinition {
  id: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  color: TitleColorId;
  minLevel?: number;
  minPoints?: number;
  dailyChampion?: boolean;
  ownedOnly?: boolean;
}

export interface ThrowableDefinition {
  id: string;
  icon: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  price: number;
}

export interface LootboxReward {
  type: "accessory" | "throwable" | "title";
  rarity: string;
  itemId: string;
  itemZh: { icon: string; name: string; color: string };
  itemEn: { icon: string; name: string; color: string };
  item: { icon: string; name: string; color: string };
  coins: number;
  pity: number;
  accessory?: EquippedAccessory;
  throwable?: { id: string; quantity: number };
  titleId?: string;
}

export type TitleCatalog = Record<string, TitleDefinition>;

export const LOOTBOX_PRICE = 160;
export const ROOT_COIN_BALANCE = Number.MAX_SAFE_INTEGER;
export const RAINBOW_PITY_LIMIT = 80;
export const RAINBOW_ACCESSORY_RATE = 0.008;
export const TOP_LUCK_TITLE_RATE = 0.001;
export const ACCESSORY_DROP_RATE = 0.12;
export const BILLIONAIRE_TITLE_ID = "billionaire";
export const TOP_LUCK_TITLE_ID = "top_luck";

export const ACCESSORY_COLORS: AccessoryColor[] = [
  { id: "black", nameZh: "墨黑", nameEn: "Ink", hex: "#1A1A1A", rarity: "common" },
  { id: "white", nameZh: "纸白", nameEn: "Paper", hex: "#FFFFFF", rarity: "common" },
  { id: "red", nameZh: "番茄红", nameEn: "Tomato", hex: "#FF2A5F", rarity: "rare" },
  { id: "blue", nameZh: "像素蓝", nameEn: "Pixel Blue", hex: "#0077FF", rarity: "rare" },
  { id: "green", nameZh: "跳过绿", nameEn: "Skip Green", hex: "#00C853", rarity: "rare" },
  { id: "yellow", nameZh: "奖杯黄", nameEn: "Trophy", hex: "#FFB300", rarity: "epic" },
  { id: "pink", nameZh: "霓虹粉", nameEn: "Neon Pink", hex: "#FF66E5", rarity: "legendary" },
  { id: "rainbow", nameZh: "炫彩", nameEn: "Chromatic", hex: "#FF66E5", rarity: "legendary", lootOnly: true },
];

export const ACCESSORIES: AccessoryDefinition[] = [
  {
    id: "crown",
    shape: "crown",
    icon: "♛",
    nameZh: "悬浮王冠",
    nameEn: "Floating Crown",
    descZh: "漂在头像上方的粗边像素王冠。",
    descEn: "A chunky crown floating above the avatar.",
    basePrice: 220,
  },
  {
    id: "halo",
    shape: "halo",
    icon: "◎",
    nameZh: "故障光环",
    nameEn: "Glitch Halo",
    descZh: "看起来像系统差点崩溃的光环。",
    descEn: "A halo that looks one frame away from crashing.",
    basePrice: 180,
  },
  {
    id: "visor",
    shape: "visor",
    icon: "▭",
    nameZh: "战术墨镜",
    nameEn: "Tactical Visor",
    descZh: "出牌之前先摆出很懂的表情。",
    descEn: "Look calculated before playing anything.",
    basePrice: 160,
  },
  {
    id: "spark",
    shape: "spark",
    icon: "✦",
    nameZh: "胜利闪片",
    nameEn: "Win Spark",
    descZh: "粘在头像边上的小小嚣张。",
    descEn: "A small loud sparkle on the avatar edge.",
    basePrice: 140,
  },
  {
    id: "cap",
    shape: "cap",
    icon: "▰",
    nameZh: "像素鸭舌帽",
    nameEn: "Pixel Cap",
    descZh: "低调，但边框很硬。",
    descEn: "Low-key, with very hard edges.",
    basePrice: 150,
  },
];

export const THROWABLES: ThrowableDefinition[] = [
  {
    id: "e1",
    icon: "\uD83C\uDF45",
    nameZh: "烂番茄",
    nameEn: "Rotten Tomato",
    descZh: "局内向对手扔出番茄。",
    descEn: "Throw a tomato at an opponent in-game.",
    price: 30,
  },
  {
    id: "e2",
    icon: "\u2615",
    nameZh: "热咖啡",
    nameEn: "Hot Coffee",
    descZh: "局内请对手喝一杯很烫的咖啡。",
    descEn: "Serve a suspiciously hot coffee in-game.",
    price: 40,
  },
  {
    id: "e3",
    icon: "\uD83D\uDCA9",
    nameZh: "粑粑",
    nameEn: "Poop",
    descZh: "局内投出一发非常直接的嘲讽。",
    descEn: "A very direct in-game taunt.",
    price: 60,
  },
  {
    id: "e4",
    icon: "\uD83C\uDF39",
    nameZh: "红玫瑰",
    nameEn: "Red Rose",
    descZh: "局内投出一朵边框很硬的玫瑰。",
    descEn: "Throw a hard-edged rose in-game.",
    price: 80,
  },
];

export const TITLES: TitleDefinition[] = [
  {
    id: "newbie",
    nameZh: "新手",
    nameEn: "Newbie",
    descZh: "默认称号。",
    descEn: "Default title.",
    color: "gray",
    minLevel: 1,
  },
  {
    id: "level_5",
    nameZh: "出牌学徒",
    nameEn: "Card Trainee",
    descZh: "等级达到 Lv.5 解锁。",
    descEn: "Unlocked at Lv.5.",
    color: "green",
    minLevel: 5,
  },
  {
    id: "level_10",
    nameZh: "像素牌手",
    nameEn: "Pixel Player",
    descZh: "等级达到 Lv.10 解锁。",
    descEn: "Unlocked at Lv.10.",
    color: "blue",
    minLevel: 10,
  },
  {
    id: "level_20",
    nameZh: "反转专家",
    nameEn: "Reverse Expert",
    descZh: "等级达到 Lv.20 解锁。",
    descEn: "Unlocked at Lv.20.",
    color: "yellow",
    minLevel: 20,
  },
  {
    id: "rank_bronze",
    nameZh: "青铜牌桌",
    nameEn: "Bronze Table",
    descZh: "排位积分达到 1000 解锁。",
    descEn: "Unlocked at 1000 ranked points.",
    color: "bronze",
    minPoints: 1000,
  },
  {
    id: "rank_silver",
    nameZh: "白银牌桌",
    nameEn: "Silver Table",
    descZh: "排位积分达到 2500 解锁。",
    descEn: "Unlocked at 2500 ranked points.",
    color: "silver",
    minPoints: 2500,
  },
  {
    id: "rank_gold",
    nameZh: "黄金牌桌",
    nameEn: "Gold Table",
    descZh: "排位积分达到 5000 解锁。",
    descEn: "Unlocked at 5000 ranked points.",
    color: "yellow",
    minPoints: 5000,
  },
  {
    id: "rank_master",
    nameZh: "大师牌桌",
    nameEn: "Master Table",
    descZh: "排位积分达到 9000 解锁。",
    descEn: "Unlocked at 9000 ranked points.",
    color: "red",
    minPoints: 9000,
  },
  {
    id: "daily_champion",
    nameZh: "今日榜一",
    nameEn: "Daily Champion",
    descZh: "每日排行榜结算第一名获得。",
    descEn: "Granted to the daily leaderboard winner.",
    color: "rainbow",
    dailyChampion: true,
  },
  {
    id: BILLIONAIRE_TITLE_ID,
    nameZh: "亿万富翁",
    nameEn: "Billionaire",
    descZh: "商城花费 10000 金币购买。",
    descEn: "Purchased from the shop for 10000 coins.",
    color: "rainbow",
    ownedOnly: true,
  },
  {
    id: TOP_LUCK_TITLE_ID,
    nameZh: "顶级欧皇",
    nameEn: "Peak Luck",
    descZh: "开箱 0.1% 概率获得，不设保底。",
    descEn: "0.1% lootbox drop. No pity.",
    color: "rainbow",
    ownedOnly: true,
  },
];

const titleColorHex: Record<TitleColorId, string> = {
  black: "#1A1A1A",
  white: "#FFFFFF",
  red: "#FF2A5F",
  blue: "#0077FF",
  green: "#00C853",
  yellow: "#FFB300",
  pink: "#FF66E5",
  gray: "#718096",
  bronze: "#B7791F",
  silver: "#A0AEC0",
  rainbow: "#FF66E5",
};

export function getAccessory(id: string): AccessoryDefinition {
  return ACCESSORIES.find((item) => item.id === id) || ACCESSORIES[0];
}

export function getAccessoryColor(id: string): AccessoryColor {
  return ACCESSORY_COLORS.find((color) => color.id === id) || ACCESSORY_COLORS[5];
}

function isTitleIdLike(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_-]{1,50}$/i.test(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getTitle(id: string, customTitles?: TitleCatalog): TitleDefinition {
  const normalizedId = String(id || "newbie");
  const custom = customTitles?.[normalizedId];
  if (custom) return custom;
  return TITLES.find((title) => title.id === normalizedId) || TITLES[0];
}

export function getTitleText(title: TitleDefinition, lang: "zh" | "en"): string {
  return lang === "zh" ? title.nameZh : title.nameEn;
}

export function getTitleColor(title: TitleDefinition): string {
  return titleColorHex[title.color];
}

export function getThrowable(id: string): ThrowableDefinition {
  return THROWABLES.find((item) => item.id === id) || THROWABLES[0];
}

export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isRootName(username?: string): boolean {
  return username?.trim().toLowerCase() === "root";
}

export function isRootAccount(state: Partial<Pick<AppStateData, "isRoot">>): boolean {
  return state.isRoot === true;
}

export function formatCoins(state: Pick<AppStateData, "coins" | "isRoot">): string {
  return state.isRoot ? "∞" : state.coins.toLocaleString();
}

export function getAllAccessoryInventory(): Record<string, AccessoryColorId[]> {
  const allColors = ACCESSORY_COLORS.map((color) => color.id);
  return Object.fromEntries(
    ACCESSORIES.map((accessory) => [accessory.id, [...allColors]])
  );
}

export function getAllThrowableInventory(quantity: number = 9999): Record<string, number> {
  return Object.fromEntries(THROWABLES.map((item) => [item.id, quantity]));
}

export function normalizeThrowableInventory(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!value || typeof value !== "object") return result;
  for (const [id, quantity] of Object.entries(value as Record<string, unknown>)) {
    if (!THROWABLES.some((item) => item.id === id)) continue;
    const count = Math.max(0, Math.floor(Number(quantity) || 0));
    if (count > 0) result[id] = count;
  }
  return result;
}

export function addThrowableToInventory(inventory: Record<string, number>, id: string, quantity: number = 1): Record<string, number> {
  const next = normalizeThrowableInventory(inventory);
  if (!THROWABLES.some((item) => item.id === id)) return next;
  next[id] = (next[id] || 0) + Math.max(1, Math.floor(quantity));
  return next;
}

export function consumeThrowable(inventory: Record<string, number>, id: string): Record<string, number> {
  const next = normalizeThrowableInventory(inventory);
  if (!next[id]) return next;
  next[id] -= 1;
  if (next[id] <= 0) delete next[id];
  return next;
}

export function normalizeOwnedTitleIds(value: unknown): string[] {
  const ids = Array.isArray(value) ? value : [];
  return Array.from(new Set(["newbie", ...ids.filter(isTitleIdLike)]));
}

export function addOwnedTitleId(value: unknown, titleId: string): string[] {
  return normalizeOwnedTitleIds([...(Array.isArray(value) ? value : []), titleId]);
}

export function normalizeAccessoryInventory(value: unknown): Record<string, AccessoryColorId[]> {
  const result: Record<string, AccessoryColorId[]> = { crown: ["yellow"] };
  if (!value || typeof value !== "object") return result;

  for (const [accessoryId, colors] of Object.entries(value as Record<string, unknown>)) {
    if (!ACCESSORIES.some((item) => item.id === accessoryId) || !Array.isArray(colors)) continue;
    const validColors = colors.filter((color): color is AccessoryColorId =>
      ACCESSORY_COLORS.some((entry) => entry.id === color)
    );
    if (validColors.length) result[accessoryId] = Array.from(new Set([...(result[accessoryId] || []), ...validColors]));
  }

  return result;
}

export function hasAccessory(inventory: Record<string, AccessoryColorId[]>, accessory: EquippedAccessory | null): boolean {
  if (!accessory) return true;
  return Boolean(inventory[accessory.id]?.includes(accessory.color));
}

export function addAccessoryToInventory(
  inventory: Record<string, AccessoryColorId[]>,
  accessoryId: string,
  colorId: AccessoryColorId
): Record<string, AccessoryColorId[]> {
  const next = normalizeAccessoryInventory(inventory);
  next[accessoryId] = Array.from(new Set([...(next[accessoryId] || []), colorId]));
  return next;
}

export function getUnlockedTitles(
  state: Pick<AppStateData, "level" | "points" | "dailyChampionDate"> & Partial<Pick<AppStateData, "isRoot" | "playerName" | "ownedTitleIds" | "customTitles">>
): TitleDefinition[] {
  const customTitles = Object.values(state.customTitles || {});
  if (isRootAccount(state)) return [...TITLES, ...customTitles.filter((title) => !TITLES.some((entry) => entry.id === title.id))];
  const today = todayKey();
  const owned = normalizeOwnedTitleIds(state.ownedTitleIds);
  const staticTitles = TITLES.filter((title) => {
    if (owned.includes(title.id)) return true;
    if (title.ownedOnly) return false;
    if (title.dailyChampion) return state.dailyChampionDate === today;
    if (title.minLevel && state.level < title.minLevel) return false;
    if (title.minPoints && state.points < title.minPoints) return false;
    return true;
  });
  const ownedCustomTitles = customTitles.filter((title) => owned.includes(title.id) && !staticTitles.some((entry) => entry.id === title.id));
  return [...staticTitles, ...ownedCustomTitles];
}

export function isTitleUnlocked(
  state: Pick<AppStateData, "level" | "points" | "dailyChampionDate"> & Partial<Pick<AppStateData, "isRoot" | "playerName" | "ownedTitleIds" | "customTitles">>,
  titleId: string
): boolean {
  return getUnlockedTitles(state).some((title) => title.id === titleId);
}

export function normalizeEquippedTitle(
  state: Pick<AppStateData, "level" | "points" | "dailyChampionDate" | "equippedTitleId"> & Partial<Pick<AppStateData, "isRoot" | "playerName" | "ownedTitleIds" | "customTitles">>
): string {
  return isTitleUnlocked(state, state.equippedTitleId) ? state.equippedTitleId : "newbie";
}

export function accessoryItemId(accessoryId: string, colorId: AccessoryColorId): string {
  return `acc_${accessoryId}_${colorId}`;
}

export function parseAccessoryItemId(itemId: string): EquippedAccessory | null {
  const match = itemId.match(/^acc_([a-z0-9-]+)_([a-z]+)$/i);
  if (!match) return null;
  const id = match[1];
  const color = match[2] as AccessoryColorId;
  if (!ACCESSORIES.some((item) => item.id === id)) return null;
  if (!ACCESSORY_COLORS.some((entry) => entry.id === color)) return null;
  return { id, color };
}

export function parseThrowableItemId(itemId: string): string | null {
  return THROWABLES.some((item) => item.id === itemId) ? itemId : null;
}

export function titleItemId(titleId: string): string {
  return `title_${titleId}`;
}

export function parseTitleItemId(itemId: string): string | null {
  const match = itemId.match(/^title_([a-z0-9_-]+)$/i);
  return match ? match[1] : null;
}

export function getAccessoryShopItems(): Array<{
  id: string;
  type: "accessory";
  icon: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  price: number;
  stock: number;
}> {
  const sellableColors = ACCESSORY_COLORS.filter((color) => !color.lootOnly);
  return ACCESSORIES.flatMap((accessory) =>
    sellableColors.map((color) => ({
      id: accessoryItemId(accessory.id, color.id),
      type: "accessory" as const,
      icon: accessory.icon,
      nameZh: `${accessory.nameZh} · ${color.nameZh}`,
      nameEn: `${accessory.nameEn} · ${color.nameEn}`,
      descZh: `${accessory.descZh}${color.rarity === "epic" ? " 高级染色。" : ""}`,
      descEn: `${accessory.descEn}${color.rarity === "epic" ? " Premium dye." : ""}`,
      price: accessory.basePrice + (color.rarity === "epic" ? 120 : color.rarity === "rare" ? 60 : 0),
      stock: -1,
    }))
  );
}

export function getThrowableShopItems(): Array<{
  id: string;
  type: "emoji";
  icon: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  price: number;
  stock: number;
  isConsumable: boolean;
}> {
  return THROWABLES.map((item) => ({
    id: item.id,
    type: "emoji" as const,
    icon: item.icon,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    descZh: item.descZh,
    descEn: item.descEn,
    price: item.price,
    stock: -1,
    isConsumable: true,
  }));
}

export function getTitleShopItems(): Array<{
  id: string;
  type: "title";
  icon: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  price: number;
  stock: number;
}> {
  const title = getTitle(BILLIONAIRE_TITLE_ID);
  return [{
    id: titleItemId(title.id),
    type: "title" as const,
    icon: "\uD83D\uDC8E",
    nameZh: title.nameZh,
    nameEn: title.nameEn,
    descZh: title.descZh,
    descEn: title.descEn,
    price: 10000,
    stock: -1,
  }];
}

export function getEconomyShopItems() {
  return [
    ...getAccessoryShopItems(),
    ...getThrowableShopItems(),
    ...getTitleShopItems(),
  ];
}

function accessoryReward(color: AccessoryColor, rarity: string, pity: number): LootboxReward {
  const accessory = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
  const equipped = { id: accessory.id, color: color.id };
  const itemZh = { icon: accessory.icon, name: `${accessory.nameZh} · ${color.nameZh}`, color: color.hex };
  const itemEn = { icon: accessory.icon, name: `${accessory.nameEn} · ${color.nameEn}`, color: color.hex };

  return {
    type: "accessory",
    rarity,
    itemId: accessoryItemId(accessory.id, color.id),
    accessory: equipped,
    itemZh,
    itemEn,
    item: itemZh,
    coins: 0,
    pity,
  };
}

function regularAccessoryReward(pity: number): LootboxReward {
  const roll = Math.random();
  const rarity = roll < 0.5 ? "common" : roll < 0.78 ? "rare" : roll < 0.95 ? "epic" : "legendary";
  const colors = ACCESSORY_COLORS.filter((color) => color.rarity === rarity && !color.lootOnly);
  const color = colors[Math.floor(Math.random() * colors.length)] || ACCESSORY_COLORS[0];
  return accessoryReward(color, rarity, pity);
}

function throwableReward(pity: number): LootboxReward {
  const throwable = THROWABLES[Math.floor(Math.random() * THROWABLES.length)] || THROWABLES[0];
  const itemZh = { icon: throwable.icon, name: `${throwable.nameZh} x1`, color: "#0077FF" };
  const itemEn = { icon: throwable.icon, name: `${throwable.nameEn} x1`, color: "#0077FF" };
  return {
    type: "throwable",
    rarity: "throwable",
    itemId: throwable.id,
    throwable: { id: throwable.id, quantity: 1 },
    itemZh,
    itemEn,
    item: itemZh,
    coins: 0,
    pity,
  };
}

function titleReward(pity: number): LootboxReward {
  const title = getTitle(TOP_LUCK_TITLE_ID);
  const itemZh = { icon: "\uD83C\uDF08", name: title.nameZh, color: "#FF66E5" };
  const itemEn = { icon: "\uD83C\uDF08", name: title.nameEn, color: "#FF66E5" };
  return {
    type: "title",
    rarity: "mythic",
    itemId: titleItemId(title.id),
    titleId: title.id,
    itemZh,
    itemEn,
    item: itemZh,
    coins: 0,
    pity,
  };
}

export function openLootboxReward(currentPity: number = 0, forceAccessory: boolean = false): LootboxReward {
  const nextPity = Math.min(RAINBOW_PITY_LIMIT, Math.max(0, currentPity) + 1);

  if (nextPity >= RAINBOW_PITY_LIMIT || Math.random() < RAINBOW_ACCESSORY_RATE) {
    return accessoryReward(getAccessoryColor("rainbow"), "chromatic", 0);
  }

  if (!forceAccessory && Math.random() < TOP_LUCK_TITLE_RATE) return titleReward(nextPity);
  if (forceAccessory || Math.random() < ACCESSORY_DROP_RATE) return regularAccessoryReward(nextPity);
  return throwableReward(nextPity);
}

export function openLootboxRewards(count: number, currentPity: number = 0, guaranteeAccessory: boolean = false): LootboxReward[] {
  const results: LootboxReward[] = [];
  let pity = Math.max(0, currentPity);

  for (let i = 0; i < count; i++) {
    const reward = openLootboxReward(pity);
    pity = reward.pity;
    results.push(reward);
  }

  if (guaranteeAccessory && !results.some((reward) => reward.type === "accessory")) {
    const firstThrowable = results.findIndex((reward) => reward.type === "throwable");
    const index = firstThrowable >= 0 ? firstThrowable : Math.max(0, results.length - 1);
    results[index] = regularAccessoryReward(pity);
  }

  return results;
}

export function openAccessoryBox(): { rarity: string; accessory: EquippedAccessory; itemZh: any; itemEn: any; item: any; coins: number } {
  const reward = regularAccessoryReward(0);
  return {
    rarity: reward.rarity,
    accessory: reward.accessory!,
    itemZh: reward.itemZh,
    itemEn: reward.itemEn,
    item: reward.item,
    coins: 0,
  };
}

export function renderAccessory(equipped: EquippedAccessory | null, size: number = 120): string {
  if (!equipped) return "";
  const accessory = getAccessory(equipped.id);
  const color = getAccessoryColor(equipped.color);
  const scale = size / 120;
  const cssColor = color.hex;
  const rainbow = color.id === "rainbow";

  return `<div class="avatar-accessory avatar-accessory-${accessory.shape} ${rainbow ? "avatar-accessory-rainbow" : ""}" style="--acc:${cssColor};--acc-scale:${scale};" aria-hidden="true"></div>`;
}

export function renderTitleBadge(titleId: string, lang: "zh" | "en", compact: boolean = false, customTitles?: TitleCatalog, fallbackText?: string): string {
  const title = getTitle(titleId, customTitles);
  const useFallback = title.id !== titleId && Boolean(fallbackText);
  const text = useFallback ? String(fallbackText) : getTitleText(title, lang);
  const rainbow = title.color === "rainbow" || useFallback;
  const color = useFallback ? titleColorHex.rainbow : getTitleColor(title);
  return `<span class="title-badge ${rainbow ? "title-badge-rainbow" : ""}" style="--title-color:${color};${compact ? "font-size:8px;padding:2px 5px;" : ""}">${escapeHtml(text)}</span>`;
}
