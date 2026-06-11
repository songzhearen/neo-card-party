/**
 * UNO 服务器入口
 * Colyseus + Express — WebSocket 游戏服务 + REST API + MariaDB 数据库
 */

import { Server } from "colyseus";
import { createServer } from "http";
import express, { Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { CARD_PARTY_PROTOCOL_VERSION } from "@card-party/shared";
import { UnoRoom } from "./rooms/UnoRoom";
import { initDatabase, initConnection, userRepo, gameRepo, shopRepo, adminRepo, accountEventRepo, mailRepo, friendRepo } from "./db";
import type { AccountEventInput, User } from "./db";
import { DB_AUTO_CREATE, DB_NAME, pool, RowDataPacket } from "./db/connection";
import { ROOT_COINS, isAdminUser, isRootUsername } from "./db/repos/userRepo";
import { LOOTBOX_PRICE, LootboxReward, openLootboxReward, openLootboxRewards } from "./cosmetics";
import { getOnlineUser, listOnlineUsers, markHeartbeat, presenceConfig } from "./presence";
import { listDailyLeaderboardSettlements, settleDailyLeaderboard, startDailyLeaderboardScheduler } from "./leaderboardSettlement";

const PORT = parseInt(process.env.PORT || "2567", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "";
const CLIENT_ORIGIN_SUFFIXES = process.env.CLIENT_ORIGIN_SUFFIXES || "";
const SERVE_STATIC_FRONTEND = process.env.SERVE_STATIC_FRONTEND !== "false";
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, "..", "..", "web", "dist");
const DB_AUTO_MIGRATE = process.env.DB_AUTO_MIGRATE !== "false";
const APP_VERSION = process.env.APP_VERSION || readPackageVersion();
const BUILD_SHA = process.env.BUILD_SHA || "";
const BUILD_TIME = process.env.BUILD_TIME || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ROOT_BOOTSTRAP_PASSWORD = process.env.ROOT_BOOTSTRAP_PASSWORD || "";
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || "5", 10);
const LOGIN_RATE_LIMIT_WINDOW_MS = parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
const LOGIN_RATE_LIMIT_LOCK_MS = parseInt(process.env.LOGIN_RATE_LIMIT_LOCK_MS || String(15 * 60 * 1000), 10);
const ADMIN_RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.ADMIN_RATE_LIMIT_MAX_REQUESTS || "120", 10);
const ADMIN_RATE_LIMIT_WINDOW_MS = parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || "60000", 10);
const SERVER_STARTED_AT = new Date().toISOString();
const app = express();
if (TRUST_PROXY) app.set("trust proxy", 1);

function readPackageVersion(): string {
  try {
    const packagePath = path.join(__dirname, "..", "package.json");
    const raw = readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(raw);
    return String(parsed.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function splitEnvList(raw: string): string[] {
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "").toLowerCase();
}

function parseClientOrigins(raw: string, suffixRaw: string): CorsOptions["origin"] {
  const origins = splitEnvList(raw).map(normalizeOrigin);
  const suffixes = splitEnvList(suffixRaw).map((suffix) => suffix.toLowerCase());
  if (origins.length === 0 || origins.includes("*")) return true;

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    let allowed = false;
    try {
      const parsed = new URL(origin);
      const normalized = normalizeOrigin(origin);
      allowed = origins.includes(normalized)
        || suffixes.some((suffix) => parsed.hostname.toLowerCase() === suffix.replace(/^\./, "")
          || parsed.hostname.toLowerCase().endsWith(suffix));
    } catch {
      allowed = false;
    }
    callback(null, allowed);
  };
}

const corsOptions: CorsOptions = {
  origin: parseClientOrigins(CLIENT_ORIGIN, CLIENT_ORIGIN_SUFFIXES),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.text({ type: "text/plain", limit: "100kb" }));
app.use((req, _res, next) => {
  if (typeof req.body === "string") {
    try {
      req.body = req.body.trim() ? JSON.parse(req.body) : {};
    } catch {
      req.body = {};
    }
  }
  next();
});

// ---- Auth 中间件 ----

interface AuthRequest extends Request {
  userId?: number;
  user?: User;
}

interface LoginAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "AUTH_ERROR"
  | "ADMIN_ONLY"
  | "ADMIN_RATE_LIMITED"
  | "INVALID_USER_ID"
  | "USER_NOT_FOUND"
  | "ACCOUNT_TAKEN"
  | "ACCOUNT_REQUIRED"
  | "NICKNAME_REQUIRED"
  | "ITEM_REQUIRED"
  | "ITEM_NOT_FOUND"
  | "ITEM_ID_CONFLICT"
  | "INVALID_CUSTOM_TITLE"
  | "INVALID_TITLE_KEY"
  | "RESERVED_TITLE_KEY"
  | "REWARD_ITEM_NOT_FOUND"
  | "INVALID_MAIL"
  | "INVALID_EXPIRES_AT"
  | "INVALID_REDEEM_CODE_ID"
  | "REDEEM_CODE_NOT_FOUND"
  | "REDEEM_CODE_EXISTS"
  | "INVALID_CODE"
  | "INTERNAL_ERROR";

const loginAttempts = new Map<string, LoginAttemptRecord>();
const adminRateLimits = new Map<string, RateLimitRecord>();

function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  error: string,
  extra: Record<string, unknown> = {}
): void {
  res.status(status).json({ error, code, ...extra });
}

function requestIp(req: Request): string {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || "unknown";
}

function loginAttemptKey(req: Request, account: string): string {
  return `${requestIp(req)}:${account.trim().toLowerCase()}`;
}

function pruneLoginAttempts(now = Date.now()): void {
  for (const [key, record] of loginAttempts) {
    if (record.lockedUntil > now) continue;
    if (now - record.firstAttemptAt > LOGIN_RATE_LIMIT_WINDOW_MS) loginAttempts.delete(key);
  }
}

function getLoginLockMs(key: string, now = Date.now()): number {
  pruneLoginAttempts(now);
  const record = loginAttempts.get(key);
  if (!record || record.lockedUntil <= now) return 0;
  return record.lockedUntil - now;
}

function recordLoginFailure(key: string, now = Date.now()): void {
  pruneLoginAttempts(now);
  const existing = loginAttempts.get(key);
  const record = existing && now - existing.firstAttemptAt <= LOGIN_RATE_LIMIT_WINDOW_MS
    ? existing
    : { count: 0, firstAttemptAt: now, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    record.lockedUntil = now + LOGIN_RATE_LIMIT_LOCK_MS;
  }
  loginAttempts.set(key, record);
}

function recordLoginSuccess(key: string): void {
  loginAttempts.delete(key);
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  const token = authHeader.slice(7);
  userRepo.findByToken(token).then((user) => {
    if (!user) {
      sendError(res, 401, "INVALID_TOKEN", "Invalid token");
      return;
    }
    req.userId = user.id;
    req.user = user;
    next();
  }).catch(() => {
    sendError(res, 500, "AUTH_ERROR", "Auth error");
  });
}

function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!isAdminUser(req.user)) {
    sendError(res, 403, "ADMIN_ONLY", "Admin only");
    return;
  }
  next();
}

function adminRateLimitMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const now = Date.now();
  for (const [entryKey, entry] of adminRateLimits) {
    if (entry.resetAt <= now) adminRateLimits.delete(entryKey);
  }
  const key = `${req.userId || "unknown"}:${requestIp(req)}`;
  const existing = adminRateLimits.get(key);
  const record = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS };
  record.count += 1;
  adminRateLimits.set(key, record);

  if (record.count > ADMIN_RATE_LIMIT_MAX_REQUESTS) {
    sendError(res, 429, "ADMIN_RATE_LIMITED", "Too many admin requests", {
      retryAfterMs: Math.max(0, record.resetAt - now),
    });
    return;
  }
  next();
}

const adminGuards = [authMiddleware, adminMiddleware, adminRateLimitMiddleware];

// ---- Game result helpers ----

const MAX_SETTLEMENT_PLAYERS = 8;
const MAX_SETTLEMENT_POINTS = 5000;
const MIN_SETTLEMENT_POINTS = -5000;

interface NormalizedSubmittedPlayer {
  user_id: number | null;
  player_name: string;
  cards_remaining: number;
  points: number;
  color: string;
  isWinner: boolean;
}

function clampInt(value: unknown, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function safeText(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, maxLength);
}

function safeColor(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#CBD5E0";
}

function attachFriendPresence(friend: any): any {
  const presence = getOnlineUser(Number(friend.userId));
  return {
    ...friend,
    online: Boolean(presence),
    onlineStatus: presence?.status || "offline",
    roomId: presence?.roomId || null,
    roomName: presence?.roomName || null,
    connected: presence?.connected ?? false,
    lastActiveAt: presence?.lastActiveAt || null,
  };
}

function normalizeSubmittedPlayers(players: unknown, userId: number): NormalizedSubmittedPlayer[] {
  if (!Array.isArray(players)) return [];
  return players.slice(0, MAX_SETTLEMENT_PLAYERS).map((player, index) => {
    const row = player && typeof player === "object" ? player as any : {};
    const localId = Number(row.id ?? index);
    const isSelf = localId === 0;
    return {
      user_id: isSelf ? userId : null,
      player_name: safeText(row.name, isSelf ? "Player" : `AI ${index}`, 50),
      cards_remaining: clampInt(row.cards, 0, 108),
      points: clampInt(row.points, MIN_SETTLEMENT_POINTS, MAX_SETTLEMENT_POINTS),
      color: safeColor(row.color),
      isWinner: Boolean(row.isWinner),
    };
  });
}

async function getUserGameHistory(userId: number, limit: number): Promise<any[]> {
  const records = await gameRepo.getRecordsByUser(userId, limit);
  return Promise.all(records.map(async (record) => {
    const players = await gameRepo.getPlayersByGame(record.id);
    const self = players.find((player) => player.user_id === userId);
    return {
      ...record,
      isWin: record.winner_user_id === userId,
      selfPoints: self?.points ?? 0,
      selfCards: self?.cards_remaining ?? 0,
      players,
    };
  }));
}

async function logAccountEvent(event: AccountEventInput): Promise<void> {
  try {
    await accountEventRepo.create(event);
  } catch (err: any) {
    console.warn("[AccountEvent] Failed to record event:", err?.message || err);
  }
}

// ---- 静态文件托管（前端构建产物）----

if (SERVE_STATIC_FRONTEND) {
  if (!existsSync(FRONTEND_DIST)) {
    console.warn(`[Server] Frontend dist not found at ${FRONTEND_DIST}`);
  }
  app.use(express.static(FRONTEND_DIST));
}

// ---- REST API ----

app.get("/api/health", async (_req, res) => {
  const health = {
    ok: true,
    service: "card-party-server",
    version: APP_VERSION,
    protocolVersion: CARD_PARTY_PROTOCOL_VERSION,
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    startedAt: SERVER_STARTED_AT,
    uptimeSeconds: Math.floor(process.uptime()),
    build: {
      sha: BUILD_SHA || null,
      time: BUILD_TIME || null,
    },
    serveStaticFrontend: SERVE_STATIC_FRONTEND,
    database: "ok",
    databaseName: DB_NAME,
    dbAutoCreate: DB_AUTO_CREATE,
    dbAutoMigrate: DB_AUTO_MIGRATE,
  };

  try {
    await pool.query("SELECT 1");
  } catch {
    health.ok = false;
    health.database = "error";
  }

  res.status(health.ok ? 200 : 503).json(health);
});

// 认证
app.post("/api/auth/register", async (req, res) => {
  try {
    const { account, username, nickname, password: rawPassword } = req.body;
    const account_clean = String(account || username || "").trim();
    const nickname_clean = String(nickname || username || account_clean || "").trim();
    const password = rawPassword || "";
    if (!account_clean) {
      res.status(400).json({ error: "Account required" });
      return;
    }
    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }
    if (isRootUsername(account_clean)) {
      const existingRoot = await userRepo.findByLogin("root");
      if (existingRoot) {
        res.status(409).json({ error: "Root account already exists", code: "ROOT_EXISTS" });
        return;
      }
      if (IS_PRODUCTION && !ROOT_BOOTSTRAP_PASSWORD) {
        res.status(403).json({ error: "Root bootstrap disabled", code: "ROOT_BOOTSTRAP_DISABLED" });
        return;
      }
      if (ROOT_BOOTSTRAP_PASSWORD && password !== ROOT_BOOTSTRAP_PASSWORD) {
        res.status(401).json({ error: "Invalid root bootstrap password", code: "INVALID_ROOT_BOOTSTRAP_PASSWORD" });
        return;
      }
      const root = await userRepo.ensureRootAccount(password);
      await shopRepo.grantAllAccessories(root.id);
      res.json({ token: root.auth_token, user: root });
      return;
    }
    const user = await userRepo.register(account_clean, password, nickname_clean);
    res.json({ token: user.auth_token, user });
  } catch (err: any) {
    if (err.message === "USERNAME_TAKEN") {
      res.status(409).json({ error: "Account already taken" });
      return;
    }
    if (err.message === "INVALID_CREDENTIALS") {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  let attemptKey = "";
  try {
    const { account, username, password: rawPassword } = req.body;
    const account_clean = String(account || username || "").trim();
    const password = rawPassword || "";
    if (!account_clean) {
      res.status(400).json({ error: "Account required" });
      return;
    }
    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }
    attemptKey = loginAttemptKey(req, account_clean);
    const lockMs = getLoginLockMs(attemptKey);
    if (lockMs > 0) {
      res.status(429).json({ error: "Too many login attempts", retryAfterMs: lockMs });
      return;
    }
    if (isRootUsername(account_clean)) {
      const root = await userRepo.login(account_clean, password);
      await shopRepo.grantAllAccessories(root.id);
      recordLoginSuccess(attemptKey);
      res.json({ token: root.auth_token, user: root });
      return;
    }

    const loggedIn = await userRepo.login(account_clean, password);
    recordLoginSuccess(attemptKey);
    res.json({ token: loggedIn.auth_token, user: loggedIn });
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      if (attemptKey) recordLoginFailure(attemptKey);
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/profile", authMiddleware, async (req: AuthRequest, res) => {
  const user = await userRepo.findById(req.userId!);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password, ...pub } = user;
  res.json({ user: pub });
});

app.put("/api/auth/profile", authMiddleware, async (req: AuthRequest, res) => {
  const { username, nickname, avatar, avatar_emoji } = req.body;
  const user = await userRepo.updateProfile(req.userId!, { nickname: nickname ?? username, avatar, avatar_emoji });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});

app.post("/api/presence/heartbeat", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const presence = markHeartbeat(req.user);
  res.json({ ok: true, presence, onlineTtlMs: presenceConfig.onlineTtlMs });
});

app.get("/api/friends", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const friends = await friendRepo.listForUser(req.userId!);
    res.json(friends.map(attachFriendPresence));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/friends/request", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const friendship = await friendRepo.requestFriend(req.userId!, req.body?.account || req.body?.identifier);
    res.json({ success: true, friend: attachFriendPresence(friendship) });
  } catch (err: any) {
    const code = err.message;
    if (code === "FRIEND_USER_NOT_FOUND") {
      res.status(404).json({ error: "Friend user not found" });
      return;
    }
    if (code === "FRIEND_ALREADY_EXISTS" || code === "FRIEND_REQUEST_PENDING") {
      res.status(409).json({ error: code });
      return;
    }
    if (code === "FRIEND_SELF" || code === "INVALID_FRIEND_IDENTIFIER") {
      res.status(400).json({ error: code });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/friends/:id/accept", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const friendshipId = clampInt(req.params.id, 1, 2147483647);
    const friendship = await friendRepo.acceptRequest(req.userId!, friendshipId);
    res.json({ success: true, friend: attachFriendPresence(friendship) });
  } catch (err: any) {
    if (err.message === "FRIEND_REQUEST_NOT_FOUND") {
      res.status(404).json({ error: "Friend request not found" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/friends/:id/reject", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const friendshipId = clampInt(req.params.id, 1, 2147483647);
    await friendRepo.rejectRequest(req.userId!, friendshipId);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === "FRIEND_REQUEST_NOT_FOUND") {
      res.status(404).json({ error: "Friend request not found" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/friends/:userId/remove", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const friendUserId = clampInt(req.params.userId, 1, 2147483647);
    await friendRepo.removeFriend(req.userId!, friendUserId);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === "FRIEND_NOT_FOUND") {
      res.status(404).json({ error: "Friend not found" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// 排行榜
app.get("/api/leaderboard", async (_req, res) => {
  const list = await userRepo.getLeaderboard(20);
  const result = list.map((u, i) => ({
    rank: i + 1,
    name: u.username,
    title: u.title_zh,
    titleZh: u.title_zh,
    titleEn: u.title_en,
    titleId: u.equipped_title_id || "newbie",
    dailyChampion: false,
    avatar: u.avatar,
    avatarEmoji: "",
    avatarColor: "#0077FF",
    points: (u as any).daily_points ?? u.points,
    totalPoints: u.points,
    dailyPoints: (u as any).daily_points ?? 0,
    winRate: u.total_games > 0 ? Math.round((u.wins / u.total_games) * 100) + "%" : "0%",
  }));
  res.json(result);
});

// 商城物品
app.get("/api/shop/items", async (_req, res) => {
  const items = await shopRepo.getAllItems();
  const result = items.map((item) => ({
    id: item.id,
    type: item.type,
    icon: item.icon,
    nameZh: item.name_zh,
    nameEn: item.name_en,
    descZh: item.desc_zh,
    descEn: item.desc_en,
    price: item.price,
    stock: item.stock,
  }));
  res.json(result);
});

// GM 管理接口
app.get("/api/admin/summary", ...adminGuards, async (_req: AuthRequest, res) => {
  try {
    const summary = await adminRepo.getSummary();
    res.json(summary);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/online-users", ...adminGuards, async (_req: AuthRequest, res) => {
  res.json(listOnlineUsers());
});

app.get("/api/admin/audit-logs", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const page = clampInt(req.query.page ?? 1, 1, 2147483647);
    const pageSize = clampInt(req.query.pageSize ?? 30, 1, 100);
    const filters = {
      type: String(req.query.type || "").trim(),
      actorUserId: clampInt(req.query.actorUserId ?? 0, 0, 2147483647) || null,
      targetUserId: clampInt(req.query.targetUserId ?? 0, 0, 2147483647) || null,
    };
    res.json(await accountEventRepo.listRecent(page, pageSize, filters));
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/leaderboard/settlements", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const limit = clampInt(req.query.limit ?? 10, 1, 30);
    res.json(await listDailyLeaderboardSettlements(limit));
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.post("/api/admin/leaderboard/settle", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const result = await settleDailyLeaderboard({
      settlementDate: typeof req.body?.date === "string" ? req.body.date : undefined,
      triggeredByUserId: req.userId!,
    });
    await logAccountEvent({
      actorUserId: req.userId!,
      type: "gm_settle_daily_leaderboard",
      metadata: {
        date: String(result.settlement?.settlement_date || req.body?.date || "").slice(0, 10),
        settlementId: result.settlement?.id || null,
        rewardBatchId: result.settlement?.id
          ? `leaderboard_daily_${String(result.settlement?.settlement_date || "").slice(0, 10).replace(/-/g, "")}_${result.settlement.id}`
          : null,
        alreadySettled: result.alreadySettled,
        rewardsSent: result.entries?.length || 0,
        playerCount: Number(result.settlement?.player_count || 0),
        topUserId: result.settlement?.top_user_id || null,
        topPoints: Number(result.settlement?.top_points || 0),
      },
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/users", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const users = await adminRepo.listUsers(String(req.query.query || ""), Number(req.query.limit || 50));
    res.json(users);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.put("/api/admin/users/:id", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    const user = await adminRepo.updateUser(userId, req.body || {});
    if (!user) {
      sendError(res, 404, "USER_NOT_FOUND", "User not found");
      return;
    }
    await logAccountEvent({
      userId,
      actorUserId: req.userId!,
      type: "gm_update_user",
      metadata: { patch: req.body || {} },
    });
    res.json({ user });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      sendError(res, 409, "ACCOUNT_TAKEN", "Account already taken");
      return;
    }
    if (err.message === "USERNAME_REQUIRED" || err.message === "NICKNAME_REQUIRED") {
      sendError(res, 400, "NICKNAME_REQUIRED", "Nickname required");
      return;
    }
    if (err.message === "ACCOUNT_REQUIRED") {
      sendError(res, 400, "ACCOUNT_REQUIRED", "Account required");
      return;
    }
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/users/:id/inventory", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    const inventory = await adminRepo.getUserInventory(userId);
    res.json(inventory);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/users/:id/games", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const limit = clampInt(req.query.limit ?? 10, 1, 20);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    res.json(await getUserGameHistory(userId, limit));
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/users/:id/presence", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    const user = await userRepo.findById(userId);
    if (!user) {
      sendError(res, 404, "USER_NOT_FOUND", "User not found");
      return;
    }
    const presence = getOnlineUser(userId);
    res.json({
      online: Boolean(presence),
      presence,
      lastLoginAt: user.last_login_at || null,
      lastActiveAt: presence?.lastActiveAt || null,
      roomId: presence?.roomId || null,
      roomName: presence?.roomName || null,
      status: presence?.status || "offline",
      connected: presence?.connected ?? false,
    });
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/users/:id/redeems", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const limit = clampInt(req.query.limit ?? 20, 1, 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    res.json(await adminRepo.getUserRedeems(userId, limit));
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/users/:id/events", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const page = clampInt(req.query.page ?? 1, 1, 2147483647);
    const pageSize = clampInt(req.query.pageSize ?? 30, 1, 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    res.json(await accountEventRepo.listForUser(userId, page, pageSize));
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/users/:id/mail", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const limit = clampInt(req.query.limit ?? 30, 1, 100);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    res.json(await mailRepo.listForUser(userId, limit));
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/mail", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const page = clampInt(req.query.page ?? 1, 1, 2147483647);
    const pageSize = clampInt(req.query.pageSize ?? req.query.limit ?? 30, 1, 100);
    res.json(await mailRepo.listRecentForAdmin(page, pageSize, String(req.query.status || "all")));
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.post("/api/admin/mail", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const allUsers = Boolean(req.body?.allUsers);
    const targetUserId = Number(req.body?.targetUserId || 0);
    const payload = {
      senderUserId: req.userId!,
      title: req.body?.title,
      body: req.body?.body,
      rewardCoins: req.body?.rewardCoins,
      rewardItemId: req.body?.rewardItemId || null,
      rewardQuantity: req.body?.rewardQuantity,
      expiresAt: req.body?.expiresAt || null,
    };

    if (allUsers) {
      const broadcast = await mailRepo.createForAllPlayers(payload);
      await logAccountEvent({
        actorUserId: req.userId!,
        type: "gm_broadcast_mail",
        deltaCoins: Number(payload.rewardCoins || 0),
        itemId: payload.rewardItemId,
        quantity: Number(payload.rewardQuantity || 0),
        metadata: { title: payload.title, sent: broadcast.sent, batchId: broadcast.batchId, expiresAt: payload.expiresAt },
      });
      res.json({ success: true, sent: broadcast.sent, batchId: broadcast.batchId });
      return;
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }

    const mail = await mailRepo.createForUser({ ...payload, userId: targetUserId });
    await logAccountEvent({
      userId: targetUserId,
      actorUserId: req.userId!,
      type: "gm_send_mail",
      deltaCoins: Number(payload.rewardCoins || 0),
      itemId: payload.rewardItemId,
      quantity: Number(payload.rewardQuantity || 0),
      metadata: { mailId: mail?.id, title: payload.title, expiresAt: payload.expiresAt },
    });
    res.json({ success: true, sent: 1, mail });
  } catch (err: any) {
    if (err.message === "ITEM_NOT_FOUND") {
      sendError(res, 404, "REWARD_ITEM_NOT_FOUND", "Reward item not found");
      return;
    }
    if (err.message === "USER_NOT_FOUND") {
      sendError(res, 404, "USER_NOT_FOUND", "User not found");
      return;
    }
    if (err.message === "INVALID_MAIL") {
      sendError(res, 400, "INVALID_MAIL", "Invalid mail");
      return;
    }
    if (err.message === "INVALID_EXPIRES_AT") {
      sendError(res, 400, "INVALID_EXPIRES_AT", "Invalid expires_at");
      return;
    }
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.post("/api/admin/users/:id/grant-item", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const itemId = String(req.body?.itemId || "").trim();
    const quantity = Number(req.body?.quantity || 1);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }
    if (!itemId) {
      sendError(res, 400, "ITEM_REQUIRED", "itemId required");
      return;
    }
    await adminRepo.grantItem(userId, itemId, quantity);
    const inventory = await adminRepo.getUserInventory(userId);
    await logAccountEvent({
      userId,
      actorUserId: req.userId!,
      type: "gm_grant_item",
      itemId,
      quantity,
    });
    res.json({ success: true, inventory });
  } catch (err: any) {
    if (err.message === "ITEM_NOT_FOUND") {
      sendError(res, 404, "ITEM_NOT_FOUND", "Item not found");
      return;
    }
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.post("/api/admin/users/:id/grant-custom-title", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      sendError(res, 400, "INVALID_USER_ID", "Invalid user id");
      return;
    }

    const result = await adminRepo.grantCustomTitle(userId, {
      titleKey: req.body?.titleKey,
      nameZh: req.body?.nameZh,
      nameEn: req.body?.nameEn,
      descZh: req.body?.descZh,
      descEn: req.body?.descEn,
      icon: req.body?.icon,
      equipNow: Boolean(req.body?.equipNow),
    });

    await logAccountEvent({
      userId,
      actorUserId: req.userId!,
      type: "gm_grant_custom_title",
      itemId: result.item?.id,
      quantity: 1,
      metadata: {
        titleKey: String(result.item?.id || "").replace(/^title_/, ""),
        nameZh: result.item?.name_zh,
        nameEn: result.item?.name_en,
        equipped: result.equipped,
      },
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") {
      sendError(res, 404, "USER_NOT_FOUND", "User not found");
      return;
    }
    if (err.message === "INVALID_CUSTOM_TITLE" || err.message === "INVALID_TITLE_KEY" || err.message === "RESERVED_TITLE_KEY") {
      sendError(res, 400, err.message, "Invalid custom title");
      return;
    }
    if (err.message === "ITEM_ID_CONFLICT") {
      sendError(res, 409, "ITEM_ID_CONFLICT", "Item id already exists with another type");
      return;
    }
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/shop-items", ...adminGuards, async (_req: AuthRequest, res) => {
  try {
    const items = await adminRepo.listShopItems();
    res.json(items);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/redeem-codes", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const codes = await adminRepo.listRedeemCodes(Number(req.query.limit || 100));
    res.json(codes);
  } catch (err: any) {
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.post("/api/admin/redeem-codes", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const code = await adminRepo.createRedeemCode({
      code: req.body?.code,
      rewardCoins: req.body?.rewardCoins,
      rewardItemId: req.body?.rewardItemId || null,
      rewardQuantity: req.body?.rewardQuantity,
      isActive: req.body?.isActive !== false,
      expiresAt: req.body?.expiresAt || null,
      maxUses: req.body?.maxUses,
    });
    await logAccountEvent({
      actorUserId: req.userId!,
      type: "gm_create_redeem_code",
      deltaCoins: Number(code.reward_coins || 0),
      itemId: code.reward_item_id,
      quantity: Number(code.reward_quantity || 0),
      metadata: {
        code: code.code,
        codeId: code.id,
        maxUses: code.max_uses,
        isActive: code.is_active,
        expiresAt: code.expires_at,
      },
    });
    res.json({ code });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      sendError(res, 409, "REDEEM_CODE_EXISTS", "Code already exists");
      return;
    }
    if (err.message === "INVALID_CODE") {
      sendError(res, 400, "INVALID_CODE", "Invalid code");
      return;
    }
    if (err.message === "ITEM_NOT_FOUND") {
      sendError(res, 404, "ITEM_NOT_FOUND", "Item not found");
      return;
    }
    if (err.message === "INVALID_EXPIRES_AT") {
      sendError(res, 400, "INVALID_EXPIRES_AT", "Invalid expires_at");
      return;
    }
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.get("/api/admin/redeem-codes/:id/uses", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const page = clampInt(req.query.page ?? 1, 1, 2147483647);
    const pageSize = clampInt(req.query.pageSize ?? 30, 1, 100);
    if (!Number.isInteger(id) || id <= 0) {
      sendError(res, 400, "INVALID_REDEEM_CODE_ID", "Invalid redeem code id");
      return;
    }
    res.json(await adminRepo.getRedeemCodeUses(id, page, pageSize));
  } catch (err: any) {
    if (err.message === "REDEEM_CODE_NOT_FOUND") {
      sendError(res, 404, "REDEEM_CODE_NOT_FOUND", "Redeem code not found");
      return;
    }
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

app.post("/api/admin/redeem-codes/:id/active", ...adminGuards, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      sendError(res, 400, "INVALID_REDEEM_CODE_ID", "Invalid redeem code id");
      return;
    }
    const code = await adminRepo.setRedeemCodeActive(id, req.body?.isActive !== false);
    await logAccountEvent({
      actorUserId: req.userId!,
      type: "gm_toggle_redeem_code",
      metadata: {
        code: code.code,
        codeId: code.id,
        isActive: code.is_active,
      },
    });
    res.json({ code });
  } catch (err: any) {
    if (err.message === "REDEEM_CODE_NOT_FOUND") {
      sendError(res, 404, "REDEEM_CODE_NOT_FOUND", "Redeem code not found");
      return;
    }
    sendError(res, 500, "INTERNAL_ERROR", err.message);
  }
});

// 用户背包
app.get("/api/shop/inventory", authMiddleware, async (req: AuthRequest, res) => {
  const items = await shopRepo.getUserInventory(req.userId!);
  res.json(items.map((inv) => ({
    id: inv.id,
    type: inv.type,
    icon: inv.icon,
    nameZh: inv.name_zh,
    nameEn: inv.name_en,
    descZh: inv.desc_zh,
    descEn: inv.desc_en,
    price: inv.price,
    quantity: inv.quantity,
    is_equipped: Boolean(inv.is_equipped),
    acquired_at: inv.acquired_at,
  })));
});

app.get("/api/mail", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = clampInt(req.query.limit ?? 50, 1, 100);
    res.json(await mailRepo.listForUser(req.userId!, limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/mail/unread-count", authMiddleware, async (req: AuthRequest, res) => {
  try {
    res.json({ unread: await mailRepo.unreadCount(req.userId!) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/mail/:id/read", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const mailId = Number(req.params.id);
    if (!Number.isInteger(mailId) || mailId <= 0) {
      res.status(400).json({ error: "Invalid mail id" });
      return;
    }
    const mail = await mailRepo.markRead(req.userId!, mailId);
    if (!mail) {
      res.status(404).json({ error: "Mail not found" });
      return;
    }
    res.json({ success: true, mail });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/mail/:id/claim", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const mailId = Number(req.params.id);
    if (!Number.isInteger(mailId) || mailId <= 0) {
      res.status(400).json({ error: "Invalid mail id" });
      return;
    }
    const result = await mailRepo.claim(req.userId!, mailId);
    await logAccountEvent({
      userId: req.userId!,
      type: "mail_claim",
      deltaCoins: result.deltaCoins,
      itemId: result.itemId,
      quantity: result.quantity,
      metadata: { mailId, title: result.mail?.title || "" },
    });
    const user = await userRepo.findById(req.userId!);
    const { password: _, ...pub } = user!;
    res.json({ success: true, ...result, user: pub });
  } catch (err: any) {
    if (err.message === "MAIL_NOT_FOUND") {
      res.status(404).json({ error: "Mail not found" });
      return;
    }
    if (err.message === "ITEM_NOT_FOUND") {
      res.status(404).json({ error: "Reward item not found" });
      return;
    }
    if (err.message === "MAIL_ALREADY_CLAIMED" || err.message === "MAIL_EXPIRED") {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// 购买物品
app.post("/api/shop/buy", authMiddleware, async (req: AuthRequest, res) => {
  const { itemId } = req.body;
  if (!itemId) {
    res.status(400).json({ error: "itemId required" });
    return;
  }
  const item = await shopRepo.getItemById(itemId);
  const result = await shopRepo.buyItem(req.userId!, itemId);
  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }
  const user = await userRepo.findById(req.userId!);
  await logAccountEvent({
    userId: req.userId!,
    type: "shop_buy",
    deltaCoins: isAdminUser(user) ? 0 : -(item?.price ?? 0),
    itemId,
    quantity: 1,
  });
  res.json({ success: true, coins: user?.coins ?? 0 });
});

// 装备物品
app.post("/api/shop/equip", authMiddleware, async (req: AuthRequest, res) => {
  const { itemId } = req.body;
  if (!itemId) {
    res.status(400).json({ error: "itemId required" });
    return;
  }
  const result = await shopRepo.equipItem(req.userId!, itemId);
  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }
  await logAccountEvent({
    userId: req.userId!,
    type: "equip_item",
    itemId,
  });
  res.json({ success: true });
});

// 兑换码
app.post("/api/shop/redeem", authMiddleware, async (req: AuthRequest, res) => {
  const { code } = req.body;
  if (!code || !(code as string).trim()) {
    res.status(400).json({ error: "Code required" });
    return;
  }
  const redeemCodeText = String(code).trim().toUpperCase();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT * FROM redeem_codes WHERE code = ? FOR UPDATE",
      [redeemCodeText]
    );
    const redeemCode = rows[0] as any;
    if (!redeemCode) {
      await conn.rollback();
      res.status(400).json({ error: "Invalid code" });
      return;
    }
    if (redeemCode.is_active === 0 || redeemCode.is_active === false) {
      await conn.rollback();
      res.status(400).json({ error: "Code disabled" });
      return;
    }
    if (redeemCode.expires_at && new Date(redeemCode.expires_at).getTime() < Date.now()) {
      await conn.rollback();
      res.status(400).json({ error: "Code expired" });
      return;
    }
    if (redeemCode.max_uses > 0 && redeemCode.used_count >= redeemCode.max_uses) {
      await conn.rollback();
      res.status(400).json({ error: "Code exhausted" });
      return;
    }

    const [alreadyUsed] = await conn.execute<RowDataPacket[]>(
      "SELECT id FROM user_redeems WHERE user_id = ? AND code = ?",
      [req.userId!, redeemCodeText]
    );
    if (alreadyUsed.length > 0) {
      await conn.rollback();
      res.status(400).json({ error: "Already redeemed" });
      return;
    }

    const rewardCoins = clampInt(redeemCode.reward_coins, 0, 2147483647);
    const rewardItemId = redeemCode.reward_item_id ? String(redeemCode.reward_item_id) : null;
    const rewardQuantity = rewardItemId ? clampInt(redeemCode.reward_quantity || 1, 1, 9999) : 0;

    if (rewardCoins > 0) {
      await conn.execute(
        "UPDATE users SET coins = LEAST(2147483647, coins + ?) WHERE id = ?",
        [rewardCoins, req.userId!]
      );
    }

    if (rewardItemId && rewardQuantity > 0) {
      await conn.execute(
        `INSERT INTO user_inventory (user_id, item_id, quantity, is_equipped)
         VALUES (?, ?, ?, FALSE)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [req.userId!, rewardItemId, rewardQuantity]
      );
    }

    await conn.execute(
      `INSERT INTO user_redeems
        (user_id, code, reward_coins, reward_item_id, reward_quantity)
       VALUES (?, ?, ?, ?, ?)`,
      [req.userId!, redeemCodeText, rewardCoins, rewardItemId, rewardQuantity]
    );
    await conn.execute(
      "UPDATE redeem_codes SET used_count = used_count + 1 WHERE id = ?",
      [redeemCode.id]
    );

    await conn.commit();

    const user = await userRepo.findById(req.userId!);
    const { password: _, ...pub } = user!;
    await logAccountEvent({
      userId: req.userId!,
      type: "redeem_code",
      deltaCoins: rewardCoins,
      itemId: rewardItemId,
      quantity: rewardQuantity,
      metadata: { code: redeemCodeText },
    });
    res.json({
      success: true,
      coins: user?.coins ?? 0,
      reward: {
        coins: rewardCoins,
        itemId: rewardItemId,
        quantity: rewardQuantity,
      },
      message: rewardItemId
        ? `Redeemed for ${rewardCoins} coins and ${rewardQuantity} item(s)!`
        : `Redeemed for ${rewardCoins} coins!`,
    });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

async function grantLootReward(conn: any, userId: number, loot: LootboxReward): Promise<void> {
  const itemType = loot.type === "throwable" ? "emoji" : loot.type;
  await conn.execute(
    `INSERT INTO shop_items (id, type, icon, name_zh, name_en, desc_zh, desc_en, price, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON DUPLICATE KEY UPDATE type = VALUES(type), icon = VALUES(icon), name_zh = VALUES(name_zh), name_en = VALUES(name_en),
       desc_zh = VALUES(desc_zh), desc_en = VALUES(desc_en), stock = VALUES(stock)`,
    [
      loot.itemId,
      itemType,
      loot.itemZh.icon,
      loot.itemZh.name,
      loot.itemEn.name,
      loot.itemZh.name,
      loot.itemEn.name,
      loot.type === "title" || (loot.type === "accessory" && loot.accessory?.color === "rainbow") ? 0 : -1,
    ]
  );

  await conn.execute(
    `INSERT INTO user_inventory (user_id, item_id, quantity, is_equipped)
     VALUES (?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + 1, is_equipped = IF(VALUES(is_equipped), TRUE, is_equipped)`,
    [userId, loot.itemId, loot.type === "accessory" || loot.type === "title"]
  );

  if (loot.type === "accessory") {
    await conn.execute(
      `UPDATE user_inventory
       SET is_equipped = FALSE
       WHERE user_id = ? AND item_id <> ? AND item_id IN (SELECT id FROM shop_items WHERE type = 'accessory')`,
      [userId, loot.itemId]
    );
  }

  if (loot.type === "title") {
    await conn.execute(
      `UPDATE user_inventory
       SET is_equipped = FALSE
       WHERE user_id = ? AND item_id <> ? AND item_id IN (SELECT id FROM shop_items WHERE type = 'title')`,
      [userId, loot.itemId]
    );
    await conn.execute("UPDATE users SET title_zh = ?, title_en = ?, equipped_title_id = ? WHERE id = ?", [
      loot.itemZh.name,
      loot.itemEn.name,
      loot.titleId || loot.itemId.replace(/^title_/, ""),
      userId,
    ]);
  }
}

app.post("/api/lootbox/open", authMiddleware, async (req: AuthRequest, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [coins] = await conn.execute<RowDataPacket[]>(
      "SELECT username, account, is_admin, coins, rainbow_pity FROM users WHERE id = ? FOR UPDATE",
      [req.userId!]
    );
    const user = coins[0] as any;
    const currentCoins = user?.coins ?? 0;
    const currentPity = user?.rainbow_pity ?? 0;
    const root = isAdminUser(user as any);
    if (!root && currentCoins < LOOTBOX_PRICE) {
      await conn.rollback();
      res.status(400).json({ success: false, error: "NOT_ENOUGH_COINS", coins: currentCoins });
      return;
    }

    const loot = openLootboxReward(currentPity);
    await grantLootReward(conn, req.userId!, loot);
    if (root) {
      await conn.execute("UPDATE users SET coins = ?, rainbow_pity = ? WHERE id = ?", [ROOT_COINS, 0, req.userId!]);
    } else {
      await conn.execute("UPDATE users SET coins = coins - ?, rainbow_pity = ? WHERE id = ?", [LOOTBOX_PRICE, loot.pity, req.userId!]);
    }

    await conn.commit();
    await logAccountEvent({
      userId: req.userId!,
      type: "lootbox_open",
      deltaCoins: root ? 0 : -LOOTBOX_PRICE,
      itemId: loot.itemId,
      quantity: loot.throwable?.quantity ?? 1,
      metadata: { rewardType: loot.type, rarity: loot.rarity, pity: root ? 0 : loot.pity },
    });
    res.json({
      success: true,
      type: loot.type,
      rarity: loot.rarity,
      item: loot.itemZh,
      itemZh: loot.itemZh,
      itemEn: loot.itemEn,
      accessory: loot.accessory,
      throwable: loot.throwable,
      titleId: loot.titleId,
      itemId: loot.itemId,
      pity: root ? 0 : loot.pity,
      coins: root ? ROOT_COINS : currentCoins - LOOTBOX_PRICE,
    });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

app.post("/api/lootbox/open10", authMiddleware, async (req: AuthRequest, res) => {
  const conn = await pool.getConnection();
  const totalCost = LOOTBOX_PRICE * 10;
  try {
    await conn.beginTransaction();

    const [coins] = await conn.execute<RowDataPacket[]>(
      "SELECT username, account, is_admin, coins, rainbow_pity FROM users WHERE id = ? FOR UPDATE",
      [req.userId!]
    );
    const user = coins[0] as any;
    const currentCoins = user?.coins ?? 0;
    const currentPity = user?.rainbow_pity ?? 0;
    const root = isAdminUser(user as any);
    if (!root && currentCoins < totalCost) {
      await conn.rollback();
      res.status(400).json({ success: false, error: "NOT_ENOUGH_COINS", coins: currentCoins });
      return;
    }

    const rewards = openLootboxRewards(10, currentPity, true);
    for (const reward of rewards) {
      await grantLootReward(conn, req.userId!, reward);
    }

    const finalPity = root ? 0 : rewards[rewards.length - 1]?.pity ?? currentPity;
    if (root) {
      await conn.execute("UPDATE users SET coins = ?, rainbow_pity = ? WHERE id = ?", [ROOT_COINS, finalPity, req.userId!]);
    } else {
      await conn.execute("UPDATE users SET coins = coins - ?, rainbow_pity = ? WHERE id = ?", [totalCost, finalPity, req.userId!]);
    }

    await conn.commit();
    await logAccountEvent({
      userId: req.userId!,
      type: "lootbox_open10",
      deltaCoins: root ? 0 : -totalCost,
      quantity: rewards.length,
      metadata: {
        pity: finalPity,
        rewards: rewards.map((reward) => ({
          itemId: reward.itemId,
          type: reward.type,
          rarity: reward.rarity,
        })),
      },
    });
    res.json({
      success: true,
      coins: root ? ROOT_COINS : currentCoins - totalCost,
      pity: finalPity,
      rewards: rewards.map((reward) => ({
        ...reward,
        item: reward.itemZh,
        success: true,
        coins: root ? ROOT_COINS : currentCoins - totalCost,
      })),
    });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

app.post("/api/lootbox/open-legacy", async (_req, res) => {
  const rand = Math.random();
  let rarity: string;
  if (rand < 0.5) rarity = "common";
  else if (rand < 0.8) rarity = "rare";
  else if (rand < 0.95) rarity = "epic";
  else rarity = "legendary";

  const zhItems: Record<string, { icon: string; name: string; color: string }> = {
    common: { icon: "🃏", name: "普通卡背", color: "#A0AEC0" },
    rare: { icon: "🔷", name: "稀有表情", color: "#0077FF" },
    epic: { icon: "💎", name: "史诗称号", color: "#9B59B6" },
    legendary: { icon: "👑", name: "传说皮肤", color: "#FFB300" },
  };
  const enItems: Record<string, { icon: string; name: string; color: string }> = {
    common: { icon: "🃏", name: "Common Card Back", color: "#A0AEC0" },
    rare: { icon: "🔷", name: "Rare Emote", color: "#0077FF" },
    epic: { icon: "💎", name: "Epic Title", color: "#9B59B6" },
    legendary: { icon: "👑", name: "Legendary Skin", color: "#FFB300" },
  };

  res.json({
    rarity,
    item: zhItems[rarity],
    itemZh: zhItems[rarity],
    itemEn: enItems[rarity],
  });
});

// 对局历史
app.get("/api/game/history", authMiddleware, async (req: AuthRequest, res) => {
  const limit = clampInt(req.query.limit ?? 10, 1, 20);
  try {
    res.json(await getUserGameHistory(req.userId!, limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 提交游戏结果
app.post("/api/game/result", authMiddleware, async (req: AuthRequest, res) => {
  const { winner, winnerScore, isPlayerWin, players } = req.body;

  try {
    const normalizedPlayers = normalizeSubmittedPlayers(players, req.userId!);
    const selfResult = normalizedPlayers.find((player) => player.user_id === req.userId!);
    if (!selfResult) {
      res.status(400).json({ error: "Player result required" });
      return;
    }

    const winnerResult = normalizedPlayers.find((player) => player.isWinner) || normalizedPlayers[0];
    const playerWon = Boolean(isPlayerWin) && Boolean(selfResult.isWinner);
    const safeWinnerName = safeText(winnerResult?.player_name ?? winner, "Player", 50);
    const safeWinnerScore = clampInt(winnerResult?.points ?? winnerScore, 0, MAX_SETTLEMENT_POINTS);

    const gameId = await gameRepo.createRecord({
      room_id: "",
      player_count: normalizedPlayers.length,
      winner_user_id: playerWon ? req.userId! : null,
      winner_name: safeWinnerName,
      winner_score: safeWinnerScore,
      players: normalizedPlayers.map((player) => ({
        user_id: player.user_id,
        player_name: player.player_name,
        cards_remaining: player.cards_remaining,
        points: player.points,
        color: player.color,
      })),
    });

    if (playerWon) {
      await userRepo.updateStats(req.userId!, {
        wins: 1,
        totalGames: 1,
        points: selfResult.points,
        coins: Math.max(0, Math.floor(selfResult.points / 10)),
      });
    } else {
      await userRepo.updateStats(req.userId!, {
        totalGames: 1,
        points: selfResult.points,
      });
    }

    await userRepo.syncLevel(req.userId!);
    await logAccountEvent({
      userId: req.userId!,
      type: "game_result",
      deltaCoins: playerWon ? Math.max(0, Math.floor(selfResult.points / 10)) : 0,
      metadata: { gameId, points: selfResult.points, isWin: playerWon },
    });

    const user = await userRepo.findById(req.userId!);
    const { password: __, ...pubUser } = user!;
    res.json({ success: true, gameId, user: pubUser, players: normalizedPlayers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
if (SERVE_STATIC_FRONTEND) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// ---- 启动服务器 ----

async function start() {
  try {
    await initConnection();
    if (DB_AUTO_MIGRATE) {
      await initDatabase();
    } else {
      console.log("[DB] Auto migration disabled");
    }
    startDailyLeaderboardScheduler();
  } catch (err) {
    console.warn("[Server] Database init failed, continuing without DB:", err);
  }

  const httpServer = createServer(app);
  const gameServer = new Server({ server: httpServer });

  gameServer.define("uno", UnoRoom);

  httpServer.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   Card Party Server             ║
║   ──────────────────────────           ║
║   HTTP API:  http://localhost:${PORT}/api  ║
║   WebSocket: ws://localhost:${PORT}       ║
║   Frontend:  http://localhost:${PORT}/    ║
║   MariaDB:  localhost:3306              ║
╚══════════════════════════════════════════╝
`);
  });

  process.on("SIGINT", () => {
    console.log("\n[Server] Shutting down...");
    gameServer.gracefullyShutdown().then(() => process.exit(0));
  });
}

start();
