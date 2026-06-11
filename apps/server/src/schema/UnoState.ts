/**
 * UNO Colyseus Schema — 游戏状态定义
 * 对应前端 core/uno-engine.ts 的 GameState 类型
 */

import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

/** 卡牌 */
export class Card extends Schema {
  @type("string") color: string = "RED";   // RED|BLU|GRN|YEL|WILD
  @type("number") value: number = 0;
  @type("string") type: string = "number"; // number|skip|reverse|draw2|wild|wild4
}

/** 玩家 */
export class Player extends Schema {
  @type("number") id: number = 0;
  @type("string") name: string = "";
  @type("string") sessionId: string = "";
  @type("string") avatar: string = "";
  @type("string") accessoryId: string = "";
  @type("string") accessoryColor: string = "";
  @type("string") titleId: string = "newbie";
  @type("string") titleZh: string = "新手";
  @type("string") titleEn: string = "Newbie";
  @type("boolean") isHuman: boolean = false;
  @type("string") color: string = "";
  @type("number") handCount: number = 0;  // 只同步手牌数量，不暴露牌面（安全）
  @type("boolean") connected: boolean = true;
  @type("boolean") isReady: boolean = false; // 准备状态
  @type("boolean") isHost: boolean = false;  // 是否为房主
}

/** 游戏房间状态 */
export class UnoState extends Schema {
  @type("string") phase: string = "waiting";    // waiting|playing|finished
  @type("number") currentPlayer: number = 0;     // 当前回合玩家 seat
  @type("string") currentColor: string = "RED";  // 当前合法颜色
  @type("boolean") isClockwise: boolean = true;  // 方向
  @type("number") penaltyStack: number = 0;      // 罚牌堆叠
  @type("number") winnerSeat: number = -1;       // 赢家 seat (-1=无)
  @type("number") deckCount: number = 0;         // 牌堆剩余
  @type("number") discardCount: number = 0;      // 弃牌堆张数

  // 弃牌堆顶牌（客户端渲染用）
  @type(Card) topCard: Card = new Card();

  // 玩家列表
  @type([Player]) players = new ArraySchema<Player>();
}
