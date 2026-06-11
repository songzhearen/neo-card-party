import { pool } from "./connection";
import { getEconomyShopItems } from "../cosmetics";

function sqlString(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

const SHOP_SEED_SQL = getEconomyShopItems()
  .map((item) => `(${[
    item.id,
    item.type,
    item.icon,
    item.nameZh,
    item.nameEn,
    item.descZh,
    item.descEn,
  ].map(sqlString).join(", ")}, ${item.price}, ${item.stock})`)
  .join(",\n");

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  account VARCHAR(50) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(384) DEFAULT '',
  avatar_emoji VARCHAR(10) DEFAULT '👤',
  coins INT DEFAULT 1000,
  level INT DEFAULT 1,
  wins INT DEFAULT 0,
  total_games INT DEFAULT 0,
  points INT DEFAULT 0,
  daily_points INT DEFAULT 0,
  title_zh VARCHAR(50) DEFAULT '新手',
  title_en VARCHAR(50) DEFAULT 'Newbie',
  equipped_title_id VARCHAR(50) DEFAULT 'newbie',
  rainbow_pity INT DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  auth_token VARCHAR(64) DEFAULT NULL,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_points (points DESC),
  INDEX idx_daily_points (daily_points DESC),
  INDEX idx_auth_token (auth_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_items (
  id VARCHAR(20) PRIMARY KEY,
  type ENUM('emoji', 'cardback', 'title', 'accessory') NOT NULL,
  icon VARCHAR(10) NOT NULL,
  name_zh VARCHAR(50) NOT NULL,
  name_en VARCHAR(50) NOT NULL,
  desc_zh VARCHAR(100) DEFAULT '',
  desc_en VARCHAR(100) DEFAULT '',
  price INT DEFAULT 0,
  stock INT DEFAULT -1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id VARCHAR(20) NOT NULL,
  quantity INT DEFAULT 1,
  is_equipped BOOLEAN DEFAULT FALSE,
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_item (user_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(50) DEFAULT '',
  player_count INT DEFAULT 0,
  winner_user_id INT DEFAULT NULL,
  winner_name VARCHAR(50) NOT NULL,
  winner_score INT DEFAULT 0,
  ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_player_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  player_name VARCHAR(50) NOT NULL,
  cards_remaining INT DEFAULT 0,
  points INT DEFAULT 0,
  color VARCHAR(20) DEFAULT '#CBD5E0',
  FOREIGN KEY (game_id) REFERENCES game_records(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  actor_user_id INT DEFAULT NULL,
  type VARCHAR(40) NOT NULL,
  delta_coins INT DEFAULT 0,
  item_id VARCHAR(50) DEFAULT NULL,
  quantity INT DEFAULT 0,
  metadata_json TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_account_events_user_created (user_id, created_at),
  INDEX idx_account_events_actor_created (actor_user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_mail (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sender_user_id INT DEFAULT NULL,
  title VARCHAR(80) NOT NULL,
  body VARCHAR(500) NOT NULL,
  reward_coins INT DEFAULT 0,
  reward_item_id VARCHAR(20) DEFAULT NULL,
  reward_quantity INT DEFAULT 0,
  batch_id VARCHAR(64) DEFAULT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_mail_user_created (user_id, created_at),
  INDEX idx_user_mail_unread (user_id, is_read, created_at),
  INDEX idx_user_mail_batch (batch_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reward_item_id) REFERENCES shop_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leaderboard_daily_settlements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  settlement_date DATE NOT NULL UNIQUE,
  player_count INT DEFAULT 0,
  rewards_sent INT DEFAULT 0,
  top_user_id INT DEFAULT NULL,
  top_points INT DEFAULT 0,
  triggered_by_user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (top_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leaderboard_daily_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  settlement_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  rank_no INT NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  daily_points INT DEFAULT 0,
  reward_coins INT DEFAULT 0,
  reward_item_id VARCHAR(20) DEFAULT NULL,
  reward_quantity INT DEFAULT 0,
  mail_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leaderboard_daily_rank (settlement_id, rank_no),
  INDEX idx_leaderboard_daily_user (user_id, created_at),
  FOREIGN KEY (settlement_id) REFERENCES leaderboard_daily_settlements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reward_item_id) REFERENCES shop_items(id) ON DELETE SET NULL,
  FOREIGN KEY (mail_id) REFERENCES user_mail(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO shop_items (id, type, icon, name_zh, name_en, desc_zh, desc_en, price, stock) VALUES
('e1', 'emoji', '🍅', '烂番茄', 'Rotten Tomato', '向对手扔出番茄', 'Throw a tomato at opponent', 10, 15),
('e2', 'emoji', '☕', '热咖啡', 'Hot Coffee', '请大佬喝杯咖啡', 'Treat someone to coffee', 20, 3),
('e3', 'emoji', '💩', '粑粑', 'Poop', '极致的嘲讽', 'Ultimate taunt', 50, -1),
('e4', 'emoji', '🌹', '红玫瑰', 'Red Rose', '表达你的爱意', 'Express your love', 15, 8),
('b1', 'cardback', '🎴', '像素红白机', 'Pixel Famicom', '复古游戏机卡背', 'Retro console card back', 500, 1),
('b2', 'cardback', '🌌', '星空黑客', 'Matrix Hacker', '代码雨特效卡背', 'Code rain effect card back', 1200, -1),
('t1', 'title', '👑', '牌桌皇帝', 'Card Table Emperor', '尊贵的聊天框前缀', 'Prestigious chat box prefix', 3000, -1);

ALTER TABLE users MODIFY avatar VARCHAR(384) DEFAULT '';
ALTER TABLE users ADD COLUMN rainbow_pity INT DEFAULT 0;
ALTER TABLE users ADD COLUMN equipped_title_id VARCHAR(50) DEFAULT 'newbie';
ALTER TABLE users ADD COLUMN daily_points INT DEFAULT 0;
ALTER TABLE users ADD COLUMN account VARCHAR(50) DEFAULT NULL;
ALTER TABLE users ADD COLUMN nickname VARCHAR(50) DEFAULT NULL;
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL;
UPDATE users SET account = username WHERE account IS NULL OR account = '';
UPDATE users SET nickname = username WHERE nickname IS NULL OR nickname = '';
UPDATE users SET is_admin = TRUE WHERE LOWER(username) = 'root' OR LOWER(account) = 'root';
ALTER TABLE users MODIFY account VARCHAR(50) NOT NULL;
ALTER TABLE users MODIFY nickname VARCHAR(50) NOT NULL;
CREATE UNIQUE INDEX uk_users_account ON users(account);
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_users_daily_points ON users(daily_points DESC);
ALTER TABLE shop_items MODIFY type ENUM('emoji', 'cardback', 'title', 'accessory') NOT NULL;
UPDATE shop_items SET stock = 0 WHERE type = 'cardback' OR id = 't1';

INSERT INTO shop_items (id, type, icon, name_zh, name_en, desc_zh, desc_en, price, stock) VALUES
${SHOP_SEED_SQL}
ON DUPLICATE KEY UPDATE type = VALUES(type), icon = VALUES(icon), name_zh = VALUES(name_zh), name_en = VALUES(name_en),
  desc_zh = VALUES(desc_zh), desc_en = VALUES(desc_en), price = VALUES(price), stock = VALUES(stock);

CREATE TABLE IF NOT EXISTS redeem_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  reward_coins INT DEFAULT 0,
  reward_item_id VARCHAR(20) DEFAULT NULL,
  reward_quantity INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  max_uses INT DEFAULT 1,
  used_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reward_item_id) REFERENCES shop_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO redeem_codes (code, reward_coins, reward_item_id, reward_quantity, is_active, expires_at, max_uses) VALUES
('CARD2026', 500, NULL, 0, TRUE, NULL, 100),
('PIXELART', 200, NULL, 0, TRUE, NULL, 50),
('NEOBRUTAL', 300, NULL, 0, TRUE, NULL, 30),
('FREEGIFT', 100, NULL, 0, TRUE, NULL, 200),
('LUCKYCARD', 1000, NULL, 0, TRUE, NULL, 10),
('VIP666', 666, NULL, 0, TRUE, NULL, 1000),
('WELCOME', 150, NULL, 0, TRUE, NULL, 500);

CREATE TABLE IF NOT EXISTS user_redeems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(20) NOT NULL,
  reward_coins INT DEFAULT 0,
  reward_item_id VARCHAR(20) DEFAULT NULL,
  reward_quantity INT DEFAULT 0,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_item_id) REFERENCES shop_items(id) ON DELETE SET NULL,
  UNIQUE KEY uk_user_code (user_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_friendships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requester_user_id INT NOT NULL,
  addressee_user_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_friendships_requester (requester_user_id, status),
  INDEX idx_friendships_addressee (addressee_user_id, status),
  UNIQUE KEY uk_friendships_direction (requester_user_id, addressee_user_id),
  FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE redeem_codes ADD COLUMN reward_quantity INT DEFAULT 0;
ALTER TABLE redeem_codes ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE redeem_codes ADD COLUMN expires_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE user_redeems ADD COLUMN reward_coins INT DEFAULT 0;
ALTER TABLE user_redeems ADD COLUMN reward_item_id VARCHAR(20) DEFAULT NULL;
ALTER TABLE user_redeems ADD COLUMN reward_quantity INT DEFAULT 0;
ALTER TABLE user_mail ADD COLUMN batch_id VARCHAR(64) DEFAULT NULL;
CREATE INDEX idx_user_mail_batch ON user_mail(batch_id, created_at);
`;

export async function initDatabase(): Promise<void> {
  const statements = SCHEMA_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await pool.execute(stmt);
    } catch (err: any) {
      console.warn("[DB] Schema statement warning:", err.message);
    }
  }

  console.log("[DB] Database initialized successfully");
}
