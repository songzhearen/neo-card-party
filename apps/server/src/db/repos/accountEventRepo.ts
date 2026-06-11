import { pool, RowDataPacket } from "../connection";

export interface AccountEventInput {
  userId?: number | null;
  actorUserId?: number | null;
  type: string;
  deltaCoins?: number;
  itemId?: string | null;
  quantity?: number;
  metadata?: Record<string, unknown> | null;
}

export interface AccountEventFilters {
  type?: string;
  actorUserId?: number | null;
  targetUserId?: number | null;
}

function clampText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function clampInt(value: unknown, min: number, max: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function paging(page: unknown, pageSize: unknown): { page: number; pageSize: number; offset: number } {
  const safePageSize = clampInt(pageSize ?? 30, 1, 100);
  const safePage = clampInt(page ?? 1, 1, 2147483647);
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize };
}

function buildAuditWhere(filters: AccountEventFilters = {}): { where: string; params: Array<string | number> } {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  const type = clampText(filters.type, 40);
  const actorUserId = filters.actorUserId ? clampInt(filters.actorUserId, 1, 2147483647) : 0;
  const targetUserId = filters.targetUserId ? clampInt(filters.targetUserId, 1, 2147483647) : 0;

  if (type) {
    conditions.push("ae.type = ?");
    params.push(type);
  }
  if (actorUserId) {
    conditions.push("ae.actor_user_id = ?");
    params.push(actorUserId);
  }
  if (targetUserId) {
    conditions.push("ae.user_id = ?");
    params.push(targetUserId);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export const accountEventRepo = {
  async create(event: AccountEventInput): Promise<void> {
    const type = clampText(event.type, 40);
    if (!type) return;

    await pool.execute(
      `INSERT INTO account_events
        (user_id, actor_user_id, type, delta_coins, item_id, quantity, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.userId ?? null,
        event.actorUserId ?? null,
        type,
        Math.trunc(Number(event.deltaCoins) || 0),
        event.itemId ? clampText(event.itemId, 50) : null,
        Math.trunc(Number(event.quantity) || 0),
        event.metadata ? JSON.stringify(event.metadata).slice(0, 4000) : null,
      ]
    );
  },

  async listForUser(userId: number, page: number = 1, pageSize: number = 30): Promise<any> {
    const safe = paging(page, pageSize);
    const [countRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM account_events WHERE user_id = ?",
      [userId]
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ae.id,
              ae.user_id,
              ae.actor_user_id,
              ae.type,
              ae.delta_coins,
              ae.item_id,
              ae.quantity,
              ae.metadata_json,
              ae.created_at,
              COALESCE(actor.nickname, actor.username) AS actor_username,
              actor.account AS actor_account
       FROM account_events ae
       LEFT JOIN users actor ON actor.id = ae.actor_user_id
       WHERE ae.user_id = ?
       ORDER BY ae.created_at DESC, ae.id DESC
       LIMIT ${safe.pageSize} OFFSET ${safe.offset}`,
      [userId]
    );
    return { rows, total: Number((countRows[0] as any)?.total || 0), page: safe.page, pageSize: safe.pageSize };
  },

  async listRecent(page: number = 1, pageSize: number = 30, filters: AccountEventFilters = {}): Promise<any> {
    const safe = paging(page, pageSize);
    const filter = buildAuditWhere(filters);
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM account_events ae
       ${filter.where}`,
      filter.params
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ae.id,
              ae.user_id AS target_user_id,
              ae.actor_user_id,
              ae.type,
              ae.delta_coins,
              ae.item_id,
              ae.quantity,
              ae.metadata_json,
              ae.created_at,
              COALESCE(target.nickname, target.username) AS target_username,
              target.account AS target_account,
              COALESCE(actor.nickname, actor.username) AS actor_username,
              actor.account AS actor_account
       FROM account_events ae
       LEFT JOIN users target ON target.id = ae.user_id
       LEFT JOIN users actor ON actor.id = ae.actor_user_id
       ${filter.where}
       ORDER BY ae.created_at DESC, ae.id DESC
       LIMIT ${safe.pageSize} OFFSET ${safe.offset}`,
      filter.params
    );
    return { rows, total: Number((countRows[0] as any)?.total || 0), page: safe.page, pageSize: safe.pageSize };
  },
};
