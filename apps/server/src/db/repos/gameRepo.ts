import { pool, RowDataPacket, InsertResult } from "../connection";

export interface GameRecord {
  id: number;
  room_id: string;
  player_count: number;
  winner_user_id: number | null;
  winner_name: string;
  winner_score: number;
  ended_at: string;
}

export interface GamePlayerRecord {
  id: number;
  game_id: number;
  user_id: number | null;
  player_name: string;
  cards_remaining: number;
  points: number;
  color: string;
}

export const gameRepo = {
  async createRecord(data: {
    room_id: string;
    player_count: number;
    winner_user_id: number | null;
    winner_name: string;
    winner_score: number;
    players: Array<{
      user_id: number | null;
      player_name: string;
      cards_remaining: number;
      points: number;
      color: string;
    }>;
  }): Promise<number> {
    const [result] = await pool.execute<InsertResult>(
      "INSERT INTO game_records (room_id, player_count, winner_user_id, winner_name, winner_score) VALUES (?, ?, ?, ?, ?)",
      [data.room_id, data.player_count, data.winner_user_id, data.winner_name, data.winner_score]
    );
    const gameId = result.insertId;

    for (const p of data.players) {
      await pool.execute(
        "INSERT INTO game_player_records (game_id, user_id, player_name, cards_remaining, points, color) VALUES (?, ?, ?, ?, ?, ?)",
        [gameId, p.user_id, p.player_name, p.cards_remaining, p.points, p.color]
      );
    }

    return gameId;
  },

  async getRecordsByUser(userId: number, limit: number = 10): Promise<GameRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT gr.* FROM game_records gr
       INNER JOIN game_player_records gpr ON gr.id = gpr.game_id
       WHERE gpr.user_id = ?
       ORDER BY gr.ended_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return rows as GameRecord[];
  },

  async getPlayersByGame(gameId: number): Promise<GamePlayerRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM game_player_records WHERE game_id = ? ORDER BY points DESC",
      [gameId]
    );
    return rows as GamePlayerRecord[];
  },
};
