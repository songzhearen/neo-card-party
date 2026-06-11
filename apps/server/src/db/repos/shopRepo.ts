import { pool, RowDataPacket, InsertResult } from "../connection";
import {
  TITLES,
  getAllAccessoryItems,
  getThrowableShopItems,
  getTitle,
  getTitleShopItems,
  isProgressionTitleUnlocked,
  parseTitleItemId,
} from "../../cosmetics";
import { isAdminUser } from "./userRepo";

export interface ShopItem {
  id: string;
  type: "emoji" | "cardback" | "title" | "accessory";
  icon: string;
  name_zh: string;
  name_en: string;
  desc_zh: string;
  desc_en: string;
  price: number;
  stock: number;
}

export interface InventoryItem extends ShopItem {
  quantity: number;
  is_equipped: boolean;
  acquired_at: string;
}

export const shopRepo = {
  async getAllItems(): Promise<ShopItem[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM shop_items WHERE type IN ('accessory', 'emoji', 'title') AND stock <> 0 AND id <> 't1' ORDER BY FIELD(type, 'accessory', 'emoji', 'title'), price ASC, id ASC"
    );
    return rows as ShopItem[];
  },

  async getItemById(itemId: string): Promise<ShopItem | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM shop_items WHERE id = ?",
      [itemId]
    );
    return (rows[0] as ShopItem) || null;
  },

  async getUserInventory(userId: number): Promise<InventoryItem[]> {
    const [users] = await pool.execute<RowDataPacket[]>(
      "SELECT username, account, is_admin FROM users WHERE id = ?",
      [userId]
    );
    if (isAdminUser(users[0] as any)) {
      await this.grantAllAccessories(userId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT si.*, ui.quantity, ui.is_equipped, ui.acquired_at
       FROM user_inventory ui
       INNER JOIN shop_items si ON ui.item_id = si.id
       WHERE ui.user_id = ?
       ORDER BY ui.acquired_at DESC`,
      [userId]
    );
    return rows as InventoryItem[];
  },

  async grantAllAccessories(userId: number): Promise<void> {
    const items = [...getAllAccessoryItems(), ...getThrowableShopItems(), ...getTitleShopItems()];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        await conn.execute(
          `INSERT INTO shop_items (id, type, icon, name_zh, name_en, desc_zh, desc_en, price, stock)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE icon = VALUES(icon), name_zh = VALUES(name_zh), name_en = VALUES(name_en),
             desc_zh = VALUES(desc_zh), desc_en = VALUES(desc_en), price = VALUES(price), stock = VALUES(stock)`,
          [item.id, item.type, item.icon, item.nameZh, item.nameEn, item.descZh, item.descEn, item.price, item.stock]
        );
        await conn.execute(
          `INSERT INTO user_inventory (user_id, item_id, quantity, is_equipped)
           VALUES (?, ?, 1, ?)
           ON DUPLICATE KEY UPDATE quantity = GREATEST(quantity, 1)`,
          [userId, item.id, item.id === "acc_crown_rainbow"]
        );
      }
      await conn.execute(
        `UPDATE user_inventory
         SET is_equipped = (item_id = 'acc_crown_rainbow')
         WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = 'accessory')`,
        [userId]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async buyItem(
    userId: number,
    itemId: string
  ): Promise<{ success: boolean; message: string }> {
    const item = await this.getItemById(itemId);
    if (!item) return { success: false, message: "商品不存在" };

    if (item.stock === 0) return { success: false, message: "已售罄" };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [coins] = await conn.execute<RowDataPacket[]>(
        "SELECT username, account, is_admin, coins FROM users WHERE id = ? FOR UPDATE",
        [userId]
      );
      const user = coins[0] as any;
      const userCoin = user?.coins ?? 0;
      const isRoot = isAdminUser(user);
      if (!isRoot && userCoin < item.price) {
        await conn.rollback();
        return { success: false, message: "余额不足" };
      }

      if (!isRoot) {
        await conn.execute(
          "UPDATE users SET coins = coins - ? WHERE id = ?",
          [item.price, userId]
        );
      }

      await conn.execute(
        `INSERT INTO user_inventory (user_id, item_id, quantity, is_equipped)
         VALUES (?, ?, 1, FALSE)
         ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
        [userId, itemId]
      );

      if (item.stock > 0) {
        await conn.execute(
          "UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0",
          [itemId]
        );
      }

      await conn.commit();
      return { success: true, message: "购买成功" };
    } catch (err: any) {
      await conn.rollback();
      return { success: false, message: err.message };
    } finally {
      conn.release();
    }
  },

  async equipItem(
    userId: number,
    itemId: string
  ): Promise<{ success: boolean; message: string }> {
    const titleId = parseTitleItemId(itemId);
    if (titleId) return this.equipTitleItem(userId, itemId, titleId);

    const item = await this.getItemById(itemId);
    if (!item) return { success: false, message: "商品不存在" };

    const [inv] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?",
      [userId, itemId]
    );
    if (!inv.length) return { success: false, message: "你还没有这个物品" };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        "UPDATE user_inventory SET is_equipped = FALSE WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)",
        [userId, item.type]
      );

      await conn.execute(
        "UPDATE user_inventory SET is_equipped = TRUE WHERE user_id = ? AND item_id = ?",
        [userId, itemId]
      );

      if (item.type === "title") {
        await conn.execute(
          "UPDATE users SET title_zh = ?, title_en = ?, equipped_title_id = ? WHERE id = ?",
          [item.name_zh, item.name_en, itemId.replace(/^title_/, ""), userId]
        );
      }

      await conn.commit();
      return { success: true, message: "装备成功" };
    } catch (err: any) {
      await conn.rollback();
      return { success: false, message: err.message };
    } finally {
      conn.release();
    }
  },

  async equipTitleItem(
    userId: number,
    itemId: string,
    titleId: string
  ): Promise<{ success: boolean; message: string }> {
    const staticTitle = TITLES.find((entry) => entry.id === titleId) || null;
    const item = await this.getItemById(itemId);
    const dbTitle = item?.type === "title" ? item : null;
    const [users] = await pool.execute<RowDataPacket[]>(
      "SELECT username, account, is_admin, level, points FROM users WHERE id = ?",
      [userId]
    );
    const user = users[0] as any;
    if (!user) return { success: false, message: "用户不存在" };

    const [inv] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?",
      [userId, itemId]
    );
    const hasInventory = inv.length > 0;
    const canEquip = isAdminUser(user) || hasInventory || (staticTitle ? isProgressionTitleUnlocked(staticTitle, user) : false);
    if (!canEquip) return { success: false, message: "称号未解锁" };
    if (!dbTitle && !staticTitle) return { success: false, message: "称号不存在" };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        "UPDATE user_inventory SET is_equipped = FALSE WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = 'title')",
        [userId]
      );

      if (item && hasInventory) {
        await conn.execute(
          "UPDATE user_inventory SET is_equipped = TRUE WHERE user_id = ? AND item_id = ?",
          [userId, itemId]
        );
      }

      await conn.execute(
        "UPDATE users SET title_zh = ?, title_en = ?, equipped_title_id = ? WHERE id = ?",
        [
          dbTitle?.name_zh || staticTitle?.nameZh || getTitle("newbie").nameZh,
          dbTitle?.name_en || staticTitle?.nameEn || getTitle("newbie").nameEn,
          titleId,
          userId,
        ]
      );

      await conn.commit();
      return { success: true, message: "装备成功" };
    } catch (err: any) {
      await conn.rollback();
      return { success: false, message: err.message };
    } finally {
      conn.release();
    }
  },
};
