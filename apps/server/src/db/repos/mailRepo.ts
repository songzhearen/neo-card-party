import { randomBytes } from "crypto";
import { pool, RowDataPacket, InsertResult } from "../connection";
import { ROOT_USERNAME } from "./userRepo";

export interface MailCreateInput {
  userId: number;
  senderUserId?: number | null;
  title: string;
  body: string;
  rewardCoins?: number;
  rewardItemId?: string | null;
  rewardQuantity?: number;
  expiresAt?: string | null;
}

export interface MailBroadcastInput extends Omit<MailCreateInput, "userId"> {}

export interface MailClaimResult {
  mail: any;
  coins: number;
  deltaCoins: number;
  itemId: string | null;
  quantity: number;
}

export interface MailBroadcastResult {
  batchId: string;
  sent: number;
}

const MAIL_SELECT = `
  SELECT m.id,
         m.user_id,
         m.sender_user_id,
         m.title,
         m.body,
         m.reward_coins,
         m.reward_item_id,
         m.reward_quantity,
         m.batch_id,
         m.is_read,
         m.claimed_at,
         m.expires_at,
         m.created_at,
         si.icon AS reward_item_icon,
         si.name_zh AS reward_item_name_zh,
         si.name_en AS reward_item_name_en,
         sender.account AS sender_account,
         sender.nickname AS sender_nickname
  FROM user_mail m
  LEFT JOIN shop_items si ON si.id = m.reward_item_id
  LEFT JOIN users sender ON sender.id = m.sender_user_id
`;

function clampInt(value: unknown, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "").trim().slice(0, maxLength);
}

function paging(page: unknown, pageSize: unknown): { page: number; pageSize: number; offset: number } {
  const safePageSize = clampInt(pageSize ?? 30, 1, 100);
  const safePage = clampInt(page ?? 1, 1, 2147483647);
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize };
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

function createMailBatchId(): string {
  return `mail_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function normalizeMailInput<T extends Partial<MailCreateInput>>(input: T): T & {
  title: string;
  body: string;
  rewardCoins: number;
  rewardItemId: string | null;
  rewardQuantity: number;
  expiresAt: string | null;
} {
  const title = cleanText(input.title, 80);
  if (!title) throw new Error("INVALID_MAIL");
  const rewardItemId = input.rewardItemId ? cleanText(input.rewardItemId, 20) : null;
  return {
    ...input,
    title,
    body: cleanText(input.body, 500),
    rewardCoins: clampInt(input.rewardCoins, 0, 2147483647),
    rewardItemId,
    rewardQuantity: rewardItemId ? clampInt(input.rewardQuantity ?? 1, 1, 9999) : 0,
    expiresAt: normalizeDateTime(input.expiresAt),
  };
}

async function ensureRewardItemExists(itemId: string | null): Promise<void> {
  if (!itemId) return;
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT id FROM shop_items WHERE id = ?", [itemId]);
  if (!rows.length) throw new Error("ITEM_NOT_FOUND");
}

async function selectMailForUser(userId: number, mailId: number): Promise<any | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `${MAIL_SELECT}
     WHERE m.user_id = ? AND m.id = ?
     LIMIT 1`,
    [userId, mailId]
  );
  return rows[0] || null;
}

export const mailRepo = {
  async listRecentForAdmin(page: number = 1, pageSize: number = 30, status: string = "all"): Promise<any> {
    const safe = paging(page, pageSize);
    const normalizedStatus = cleanText(status, 20);
    const havingByStatus: Record<string, string> = {
      unread: "HAVING unread_count > 0",
      unclaimed: "HAVING unclaimed_count > 0",
      claimed: "HAVING claimed_count > 0",
      expired: "HAVING expired_count > 0",
    };
    const having = havingByStatus[normalizedStatus] || "";
    const groupedMailSql = `
      SELECT MIN(m.id) AS id,
             MIN(m.user_id) AS sample_user_id,
             COALESCE(MIN(m.batch_id), CONCAT('legacy_', MIN(m.id))) AS batch_id,
             m.sender_user_id,
             m.title,
             m.body,
             m.reward_coins,
             m.reward_item_id,
             m.reward_quantity,
             m.expires_at,
             m.created_at,
             COUNT(*) AS recipients,
             SUM(CASE WHEN m.is_read = FALSE THEN 1 ELSE 0 END) AS unread_count,
             SUM(CASE WHEN m.claimed_at IS NOT NULL THEN 1 ELSE 0 END) AS claimed_count,
             SUM(CASE WHEN (m.reward_coins > 0 OR m.reward_item_id IS NOT NULL) THEN 1 ELSE 0 END) AS reward_count,
             SUM(CASE
                   WHEN (m.reward_coins > 0 OR m.reward_item_id IS NOT NULL)
                    AND m.claimed_at IS NULL
                    AND (m.expires_at IS NULL OR m.expires_at >= CURRENT_TIMESTAMP)
                   THEN 1 ELSE 0
                 END) AS unclaimed_count,
             SUM(CASE WHEN m.expires_at IS NOT NULL AND m.expires_at < CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS expired_count,
             si.icon AS reward_item_icon,
             si.name_zh AS reward_item_name_zh,
             si.name_en AS reward_item_name_en,
             sender.account AS sender_account,
             sender.nickname AS sender_nickname
      FROM user_mail m
      LEFT JOIN shop_items si ON si.id = m.reward_item_id
      LEFT JOIN users sender ON sender.id = m.sender_user_id
      GROUP BY
        m.batch_id,
        m.sender_user_id,
        m.title,
        m.body,
        m.reward_coins,
        m.reward_item_id,
        m.reward_quantity,
        m.expires_at,
        m.created_at,
        si.icon,
        si.name_zh,
        si.name_en,
        sender.account,
        sender.nickname
      ${having}
    `;
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM (${groupedMailSql}) grouped_mail`
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      `${groupedMailSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ${safe.pageSize} OFFSET ${safe.offset}`
    );
    const mappedRows = rows.map((row: any) => ({
      ...row,
      id: Number(row.id || 0),
      recipients: Number(row.recipients || 1),
      unread_count: Number(row.unread_count || 0),
      claimed_count: Number(row.claimed_count || 0),
      reward_count: Number(row.reward_count || 0),
      unclaimed_count: Number(row.unclaimed_count || 0),
      expired_count: Number(row.expired_count || 0),
    }));
    return {
      rows: mappedRows,
      total: Number((countRows[0] as any)?.total || 0),
      page: safe.page,
      pageSize: safe.pageSize,
    };
  },

  async listForUser(userId: number, limit: number = 50): Promise<any[]> {
    const safeLimit = clampInt(limit, 1, 100);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `${MAIL_SELECT}
       WHERE m.user_id = ?
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${safeLimit}`,
      [userId]
    );
    return rows;
  },

  async unreadCount(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS unread FROM user_mail WHERE user_id = ? AND is_read = FALSE",
      [userId]
    );
    return Number((rows[0] as any)?.unread || 0);
  },

  async createForUser(input: MailCreateInput): Promise<any> {
    const normalized = normalizeMailInput(input);
    await ensureRewardItemExists(normalized.rewardItemId);

    const [users] = await pool.execute<RowDataPacket[]>("SELECT id FROM users WHERE id = ?", [input.userId]);
    if (!users.length) throw new Error("USER_NOT_FOUND");

    const [result] = await pool.execute<InsertResult>(
      `INSERT INTO user_mail
        (user_id, sender_user_id, title, body, reward_coins, reward_item_id, reward_quantity, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        normalized.senderUserId ?? null,
        normalized.title,
        normalized.body,
        normalized.rewardCoins,
        normalized.rewardItemId,
        normalized.rewardQuantity,
        normalized.expiresAt,
      ]
    );

    return selectMailForUser(input.userId, result.insertId);
  },

  async createForAllPlayers(input: MailBroadcastInput): Promise<MailBroadcastResult> {
    const normalized = normalizeMailInput(input);
    await ensureRewardItemExists(normalized.rewardItemId);
    const batchId = createMailBatchId();

    const [result] = await pool.execute<InsertResult>(
      `INSERT INTO user_mail
        (user_id, sender_user_id, title, body, reward_coins, reward_item_id, reward_quantity, batch_id, expires_at)
       SELECT id, ?, ?, ?, ?, ?, ?, ?, ?
       FROM users
       WHERE COALESCE(is_admin, FALSE) = FALSE
         AND LOWER(username) <> ?
         AND LOWER(account) <> ?`,
      [
        normalized.senderUserId ?? null,
        normalized.title,
        normalized.body,
        normalized.rewardCoins,
        normalized.rewardItemId,
        normalized.rewardQuantity,
        batchId,
        normalized.expiresAt,
        ROOT_USERNAME,
        ROOT_USERNAME,
      ]
    );

    return { batchId, sent: result.affectedRows };
  },

  async markRead(userId: number, mailId: number): Promise<any | null> {
    await pool.execute(
      "UPDATE user_mail SET is_read = TRUE WHERE id = ? AND user_id = ?",
      [mailId, userId]
    );
    return selectMailForUser(userId, mailId);
  },

  async claim(userId: number, mailId: number): Promise<MailClaimResult> {
    const conn = await pool.getConnection();
    let coins = 0;
    let deltaCoins = 0;
    let itemId: string | null = null;
    let quantity = 0;

    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT m.*, si.id AS reward_item_exists
         FROM user_mail m
         LEFT JOIN shop_items si ON si.id = m.reward_item_id
         WHERE m.id = ? AND m.user_id = ?
         FOR UPDATE`,
        [mailId, userId]
      );
      const mail = rows[0] as any;
      if (!mail) throw new Error("MAIL_NOT_FOUND");
      if (mail.claimed_at) throw new Error("MAIL_ALREADY_CLAIMED");
      if (mail.expires_at && new Date(mail.expires_at).getTime() < Date.now()) {
        throw new Error("MAIL_EXPIRED");
      }

      deltaCoins = clampInt(mail.reward_coins, 0, 2147483647);
      itemId = mail.reward_item_id ? String(mail.reward_item_id) : null;
      quantity = itemId ? clampInt(mail.reward_quantity, 1, 9999) : 0;

      if (itemId && !mail.reward_item_exists) throw new Error("ITEM_NOT_FOUND");

      if (deltaCoins > 0) {
        await conn.execute(
          "UPDATE users SET coins = LEAST(2147483647, coins + ?) WHERE id = ?",
          [deltaCoins, userId]
        );
      }

      if (itemId && quantity > 0) {
        await conn.execute(
          `INSERT INTO user_inventory (user_id, item_id, quantity, is_equipped)
           VALUES (?, ?, ?, FALSE)
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
          [userId, itemId, quantity]
        );
      }

      await conn.execute(
        "UPDATE user_mail SET is_read = TRUE, claimed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [mailId, userId]
      );

      const [userRows] = await conn.execute<RowDataPacket[]>(
        "SELECT coins FROM users WHERE id = ?",
        [userId]
      );
      coins = Number((userRows[0] as any)?.coins || 0);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const mail = await selectMailForUser(userId, mailId);
    return { mail, coins, deltaCoins, itemId, quantity };
  },
};
