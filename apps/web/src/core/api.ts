/**
 * 后端 API 封装 — REST + Colyseus 客户端
 * 优先连接真实服务器，不可用时自动降级为 mock 数据（仅离线模式）
 */

import { state, AppStateData } from "./state";
import { normalizeAvatarCode, randomAvatarCode } from "./avatar";
import type { JoinRoomOptions, JoinRoomPayload } from "@card-party/shared";
import {
  addAccessoryToInventory,
  addOwnedTitleId,
  addThrowableToInventory,
  getAllAccessoryInventory,
  getTitle,
  getEconomyShopItems,
  isRootAccount,
  isRootName,
  LOOTBOX_PRICE,
  openLootboxReward,
  openLootboxRewards,
  parseAccessoryItemId,
  parseThrowableItemId,
  parseTitleItemId,
  ROOT_COIN_BALANCE,
  TitleDefinition,
  todayKey,
} from "./cosmetics";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const SERVER_URL = normalizeBaseUrl(import.meta.env.VITE_WS_URL || "ws://localhost:2567");
const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_BASE || "http://localhost:2567/api");
const ROOM_CONNECTION_KEY = "uno_room_connection";
const HEALTH_TIMEOUT_MS = 4000;

let serverAvailable = false;
let colyseusClient: any = null;
let activeRoom: any = null;
let initPromise: Promise<boolean> | null = null;
let reconnectionTimers: Map<string, number> = new Map();
let presenceHeartbeatTimer: number | null = null;
let presenceHeartbeatInFlight = false;

const PRESENCE_HEARTBEAT_MS = 30_000;

interface SavedRoomConnection {
  roomId: string;
  sessionId: string;
}

interface LootboxResponse {
  success?: boolean;
  coins?: number;
  error?: string;
  type?: "accessory" | "throwable" | "title";
  itemId?: string;
  pity?: number;
  rarity: string;
  item: { icon: string; name: string; color: string };
  itemZh?: any;
  itemEn?: any;
  accessory?: { id: string; color: any };
  throwable?: { id: string; quantity: number };
  titleId?: string;
}

interface RedeemCodeResponse {
  success: boolean;
  coins?: number;
  reward?: {
    coins: number;
    itemId: string | null;
    quantity: number;
  };
  message?: string;
  error?: string;
}

export interface RestDiagnosticResult {
  apiBase: string;
  userAgent: string;
  online: boolean;
  health: string;
  healthNoCors: string;
  leaderboard: string;
}

export interface FriendEntry {
  friendshipId: number;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing" | "friend";
  userId: number;
  account: string;
  nickname: string;
  avatar: string;
  titleZh: string;
  titleEn: string;
  online: boolean;
  onlineStatus: "offline" | "lobby" | "room" | "reconnecting";
  roomId: string | null;
  roomName: string | null;
  connected: boolean;
  lastActiveAt: number | null;
}

interface GachaResponse {
  success?: boolean;
  coins?: number;
  pity?: number;
  rewards?: LootboxResponse[];
  error?: string;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function isLocalApiBase(): boolean {
  try {
    const url = new URL(API_BASE, window.location.origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function canUseMockFallback(): boolean {
  return Boolean(import.meta.env.DEV) || window.location.protocol === "file:" || isLocalApiBase();
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = HEALTH_TIMEOUT_MS): Promise<Response> {
  if (typeof AbortController === "undefined") return fetch(input, init);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: init.signal || controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function probe(path: string, init: RequestInit = {}): Promise<string> {
  try {
    const res = await fetchWithTimeout(API_BASE + path, init, HEALTH_TIMEOUT_MS);
    return `${res.status} ${res.type || "basic"}`;
  } catch (err: any) {
    return err?.name || err?.message || "fetch-error";
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = state.authToken as string;
  if (token) {
    return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  }
  return { "Content-Type": "application/json" };
}

function getJsonHeaders(auth: boolean): Record<string, string> | undefined {
  if (auth) return getAuthHeaders();
  return undefined;
}

function getPostHeaders(auth: boolean): Record<string, string> {
  if (auth) return getAuthHeaders();
  return { "Content-Type": "text/plain;charset=UTF-8" };
}

// ---- Mock 数据（仅离线模式使用）----

const MOCK_LEADERBOARD = [
  { rank: 1, name: "CardMaster_99", titleZh: "\u724C\u684C\u7687\u5E1D", titleEn: "Card Table Emperor", avatarColor: "#FFD54F", points: 9800, winRate: "78%" },
  { rank: 2, name: "PixelMaster", titleZh: "\u50CF\u7D20\u5927\u5E08", titleEn: "Pixel Master", avatarColor: "#4FC3F7", points: 8500, winRate: "72%" },
  { rank: 3, name: "LuckyDraw", titleZh: "\u795E\u62BD\u72D7", titleEn: "Lucky Dog", avatarColor: "#81C784", points: 7200, winRate: "68%" },
  { rank: 4, name: "PLAYER_1", titleZh: "\u65B0\u624B", titleEn: "Newbie", avatarColor: "#E57373", points: 5200, winRate: "55%" },
  { rank: 5, name: "NoobKiller", titleZh: "\u83DC\u9E1F\u6740\u624B", titleEn: "Noob Killer", avatarColor: "#9B59B6", points: 4100, winRate: "48%" },
];

const MOCK_SHOP_ITEMS = [
  ...getEconomyShopItems(),
];

function getLang(): "zh" | "en" {
  return state.settings.language || "zh";
}

function localize(item: any): any {
  const lang = getLang();
  const titleZh = item.titleZh ?? item.title_zh;
  const titleEn = item.titleEn ?? item.title_en;
  if (titleZh !== undefined || titleEn !== undefined) {
    return { ...item, title: lang === "zh" ? titleZh : titleEn };
  }
  const nameZh = item.nameZh ?? item.name_zh;
  const nameEn = item.nameEn ?? item.name_en;
  if (nameZh !== undefined || nameEn !== undefined) {
    const descZh = item.descZh ?? item.desc_zh;
    const descEn = item.descEn ?? item.desc_en;
    return { ...item, name: lang === "zh" ? nameZh : nameEn, desc: lang === "zh" ? descZh : descEn };
  }
  return item;
}

function localizeLootbox<T extends { item?: any; itemZh?: any; itemEn?: any }>(loot: T): T {
  if (!loot.itemZh || !loot.itemEn) return loot;
  return { ...loot, item: getLang() === "zh" ? loot.itemZh : loot.itemEn };
}

function rootStatePatch(username: string, accountName: string = "root"): Partial<AppStateData> {
  const title = getTitle("daily_champion");
  return {
    accountName,
    playerName: username || "root",
    isRoot: true,
    coins: ROOT_COIN_BALANCE,
    level: 99,
    points: 999999,
    accessoryInventory: getAllAccessoryInventory(),
    equippedAccessory: { id: "crown", color: "rainbow" },
    equippedTitleId: title.id,
    titleZh: title.nameZh,
    titleEn: title.nameEn,
    dailyChampionDate: todayKey(),
  };
}

function applyRootIfNeeded(username: string, patch: Partial<AppStateData>, explicitRoot: boolean = false): Partial<AppStateData> {
  return explicitRoot || isRootName(username) ? { ...patch, ...rootStatePatch(username, patch.accountName || username || "root") } : { ...patch, isRoot: false };
}

function pixelAvatarFrom(value: unknown, fallback: string = state.avatar, randomFallback: boolean = false): string {
  const raw = String(value || "").trim();
  if (raw) return normalizeAvatarCode(raw);
  if (fallback) return normalizeAvatarCode(fallback);
  return randomFallback ? randomAvatarCode() : normalizeAvatarCode("");
}

function equippedTitleIdFrom(user: any, fallback: string = state.equippedTitleId): string {
  return String(user?.equipped_title_id || user?.equippedTitleId || fallback || "newbie");
}

function titleDefinitionFromRow(row: any, titleId: string): TitleDefinition | null {
  const base = getTitle(titleId);
  const nameZh = String(row?.name_zh ?? row?.nameZh ?? row?.title_zh ?? row?.titleZh ?? "").trim();
  const nameEn = String(row?.name_en ?? row?.nameEn ?? row?.title_en ?? row?.titleEn ?? "").trim();
  const hasStaticTitle = base.id === titleId;
  if (!nameZh && !nameEn && hasStaticTitle) return null;
  if (!nameZh && !nameEn) return null;
  return {
    ...base,
    id: titleId,
    nameZh: nameZh || base.nameZh || nameEn || titleId,
    nameEn: nameEn || base.nameEn || nameZh || titleId,
    descZh: String(row?.desc_zh ?? row?.descZh ?? base.descZh ?? "GM 专属发放称号。"),
    descEn: String(row?.desc_en ?? row?.descEn ?? base.descEn ?? "Exclusive GM-granted title."),
    color: hasStaticTitle ? base.color : "rainbow",
    ownedOnly: true,
  };
}

function titleCatalogWith(titleId: string, title: TitleDefinition | null): Record<string, TitleDefinition> {
  if (!title || title.id === "newbie") return state.customTitles;
  return { ...state.customTitles, [titleId]: title };
}

function displayNameFromUser(user: any, fallback: string): string {
  return String(user?.nickname || user?.username || fallback || "PLAYER_1");
}

function accountNameFromUser(user: any, fallback: string = state.accountName): string {
  return String(user?.account || fallback || "");
}

function applyUserSnapshot(user: any, fallbackName: string = state.playerName || "PLAYER_1"): void {
  const finalName = displayNameFromUser(user, fallbackName);
  const equippedTitleId = equippedTitleIdFrom(user);
  const customTitle = titleDefinitionFromRow(user, equippedTitleId);
  state.update(applyRootIfNeeded(finalName, {
    accountName: accountNameFromUser(user),
    playerName: finalName,
    playerId: String(user?.id || state.playerId || ""),
    coins: user?.coins ?? state.coins,
    wins: user?.wins ?? state.wins,
    totalGames: user?.total_games ?? state.totalGames,
    level: user?.level ?? state.level,
    points: user?.points ?? state.points,
    avatar: pixelAvatarFrom(user?.avatar),
    avatarEmoji: "",
    customTitles: titleCatalogWith(equippedTitleId, customTitle),
    ownedTitleIds: addOwnedTitleId(state.ownedTitleIds, equippedTitleId),
    equippedTitleId,
    titleZh: user?.title_zh ?? state.titleZh,
    titleEn: user?.title_en ?? state.titleEn,
    rainbowPity: user?.rainbow_pity ?? state.rainbowPity,
  }, Boolean(user?.isRoot || user?.is_admin)));
}

async function loadColyseusClient(): Promise<any> {
  if (colyseusClient) return colyseusClient;
  const { Client } = await import("colyseus.js");
  colyseusClient = new Client(SERVER_URL);
  console.log("[Colyseus] Client ready for", SERVER_URL);
  return colyseusClient;
}

function saveRoomConnection(room: any): void {
  try {
    const roomId = room?.roomId || room?.id;
    const sessionId = room?.sessionId;
    if (!roomId || !sessionId) return;
    sessionStorage.setItem(ROOM_CONNECTION_KEY, JSON.stringify({ roomId, sessionId }));
  } catch {
    // ignore storage failures
  }
}

function loadRoomConnection(): SavedRoomConnection | null {
  try {
    const raw = sessionStorage.getItem(ROOM_CONNECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.roomId || !parsed?.sessionId) return null;
    return { roomId: parsed.roomId, sessionId: parsed.sessionId };
  } catch {
    return null;
  }
}

function clearRoomConnection(): void {
  try {
    sessionStorage.removeItem(ROOM_CONNECTION_KEY);
  } catch {
    // ignore storage failures
  }
}

function bindRoomLifecycle(room: any, playerName: string): void {
  room.onLeave((code: number) => {
    console.log("[Colyseus] Left room, code:", code);
    if (code >= 4000) {
      scheduleReconnect(room.id, playerName);
    }
  });

  room.onError((code: number, message: string) => {
    console.error("[Colyseus] Room error:", code, message);
    scheduleReconnect(room.id, playerName);
  });
}

// ---- REST 请求 ----

async function restGet<T>(path: string, auth = false): Promise<T> {
  try {
    const headers = getJsonHeaders(auth);
    const res = await fetch(API_BASE + path, { headers });
    serverAvailable = true;
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new HttpError(res.status, err.error || "Request failed");
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    if (!serverAvailable && canUseMockFallback()) return fallbackGet<T>(path);
    throw e;
  }
}

async function restPost<T>(path: string, body?: unknown, auth = false): Promise<T> {
  try {
    const headers = getPostHeaders(auth);
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    serverAvailable = true;
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new HttpError(res.status, err.error || "Request failed");
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    if (!serverAvailable && canUseMockFallback()) return fallbackPost<T>(path, body);
    throw e;
  }
}

async function remotePost<T>(path: string, body?: unknown, auth = false): Promise<T> {
  try {
    const headers = auth ? getAuthHeaders() : { "Content-Type": "application/json" };
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    serverAvailable = true;
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new HttpError(res.status, err.error || "Request failed");
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    serverAvailable = false;
    throw e;
  }
}

async function restPut<T>(path: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(API_BASE + path, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    serverAvailable = true;
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new HttpError(res.status, err.error || "Request failed");
    }
    return res.json();
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    if (!serverAvailable && canUseMockFallback()) return { success: true } as unknown as T;
    throw e;
  }
}

async function sendPresenceHeartbeat(): Promise<void> {
  if (!state.authToken || presenceHeartbeatInFlight) return;
  presenceHeartbeatInFlight = true;
  try {
    const res = await fetch(API_BASE + "/presence/heartbeat", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    if (res.ok) serverAvailable = true;
  } catch {
    // Presence is best-effort; gameplay and profile sync should not depend on it.
  } finally {
    presenceHeartbeatInFlight = false;
  }
}

function startPresenceHeartbeat(immediate: boolean = true): void {
  if (!state.authToken || typeof window === "undefined") return;
  if (presenceHeartbeatTimer === null) {
    presenceHeartbeatTimer = window.setInterval(() => {
      void sendPresenceHeartbeat();
    }, PRESENCE_HEARTBEAT_MS);
  }
  if (immediate) void sendPresenceHeartbeat();
}

function stopPresenceHeartbeat(): void {
  if (presenceHeartbeatTimer !== null) {
    window.clearInterval(presenceHeartbeatTimer);
    presenceHeartbeatTimer = null;
  }
  presenceHeartbeatInFlight = false;
}

state.onChange((next) => {
  if (next.authToken) {
    startPresenceHeartbeat(false);
  } else {
    stopPresenceHeartbeat();
  }
});

// ---- Mock fallback（仅离线模式）----

function fallbackGet<T>(path: string): T {
  switch (path) {
    case "/leaderboard": return MOCK_LEADERBOARD.map(localize) as unknown as T;
    case "/shop/items": return MOCK_SHOP_ITEMS.map(localize) as unknown as T;
    default: throw new Error("Mock: Unknown GET " + path);
  }
}

function applyLootboxReward(loot: LootboxResponse, coins: number): void {
  const patch: Partial<AppStateData> = {
    coins,
    rainbowPity: loot.pity ?? state.rainbowPity,
  };

  if (loot.accessory) {
    patch.accessoryInventory = addAccessoryToInventory(state.accessoryInventory, loot.accessory.id, loot.accessory.color);
    patch.equippedAccessory = loot.accessory;
  }
  if (loot.throwable) {
    patch.throwableInventory = addThrowableToInventory(state.throwableInventory, loot.throwable.id, loot.throwable.quantity);
  }
  if (loot.titleId) {
    const title = getTitle(loot.titleId);
    patch.ownedTitleIds = addOwnedTitleId(state.ownedTitleIds, title.id);
    patch.equippedTitleId = title.id;
    patch.titleZh = title.nameZh;
    patch.titleEn = title.nameEn;
  }

  state.update(patch);
}

function applyInventoryRows(rows: any[]): void {
  const accessoryInventory: Record<string, any[]> = {};
  const throwableInventory: Record<string, number> = {};
  let ownedTitleIds: string[] = ["newbie"];
  const customTitles: Record<string, TitleDefinition> = { ...state.customTitles };
  let equippedAccessory = state.equippedAccessory;
  let equippedTitleId = state.equippedTitleId;

  for (const row of rows) {
    const itemId = String(row?.id ?? row?.item_id ?? "");
    const quantity = Math.max(0, Math.floor(Number(row?.quantity) || 0));
    if (!itemId || quantity <= 0) continue;

    const accessory = parseAccessoryItemId(itemId);
    const throwableId = parseThrowableItemId(itemId);
    const titleId = parseTitleItemId(itemId);
    const equipped = Boolean(row?.is_equipped ?? row?.isEquipped);

    if (accessory) {
      accessoryInventory[accessory.id] = Array.from(new Set([...(accessoryInventory[accessory.id] || []), accessory.color]));
      if (equipped) equippedAccessory = accessory;
      continue;
    }

    if (throwableId) {
      throwableInventory[throwableId] = (throwableInventory[throwableId] || 0) + quantity;
      continue;
    }

    if (titleId) {
      const title = titleDefinitionFromRow(row, titleId);
      if (title && title.id !== "newbie") customTitles[titleId] = title;
      ownedTitleIds = addOwnedTitleId(ownedTitleIds, titleId);
      if (equipped) equippedTitleId = titleId;
    }
  }

  const title = getTitle(equippedTitleId, customTitles);
  state.update({
    accessoryInventory,
    throwableInventory,
    ownedTitleIds,
    customTitles,
    equippedAccessory,
    equippedTitleId: title.id,
    titleZh: title.nameZh,
    titleEn: title.nameEn,
  });
}

function lootboxFailure(error: string | undefined = "NOT_ENOUGH_COINS", coins: number = state.coins): LootboxResponse {
  return {
    success: false,
    coins,
    error,
    rarity: "",
    item: { icon: "", name: "", color: "" },
  };
}

async function syncAccountState(): Promise<void> {
  if (!state.authToken) return;
  try {
    await api.refreshProfile();
    await api.refreshInventory();
  } catch {
    // Keep local cache if account sync is temporarily unavailable.
  }
}

function fallbackPost<T>(path: string, _body?: unknown): T {
  if (path === "/lootbox/open") {
    const currentCoins = (state as unknown as AppStateData).coins;
    const root = isRootAccount(state);
    if (!root && currentCoins < LOOTBOX_PRICE) {
      return { success: false, coins: currentCoins, error: "NOT_ENOUGH_COINS" } as unknown as T;
    }

    const loot = openLootboxReward(state.rainbowPity);
    const nextCoins = root ? ROOT_COIN_BALANCE : currentCoins - LOOTBOX_PRICE;
    applyLootboxReward(loot, nextCoins);

    return { ...loot, success: true, coins: state.coins } as unknown as T;
  }
  throw new Error("Mock: Unknown POST " + path);
}

// ---- 公开 API ----

export const api = {
  get isServerAvailable(): boolean { return serverAvailable; },
  get colyseus(): any { return colyseusClient; },
  get room(): any { return activeRoom; },

  async init(force: boolean = false): Promise<boolean> {
    if (initPromise && !force) return initPromise;

    initPromise = (async () => {
      try {
        const res = await fetchWithTimeout(API_BASE + "/health");
        serverAvailable = res.ok;
        console.log("[API] Server " + (serverAvailable ? "available at " + API_BASE : "not ready"));
      } catch {
        serverAvailable = false;
        console.log("[API] Server not available" + (canUseMockFallback() ? ", using mock data" : ""));
      }

      try {
        await loadColyseusClient();
      } catch {
        console.log("[Colyseus] SDK not loaded, online mode disabled");
      }

      if (state.authToken) startPresenceHeartbeat();

      return serverAvailable;
    })();

    return initPromise;
  },

  async diagnoseRest(): Promise<RestDiagnosticResult> {
    return {
      apiBase: API_BASE,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      health: await probe("/health"),
      healthNoCors: await probe("/health", { mode: "no-cors" }),
      leaderboard: await probe("/leaderboard"),
    };
  },

  async joinGameRoom(playerName: string, options: JoinRoomOptions = {}): Promise<any> {
    try {
      const activeRoomId = activeRoom?.roomId || activeRoom?.id;
      const shouldReuseActiveRoom = activeRoom && options.roomId && activeRoomId === options.roomId;
      if (shouldReuseActiveRoom) return activeRoom;

      const shouldReplaceActiveRoom = activeRoom && (options.create || Boolean(options.roomId));
      if (shouldReplaceActiveRoom) {
        try { await activeRoom.leave(); } catch { /* ignore stale room */ }
        activeRoom = null;
        clearRoomConnection();
      }

      const client = await loadColyseusClient();
      const savedConnection = loadRoomConnection();
      const previousSessionId = options.roomId && savedConnection?.roomId === options.roomId
        ? savedConnection.sessionId
        : undefined;
      const payload: JoinRoomPayload & { titleId?: string; titleZh?: string; titleEn?: string } = {
        name: playerName,
        avatar: pixelAvatarFrom(state.avatar),
        accessoryId: state.equippedAccessory?.id || "",
        accessoryColor: state.equippedAccessory?.color || "",
        titleId: state.equippedTitleId || "newbie",
        titleZh: state.titleZh || "新手",
        titleEn: state.titleEn || "Newbie",
        authToken: state.authToken || "",
        previousSessionId,
        playerCount: options.playerCount ?? 4,
        roomName: options.roomName,
        mode: options.mode ?? "casual",
        ante: options.ante ?? 100,
      } as JoinRoomPayload & { authToken?: string; titleId?: string; titleZh?: string; titleEn?: string };

      const room = options.roomId
        ? await client.joinById(options.roomId, payload)
        : options.create
          ? await client.create("uno", payload)
          : await client.joinOrCreate("uno", payload);

      console.log("[Colyseus] Joined room:", room.id);
      activeRoom = room;
      serverAvailable = true;
      state.update({ sessionId: room.sessionId });
      saveRoomConnection(room);
      bindRoomLifecycle(room, playerName);

      return room;
    } catch (e) { console.error("[Colyseus] Join failed:", e); return null; }
  },

  async reconnectGameRoom(playerName: string = state.playerName || "PLAYER_1", expectedRoomId?: string): Promise<any> {
    const activeRoomId = activeRoom?.roomId || activeRoom?.id;
    if (activeRoom && (!expectedRoomId || activeRoomId === expectedRoomId)) return activeRoom;
    if (activeRoom && expectedRoomId && activeRoomId !== expectedRoomId) return null;

    const saved = loadRoomConnection();
    if (!saved) return null;
    if (expectedRoomId && saved.roomId !== expectedRoomId) return null;

    try {
      const client = await loadColyseusClient();
      const room = await client.reconnect(saved.roomId, saved.sessionId);
      console.log("[Colyseus] Reconnected room:", room.id);
      activeRoom = room;
      serverAvailable = true;
      state.update({ sessionId: room.sessionId });
      saveRoomConnection(room);
      bindRoomLifecycle(room, playerName);
      return room;
    } catch (e) {
      console.error("[Colyseus] Reconnect failed:", e);
      return null;
    }
  },

  async getAvailableRooms(): Promise<any[]> {
    try {
      const client = await loadColyseusClient();
      const rooms = await client.getAvailableRooms("uno");
      serverAvailable = true;
      return rooms;
    } catch {
      serverAvailable = false;
      return [];
    }
  },

  async leaveGameRoom(): Promise<void> {
    const room = activeRoom;
    activeRoom = null;
    clearRoomConnection();
    if (!room) return;
    try {
      await room.leave();
    } catch {
      // Already gone.
    }
  },

  async login(username: string, password: string): Promise<AppStateData> {
    try {
      const res = await restPost<{ token: string; user: any }>("/auth/login", { account: username, username, password });
      const finalName = displayNameFromUser(res.user, username);
      const equippedTitleId = equippedTitleIdFrom(res.user);
      const customTitle = titleDefinitionFromRow(res.user, equippedTitleId);
      state.update(applyRootIfNeeded(finalName, {
        accountName: accountNameFromUser(res.user, username),
        playerName: finalName,
        playerId: String(res.user?.id || ""),
        authToken: res.token,
        coins: res.user?.coins ?? 1250,
        wins: res.user?.wins ?? 0,
        totalGames: res.user?.total_games ?? 0,
        level: res.user?.level ?? 1,
        points: res.user?.points ?? 0,
        avatar: pixelAvatarFrom(res.user?.avatar, "", false),
        avatarEmoji: "",
        customTitles: titleCatalogWith(equippedTitleId, customTitle),
        ownedTitleIds: addOwnedTitleId(state.ownedTitleIds, equippedTitleId),
        equippedTitleId,
        titleZh: res.user?.title_zh ?? "\u65B0\u624B",
        titleEn: res.user?.title_en ?? "Newbie",
        sessionId: "session_" + Math.random().toString(36).slice(2),
      }, Boolean(res.user?.isRoot || res.user?.is_admin)));
      startPresenceHeartbeat();
    } catch (e: any) {
      throw e;
    }
    return state as unknown as AppStateData;
  },

  async register(username: string, password: string): Promise<AppStateData> {
    try {
      const res = await restPost<{ token: string; user: any }>("/auth/register", { account: username, username, nickname: username, password });
      const finalName = displayNameFromUser(res.user, username);
      const equippedTitleId = equippedTitleIdFrom(res.user, "newbie");
      const customTitle = titleDefinitionFromRow(res.user, equippedTitleId);
      state.update(applyRootIfNeeded(finalName, {
        accountName: accountNameFromUser(res.user, username),
        playerName: finalName,
        playerId: String(res.user?.id || ""),
        authToken: res.token,
        coins: res.user?.coins ?? 1000,
        wins: 0, totalGames: 0, level: 1, points: 0,
        avatar: pixelAvatarFrom(res.user?.avatar, "", true), avatarEmoji: "",
        customTitles: titleCatalogWith(equippedTitleId, customTitle),
        ownedTitleIds: addOwnedTitleId(state.ownedTitleIds, equippedTitleId),
        equippedTitleId,
        titleZh: "\u65B0\u624B", titleEn: "Newbie",
        sessionId: "session_" + Math.random().toString(36).slice(2),
      }, Boolean(res.user?.isRoot || res.user?.is_admin)));
      startPresenceHeartbeat();
    } catch (e: any) {
      throw e;
    }
    return state as unknown as AppStateData;
  },

  async updateProfile(data: { username?: string; nickname?: string; avatar?: string; avatar_emoji?: string }): Promise<any> {
    return restPut("/auth/profile", data);
  },

  async refreshProfile(): Promise<AppStateData> {
    if (!state.authToken) return state as unknown as AppStateData;
    const res = await restGet<{ user: any }>("/auth/profile", true);
    const user = res.user || {};
    const finalName = displayNameFromUser(user, state.playerName || "PLAYER_1");
    const equippedTitleId = equippedTitleIdFrom(user);
    const customTitle = titleDefinitionFromRow(user, equippedTitleId);
    state.update(applyRootIfNeeded(finalName, {
      accountName: accountNameFromUser(user),
      playerName: finalName,
      playerId: String(user.id || state.playerId || ""),
      coins: user.coins ?? state.coins,
      wins: user.wins ?? state.wins,
      totalGames: user.total_games ?? state.totalGames,
      level: user.level ?? state.level,
      points: user.points ?? state.points,
      avatar: pixelAvatarFrom(user.avatar),
      avatarEmoji: "",
      customTitles: titleCatalogWith(equippedTitleId, customTitle),
      ownedTitleIds: addOwnedTitleId(state.ownedTitleIds, equippedTitleId),
      equippedTitleId,
      titleZh: user.title_zh ?? state.titleZh,
      titleEn: user.title_en ?? state.titleEn,
      rainbowPity: user.rainbow_pity ?? state.rainbowPity,
    }, Boolean(user?.isRoot || user?.is_admin)));
    startPresenceHeartbeat();
    return state as unknown as AppStateData;
  },

  async refreshInventory(): Promise<any[]> {
    if (!state.authToken) return [];
    const rows = await restGet<any[]>("/shop/inventory", true);
    applyInventoryRows(rows);
    return rows.map(localize);
  },

  async refreshAccount(): Promise<AppStateData> {
    await this.refreshProfile();
    await this.refreshInventory();
    return state as unknown as AppStateData;
  },

  async getGameHistory(limit: number = 5): Promise<any[]> {
    if (!state.authToken) return [];
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
    return restGet<any[]>(`/game/history?limit=${safeLimit}`, true);
  },

  async getMail(limit: number = 50): Promise<any[]> {
    if (!state.authToken) return [];
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    return restGet<any[]>(`/mail?limit=${safeLimit}`, true);
  },

  async getUnreadMailCount(): Promise<number> {
    if (!state.authToken) return 0;
    const result = await restGet<{ unread: number }>("/mail/unread-count", true);
    return Number(result.unread || 0);
  },

  async getFriends(): Promise<FriendEntry[]> {
    return restGet<FriendEntry[]>("/friends", true);
  },

  async requestFriend(account: string): Promise<{ success: boolean; friend: FriendEntry }> {
    return restPost<{ success: boolean; friend: FriendEntry }>("/friends/request", { account }, true);
  },

  async acceptFriend(friendshipId: number): Promise<{ success: boolean; friend: FriendEntry }> {
    return restPost<{ success: boolean; friend: FriendEntry }>(`/friends/${friendshipId}/accept`, {}, true);
  },

  async rejectFriend(friendshipId: number): Promise<{ success: boolean }> {
    return restPost<{ success: boolean }>(`/friends/${friendshipId}/reject`, {}, true);
  },

  async removeFriend(userId: number): Promise<{ success: boolean }> {
    return restPost<{ success: boolean }>(`/friends/${userId}/remove`, {}, true);
  },

  async readMail(mailId: number): Promise<{ success: boolean; mail: any }> {
    return remotePost<{ success: boolean; mail: any }>(`/mail/${mailId}/read`, {}, true);
  },

  async claimMail(mailId: number): Promise<any> {
    const result = await remotePost<any>(`/mail/${mailId}/claim`, {}, true);
    if (result.user) applyUserSnapshot(result.user);
    if (result.itemId) await this.refreshInventory();
    return result;
  },

  async getLeaderboard() {
    const rows = await restGet<any[]>("/leaderboard");
    return rows
      .map(localize)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .map((row, index) => {
        return {
          ...row,
          rank: index + 1,
          avatar: pixelAvatarFrom(row.avatar, "", false),
          avatarEmoji: "",
          titleId: row.titleId || row.equipped_title_id || "newbie",
          dailyChampion: Boolean(row.dailyChampion),
        };
      });
  },
  async getShopItems() {
    const rows = await restGet<any[]>("/shop/items");
    const merged = new Map<string, any>();
    for (const item of MOCK_SHOP_ITEMS) merged.set(item.id, item);
    for (const item of rows) merged.set(item.id, item);
    return Array.from(merged.values())
      .filter((row) => row.type === "accessory" || row.type === "emoji" || row.type === "title")
      .map(localize);
  },
  async getInventory(): Promise<any[]> {
    return this.refreshInventory();
  },

  async buyItem(itemId: string, price: number): Promise<{ success: boolean; coins: number }> {
    const localShopItem = MOCK_SHOP_ITEMS.find((item) => item.id === itemId);
    const root = isRootAccount(state);
    if (!root && state.authToken) {
      try {
        const result = await remotePost<{ success: boolean; coins: number }>("/shop/buy", { itemId }, true);
        if (result.success) {
          state.update({ coins: result.coins });
          await syncAccountState();
        }
        return result;
      } catch {
        return { success: false, coins: state.coins };
      }
    }

    if (localShopItem || root || !state.authToken) {
      const currentCoins = (state as unknown as AppStateData).coins;
      if (!root && currentCoins < price) return { success: false, coins: currentCoins };
      const accessory = parseAccessoryItemId(itemId);
      const throwableId = parseThrowableItemId(itemId);
      const titleId = parseTitleItemId(itemId);
      const patch: Partial<AppStateData> = {
        coins: root ? ROOT_COIN_BALANCE : currentCoins - price,
      };
      if (accessory) {
        patch.accessoryInventory = addAccessoryToInventory(state.accessoryInventory, accessory.id, accessory.color);
        patch.equippedAccessory = accessory;
      }
      if (throwableId) {
        patch.throwableInventory = addThrowableToInventory(state.throwableInventory, throwableId, 1);
      }
      if (titleId) {
        const title = getTitle(titleId, state.customTitles);
        patch.ownedTitleIds = addOwnedTitleId(state.ownedTitleIds, title.id);
        patch.equippedTitleId = title.id;
        patch.titleZh = title.nameZh;
        patch.titleEn = title.nameEn;
      }
      state.update(patch);
      return { success: true, coins: root ? ROOT_COIN_BALANCE : currentCoins - price };
    }
    return { success: false, coins: state.coins };
  },

  async equipItem(itemId: string): Promise<{ success: boolean }> {
    const accessory = parseAccessoryItemId(itemId);
    const titleId = parseTitleItemId(itemId);
    const root = isRootAccount(state);

    if (!root && state.authToken) {
      try {
        const result = await remotePost<{ success: boolean }>("/shop/equip", { itemId }, true);
        if (result.success) {
          if (accessory) state.update({ equippedAccessory: accessory });
          if (titleId) {
            const title = getTitle(titleId, state.customTitles);
            state.update({ equippedTitleId: title.id, titleZh: title.nameZh, titleEn: title.nameEn });
          }
          await syncAccountState();
        }
        return result;
      } catch {
        return { success: false };
      }
    }

    if (root || !serverAvailable || !state.authToken) {
      if (accessory) {
        const owned = state.accessoryInventory[accessory.id]?.includes(accessory.color);
        if (!owned) return { success: false };
        state.update({ equippedAccessory: accessory });
      }
      if (titleId) {
        const owned = state.ownedTitleIds.includes(titleId);
        if (!owned && !isRootAccount(state)) return { success: false };
        const title = getTitle(titleId, state.customTitles);
        state.update({ equippedTitleId: title.id, titleZh: title.nameZh, titleEn: title.nameEn });
      }
      return { success: true };
    }
    return { success: false };
  },

  async redeemCode(code: string): Promise<RedeemCodeResponse> {
    if (!state.authToken) return { success: false, coins: state.coins, error: "LOGIN_REQUIRED" };
    const result = await remotePost<RedeemCodeResponse>("/shop/redeem", { code }, true);
    if (result.success) {
      if (typeof result.coins === "number") state.update({ coins: result.coins });
      await syncAccountState();
    }
    return result;
  },

  async getRooms(): Promise<any[]> {
    const rooms = await this.getAvailableRooms();
    return rooms.map((r: any, i: number) => ({
      id: r.roomId || String(i),
      name: "#" + String(i + 1).padStart(2, "0") + " " + (r.metadata?.name || (getLang() === "zh" ? "牌桌房间" : "Card Room")),
      modeKey: r.metadata?.mode || "casual",
      mode: r.metadata?.mode === "ranked" ? (getLang() === "zh" ? "排位" : "Ranked") : (getLang() === "zh" ? "休闲" : "Casual"),
      ante: r.metadata?.ante || 100,
      players: r.clients || 0,
      max: r.metadata?.maxPlayers || r.maxClients || 4,
      roomId: r.roomId,
    }));
  },

  async openLootbox(): Promise<LootboxResponse> {
    if (!isRootAccount(state) && state.authToken) {
      try {
        const loot = await remotePost<LootboxResponse>("/lootbox/open", {}, true);
        if (loot.success === false) return localizeLootbox(lootboxFailure(loot.error, loot.coins ?? state.coins));
        applyLootboxReward(loot, loot.coins ?? state.coins);
        await syncAccountState();
        return localizeLootbox({ ...loot, success: true, coins: loot.coins ?? state.coins });
      } catch (e: any) {
        return localizeLootbox(lootboxFailure(e?.message || "LOOTBOX_FAILED", state.coins));
      }
    }
    return localizeLootbox(fallbackPost<LootboxResponse>("/lootbox/open"));
  },

  async openGacha() {
    const totalCost = LOOTBOX_PRICE * 10;
    const root = isRootAccount(state);

    if (!root && state.authToken) {
      try {
        const result = await remotePost<GachaResponse>("/lootbox/open10", {}, true);
        if (result.success === false || !Array.isArray(result.rewards)) {
          return [lootboxFailure(result.error, result.coins ?? state.coins)];
        }

        const finalCoins = result.coins ?? state.coins;
        for (const reward of result.rewards) {
          applyLootboxReward({ ...reward, pity: reward.pity ?? result.pity }, finalCoins);
        }
        if (typeof result.pity === "number") state.update({ rainbowPity: result.pity, coins: finalCoins });
        await syncAccountState();

        return result.rewards.map((reward) => localizeLootbox({
          ...reward,
          success: true,
          coins: finalCoins,
          pity: reward.pity ?? result.pity ?? state.rainbowPity,
        }));
      } catch (e: any) {
        return [lootboxFailure(e?.message || "GACHA_FAILED", state.coins)];
      }
    }

    if (!root && state.coins < totalCost) {
      return [lootboxFailure("NOT_ENOUGH_COINS", state.coins)];
    }
    const rewards = openLootboxRewards(10, state.rainbowPity, true) as LootboxResponse[];
    const nextCoins = root ? ROOT_COIN_BALANCE : state.coins - totalCost;
    for (const reward of rewards) applyLootboxReward(reward, nextCoins);
    return rewards.map((reward) => localizeLootbox({ ...reward, success: true, coins: state.coins }));
  },

  async submitGameResult(data: { winner: string; winnerScore: number; isPlayerWin: boolean; players: any[] }): Promise<any> {
    if (!state.authToken) return { success: true };
    const result = await remotePost<{ success: boolean; gameId?: number; user?: any }>("/game/result", data, true);
    if (result.user) applyUserSnapshot(result.user);
    return result;
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const _reconnectAttempts: Map<string, number> = new Map();

function scheduleReconnect(roomId: string, playerName: string): void {
  const attempts = _reconnectAttempts.get(roomId) || 0;
  if (attempts >= 5) {
    console.log("[Colyseus] Max reconnect attempts reached for", roomId);
    _reconnectAttempts.delete(roomId);
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
  console.log(`[Colyseus] Reconnecting in ${delay}ms (attempt ${attempts + 1})...`);

  const timer = window.setTimeout(async () => {
    try {
      if (!colyseusClient) return;
      const room = await colyseusClient.reconnect(roomId, state.sessionId);
      console.log("[Colyseus] Reconnected to room:", room.id);
      activeRoom = room;
      state.update({ sessionId: room.sessionId });
      saveRoomConnection(room);
      bindRoomLifecycle(room, playerName);
      _reconnectAttempts.delete(roomId);
    } catch {
      _reconnectAttempts.set(roomId, attempts + 1);
      scheduleReconnect(roomId, playerName);
    }
  }, delay);

  reconnectionTimers.set(roomId, timer);
  _reconnectAttempts.set(roomId, attempts + 1);
}
