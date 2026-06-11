import { InsertResult, pool, RowDataPacket } from "../connection";
import { ROOT_USERNAME } from "./userRepo";

export type FriendshipStatus = "pending" | "accepted";
export type FriendshipDirection = "incoming" | "outgoing" | "friend";

export interface FriendRow {
  friendshipId: number;
  status: FriendshipStatus;
  direction: FriendshipDirection;
  userId: number;
  account: string;
  nickname: string;
  avatar: string;
  titleZh: string;
  titleEn: string;
  createdAt: string;
  updatedAt: string;
}

function normalizeIdentifier(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function mapFriendRow(row: any, currentUserId: number): FriendRow {
  const status = String(row.status || "pending") as FriendshipStatus;
  const isRequester = Number(row.requester_user_id) === currentUserId;
  const direction: FriendshipDirection = status === "accepted" ? "friend" : isRequester ? "outgoing" : "incoming";
  return {
    friendshipId: Number(row.id),
    status,
    direction,
    userId: Number(row.friend_user_id),
    account: String(row.friend_account || ""),
    nickname: String(row.friend_nickname || row.friend_account || ""),
    avatar: String(row.friend_avatar || ""),
    titleZh: String(row.friend_title_zh || ""),
    titleEn: String(row.friend_title_en || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

async function getFriendshipBetween(userId: number, targetUserId: number): Promise<any | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT *
     FROM user_friendships
     WHERE (requester_user_id = ? AND addressee_user_id = ?)
        OR (requester_user_id = ? AND addressee_user_id = ?)
     LIMIT 1`,
    [userId, targetUserId, targetUserId, userId]
  );
  return rows[0] || null;
}

async function getFriendRowById(userId: number, friendshipId: number): Promise<FriendRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT f.*,
            other_user.id AS friend_user_id,
            other_user.account AS friend_account,
            other_user.nickname AS friend_nickname,
            other_user.avatar AS friend_avatar,
            other_user.title_zh AS friend_title_zh,
            other_user.title_en AS friend_title_en
     FROM user_friendships f
     JOIN users other_user ON other_user.id = CASE
       WHEN f.requester_user_id = ? THEN f.addressee_user_id
       ELSE f.requester_user_id
     END
     WHERE f.id = ? AND (f.requester_user_id = ? OR f.addressee_user_id = ?)
     LIMIT 1`,
    [userId, friendshipId, userId, userId]
  );
  return rows[0] ? mapFriendRow(rows[0], userId) : null;
}

export const friendRepo = {
  async listForUser(userId: number): Promise<FriendRow[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT f.*,
              other_user.id AS friend_user_id,
              other_user.account AS friend_account,
              other_user.nickname AS friend_nickname,
              other_user.avatar AS friend_avatar,
              other_user.title_zh AS friend_title_zh,
              other_user.title_en AS friend_title_en
       FROM user_friendships f
       JOIN users other_user ON other_user.id = CASE
         WHEN f.requester_user_id = ? THEN f.addressee_user_id
         ELSE f.requester_user_id
       END
       WHERE f.requester_user_id = ? OR f.addressee_user_id = ?
       ORDER BY
         CASE
           WHEN f.status = 'pending' AND f.addressee_user_id = ? THEN 0
           WHEN f.status = 'accepted' THEN 1
           ELSE 2
         END,
         f.updated_at DESC`,
      [userId, userId, userId, userId]
    );
    return rows.map((row) => mapFriendRow(row, userId));
  },

  async requestFriend(userId: number, identifier: unknown): Promise<FriendRow> {
    const normalized = normalizeIdentifier(identifier);
    if (!normalized) throw new Error("INVALID_FRIEND_IDENTIFIER");

    const [targets] = await pool.execute<RowDataPacket[]>(
      `SELECT id, account, username
       FROM users
       WHERE (LOWER(account) = ? OR LOWER(username) = ?)
         AND COALESCE(is_admin, FALSE) = FALSE
         AND LOWER(account) <> ?
         AND LOWER(username) <> ?
       LIMIT 1`,
      [normalized, normalized, ROOT_USERNAME, ROOT_USERNAME]
    );
    const target = targets[0] as any;
    if (!target) throw new Error("FRIEND_USER_NOT_FOUND");
    const targetUserId = Number(target.id);
    if (targetUserId === userId) throw new Error("FRIEND_SELF");

    const existing = await getFriendshipBetween(userId, targetUserId);
    if (existing) {
      if (existing.status === "accepted") throw new Error("FRIEND_ALREADY_EXISTS");
      if (Number(existing.addressee_user_id) === userId) {
      await pool.execute(
        "UPDATE user_friendships SET status = 'accepted' WHERE id = ?",
        [existing.id]
      );
        const accepted = await getFriendRowById(userId, Number(existing.id));
        if (!accepted) throw new Error("FRIEND_REQUEST_NOT_FOUND");
        return accepted;
      }
      throw new Error("FRIEND_REQUEST_PENDING");
    }

    const [result] = await pool.execute<InsertResult>(
      `INSERT INTO user_friendships (requester_user_id, addressee_user_id, status)
       VALUES (?, ?, 'pending')`,
      [userId, targetUserId]
    );
    const created = await getFriendRowById(userId, result.insertId);
    if (!created) throw new Error("FRIEND_REQUEST_NOT_FOUND");
    return created;
  },

  async acceptRequest(userId: number, friendshipId: number): Promise<FriendRow> {
    await pool.execute(
      `UPDATE user_friendships
       SET status = 'accepted'
       WHERE id = ? AND addressee_user_id = ? AND status = 'pending'`,
      [friendshipId, userId]
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM user_friendships WHERE id = ? AND (requester_user_id = ? OR addressee_user_id = ?) LIMIT 1",
      [friendshipId, userId, userId]
    );
    const row = rows[0];
    if (!row || row.status !== "accepted") throw new Error("FRIEND_REQUEST_NOT_FOUND");
    const full = await getFriendRowById(userId, friendshipId);
    if (!full) throw new Error("FRIEND_REQUEST_NOT_FOUND");
    return full;
  },

  async rejectRequest(userId: number, friendshipId: number): Promise<void> {
    const [result] = await pool.execute<InsertResult>(
      "DELETE FROM user_friendships WHERE id = ? AND addressee_user_id = ? AND status = 'pending'",
      [friendshipId, userId]
    );
    if (result.affectedRows <= 0) throw new Error("FRIEND_REQUEST_NOT_FOUND");
  },

  async removeFriend(userId: number, friendUserId: number): Promise<void> {
    const [result] = await pool.execute<InsertResult>(
      `DELETE FROM user_friendships
       WHERE status = 'accepted'
         AND ((requester_user_id = ? AND addressee_user_id = ?)
           OR (requester_user_id = ? AND addressee_user_id = ?))`,
      [userId, friendUserId, friendUserId, userId]
    );
    if (result.affectedRows <= 0) throw new Error("FRIEND_NOT_FOUND");
  },
};
