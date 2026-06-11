export type AccessoryColorId = "black" | "white" | "red" | "blue" | "green" | "yellow" | "pink" | "rainbow";

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
  icon: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  basePrice: number;
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

export type TitleColorId = AccessoryColorId | "gray" | "bronze" | "silver";

export interface TitleDefinition {
  id: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  minLevel?: number;
  minPoints?: number;
  dailyChampion?: boolean;
  ownedOnly?: boolean;
}

export interface LootboxReward {
  type: "accessory" | "throwable" | "title";
  rarity: string;
  itemId: string;
  itemZh: { icon: string; name: string; color: string };
  itemEn: { icon: string; name: string; color: string };
  accessory?: { id: string; color: AccessoryColorId };
  throwable?: { id: string; quantity: number };
  titleId?: string;
  pity: number;
}

export const LOOTBOX_PRICE = 160;
export const RAINBOW_PITY_LIMIT = 80;
export const RAINBOW_ACCESSORY_RATE = 0.008;
export const TOP_LUCK_TITLE_RATE = 0.001;
export const ACCESSORY_DROP_RATE = 0.12;
export const BILLIONAIRE_TITLE_ID = "billionaire";
export const TOP_LUCK_TITLE_ID = "top_luck";

export const TITLES: TitleDefinition[] = [
  {
    id: "newbie",
    nameZh: "\u65b0\u624b",
    nameEn: "Newbie",
    descZh: "\u9ed8\u8ba4\u79f0\u53f7",
    descEn: "Default title.",
    minLevel: 1,
  },
  {
    id: "level_5",
    nameZh: "\u51fa\u724c\u5b66\u5f92",
    nameEn: "Card Trainee",
    descZh: "\u7b49\u7ea7\u8fbe\u5230 Lv.5 \u89e3\u9501",
    descEn: "Unlocked at Lv.5.",
    minLevel: 5,
  },
  {
    id: "level_10",
    nameZh: "\u50cf\u7d20\u724c\u624b",
    nameEn: "Pixel Player",
    descZh: "\u7b49\u7ea7\u8fbe\u5230 Lv.10 \u89e3\u9501",
    descEn: "Unlocked at Lv.10.",
    minLevel: 10,
  },
  {
    id: "level_20",
    nameZh: "\u53cd\u8f6c\u4e13\u5bb6",
    nameEn: "Reverse Expert",
    descZh: "\u7b49\u7ea7\u8fbe\u5230 Lv.20 \u89e3\u9501",
    descEn: "Unlocked at Lv.20.",
    minLevel: 20,
  },
  {
    id: "rank_bronze",
    nameZh: "\u9752\u94dc\u724c\u684c",
    nameEn: "Bronze Table",
    descZh: "\u79ef\u5206\u8fbe\u5230 1000 \u89e3\u9501",
    descEn: "Unlocked at 1000 points.",
    minPoints: 1000,
  },
  {
    id: "rank_silver",
    nameZh: "\u767d\u94f6\u724c\u684c",
    nameEn: "Silver Table",
    descZh: "\u79ef\u5206\u8fbe\u5230 2500 \u89e3\u9501",
    descEn: "Unlocked at 2500 points.",
    minPoints: 2500,
  },
  {
    id: "rank_gold",
    nameZh: "\u9ec4\u91d1\u724c\u684c",
    nameEn: "Gold Table",
    descZh: "\u79ef\u5206\u8fbe\u5230 5000 \u89e3\u9501",
    descEn: "Unlocked at 5000 points.",
    minPoints: 5000,
  },
  {
    id: "rank_master",
    nameZh: "\u5927\u5e08\u724c\u684c",
    nameEn: "Master Table",
    descZh: "\u79ef\u5206\u8fbe\u5230 9000 \u89e3\u9501",
    descEn: "Unlocked at 9000 points.",
    minPoints: 9000,
  },
  {
    id: "daily_champion",
    nameZh: "\u4eca\u65e5\u699c\u4e00",
    nameEn: "Daily Champion",
    descZh: "\u6bcf\u65e5\u6392\u884c\u699c\u7ed3\u7b97\u7b2c\u4e00\u540d\u83b7\u5f97",
    descEn: "Granted to the daily leaderboard winner.",
    dailyChampion: true,
  },
  {
    id: BILLIONAIRE_TITLE_ID,
    nameZh: "\u4ebf\u4e07\u5bcc\u7fc1",
    nameEn: "Billionaire",
    descZh: "\u5546\u57ce\u82b1\u8d39 10000 \u91d1\u5e01\u8d2d\u4e70",
    descEn: "Purchased from the shop for 10000 coins.",
    ownedOnly: true,
  },
  {
    id: TOP_LUCK_TITLE_ID,
    nameZh: "\u9876\u7ea7\u6b27\u7687",
    nameEn: "Peak Luck",
    descZh: "\u5f00\u7bb1 0.1% \u6982\u7387\u83b7\u5f97",
    descEn: "0.1% lootbox drop.",
    ownedOnly: true,
  },
];

export const ACCESSORY_COLORS: AccessoryColor[] = [
  { id: "black", nameZh: "\u58a8\u9ed1", nameEn: "Ink", hex: "#1A1A1A", rarity: "common" },
  { id: "white", nameZh: "\u7eb8\u767d", nameEn: "Paper", hex: "#FFFFFF", rarity: "common" },
  { id: "red", nameZh: "\u756a\u8304\u7ea2", nameEn: "Tomato", hex: "#FF2A5F", rarity: "rare" },
  { id: "blue", nameZh: "\u50cf\u7d20\u84dd", nameEn: "Pixel Blue", hex: "#0077FF", rarity: "rare" },
  { id: "green", nameZh: "\u8df3\u8fc7\u7eff", nameEn: "Skip Green", hex: "#00C853", rarity: "rare" },
  { id: "yellow", nameZh: "\u5956\u676f\u9ec4", nameEn: "Trophy", hex: "#FFB300", rarity: "epic" },
  { id: "pink", nameZh: "\u9713\u8679\u7c89", nameEn: "Neon Pink", hex: "#FF66E5", rarity: "legendary" },
  { id: "rainbow", nameZh: "\u70ab\u5f69", nameEn: "Chromatic", hex: "#FF66E5", rarity: "legendary", lootOnly: true },
];

export const ACCESSORIES: AccessoryDefinition[] = [
  { id: "crown", icon: "\u265b", nameZh: "\u60ac\u6d6e\u738b\u51a0", nameEn: "Floating Crown", descZh: "\u6f02\u5728\u5934\u50cf\u4e0a\u65b9\u7684\u7c97\u8fb9\u50cf\u7d20\u738b\u51a0", descEn: "A chunky crown floating above the avatar.", basePrice: 220 },
  { id: "halo", icon: "\u25ce", nameZh: "\u6545\u969c\u5149\u73af", nameEn: "Glitch Halo", descZh: "\u770b\u8d77\u6765\u50cf\u7cfb\u7edf\u5dee\u70b9\u5d29\u6e83\u7684\u5149\u73af", descEn: "A halo that looks one frame away from crashing.", basePrice: 180 },
  { id: "visor", icon: "\u25ad", nameZh: "\u6218\u672f\u58a8\u955c", nameEn: "Tactical Visor", descZh: "\u51fa\u724c\u4e4b\u524d\u5148\u6446\u51fa\u5f88\u61c2\u7684\u8868\u60c5", descEn: "Look calculated before playing anything.", basePrice: 160 },
  { id: "spark", icon: "\u2726", nameZh: "\u80dc\u5229\u95ea\u7247", nameEn: "Win Spark", descZh: "\u7c98\u5728\u5934\u50cf\u8fb9\u4e0a\u7684\u5c0f\u5c0f\u56a3\u5f20", descEn: "A small loud sparkle on the avatar edge.", basePrice: 140 },
  { id: "cap", icon: "\u25b0", nameZh: "\u50cf\u7d20\u9e2d\u820c\u5e3d", nameEn: "Pixel Cap", descZh: "\u4f4e\u8c03\u4f46\u8fb9\u6846\u5f88\u786c", descEn: "Low-key, with very hard edges.", basePrice: 150 },
];

export const THROWABLES: ThrowableDefinition[] = [
  { id: "e1", icon: "\uD83C\uDF45", nameZh: "\u70c2\u756a\u8304", nameEn: "Rotten Tomato", descZh: "\u5c40\u5185\u5411\u5bf9\u624b\u6254\u51fa\u756a\u8304", descEn: "Throw a tomato at an opponent in-game.", price: 30 },
  { id: "e2", icon: "\u2615", nameZh: "\u70ed\u5496\u5561", nameEn: "Hot Coffee", descZh: "\u5c40\u5185\u8bf7\u5bf9\u624b\u559d\u4e00\u676f\u5f88\u70eb\u7684\u5496\u5561", descEn: "Serve a suspiciously hot coffee in-game.", price: 40 },
  { id: "e3", icon: "\uD83D\uDCA9", nameZh: "\u7c91\u7c91", nameEn: "Poop", descZh: "\u5c40\u5185\u6295\u51fa\u4e00\u53d1\u975e\u5e38\u76f4\u63a5\u7684\u5632\u8bbd", descEn: "A very direct in-game taunt.", price: 60 },
  { id: "e4", icon: "\uD83C\uDF39", nameZh: "\u7ea2\u73ab\u7470", nameEn: "Red Rose", descZh: "\u5c40\u5185\u6295\u51fa\u4e00\u6735\u8fb9\u6846\u5f88\u786c\u7684\u73ab\u7470", descEn: "Throw a hard-edged rose in-game.", price: 80 },
];

export function accessoryItemId(accessoryId: string, colorId: AccessoryColorId): string {
  return `acc_${accessoryId}_${colorId}`;
}

export function titleItemId(titleId: string): string {
  return `title_${titleId}`;
}

export function parseTitleItemId(itemId: string): string | null {
  const match = String(itemId || "").match(/^title_([a-z0-9_-]+)$/i);
  if (!match) return null;
  return match[1];
}

export function getTitle(titleId: string): TitleDefinition {
  return TITLES.find((title) => title.id === titleId) || TITLES[0];
}

export function isProgressionTitleUnlocked(
  title: TitleDefinition,
  user: { level?: number; points?: number }
): boolean {
  if (title.ownedOnly || title.dailyChampion) return false;
  if (title.minLevel && Number(user.level || 0) < title.minLevel) return false;
  if (title.minPoints && Number(user.points || 0) < title.minPoints) return false;
  return true;
}

function buildAccessoryItems(includeLootOnly: boolean) {
  const sellableColors = ACCESSORY_COLORS.filter((color) => includeLootOnly || !color.lootOnly);
  return ACCESSORIES.flatMap((accessory) =>
    sellableColors.map((color) => ({
      id: accessoryItemId(accessory.id, color.id),
      type: "accessory",
      icon: accessory.icon,
      nameZh: `${accessory.nameZh} · ${color.nameZh}`,
      nameEn: `${accessory.nameEn} · ${color.nameEn}`,
      descZh: accessory.descZh,
      descEn: accessory.descEn,
      price: accessory.basePrice + (color.rarity === "legendary" ? 240 : color.rarity === "epic" ? 120 : color.rarity === "rare" ? 60 : 0),
      stock: color.lootOnly ? 0 : -1,
    }))
  );
}

export function getAccessoryShopItems() {
  return buildAccessoryItems(false);
}

export function getAllAccessoryItems() {
  return buildAccessoryItems(true);
}

export function getThrowableShopItems() {
  return THROWABLES.map((item) => ({
    id: item.id,
    type: "emoji",
    icon: item.icon,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    descZh: item.descZh,
    descEn: item.descEn,
    price: item.price,
    stock: -1,
  }));
}

export function getTitleShopItems() {
  return [{
    id: titleItemId(BILLIONAIRE_TITLE_ID),
    type: "title",
    icon: "\uD83D\uDC8E",
    nameZh: "\u4ebf\u4e07\u5bcc\u7fc1",
    nameEn: "Billionaire",
    descZh: "\u5546\u57ce\u82b1\u8d39 10000 \u91d1\u5e01\u8d2d\u4e70",
    descEn: "Purchased from the shop for 10000 coins.",
    price: 10000,
    stock: -1,
  }];
}

export function getEconomyShopItems() {
  return [...getAccessoryShopItems(), ...getThrowableShopItems(), ...getTitleShopItems()];
}

function accessoryReward(color: AccessoryColor, rarity: string, pity: number): LootboxReward {
  const accessory = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
  return {
    type: "accessory",
    rarity,
    itemId: accessoryItemId(accessory.id, color.id),
    accessory: { id: accessory.id, color: color.id },
    itemZh: { icon: accessory.icon, name: `${accessory.nameZh} · ${color.nameZh}`, color: color.hex },
    itemEn: { icon: accessory.icon, name: `${accessory.nameEn} · ${color.nameEn}`, color: color.hex },
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
  const item = THROWABLES[Math.floor(Math.random() * THROWABLES.length)] || THROWABLES[0];
  return {
    type: "throwable",
    rarity: "throwable",
    itemId: item.id,
    throwable: { id: item.id, quantity: 1 },
    itemZh: { icon: item.icon, name: `${item.nameZh} x1`, color: "#0077FF" },
    itemEn: { icon: item.icon, name: `${item.nameEn} x1`, color: "#0077FF" },
    pity,
  };
}

function titleReward(pity: number): LootboxReward {
  return {
    type: "title",
    rarity: "mythic",
    itemId: titleItemId(TOP_LUCK_TITLE_ID),
    titleId: TOP_LUCK_TITLE_ID,
    itemZh: { icon: "\uD83C\uDF08", name: "\u9876\u7ea7\u6b27\u7687", color: "#FF66E5" },
    itemEn: { icon: "\uD83C\uDF08", name: "Peak Luck", color: "#FF66E5" },
    pity,
  };
}

export function openLootboxReward(currentPity: number = 0, forceAccessory: boolean = false): LootboxReward {
  const nextPity = Math.min(RAINBOW_PITY_LIMIT, Math.max(0, currentPity) + 1);
  const rainbow = ACCESSORY_COLORS.find((color) => color.id === "rainbow") || ACCESSORY_COLORS[0];
  if (nextPity >= RAINBOW_PITY_LIMIT || Math.random() < RAINBOW_ACCESSORY_RATE) return accessoryReward(rainbow, "chromatic", 0);
  if (!forceAccessory && Math.random() < TOP_LUCK_TITLE_RATE) return titleReward(nextPity);
  if (forceAccessory || Math.random() < ACCESSORY_DROP_RATE) return regularAccessoryReward(nextPity);
  return throwableReward(nextPity);
}

export function openLootboxRewards(count: number, currentPity: number = 0, guaranteeAccessory: boolean = false): LootboxReward[] {
  const rewards: LootboxReward[] = [];
  let pity = Math.max(0, currentPity);
  for (let i = 0; i < count; i++) {
    const reward = openLootboxReward(pity);
    pity = reward.pity;
    rewards.push(reward);
  }
  if (guaranteeAccessory && !rewards.some((reward) => reward.type === "accessory")) {
    const firstThrowable = rewards.findIndex((reward) => reward.type === "throwable");
    const index = firstThrowable >= 0 ? firstThrowable : Math.max(0, rewards.length - 1);
    rewards[index] = regularAccessoryReward(pity);
  }
  return rewards;
}

export function openAccessoryBox() {
  return regularAccessoryReward(0);
}
