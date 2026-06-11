import { pool, RowDataPacket, InsertResult } from "../connection";
import crypto from "crypto";
import { normalizeAvatarCode, randomAvatarCode } from "../../avatar";

export interface User {
  id: number;
  username: string;
  account: string;
  nickname: string;
  password: string;
  avatar: string;
  avatar_emoji: string;
  coins: number;
  level: number;
  wins: number;
  total_games: number;
  points: number;
  daily_points: number;
  title_zh: string;
  title_en: string;
  equipped_title_id: string;
  rainbow_pity: number;
  is_admin: boolean | number;
  auth_token: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: number;
  username: string;
  account: string;
  nickname: string;
  avatar: string;
  avatar_emoji: string;
  coins: number;
  level: number;
  wins: number;
  total_games: number;
  points: number;
  daily_points: number;
  title_zh: string;
  title_en: string;
  equipped_title_id: string;
  rainbow_pity?: number;
  is_admin?: boolean;
  auth_token: string;
  last_login_at?: string | null;
  isRoot?: boolean;
}

export const ROOT_USERNAME = "root";
export const ROOT_COINS = 2147483647;
const ROOT_POINTS = 999999;
const ROOT_LEVEL = 99;
const ROOT_TITLE_ZH = "\u4eca\u65e5\u699c\u4e00";
const ROOT_TITLE_EN = "Daily Champion";

export function isRootUsername(username?: string): boolean {
  return username?.trim().toLowerCase() === ROOT_USERNAME;
}

export function isAdminUser(user?: Partial<Pick<User, "username" | "account" | "is_admin">> | null): boolean {
  if (!user) return false;
  return Boolean(user.is_admin) || isRootUsername(user.account) || isRootUsername(user.username);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored.includes(":")) {
    return password === stored;
  }
  const [salt, hash] = stored.split(":");
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verify;
}

export { verifyPassword };

function toPublic(user: User): UserPublic {
  const { password, created_at, updated_at, ...pub } = user;
  const account = user.account || user.username;
  const nickname = user.nickname || user.username || account;
  return {
    ...pub,
    account,
    nickname,
    username: nickname,
    avatar: normalizeAvatarCode(user.avatar),
    equipped_title_id: user.equipped_title_id || "newbie",
    is_admin: isAdminUser(user),
    isRoot: isAdminUser(user),
  };
}

function cleanAccount(value: unknown): string {
  return String(value || "").trim();
}

function cleanNickname(value: unknown, fallback: string): string {
  return (String(value || "").trim() || fallback).slice(0, 50);
}

async function backfillAvatarIfNeeded(user: User): Promise<User> {
  if (user.avatar && normalizeAvatarCode(user.avatar) === user.avatar) return user;
  const avatar = randomAvatarCode();
  await pool.execute("UPDATE users SET avatar = ? WHERE id = ?", [avatar, user.id]);
  return { ...user, avatar };
}

export const userRepo = {
  async findById(id: number): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );
    return (rows[0] as User) || null;
  },

  async findByUsername(username: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    return (rows[0] as User) || null;
  },

  async findByAccount(account: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE account = ?",
      [account]
    );
    return (rows[0] as User) || null;
  },

  async findByLogin(login: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE account = ? OR username = ? LIMIT 1",
      [login, login]
    );
    return (rows[0] as User) || null;
  },

  async findByToken(token: string): Promise<User | null> {
    if (!token) return null;
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE auth_token = ?",
      [token]
    );
    const user = (rows[0] as User) || null;
    return user ? backfillAvatarIfNeeded(user) : null;
  },

  async ensureRootAccount(password: string = ROOT_USERNAME): Promise<UserPublic> {
    const token = generateToken();
    const existing = await this.findByLogin(ROOT_USERNAME);

    if (!existing) {
      await pool.execute(
        `INSERT INTO users (username, account, nickname, password, auth_token, avatar, coins, level, points, title_zh, title_en, equipped_title_id, rainbow_pity, is_admin, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, TRUE, CURRENT_TIMESTAMP)`,
        [
          ROOT_USERNAME,
          ROOT_USERNAME,
          ROOT_USERNAME,
          hashPassword(password || ROOT_USERNAME),
          token,
          randomAvatarCode(),
          ROOT_COINS,
          ROOT_LEVEL,
          ROOT_POINTS,
          ROOT_TITLE_ZH,
          ROOT_TITLE_EN,
          "daily_champion",
        ]
      );
    } else {
      if (!verifyPassword(password || ROOT_USERNAME, existing.password)) {
        throw new Error("INVALID_CREDENTIALS");
      }
      await pool.execute(
        `UPDATE users
         SET account = ?, nickname = ?, auth_token = ?, avatar = ?, coins = ?, level = GREATEST(level, ?), points = GREATEST(points, ?), title_zh = ?, title_en = ?, equipped_title_id = ?, rainbow_pity = 0, is_admin = TRUE, last_login_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          ROOT_USERNAME,
          ROOT_USERNAME,
          token,
          normalizeAvatarCode(existing.avatar, randomAvatarCode()),
          ROOT_COINS,
          ROOT_LEVEL,
          ROOT_POINTS,
          ROOT_TITLE_ZH,
          ROOT_TITLE_EN,
          "daily_champion",
          existing.id,
        ]
      );
    }

    const user = await this.findByLogin(ROOT_USERNAME);
    if (!user) throw new Error("ROOT_CREATE_FAILED");
    return toPublic(user);
  },

  async register(accountInput: string, password: string, nicknameInput?: string): Promise<UserPublic> {
    const account = cleanAccount(accountInput);
    const nickname = cleanNickname(nicknameInput, account);
    if (isRootUsername(account)) return this.ensureRootAccount(password);

    const existing = await this.findByLogin(account);
    if (existing) {
      throw new Error("USERNAME_TAKEN");
    }

    const token = generateToken();
    const hashed = hashPassword(password);
    const [result] = await pool.execute<InsertResult>(
      "INSERT INTO users (username, account, nickname, password, auth_token, avatar, avatar_emoji, equipped_title_id, is_admin) VALUES (?, ?, ?, ?, ?, ?, '', 'newbie', FALSE)",
      [account, account, nickname, hashed, token, randomAvatarCode()]
    );

    const user = await this.findById(result.insertId);
    if (!user) throw new Error("REGISTER_FAILED");
    return toPublic(user);
  },

  async login(accountInput: string, password: string): Promise<UserPublic> {
    const account = cleanAccount(accountInput);
    if (isRootUsername(account)) {
      const existing = await this.findByLogin(ROOT_USERNAME);
      if (!existing) throw new Error("INVALID_CREDENTIALS");
      return this.ensureRootAccount(password);
    }

    let user = await this.findByLogin(account);
    if (!user || !verifyPassword(password, user.password)) {
      throw new Error("INVALID_CREDENTIALS");
    }
    user = await backfillAvatarIfNeeded(user);

    const token = generateToken();
    await pool.execute("UPDATE users SET auth_token = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [
      token,
      user.id,
    ]);
    user.auth_token = token;
    user.last_login_at = new Date().toISOString();

    return toPublic(user);
  },

  async updateProfile(
    id: number,
    data: Partial<Pick<User, "username" | "nickname" | "avatar" | "avatar_emoji">>
  ): Promise<UserPublic | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.username !== undefined) {
      fields.push("nickname = ?");
      values.push(cleanNickname(data.username, "PLAYER"));
    }
    if (data.nickname !== undefined) {
      fields.push("nickname = ?");
      values.push(cleanNickname(data.nickname, "PLAYER"));
    }
    if (data.avatar !== undefined) {
      fields.push("avatar = ?");
      values.push(normalizeAvatarCode(data.avatar, randomAvatarCode()));
    }
    if (data.avatar_emoji !== undefined) {
      fields.push("avatar_emoji = ?");
      values.push(data.avatar_emoji);
    }

    if (fields.length === 0) return null;
    values.push(id);

    await pool.execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    const user = await this.findById(id);
    return user ? toPublic(user) : null;
  },

  async updateStats(
    id: number,
    data: { wins?: number; totalGames?: number; points?: number; coins?: number }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.wins !== undefined) {
      fields.push("wins = wins + ?");
      values.push(data.wins);
    }
    if (data.totalGames !== undefined) {
      fields.push("total_games = total_games + ?");
      values.push(data.totalGames);
    }
    if (data.points !== undefined) {
      fields.push("points = GREATEST(0, points + ?)");
      values.push(data.points);
      fields.push("daily_points = GREATEST(0, daily_points + ?)");
      values.push(data.points);
    }
    if (data.coins !== undefined) {
      fields.push("coins = GREATEST(0, coins + ?)");
      values.push(data.coins);
    }

    if (fields.length === 0) return;
    values.push(id);

    await pool.execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  },

  async syncLevel(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) return;
    const level = Math.floor(Math.sqrt(user.points / 10)) + 1;
    await pool.execute("UPDATE users SET level = ? WHERE id = ?", [level, id]);
  },

  async deductCoins(id: number, amount: number): Promise<boolean> {
    const [result] = await pool.execute<InsertResult>(
      "UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?",
      [amount, id, amount]
    );
    return result.affectedRows > 0;
  },

  async getLeaderboard(limit: number = 20): Promise<UserPublic[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, username, account, nickname, avatar, avatar_emoji, coins, level, wins, total_games, points, daily_points, title_zh, title_en, equipped_title_id, rainbow_pity, is_admin, auth_token FROM users WHERE COALESCE(is_admin, FALSE) = FALSE AND LOWER(username) <> ? AND LOWER(account) <> ? ORDER BY daily_points DESC, points DESC LIMIT ?",
      [ROOT_USERNAME, ROOT_USERNAME, limit]
    );
    const users = rows as User[];
    for (const user of users) {
      if (user.avatar && normalizeAvatarCode(user.avatar) === user.avatar) continue;
      user.avatar = randomAvatarCode();
      await pool.execute("UPDATE users SET avatar = ? WHERE id = ?", [user.avatar, user.id]);
    }
    return users.map(toPublic);
  },
};
