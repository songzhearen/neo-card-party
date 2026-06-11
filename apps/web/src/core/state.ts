/**
 * 全局响应式状态管理 (Proxy 实现)
 * 变更时自动触发 state-changed 自定义事件
 */

import { DEFAULT_AVATAR_CODE, normalizeAvatarCode } from "./avatar";
import {
  AccessoryColorId,
  EquippedAccessory,
  TitleDefinition,
  ROOT_COIN_BALANCE,
  getAllAccessoryInventory,
  getAllThrowableInventory,
  hasAccessory,
  isRootAccount,
  normalizeAccessoryInventory,
  normalizeEquippedTitle,
  normalizeOwnedTitleIds,
  normalizeThrowableInventory,
} from "./cosmetics";

export interface AppSettings {
  bgmVolume: number;    // 0-100
  sfxVolume: number;    // 0-100
  language: "zh" | "en";
  fullscreen: boolean;
}

export interface AppStateData {
  accountName: string;
  playerName: string;
  playerId: string;
  avatar: string;       // 头像序列化码 (64位)
  avatarEmoji: string;  // 头像 Emoji
  coins: number;
  isRoot: boolean;
  level: number;
  wins: number;
  totalGames: number;
  points: number;       // 排行榜积分
  titleZh: string;
  titleEn: string;
  accessoryInventory: Record<string, AccessoryColorId[]>;
  throwableInventory: Record<string, number>;
  ownedTitleIds: string[];
  customTitles: Record<string, TitleDefinition>;
  equippedAccessory: EquippedAccessory | null;
  equippedTitleId: string;
  dailyChampionDate: string;
  rainbowPity: number;
  authToken: string;    // 服务端认证令牌
  settings: AppSettings;
  sessionId: string | null;
}

const defaultSettings: AppSettings = {
  bgmVolume: 80,
  sfxVolume: 100,
  language: "zh",
  fullscreen: false,
};

const initialState: AppStateData = {
  accountName: "",
  playerName: "PLAYER_1",
  playerId: "",
  avatar: DEFAULT_AVATAR_CODE,
  avatarEmoji: "",
  coins: 1250,
  isRoot: false,
  level: 1,
  wins: 0,
  totalGames: 0,
  points: 0,
  titleZh: "新手",
  titleEn: "Newbie",
  accessoryInventory: { crown: ["yellow"] },
  throwableInventory: {},
  ownedTitleIds: ["newbie"],
  customTitles: {},
  equippedAccessory: { id: "crown", color: "yellow" },
  equippedTitleId: "newbie",
  dailyChampionDate: "",
  rainbowPity: 0,
  authToken: "",
  settings: { ...defaultSettings },
  sessionId: null,
};

type StateListener = (state: AppStateData) => void;

class StateManager {
  private data: AppStateData;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.data = { ...initialState };

    // 从 localStorage 恢复
    const saved = localStorage.getItem("uno_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.data = { ...initialState, ...parsed, settings: { ...defaultSettings, ...parsed.settings } };
      } catch { /* ignore */ }
    }
    this.data.avatar = normalizeAvatarCode(this.data.avatar);
    this.normalizeCosmeticState();

    // 创建响应式代理
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop === "data") return this.data;
        if (prop === "onChange") return this.onChange.bind(this);
        if (prop === "update") return this.update.bind(this);
        if (prop === "reset") return this.reset.bind(this);
        return (this.data as any)[prop];
      },
      set: (target, prop, value) => {
        (this.data as any)[prop] = prop === "avatar" ? normalizeAvatarCode(value) : value;
        this.normalizeCosmeticState();
        this.notify();
        this.save();
        return true;
      },
    }) as any;
  }

  /** 批量更新 */
  update(partial: Partial<AppStateData>): void {
    const next = { ...partial };
    if ("avatar" in next) next.avatar = normalizeAvatarCode(next.avatar);
    Object.assign(this.data, next);
    this.normalizeCosmeticState();
    this.notify();
    this.save();
  }

  /** 重置为初始状态 */
  reset(): void {
    this.data = { ...initialState };
    this.normalizeCosmeticState();
    this.notify();
    this.save();
  }

  /** 注册变更监听 */
  onChange(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 通知所有监听器 */
  private notify(): void {
    for (const fn of this.listeners) {
      fn(this.data);
    }
  }

  /** 持久化到 localStorage */
  private normalizeCosmeticState(): void {
    this.data.isRoot = isRootAccount(this.data);
    if (this.data.isRoot) {
      this.data.coins = ROOT_COIN_BALANCE;
      this.data.accessoryInventory = getAllAccessoryInventory();
      this.data.throwableInventory = getAllThrowableInventory();
      this.data.ownedTitleIds = normalizeOwnedTitleIds(["newbie", "daily_champion", "billionaire", "top_luck"]);
      this.data.customTitles = {};
      this.data.rainbowPity = 0;
    } else {
      this.data.accessoryInventory = normalizeAccessoryInventory(this.data.accessoryInventory);
      this.data.throwableInventory = normalizeThrowableInventory(this.data.throwableInventory);
      this.data.ownedTitleIds = normalizeOwnedTitleIds(this.data.ownedTitleIds);
      this.data.customTitles = this.data.customTitles && typeof this.data.customTitles === "object" ? this.data.customTitles : {};
      this.data.rainbowPity = Math.max(0, Math.floor(Number(this.data.rainbowPity) || 0));
    }
    if (!hasAccessory(this.data.accessoryInventory, this.data.equippedAccessory)) {
      this.data.equippedAccessory = { id: "crown", color: "yellow" };
    }
    this.data.equippedTitleId = normalizeEquippedTitle(this.data);
  }

  private save(): void {
    try {
      localStorage.setItem("uno_state", JSON.stringify(this.data));
    } catch { /* ignore */ }
  }
}

/** 全局状态单例 */
export const state = new StateManager() as unknown as StateManager & AppStateData;
