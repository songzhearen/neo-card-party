import { pool, RowDataPacket } from "../connection";
import { TITLES } from "../../cosmetics";

const ADMIN_USER_SELECT = [
  "id",
  "username",
  "account",
  "nickname",
  "avatar",
  "avatar_emoji",
  "coins",
  "level",
  "wins",
  "total_games",
  "points",
  "daily_points",
  "title_zh",
  "title_en",
  "equipped_title_id",
  "rainbow_pity",
  "is_admin",
  "last_login_at",
  "created_at",
  "updated_at",
].join(", ");

function clampInt(value: unknown, min: number, max: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeDateTime(value: unknown): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const localText = text.replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(localText)) {
    return localText.length === 16 ? `${localText}:00` : localText.slice(0, 19);
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_EXPIRES_AT");
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function limitText(value: unknown, fallback: string, max: number): string {
  const text = Array.from(String(value ?? "").trim()).slice(0, max).join("");
  return text || fallback;
}

function normalizeCustomTitleKey(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase().replace(/^title_/i, "");
  const fallback = `ct${Date.now().toString(36).slice(-8)}`;
  const key = (raw || fallback)
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 14);
  if (!/^[a-z0-9][a-z0-9_-]{1,13}$/.test(key)) throw new Error("INVALID_TITLE_KEY");
  if (TITLES.some((title) => title.id === key)) throw new Error("RESERVED_TITLE_KEY");
  return key;
}

export interface AdminUserPatch {
  username?: string;
  account?: string;
  nickname?: string;
  is_admin?: boolean;
  coins?: number;
  level?: number;
  wins?: number;
  total_games?: number;
  points?: number;
  daily_points?: number;
  title_zh?: string;
  title_en?: string;
  rainbow_pity?: number;
  avatar_emoji?: string;
}

export interface AdminCustomTitleGrantInput {
  titleKey?: unknown;
  nameZh: unknown;
  nameEn?: unknown;
  descZh?: unknown;
  descEn?: unknown;
  icon?: unknown;
  equipNow?: boolean;
}

export const adminRepo = {
  async getSummary(): Promise<Record<string, number>> {
    const [userRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS users,
              COALESCE(SUM(coins), 0) AS totalCoins,
              COALESCE(SUM(points), 0) AS totalPoints,
              COALESCE(SUM(daily_points), 0) AS totalDailyPoints,
              COALESCE(SUM(total_games), 0) AS totalGames
       FROM users`
    );
    const [inventoryRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS inventoryRows, COALESCE(SUM(quantity), 0) AS inventoryItems FROM user_inventory"
    );
    const [gameRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS gameRecords FROM game_records"
    );
    const [eventRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS accountEvents FROM account_events"
    );
    const [redeemRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS redeemCodes,
              COALESCE(SUM(used_count), 0) AS redeemUses
       FROM redeem_codes`
    );
    const [mailRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS mailMessages,
              COALESCE(SUM(CASE WHEN claimed_at IS NULL AND (reward_coins > 0 OR reward_item_id IS NOT NULL) THEN 1 ELSE 0 END), 0) AS unclaimedMailRewards
       FROM user_mail`
    );
    const [settlementRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS dailySettlements FROM leaderboard_daily_settlements"
    );

    return {
      users: Number((userRows[0] as any)?.users || 0),
      totalCoins: Number((userRows[0] as any)?.totalCoins || 0),
      totalPoints: Number((userRows[0] as any)?.totalPoints || 0),
      totalDailyPoints: Number((userRows[0] as any)?.totalDailyPoints || 0),
      totalGames: Number((userRows[0] as any)?.totalGames || 0),
      inventoryRows: Number((inventoryRows[0] as any)?.inventoryRows || 0),
      inventoryItems: Number((inventoryRows[0] as any)?.inventoryItems || 0),
      gameRecords: Number((gameRows[0] as any)?.gameRecords || 0),
      accountEvents: Number((eventRows[0] as any)?.accountEvents || 0),
      redeemCodes: Number((redeemRows[0] as any)?.redeemCodes || 0),
      redeemUses: Number((redeemRows[0] as any)?.redeemUses || 0),
      mailMessages: Number((mailRows[0] as any)?.mailMessages || 0),
      unclaimedMailRewards: Number((mailRows[0] as any)?.unclaimedMailRewards || 0),
      dailySettlements: Number((settlementRows[0] as any)?.dailySettlements || 0),
    };
  },

  async listUsers(query: string = "", limit: number = 50): Promise<any[]> {
    const safeLimit = clampInt(limit, 1, 100);
    const q = query.trim();
    if (q) {
      const queryId = /^\d+$/.test(q) ? clampInt(q, 1, 2147483647) : 0;
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${ADMIN_USER_SELECT}
         FROM users
         WHERE id = ? OR username LIKE ? OR account LIKE ? OR nickname LIKE ?
         ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, updated_at DESC
         LIMIT ${safeLimit}`,
        [queryId, `%${q}%`, `%${q}%`, `%${q}%`, queryId]
      );
      return rows;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${ADMIN_USER_SELECT}
       FROM users
       ORDER BY updated_at DESC
       LIMIT ${safeLimit}`
    );
    return rows;
  },

  async updateUser(userId: number, patch: AdminUserPatch): Promise<any | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (patch.username !== undefined) {
      const nickname = String(patch.username).trim();
      if (!nickname) throw new Error("NICKNAME_REQUIRED");
      fields.push("nickname = ?");
      values.push(nickname.slice(0, 50));
    }
    if (patch.account !== undefined) {
      const account = String(patch.account).trim();
      if (!account) throw new Error("ACCOUNT_REQUIRED");
      fields.push("account = ?");
      values.push(account.slice(0, 50));
      fields.push("username = ?");
      values.push(account.slice(0, 50));
    }
    if (patch.nickname !== undefined) {
      const nickname = String(patch.nickname).trim();
      if (!nickname) throw new Error("NICKNAME_REQUIRED");
      fields.push("nickname = ?");
      values.push(nickname.slice(0, 50));
    }
    if (patch.is_admin !== undefined) {
      fields.push("is_admin = ?");
      values.push(Boolean(patch.is_admin));
    }
    if (patch.avatar_emoji !== undefined) {
      fields.push("avatar_emoji = ?");
      values.push(String(patch.avatar_emoji).slice(0, 10));
    }
    if (patch.coins !== undefined) {
      fields.push("coins = ?");
      values.push(clampInt(patch.coins, 0, 2147483647));
    }
    if (patch.level !== undefined) {
      fields.push("level = ?");
      values.push(clampInt(patch.level, 1, 999));
    }
    if (patch.wins !== undefined) {
      fields.push("wins = ?");
      values.push(clampInt(patch.wins, 0, 2147483647));
    }
    if (patch.total_games !== undefined) {
      fields.push("total_games = ?");
      values.push(clampInt(patch.total_games, 0, 2147483647));
    }
    if (patch.points !== undefined) {
      fields.push("points = ?");
      values.push(clampInt(patch.points, 0, 2147483647));
    }
    if (patch.daily_points !== undefined) {
      fields.push("daily_points = ?");
      values.push(clampInt(patch.daily_points, 0, 2147483647));
    }
    if (patch.title_zh !== undefined) {
      fields.push("title_zh = ?");
      values.push(String(patch.title_zh).trim().slice(0, 50) || "新手");
    }
    if (patch.title_en !== undefined) {
      fields.push("title_en = ?");
      values.push(String(patch.title_en).trim().slice(0, 50) || "Newbie");
    }
    if (patch.rainbow_pity !== undefined) {
      fields.push("rainbow_pity = ?");
      values.push(clampInt(patch.rainbow_pity, 0, 999));
    }

    if (fields.length > 0) {
      values.push(userId);
      await pool.execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${ADMIN_USER_SELECT} FROM users WHERE id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async getUserInventory(userId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ui.id,
              ui.user_id,
              ui.item_id,
              ui.quantity,
              ui.is_equipped,
              ui.acquired_at,
              si.type,
              si.icon,
              si.name_zh,
              si.name_en,
              si.price,
              si.stock
       FROM user_inventory ui
       INNER JOIN shop_items si ON si.id = ui.item_id
       WHERE ui.user_id = ?
       ORDER BY ui.acquired_at DESC`,
      [userId]
    );
    return rows;
  },

  async grantItem(userId: number, itemId: string, quantity: number = 1): Promise<void> {
    const normalizedItemId = String(itemId || "").trim();
    const safeQuantity = clampInt(quantity, 1, 9999);
    const [items] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM shop_items WHERE id = ?",
      [normalizedItemId]
    );
    if (!items.length) throw new Error("ITEM_NOT_FOUND");

    await pool.execute(
      `INSERT INTO user_inventory (user_id, item_id, quantity, is_equipped)
       VALUES (?, ?, ?, FALSE)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, normalizedItemId, safeQuantity]
    );
  },

  async grantCustomTitle(userId: number, input: AdminCustomTitleGrantInput): Promise<{ item: any; inventory: any[]; user: any | null; equipped: boolean }> {
    const titleKey = normalizeCustomTitleKey(input.titleKey);
    const itemId = `title_${titleKey}`;
    const nameZh = limitText(input.nameZh, "", 50);
    if (!nameZh) throw new Error("INVALID_CUSTOM_TITLE");
    const nameEn = limitText(input.nameEn, nameZh, 50);
    const descZh = limitText(input.descZh, "GM 专属发放称号。", 100);
    const descEn = limitText(input.descEn, "Exclusive GM-granted title.", 100);
    const icon = limitText(input.icon, "★", 10);
    const equipped = Boolean(input.equipNow);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [users] = await conn.execute<RowDataPacket[]>(
        "SELECT id FROM users WHERE id = ? FOR UPDATE",
        [userId]
      );
      if (!users.length) throw new Error("USER_NOT_FOUND");

      const [existingItems] = await conn.execute<RowDataPacket[]>(
        "SELECT id, type FROM shop_items WHERE id = ?",
        [itemId]
      );
      if (existingItems.length && existingItems[0].type !== "title") {
        throw new Error("ITEM_ID_CONFLICT");
      }

      await conn.execute(
        `INSERT INTO shop_items (id, type, icon, name_zh, name_en, desc_zh, desc_en, price, stock)
         VALUES (?, 'title', ?, ?, ?, ?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE icon = VALUES(icon), name_zh = VALUES(name_zh),
           name_en = VALUES(name_en), desc_zh = VALUES(desc_zh), desc_en = VALUES(desc_en),
           price = 0, stock = 0`,
        [itemId, icon, nameZh, nameEn, descZh, descEn]
      );

      await conn.execute(
        `INSERT INTO user_inventory (user_id, item_id, quantity, is_equipped)
         VALUES (?, ?, 1, FALSE)
         ON DUPLICATE KEY UPDATE quantity = GREATEST(quantity, 1)`,
        [userId, itemId]
      );

      if (equipped) {
        await conn.execute(
          `UPDATE user_inventory
           SET is_equipped = FALSE
           WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = 'title')`,
          [userId]
        );
        await conn.execute(
          "UPDATE user_inventory SET is_equipped = TRUE WHERE user_id = ? AND item_id = ?",
          [userId, itemId]
        );
        await conn.execute(
          "UPDATE users SET title_zh = ?, title_en = ?, equipped_title_id = ? WHERE id = ?",
          [nameZh, nameEn, titleKey, userId]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [items] = await pool.execute<RowDataPacket[]>("SELECT * FROM shop_items WHERE id = ?", [itemId]);
    const [users] = await pool.execute<RowDataPacket[]>(`SELECT ${ADMIN_USER_SELECT} FROM users WHERE id = ?`, [userId]);
    return {
      item: items[0] || { id: itemId, type: "title", icon, name_zh: nameZh, name_en: nameEn, desc_zh: descZh, desc_en: descEn, price: 0, stock: 0 },
      inventory: await this.getUserInventory(userId),
      user: users[0] || null,
      equipped,
    };
  },

  async listShopItems(): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM shop_items ORDER BY FIELD(type, 'accessory', 'emoji', 'title', 'cardback'), id ASC"
    );
    return rows;
  },

  async listRedeemCodes(limit: number = 100): Promise<any[]> {
    const safeLimit = clampInt(limit, 1, 200);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rc.id,
              rc.code,
              rc.reward_coins,
              rc.reward_item_id,
              rc.reward_quantity,
              rc.is_active,
              rc.expires_at,
              rc.max_uses,
              rc.used_count,
              rc.created_at,
              si.name_zh AS reward_item_name_zh,
              si.name_en AS reward_item_name_en,
              COALESCE(stats.uses_24h, 0) AS uses_24h,
              COALESCE(stats.uses_7d, 0) AS uses_7d,
              stats.last_redeemed_at,
              last_ur.user_id AS last_user_id,
              last_user.account AS last_user_account,
              last_user.username AS last_user_username,
              last_user.nickname AS last_user_nickname
       FROM redeem_codes rc
       LEFT JOIN shop_items si ON si.id = rc.reward_item_id
       LEFT JOIN (
         SELECT code,
                SUM(CASE WHEN redeemed_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS uses_24h,
                SUM(CASE WHEN redeemed_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS uses_7d,
                MAX(redeemed_at) AS last_redeemed_at
         FROM user_redeems
         GROUP BY code
       ) stats ON stats.code = rc.code
       LEFT JOIN user_redeems last_ur ON last_ur.id = (
         SELECT ur2.id
         FROM user_redeems ur2
         WHERE ur2.code = rc.code
         ORDER BY ur2.redeemed_at DESC, ur2.id DESC
         LIMIT 1
       )
       LEFT JOIN users last_user ON last_user.id = last_ur.user_id
       ORDER BY rc.created_at DESC
       LIMIT ${safeLimit}`
    );
    return rows;
  },

  async getUserRedeems(userId: number, limit: number = 20): Promise<any[]> {
    const safeLimit = clampInt(limit, 1, 100);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ur.id,
              ur.user_id,
              ur.code,
              ur.redeemed_at,
              COALESCE(ur.reward_coins, rc.reward_coins, 0) AS reward_coins,
              COALESCE(ur.reward_item_id, rc.reward_item_id) AS reward_item_id,
              COALESCE(ur.reward_quantity, rc.reward_quantity, 0) AS reward_quantity,
              si.name_zh AS reward_item_name_zh,
              si.name_en AS reward_item_name_en
       FROM user_redeems ur
       LEFT JOIN redeem_codes rc ON rc.code = ur.code
       LEFT JOIN shop_items si ON si.id = COALESCE(ur.reward_item_id, rc.reward_item_id)
       WHERE ur.user_id = ?
       ORDER BY ur.redeemed_at DESC
       LIMIT ${safeLimit}`,
      [userId]
    );
    return rows;
  },

  async getRedeemCodeUses(
    codeId: number,
    page: number = 1,
    pageSize: number = 30
  ): Promise<{ code: any; uses: any[]; total: number; page: number; pageSize: number }> {
    const safeId = clampInt(codeId, 1, 2147483647);
    const safePageSize = clampInt(pageSize, 1, 100);
    const safePage = clampInt(page, 1, 2147483647);
    const offset = (safePage - 1) * safePageSize;
    const [codeRows] = await pool.execute<RowDataPacket[]>(
      `SELECT rc.id,
              rc.code,
              rc.reward_coins,
              rc.reward_item_id,
              rc.reward_quantity,
              rc.is_active,
              rc.expires_at,
              rc.max_uses,
              rc.used_count,
              rc.created_at,
              si.name_zh AS reward_item_name_zh,
              si.name_en AS reward_item_name_en
       FROM redeem_codes rc
       LEFT JOIN shop_items si ON si.id = rc.reward_item_id
       WHERE rc.id = ?
       LIMIT 1`,
      [safeId]
    );
    const code = codeRows[0] || null;
    if (!code) throw new Error("REDEEM_CODE_NOT_FOUND");

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM user_redeems ur
       INNER JOIN redeem_codes rc ON rc.code = ur.code
       WHERE rc.id = ?`,
      [safeId]
    );

    const [uses] = await pool.execute<RowDataPacket[]>(
      `SELECT ur.id,
              ur.user_id,
              ur.code,
              ur.redeemed_at,
              COALESCE(ur.reward_coins, rc.reward_coins, 0) AS reward_coins,
              COALESCE(ur.reward_item_id, rc.reward_item_id) AS reward_item_id,
              COALESCE(ur.reward_quantity, rc.reward_quantity, 0) AS reward_quantity,
              u.account,
              u.username,
              u.nickname,
              u.avatar,
              si.name_zh AS reward_item_name_zh,
              si.name_en AS reward_item_name_en
       FROM user_redeems ur
       INNER JOIN redeem_codes rc ON rc.code = ur.code
       LEFT JOIN users u ON u.id = ur.user_id
       LEFT JOIN shop_items si ON si.id = COALESCE(ur.reward_item_id, rc.reward_item_id)
       WHERE rc.id = ?
       ORDER BY ur.redeemed_at DESC, ur.id DESC
       LIMIT ${safePageSize} OFFSET ${offset}`,
      [safeId]
    );

    return {
      code,
      uses,
      total: Number((countRows[0] as any)?.total || 0),
      page: safePage,
      pageSize: safePageSize,
    };
  },

  async createRedeemCode(data: {
    code: string;
    rewardCoins?: number;
    rewardItemId?: string | null;
    rewardQuantity?: number;
    isActive?: boolean;
    expiresAt?: string | null;
    maxUses?: number;
  }): Promise<any> {
    const code = normalizeCode(data.code);
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new Error("INVALID_CODE");

    const rewardCoins = clampInt(data.rewardCoins, 0, 2147483647);
    const maxUses = clampInt(data.maxUses ?? 1, 0, 2147483647);
    const rewardItemId = data.rewardItemId ? String(data.rewardItemId).trim() : null;
    const rewardQuantity = rewardItemId ? clampInt(data.rewardQuantity ?? 1, 1, 9999) : 0;
    const isActive = data.isActive !== false;
    const expiresAt = normalizeDateTime(data.expiresAt);

    if (rewardItemId) {
      const [items] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM shop_items WHERE id = ?",
        [rewardItemId]
      );
      if (!items.length) throw new Error("ITEM_NOT_FOUND");
    }

    await pool.execute(
      `INSERT INTO redeem_codes (code, reward_coins, reward_item_id, reward_quantity, is_active, expires_at, max_uses)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, rewardCoins, rewardItemId, rewardQuantity, isActive, expiresAt, maxUses]
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM redeem_codes WHERE code = ?",
      [code]
    );
    return rows[0];
  },

  async setRedeemCodeActive(id: number, isActive: boolean): Promise<any> {
    const safeId = clampInt(id, 1, 2147483647);
    await pool.execute(
      "UPDATE redeem_codes SET is_active = ? WHERE id = ?",
      [Boolean(isActive), safeId]
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rc.*,
              si.name_zh AS reward_item_name_zh,
              si.name_en AS reward_item_name_en
       FROM redeem_codes rc
       LEFT JOIN shop_items si ON si.id = rc.reward_item_id
       WHERE rc.id = ?
       LIMIT 1`,
      [safeId]
    );
    if (!rows.length) throw new Error("REDEEM_CODE_NOT_FOUND");
    return rows[0];
  },
};
