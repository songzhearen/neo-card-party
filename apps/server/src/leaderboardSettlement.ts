import { pool, RowDataPacket, InsertResult } from "./db/connection";
import { getTitle, titleItemId } from "./cosmetics";
import { ROOT_USERNAME } from "./db/repos/userRepo";

interface DailyReward {
  rank: number;
  coins: number;
  itemId: string | null;
  quantity: number;
}

interface SettlementOptions {
  settlementDate?: string;
  triggeredByUserId?: number | null;
}

export interface DailySettlementResult {
  alreadySettled: boolean;
  settlement: any;
  entries: any[];
}

const DAILY_CHAMPION_TITLE_ID = "daily_champion";
const DAILY_CHAMPION_ITEM_ID = titleItemId(DAILY_CHAMPION_TITLE_ID);

const DAILY_REWARDS: DailyReward[] = [
  { rank: 1, coins: 1000, itemId: DAILY_CHAMPION_ITEM_ID, quantity: 1 },
  { rank: 2, coins: 600, itemId: null, quantity: 0 },
  { rank: 3, coins: 300, itemId: null, quantity: 0 },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function previousLocalDateKey(date: Date = new Date()): string {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return localDateKey(previous);
}

function normalizeSettlementDate(value?: string): string {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return localDateKey();
}

function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 5, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

async function ensureDailyChampionItem(conn: any): Promise<void> {
  const title = getTitle(DAILY_CHAMPION_TITLE_ID);
  await conn.execute(
    `INSERT INTO shop_items (id, type, icon, name_zh, name_en, desc_zh, desc_en, price, stock)
     VALUES (?, 'title', ?, ?, ?, ?, ?, 0, 0)
     ON DUPLICATE KEY UPDATE type = VALUES(type), icon = VALUES(icon), name_zh = VALUES(name_zh), name_en = VALUES(name_en),
       desc_zh = VALUES(desc_zh), desc_en = VALUES(desc_en), stock = VALUES(stock)`,
    [DAILY_CHAMPION_ITEM_ID, "\u2605", title.nameZh, title.nameEn, title.descZh, title.descEn]
  );
}

async function hydrateSettlement(settlement: any): Promise<DailySettlementResult> {
  const [entries] = await pool.execute<RowDataPacket[]>(
    `SELECT e.*,
            u.account,
            u.nickname,
            u.avatar
     FROM leaderboard_daily_entries e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.settlement_id = ?
     ORDER BY e.rank_no ASC`,
    [settlement.id]
  );
  return { alreadySettled: false, settlement, entries };
}

export async function getDailyLeaderboardSettlement(date: string): Promise<DailySettlementResult | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*,
            top_user.account AS top_account,
            top_user.nickname AS top_nickname,
            actor.account AS triggered_by_account
     FROM leaderboard_daily_settlements s
     LEFT JOIN users top_user ON top_user.id = s.top_user_id
     LEFT JOIN users actor ON actor.id = s.triggered_by_user_id
     WHERE s.settlement_date = ?
     LIMIT 1`,
    [date]
  );
  const settlement = rows[0];
  if (!settlement) return null;
  return hydrateSettlement(settlement);
}

export async function listDailyLeaderboardSettlements(limit: number = 10): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(30, Math.trunc(Number(limit) || 10)));
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*,
            top_user.account AS top_account,
            top_user.nickname AS top_nickname,
            actor.account AS triggered_by_account
     FROM leaderboard_daily_settlements s
     LEFT JOIN users top_user ON top_user.id = s.top_user_id
     LEFT JOIN users actor ON actor.id = s.triggered_by_user_id
     ORDER BY s.settlement_date DESC
     LIMIT ${safeLimit}`
  );

  return Promise.all(rows.map(async (row) => {
    const result = await hydrateSettlement(row);
    return { ...result.settlement, entries: result.entries };
  }));
}

export async function settleDailyLeaderboard(options: SettlementOptions = {}): Promise<DailySettlementResult> {
  const settlementDate = normalizeSettlementDate(options.settlementDate);
  const triggeredByUserId = options.triggeredByUserId ?? null;
  const existing = await getDailyLeaderboardSettlement(settlementDate);
  if (existing) return { ...existing, alreadySettled: true };

  const conn = await pool.getConnection();
  let settlementId = 0;

  try {
    await conn.beginTransaction();
    await ensureDailyChampionItem(conn);

    const [playerCountRows] = await conn.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS player_count
       FROM users
       WHERE COALESCE(is_admin, FALSE) = FALSE
         AND LOWER(username) <> ?
         AND LOWER(account) <> ?
         AND daily_points > 0`,
      [ROOT_USERNAME, ROOT_USERNAME]
    );
    const playerCount = Number((playerCountRows[0] as any)?.player_count || 0);

    const [winnerRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, account, nickname, daily_points
       FROM users
       WHERE COALESCE(is_admin, FALSE) = FALSE
         AND LOWER(username) <> ?
         AND LOWER(account) <> ?
         AND daily_points > 0
       ORDER BY daily_points DESC, points DESC, id ASC
       LIMIT 3
       FOR UPDATE`,
      [ROOT_USERNAME, ROOT_USERNAME]
    );
    const winners = winnerRows as any[];
    const top = winners[0] || null;

    const [settlementResult] = await conn.execute<InsertResult>(
      `INSERT INTO leaderboard_daily_settlements
        (settlement_date, player_count, rewards_sent, top_user_id, top_points, triggered_by_user_id)
       VALUES (?, ?, 0, ?, ?, ?)`,
      [settlementDate, playerCount, top?.id ?? null, top?.daily_points ?? 0, triggeredByUserId]
    );
    settlementId = settlementResult.insertId;
    const rewardBatchId = `leaderboard_daily_${settlementDate.replace(/-/g, "")}_${settlementId}`;

    let rewardsSent = 0;
    for (let index = 0; index < winners.length; index++) {
      const winner = winners[index];
      const reward = DAILY_REWARDS[index] || DAILY_REWARDS[DAILY_REWARDS.length - 1];
      const title = `\u6bcf\u65e5\u6392\u884c\u699c\u7b2c ${reward.rank} \u540d`;
      const body = `\u4f60\u5728 ${settlementDate} \u7684\u6bcf\u65e5\u6392\u884c\u699c\u4e2d\u83b7\u5f97\u7b2c ${reward.rank} \u540d\uff0c\u5956\u52b1\u5df2\u968f\u90ae\u4ef6\u53d1\u653e\u3002`;
      const [mailResult] = await conn.execute<InsertResult>(
        `INSERT INTO user_mail
          (user_id, sender_user_id, title, body, reward_coins, reward_item_id, reward_quantity, batch_id)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
        [winner.id, title, body, reward.coins, reward.itemId, reward.quantity, rewardBatchId]
      );
      const mailId = mailResult.insertId;

      await conn.execute(
        `INSERT INTO leaderboard_daily_entries
          (settlement_id, user_id, rank_no, nickname, daily_points, reward_coins, reward_item_id, reward_quantity, mail_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          settlementId,
          winner.id,
          reward.rank,
          winner.nickname || winner.account || `Player ${winner.id}`,
          winner.daily_points,
          reward.coins,
          reward.itemId,
          reward.quantity,
          mailId,
        ]
      );

      await conn.execute(
        `INSERT INTO account_events
          (user_id, actor_user_id, type, delta_coins, item_id, quantity, metadata_json)
         VALUES (?, NULL, 'leaderboard_reward', ?, ?, ?, ?)`,
        [
          winner.id,
          reward.coins,
          reward.itemId,
          reward.quantity,
          JSON.stringify({
            settlementDate,
            settlementId,
            rewardBatchId,
            rank: reward.rank,
            dailyPoints: winner.daily_points,
            mailId,
          }).slice(0, 4000),
        ]
      );

      rewardsSent += 1;
    }

    await conn.execute(
      "UPDATE leaderboard_daily_settlements SET rewards_sent = ? WHERE id = ?",
      [rewardsSent, settlementId]
    );
    await conn.execute(
      `UPDATE users
       SET daily_points = 0
       WHERE COALESCE(is_admin, FALSE) = FALSE
         AND LOWER(username) <> ?
         AND LOWER(account) <> ?`,
      [ROOT_USERNAME, ROOT_USERNAME]
    );

    await conn.commit();
  } catch (err: any) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY") {
      const duplicate = await getDailyLeaderboardSettlement(settlementDate);
      if (duplicate) return { ...duplicate, alreadySettled: true };
    }
    throw err;
  } finally {
    conn.release();
  }

  const result = await getDailyLeaderboardSettlement(settlementDate);
  if (!result) throw new Error("SETTLEMENT_NOT_FOUND");
  return { ...result, alreadySettled: false };
}

let settlementTimer: NodeJS.Timeout | null = null;

export function startDailyLeaderboardScheduler(): void {
  if (process.env.LEADERBOARD_AUTO_SETTLE === "false") {
    console.log("[Leaderboard] Auto settlement disabled");
    return;
  }
  if (settlementTimer) return;

  const scheduleNext = () => {
    const delay = msUntilNextLocalMidnight();
    settlementTimer = setTimeout(async () => {
      settlementTimer = null;
      const settlementDate = previousLocalDateKey();
      try {
        const result = await settleDailyLeaderboard({ settlementDate });
        console.log(`[Leaderboard] Daily settlement ${settlementDate}: ${result.entries.length} rewards`);
      } catch (err: any) {
        console.warn("[Leaderboard] Daily settlement failed:", err?.message || err);
      } finally {
        scheduleNext();
      }
    }, delay);
    settlementTimer.unref?.();
    console.log(`[Leaderboard] Next daily settlement scheduled in ${Math.ceil(delay / 1000)}s`);
  };

  scheduleNext();
}
