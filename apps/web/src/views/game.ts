/**
 * UNO 游戏界面视图 — 渲染层
 * 移植自 游戏界面.html (~2000+ 行 JS)
 * 游戏逻辑委托给 core/uno-engine.ts
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { state as appState } from "../core/state";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { renderAvatar } from "../core/avatar";
import { consumeThrowable, renderAccessory, THROWABLES } from "../core/cosmetics";
import { GameAction, GameProvider, createGameProvider } from "../core/game-provider";
import { getGameMode } from "./waiting-room";
import type { RoomContextPlayer } from "@card-party/shared";
import {
  GameState, Card, CardColor,
  createGame, getValidPlays, playCard, drawCard,
  applyCardEffect, checkWin, advanceTurn,
  getSymbol, COLOR_HEX, COLORS,
  aiDecideCard, aiChooseWildColor, calculateScore,
  canPlayUnderPenalty, isValidPlay, topCard,
  callUno, isUnoDanger, catchUnoFail, clearUnoCall,
} from "../core/uno-engine";

const CARD_W = 64;
const CARD_H = 92;
const DECK_X = 365;
const DECK_Y = 285;
const DISCARD_X = 545;
const DISCARD_Y = 285;

interface SettlementPlayer {
  id: number;
  name: string;
  cards: number;
  played: number;
  handValue: number;
  rank: number;
  rankBonus: number;
  playBonus: number;
  residueBonus: number;
  cardPenalty: number;
  points: number;
  color: string;
  isWinner: boolean;
  avatar?: string;
  accessoryId?: string;
  accessoryColor?: string;
}

interface OnlineGameOverMessage {
  winnerSeat: number;
  winner?: string;
  winnerScore?: number;
  gameId?: number | null;
  players?: SettlementPlayer[];
}

export class GameView implements View {
  private gs!: GameState;
  private boardEl!: HTMLElement;
  private cardsLayer!: HTMLElement;
  private fxLayer!: HTMLElement;
  private animLock: boolean = false;
  private hasDrawnThisTurn: boolean = false;
  private drawnCardThisTurn: Card | null = null;
  private cardDomMap: WeakMap<Card, HTMLElement> = new WeakMap();
  private gameMode: "ai" | "multi" = "ai";
  private playerCount: number = 4;
  private roomPlayers: RoomContextPlayer[] = [];
  private mySeat: number = -1;
  private roomId: string | null = null;
  private onlineRoom: any = null;
  private gameProvider: GameProvider = createGameProvider(null);
  private onlineHand: Card[] = [];
  private onlineDisposers: Array<() => void> = [];
  private interactTargetIndex: number | null = null;
  private discardZIndex: number = 200;
  private playedCounts: number[] = [];
  private onlineGameOverHandled: boolean = false;
  private onlineDiscardStack: Card[] = [];
  private onlineLastTopIdentity: string = "";
  private onlineLastTopVisual: string = "";
  private onlineLastCurrentSeat: number | null = null;

  mount(container: HTMLElement): void {
    document.body.classList.add("is-game-view");
    this.onlineGameOverHandled = false;
    this.resetOnlineVisualState();
    const { mode, playerCount, players, mySeat, roomId } = getGameMode();
    this.gameMode = mode;
    this.roomPlayers = players || [];
    this.mySeat = mySeat;
    this.roomId = roomId;
    this.setOnlineRoom(mode === "multi" ? api.room : null);
    this.playerCount = mode === "multi"
      ? Math.max(2, this.roomPlayers.length || playerCount)
      : playerCount;

    container.innerHTML = `
      <div class="game-mobile-shell">
        <div class="game-stage">
      <div id="game-board" class="neo-panel" style="width:1060px;height:740px;position:relative;">
        <!-- 标题栏 -->
        <div class="g-header" style="position:absolute;top:0;left:0;right:0;height:52px;border-bottom:4px solid var(--color-black);background:var(--color-gray-light);display:flex;align-items:center;padding:0 20px;gap:20px;z-index:500;">
          <span style="font-size:18px;text-shadow:3px 3px 0 #E2E8F0;letter-spacing:-1px;">${t("game.title")}</span>
          <div class="turn-badge turn-main-badge">
            <span>\uD83C\uDFAF</span>
            <span id="current-player-name">${t("game.me")}</span>
          </div>
          <div class="turn-badge turn-color-badge">
            <span id="current-color-dot" style="display:inline-block;width:12px;height:12px;border:2px solid var(--color-black);background:var(--color-red);"></span>
            <span id="current-color-text" style="font-size:8px;">RED</span>
          </div>
          <div class="turn-badge">
            <span id="direction-icon">\u21BB</span>
            <span id="direction-text" style="font-size:8px;">CW</span>
          </div>
          <span id="penalty-badge" style="display:none;font-size:9px;color:var(--color-red);border:2px solid var(--color-red);padding:4px 8px;background:var(--color-white);">+0</span>
          <button id="btn-game-settings" class="game-settings-trigger" title="${t("nav.settings")}" aria-label="${t("nav.settings")}">\u2699</button>
        </div>

        <div class="turn-badge" style="padding:5px 10px;border:2px solid var(--color-black);background:var(--color-white);box-shadow:2px 2px 0 var(--color-black);display:flex;align-items:center;gap:6px;font-size:9px;"></div>

        <!-- 玩家位置 -->
        <div id="player-spots"></div>

        <!-- 牌堆 -->
        <div id="deck-zone" style="position:absolute;left:360px;top:280px;width:72px;height:100px;border:3px dashed var(--color-gray);display:flex;align-items:center;justify-content:center;z-index:0;">
          <span style="font-size:8px;">${t("game.deck")}</span>
        </div>
        <div id="deck-count-below" style="position:absolute;left:360px;top:380px;width:72px;text-align:center;font-size:11px;">${t("game.cardsCount", { 0: 0 })}</div>

        <!-- 弃牌堆 -->
        <div id="discard-zone" style="position:absolute;left:540px;top:280px;width:72px;height:100px;border:3px dashed var(--color-gray);display:flex;align-items:center;justify-content:center;pointer-events:none;">
          <span style="font-size:8px;">${t("game.discard")}</span>
        </div>

        <!-- 野色选择器 -->
        <div id="wild-picker" style="position:absolute;left:440px;top:220px;z-index:3000;background:var(--color-white);border:4px solid var(--color-black);box-shadow:8px 8px 0 var(--color-black);padding:15px;display:none;gap:10px;">
          <div class="wild-opt" style="width:44px;height:44px;background:var(--color-red);border:3px solid var(--color-black);cursor:pointer;box-shadow:3px 3px 0 var(--color-black);"></div>
          <div class="wild-opt" style="width:44px;height:44px;background:var(--color-blue);border:3px solid var(--color-black);cursor:pointer;box-shadow:3px 3px 0 var(--color-black);"></div>
          <div class="wild-opt" style="width:44px;height:44px;background:var(--color-green);border:3px solid var(--color-black);cursor:pointer;box-shadow:3px 3px 0 var(--color-black);"></div>
          <div class="wild-opt" style="width:44px;height:44px;background:var(--color-yellow);border:3px solid var(--color-black);cursor:pointer;box-shadow:3px 3px 0 var(--color-black);"></div>
        </div>

        <!-- 喊话菜单 -->
        <div id="shout-menu" class="popup-menu" style="bottom:80px;right:280px;">
          <button class="popup-btn" data-shout="战斗爽！">${t("shout.battle")}</button>
          <button class="popup-btn" data-shout="快点阿，等花儿都谢了">${t("shout.hurry")}</button>
          <button class="popup-btn" data-shout="砸瓦鲁多！时间停止吧！">${t("shout.zaWarudo")}</button>
          <button class="popup-btn" data-shout="这也在你的计算之中吗！">${t("shout.calculate")}</button>
          <button class="popup-btn" data-shout="这牌烂得像刚写的bug一样...">${t("shout.bugCards")}</button>
        </div>

        <!-- 互动菜单 -->
        <div id="interact-menu" class="popup-menu">
          ${this.renderInteractButtons()}
        </div>

        <div id="game-settings-menu" class="popup-menu">
          ${this.gameMode === "ai" ? `<button class="popup-btn" id="btn-reset">${t("game.reset")}</button>` : ""}
          <button class="popup-btn" id="btn-back-game">${t("result.backHome")}</button>
        </div>

        <!-- 气泡 -->
        <div id="speech-bubble" class="speech-bubble"></div>

        <!-- 按钮栏 -->

        <!-- 赢家覆盖层 -->
        <div id="winner-overlay" class="winner-overlay" style="position:absolute;inset:0;background:rgba(255,255,255,0.85);z-index:5000;display:none;flex-direction:column;align-items:center;justify-content:center;">
          <div id="winner-msg" style="font-size:36px;text-shadow:5px 5px 0 var(--color-gray);margin-bottom:20px;">${t("game.youWin")}</div>
          <button class="neo-btn neo-btn-yellow" id="btn-replay" style="font-size:14px;">${t("game.playAgain")}</button>
        </div>

        <!-- Toast -->
        <div id="msg-toast" style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:2500;font-size:11px;background:var(--color-black);color:var(--color-yellow);padding:8px 16px;border:2px solid var(--color-yellow);pointer-events:none;opacity:0;transition:opacity 0.3s;"></div>

        <!-- 设置界面 -->
        <div id="setup-overlay" style="position:absolute;inset:0;background:rgba(255,255,255,0.92);z-index:6000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="background:var(--color-white);border:4px solid var(--color-black);box-shadow:10px 10px 0 var(--color-red);padding:35px 45px;text-align:center;max-width:420px;width:90%;">
            <h2 style="font-size:18px;margin-bottom:25px;text-shadow:3px 3px 0 #E2E8F0;">${t("game.setup")}</h2>
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:25px;">
              <button class="count-btn" id="count-minus" style="width:44px;height:44px;border:3px solid var(--color-black);background:var(--color-white);font-family:var(--font-pixel);font-size:20px;cursor:pointer;box-shadow:3px 3px 0 var(--color-black);">\u2212</button>
              <span id="count-display" style="font-size:42px;min-width:60px;text-align:center;text-shadow:2px 2px 0 #E2E8F0;">4</span>
              <button class="count-btn" id="count-plus" style="width:44px;height:44px;border:3px solid var(--color-black);background:var(--color-white);font-family:var(--font-pixel);font-size:20px;cursor:pointer;box-shadow:3px 3px 0 var(--color-black);">+</button>
            </div>
            <div style="font-size:9px;color:#718096;margin-bottom:20px;">${t("game.playerCount")}</div>
            <button class="neo-btn neo-btn-red" id="btn-start-game" style="font-size:13px;padding:12px 30px;">${t("game.startGame")}</button>
          </div>
        </div>

        <!-- 卡牌容器 -->
        <div id="cards-layer" style="position:absolute;inset:0;pointer-events:none;z-index:2;"></div>
        <!-- 特效容器 -->
        <div id="fx-layer" style="position:absolute;inset:0;pointer-events:none;z-index:3500;"></div>
      </div>
        </div>
        <div class="game-portrait-tip">
          <div class="game-portrait-title">${t("game.mobilePortraitTitle")}</div>
          <div class="game-portrait-body">${t("game.mobilePortraitBody")}</div>
        </div>
      </div>

      <style>
        .g-header .turn-badge {
          font-size: 9px; padding: 5px 10px;
          border: 2px solid var(--color-black); background: var(--color-white);
          box-shadow: 2px 2px 0 var(--color-black);
          display: flex; align-items: center; gap: 6px;
        }
        .g-header .turn-main-badge {
          background: var(--color-yellow);
          border-width: 3px;
          box-shadow: 4px 4px 0 var(--color-black);
          font-size: 10px;
          min-width: 112px;
          justify-content: center;
        }
        .g-header .turn-color-badge {
          border-width: 3px;
          box-shadow: 3px 3px 0 var(--color-black);
          min-width: 86px;
          justify-content: center;
        }
        .game-card {
          position: absolute; width: ${CARD_W}px; height: ${CARD_H}px;
          cursor: pointer; transform-style: preserve-3d; z-index: 10; pointer-events: auto;
        }
        .game-card-inner {
          width: 100%; height: 100%; transform-style: preserve-3d;
          transition: transform 0.25s ease-out;
        }
        .game-card-front, .game-card-back {
          position: absolute; width: 100%; height: 100%;
          border-radius: 3px; border: 3px solid var(--color-black);
          display: flex; align-items: center; justify-content: center;
          backface-visibility: hidden;
        }
        .game-card-back {
          background: repeating-conic-gradient(#FF3366 0% 25%, #FF5588 0% 50%) 50% / 8px 8px;
          transform: rotateY(180deg);
        }
        .game-card-back::after { content: "CARD"; font-size: 12px; color: var(--color-white); text-shadow: 2px 2px 0 var(--color-black); }
        .game-card-front { background: var(--color-white); }
        .game-card-front > span { z-index: 1; }
        .wild-choice-chip {
          position: absolute;
          inset: 15px 10px;
          border: 3px solid var(--color-black);
          box-shadow: 3px 3px 0 var(--color-black);
          z-index: 0 !important;
        }
        .game-settings-trigger {
          margin-left: auto;
          width: 34px;
          height: 34px;
          border: 3px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 3px 3px 0 var(--color-black);
          font-family: var(--font-pixel);
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
        }
        .game-settings-trigger:hover {
          transform: translate(-1px, -1px);
          box-shadow: 4px 4px 0 var(--color-black);
        }
        .game-settings-trigger:active {
          transform: translate(2px, 2px);
          box-shadow: 1px 1px 0 var(--color-black);
        }

        .player-spot {
          position: absolute; display: flex; flex-direction: column;
          align-items: center; gap: 4px; z-index: 45;
        }
        .player-spot .p-avatar {
          width: 52px; height: 52px; border: 4px solid var(--color-black);
          box-shadow: 4px 4px 0 var(--color-black); display: flex;
          align-items: center; justify-content: center; font-size: 10px;
          color: var(--color-white); text-shadow: 2px 2px 0 var(--color-black);
        }
        .player-spot .p-name {
          font-size: 7px; background: var(--color-white); border: 2px solid var(--color-black);
          padding: 2px 6px; box-shadow: 2px 2px 0 var(--color-black); white-space: nowrap;
        }
        .player-spot .p-count {
          font-size: 7px; color: var(--color-white); background: var(--color-black); padding: 2px 6px;
        }
        .player-spot .p-order {
          position: absolute;
          right: -10px;
          top: -12px;
          min-width: 28px;
          padding: 4px 5px;
          border: 2px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 2px 2px 0 var(--color-black);
          font-family: var(--font-pixel);
          font-size: 7px;
          text-align: center;
        }
        .player-spot.current .p-order {
          background: var(--color-yellow);
          color: var(--color-black);
        }
        .player-spot.current { filter: drop-shadow(0 0 12px var(--color-yellow)); }
        .player-spot .p-avatar.is-me { border-color: var(--color-yellow); box-shadow: 4px 4px 0 var(--color-yellow); }
        .player-spot .p-avatar.p-avatar-pixel { overflow: hidden; text-shadow: none; background: var(--color-yellow) !important; }

      /* -- 卡牌翻转 -- */
      .game-card.flipped .game-card-inner { transform: rotateY(180deg); }
      .game-card.valid-play { animation: glowPulse 0.8s ease-in-out infinite; }
      @keyframes glowPulse {
        0%, 100% { filter: drop-shadow(0 0 0px var(--color-yellow)); }
        50% { filter: drop-shadow(0 0 8px var(--color-yellow)); }
      }
      /* -- 气泡 -- */
      .speech-bubble {
        position: absolute; background: var(--color-white); border: 4px solid var(--color-black);
        padding: 10px 14px; font-size: 11px; font-family: "Microsoft YaHei", sans-serif;
        font-weight: bold; box-shadow: 6px 6px 0 var(--color-gray);
        z-index: 2000; opacity: 0; pointer-events: none; white-space: nowrap;
        transition: opacity 0.2s;
      }
      /* -- 弹出菜单 -- */
      .popup-menu {
        position: absolute; background: var(--color-white); border: 4px solid var(--color-black);
        box-shadow: 6px 6px 0 var(--color-black); z-index: 2100;
        display: none; flex-direction: column; padding: 4px;
      }
      .popup-btn {
        background: none; border: none; border-bottom: 2px dashed var(--color-gray);
        font-family: "Microsoft YaHei", sans-serif; font-weight: bold;
        font-size: 13px; padding: 8px 12px; cursor: pointer; text-align: left;
      }
      .popup-btn:last-child { border-bottom: none; }
      .popup-btn:hover { background: #EDF2F7; color: var(--color-blue); }
      .popup-label {
        margin: 4px 4px 2px;
        padding: 6px 8px;
        border: 2px solid var(--color-black);
        background: var(--color-yellow);
        font-family: var(--font-pixel);
        font-size: 8px;
      }
      /* -- 粒子 -- */
      .particle {
        position: absolute; width: 6px; height: 6px;
        pointer-events: none; z-index: 4000;
      }
      /* -- 表情飞行物 -- */
      .emoji-projectile {
        position: absolute; font-size: 28px; z-index: 3500; pointer-events: none;
      }
      /* -- 牌堆数字脉冲 -- */
      #deck-count-below.pulse { transform: scale(1.5); color: var(--color-red); }
      /* -- 惩罚浮动文字 -- */
      .penalty-popup {
        position: absolute; z-index: 3000; font-size: 24px;
        color: var(--color-red); text-shadow: 2px 2px 0 var(--color-black);
        pointer-events: none;
        animation: penaltyFloat 1.5s ease-out forwards;
      }
      @keyframes penaltyFloat {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-60px) scale(1.5); }
      }
      /* -- 弃牌堆 -- */
      #deck-zone.clickable { border-color: var(--color-blue); cursor: pointer; background: #EDF2F7; }
      #deck-zone.clickable:hover { transform: scale(1.08); box-shadow: 4px 4px 0 var(--color-blue); }
      /* -- 头像交互 -- */
      .player-spot .p-avatar { cursor: pointer; transition: all 0.1s; }
      .player-spot .p-avatar:hover { transform: scale(1.12); }
      .player-spot .p-avatar:active { transform: scale(0.9); box-shadow: 2px 2px 0 var(--color-black); }
    </style>
    `;

    this.boardEl = container.querySelector("#game-board")!;
    this.cardsLayer = container.querySelector("#cards-layer")!;
    this.fxLayer = container.querySelector("#fx-layer")!;
    if (!this.onlineRoom) this.setLocalProvider(container);

    this.bindGlobalEvents(container);

    // AI 模式：跳过设置界面，直接开始
    if (this.gameMode === "multi" && this.onlineRoom) {
      const setupOverlay = container.querySelector("#setup-overlay") as HTMLElement;
      if (setupOverlay) setupOverlay.style.display = "none";
      this.bindOnlineRoom(container);
      this.syncOnlineGameState(container);
    } else if (this.gameMode === "multi") {
      const setupOverlay = container.querySelector("#setup-overlay") as HTMLElement;
      if (setupOverlay) setupOverlay.style.display = "none";
      void this.restoreOnlineRoom(container);
    } else if (this.gameMode === "ai") {
      const setupOverlay = container.querySelector("#setup-overlay") as HTMLElement;
      if (setupOverlay) setupOverlay.style.display = "none";
      // 更新计数显示
      this.updateCountDisplay(container, this.playerCount);
      // 延迟开始，等待渲染完成
      setTimeout(() => this.startGame(container, this.playerCount), 100);
    }
  }

  unmount(): void {
    document.body.classList.remove("is-game-view");
    for (const dispose of this.onlineDisposers) {
      try { dispose(); } catch { /* ignore */ }
    }
    this.onlineDisposers = [];
    this.setOnlineRoom(null);
    this.cardsLayer.innerHTML = "";
    this.fxLayer.innerHTML = "";
  }

  private setOnlineRoom(room: any | null): void {
    this.onlineRoom = room;
    this.gameProvider = createGameProvider(room);
  }

  private resetOnlineVisualState(): void {
    this.onlineDiscardStack = [];
    this.onlineLastTopIdentity = "";
    this.onlineLastTopVisual = "";
    this.onlineLastCurrentSeat = null;
  }

  private setLocalProvider(container: HTMLElement): void {
    this.onlineRoom = null;
    this.gameProvider = createGameProvider(null, (action) => this.handleLocalGameAction(container, action));
  }

  private isRemoteGame(): boolean {
    return this.gameMode === "multi" && this.gameProvider.mode === "remote";
  }

  private dispatchGameAction(action: GameAction): boolean {
    return this.gameProvider.send(action);
  }

  private handleLocalGameAction(container: HTMLElement, action: GameAction): boolean {
    switch (action.type) {
      case "play":
        return this.performLocalHumanPlay(container, action.cardIndex);
      case "draw":
        return this.performLocalDraw(container);
      case "chooseColor":
        return this.performLocalWildColor(container, action.color as CardColor);
      case "gameShout":
        this.showSpeech(container, 0, action.message);
        return true;
      case "throwEmoji":
        this.throwEmoji(container, 0, action.targetSeat, action.emoji);
        return true;
      default:
        return false;
    }
  }

  private async restoreOnlineRoom(container: HTMLElement): Promise<void> {
    const room = await api.reconnectGameRoom(appState.playerName || "PLAYER_1")
      || (this.roomId
        ? await api.joinGameRoom(appState.playerName || "PLAYER_1", {
          roomId: this.roomId,
          playerCount: this.playerCount,
          mode: "casual",
        })
        : null);
    if (!this.boardEl || !container.isConnected) return;
    if (!room) {
      this.showToast(container, "联机房间恢复失败，请返回大厅重新进入");
      return;
    }
    this.setOnlineRoom(room);
    this.bindOnlineRoom(container);
    this.syncOnlineGameState(container);
  }

  private renderInteractButtons(): string {
    const lang = appState.settings.language === "zh" ? "zh" : "en";
    const buttons = THROWABLES
      .filter((item) => appState.isRoot || (appState.throwableInventory[item.id] || 0) > 0)
      .map((item) => {
        const count = appState.isRoot ? "∞" : String(appState.throwableInventory[item.id] || 0);
        const name = lang === "zh" ? item.nameZh : item.nameEn;
        return `<button class="popup-btn" data-throwable-id="${item.id}" data-emoji="${item.icon}">${item.icon} ${name} x${count}</button>`;
      });

    const buyButtons = THROWABLES.map((item) => {
      const name = lang === "zh" ? item.nameZh : item.nameEn;
      return `<button class="popup-btn" data-buy-throwable-id="${item.id}" data-price="${item.price}">+ ${item.icon} ${name} · ${item.price}</button>`;
    });
    const buySection = `<div class="popup-label">${lang === "zh" ? "局内购买" : "Buy in game"}</div>${buyButtons.join("")}`;

    if (!buttons.length) {
      return `<button class="popup-btn" disabled style="color:var(--color-gray-text);cursor:not-allowed;">${lang === "zh" ? "暂无投掷物" : "No throwables"}</button>${buySection}`;
    }

    return `${buttons.join("")}${buySection}`;
  }

  // ===================== 全局事件 =====================

  private bindGlobalEvents(container: HTMLElement): void {
    let playerCount = this.playerCount;

    container.querySelector("#count-minus")?.addEventListener("click", () => {
      if (playerCount > 2) { playerCount--; this.updateCountDisplay(container, playerCount); }
    });
    container.querySelector("#count-plus")?.addEventListener("click", () => {
      if (playerCount < 12) { playerCount++; this.updateCountDisplay(container, playerCount); }
    });
    container.querySelector("#btn-start-game")?.addEventListener("click", () => {
      audio.playClick();
      this.startGame(container, playerCount);
    });
    container.querySelector("#btn-reset")?.addEventListener("click", () => {
      audio.playClick();
      this.hidePopupMenus(container);
      this.resetGame(container);
    });
    container.querySelector("#btn-replay")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#result");
    });
    container.querySelector("#btn-back-game")?.addEventListener("click", () => {
      audio.playClick();
      this.hidePopupMenus(container);
      router.navigate("#home");
    });

    // Draw 按钮
    container.querySelector("#deck-zone")?.addEventListener("click", () => this.handleDraw(container));

    const shoutMenu = container.querySelector("#shout-menu") as HTMLElement;
    const interactMenu = container.querySelector("#interact-menu") as HTMLElement;
    const settingsMenu = container.querySelector("#game-settings-menu") as HTMLElement;
    const settingsButton = container.querySelector("#btn-game-settings") as HTMLElement;

    settingsButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      audio.playClick();
      if (settingsMenu.style.display === "flex") {
        this.hidePopupMenus(container);
        return;
      }
      this.hidePopupMenus(container);
      this.openPopupNear(container, settingsMenu, settingsButton);
    });

    shoutMenu?.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".popup-btn[data-shout]");
      if (!button) return;
      event.stopPropagation();
      audio.playClick();
      this.hidePopupMenus(container);
      const message = button.textContent?.trim() || button.dataset.shout || "";
      this.dispatchGameAction({ type: "gameShout", message });
    });

    interactMenu?.addEventListener("click", async (event) => {
      const buyButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".popup-btn[data-buy-throwable-id]");
      if (buyButton) {
        event.stopPropagation();
        audio.playClick();
        const itemId = buyButton.dataset.buyThrowableId || "";
        const price = Number(buyButton.dataset.price || 0);
        const result = await api.buyItem(itemId, price);
        if (result.success) {
          this.showToast(container, appState.settings.language === "zh" ? "投掷物已购买" : "Throwable purchased");
          interactMenu.innerHTML = this.renderInteractButtons();
        } else {
          this.showToast(container, t("shop.noCoins"));
        }
        return;
      }

      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".popup-btn[data-emoji]");
      if (!button || this.interactTargetIndex === null) return;
      event.stopPropagation();
      audio.playClick();
      const targetIndex = this.interactTargetIndex;
      const emoji = button.dataset.emoji || button.textContent?.trim() || "";
      const throwableId = button.dataset.throwableId || "";
      if (!appState.isRoot && throwableId) {
        const count = appState.throwableInventory[throwableId] || 0;
        if (count <= 0) {
          this.hidePopupMenus(container);
          return;
        }
        appState.update({ throwableInventory: consumeThrowable(appState.throwableInventory, throwableId) });
      }
      this.hidePopupMenus(container);
      this.dispatchGameAction({
        type: "throwEmoji",
        targetSeat: this.isRemoteGame() ? this.localIndexToSeat(targetIndex) : targetIndex,
        emoji,
      });
    });

    this.boardEl.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest(".popup-menu") || target.closest("#btn-game-settings") || target.closest(".p-avatar")) return;
      this.hidePopupMenus(container);
    });

    // UNO 按钮
    // 野色选择
    container.querySelectorAll(".wild-opt").forEach((el) => {
      el.addEventListener("click", () => {
        const colors: CardColor[] = ["RED", "BLU", "GRN", "YEL"];
        const idx = Array.from(el.parentElement!.children).indexOf(el);
        const color = colors[idx];
        this.resolveWildColor(container, color);
      });
    });
  }

  private updateCountDisplay(container: HTMLElement, count: number): void {
    const display = container.querySelector("#count-display")!;
    display.textContent = String(count);
  }

  // ===================== 游戏流程 =====================

  private trackOnlineDisposer(disposer: any): void {
    if (typeof disposer === "function") {
      this.onlineDisposers.push(disposer);
    } else if (disposer && typeof disposer.remove === "function") {
      this.onlineDisposers.push(() => disposer.remove());
    }
  }

  private bindOnlineRoom(container: HTMLElement): void {
    const room = this.onlineRoom;
    if (!room) return;

    this.trackOnlineDisposer(room.onStateChange?.(() => {
      this.syncOnlineGameState(container);
    }));

    this.trackOnlineDisposer(room.onMessage?.("hand", (msg: { cards: Card[] }) => {
      this.onlineHand = Array.isArray(msg?.cards) ? msg.cards : [];
      this.syncOnlineGameState(container);
    }));

    this.trackOnlineDisposer(room.onMessage?.("drawResult", () => {
      this.syncOnlineGameState(container);
    }));

    this.trackOnlineDisposer(room.onMessage?.("gameOver", (msg: OnlineGameOverMessage) => {
      this.handleOnlineGameOver(container, msg);
    }));

    this.trackOnlineDisposer(room.onMessage?.("gameShout", (msg: { seat: number; message: string }) => {
      const localIndex = this.seatToLocalIndex(msg.seat);
      if (localIndex >= 0) this.showSpeech(container, localIndex, msg.message);
    }));

    this.trackOnlineDisposer(room.onMessage?.("throwEmoji", (msg: { fromSeat: number; targetSeat: number; emoji: string }) => {
      const fromIndex = this.seatToLocalIndex(msg.fromSeat);
      const targetIndex = this.seatToLocalIndex(msg.targetSeat);
      if (fromIndex >= 0 && targetIndex >= 0) this.throwEmoji(container, fromIndex, targetIndex, msg.emoji);
    }));

    this.trackOnlineDisposer(room.onMessage?.("error", (msg: any) => {
      this.showToast(container, String(msg?.message || "Room error"));
    }));

    try {
      this.dispatchGameAction({ type: "requestHand" });
    } catch {
      // ignore transient room send failures during navigation
    }
  }

  private handleOnlineGameOver(container: HTMLElement, msg: OnlineGameOverMessage): void {
    if (this.onlineGameOverHandled) return;
    this.onlineGameOverHandled = true;
    this.syncOnlineGameState(container);

    const winnerSeat = Number(msg?.winnerSeat ?? this.onlineRoom?.state?.winnerSeat ?? -1);
    const winnerIndex = this.seatToLocalIndex(winnerSeat);
    const players = this.enrichSettlementPlayers(Array.isArray(msg?.players) && msg.players.length
      ? msg.players
      : winnerIndex >= 0
        ? this.buildSettlement(winnerIndex)
        : []);
    const winner = msg?.winner || players.find((player) => player.isWinner)?.name || "P1";
    const winnerScore = Number(msg?.winnerScore ?? players.find((player) => player.isWinner)?.points ?? 0);
    const isPlayerWin = winnerSeat === this.mySeat || winnerIndex === 0;

    sessionStorage.setItem("card_party_result", JSON.stringify({
      winner,
      winnerScore,
      isPlayerWin,
      gameId: msg?.gameId ?? null,
      source: "server",
      players,
    }));

    if (isPlayerWin) {
      audio.playWin();
    } else {
      audio.playLose();
    }

    const overlay = container.querySelector("#winner-overlay") as HTMLElement;
    const message = container.querySelector("#winner-msg");
    if (message) message.textContent = isPlayerWin ? t("game.youWin") : t("game.otherWin", { 0: winner });
    if (overlay) overlay.style.display = "flex";

    void api.refreshAccount().catch(() => {
      // Profile refresh is best-effort; the server result is already persisted.
    });

    setTimeout(() => router.navigate("#result"), 900);
  }

  private dummyCard(): Card {
    return { color: "RED", value: 0, type: "number" };
  }

  private onlinePlayersOrdered(): any[] {
    const rawPlayers = Array.from(this.onlineRoom?.state?.players || []) as any[];
    const connected = rawPlayers.filter((player) => player?.connected !== false).sort((a, b) => Number(a.id) - Number(b.id));
    const sessionId = this.onlineRoom?.sessionId || appState.sessionId;
    const me = connected.find((player) => player?.sessionId === sessionId) || connected.find((player) => Number(player?.id) === this.mySeat);
    if (!me) return connected;
    this.mySeat = Number(me.id);
    return [me, ...connected.filter((player) => player !== me)];
  }

  private seatToLocalIndex(seat: number): number {
    return this.roomPlayers.findIndex((player) => player.id === Number(seat));
  }

  private localIndexToSeat(index: number): number {
    return this.roomPlayers[index]?.id ?? index;
  }

  private cardIdentityKey(card: Card | null | undefined): string {
    if (!card) return "";
    return `${card.color}:${card.value}:${card.type}`;
  }

  private cardVisualKey(card: Card | null | undefined): string {
    if (!card) return "";
    return `${this.cardIdentityKey(card)}:${card.chosenColor || ""}`;
  }

  private normalizeOnlineTopCard(top: any, currentColor: CardColor): Card {
    const card: Card = {
      color: top?.color || "RED",
      value: Number(top?.value) || 0,
      type: top?.type || "number",
    };
    if (card.color === "WILD" && currentColor && currentColor !== "WILD") {
      card.chosenColor = currentColor;
    }
    return card;
  }

  private colorLabel(color: CardColor): string {
    const zh: Record<CardColor, string> = { RED: "红色", BLU: "蓝色", GRN: "绿色", YEL: "黄色", WILD: "万能" };
    const en: Record<CardColor, string> = { RED: "RED", BLU: "BLUE", GRN: "GREEN", YEL: "YELLOW", WILD: "WILD" };
    return appState.settings.language === "zh" ? zh[color] : en[color];
  }

  private renderDiscardStack(cards: Card[], animateTopFromIndex: number | null = null): void {
    const visible = cards.slice(-12);
    this.discardZIndex = 200;

    visible.forEach((card, index) => {
      const isTop = index === visible.length - 1;
      const dom = this.createCardDom(card);
      dom.classList.add("discard-card");
      dom.style.pointerEvents = "none";
      const z = this.nextDiscardZIndex();
      if (isTop && animateTopFromIndex !== null) {
        const start = this.playerSpotCenter(animateTopFromIndex) || { x: DISCARD_X + CARD_W / 2, y: DISCARD_Y + CARD_H / 2 };
        dom.style.left = `${start.x - CARD_W / 2}px`;
        dom.style.top = `${start.y - CARD_H / 2}px`;
        dom.style.opacity = "1";
        dom.style.transform = `scale(0.72) rotate(${(index * 13) % 17 - 8}deg)`;
        this.animateCardToDiscard(dom, z, 650);
        return;
      }

      const offset = index - visible.length + 1;
      const driftX = (offset % 5) * 1.7;
      const driftY = (offset % 4) * 1.4;
      const rotation = ((index * 17) % 31) - 15;
      dom.style.left = `${DISCARD_X + driftX}px`;
      dom.style.top = `${DISCARD_Y + driftY}px`;
      dom.style.transform = `rotate(${rotation}deg)`;
      dom.style.zIndex = String(z);
    });
  }

  private syncOnlineGameState(container: HTMLElement): void {
    const roomState = this.onlineRoom?.state;
    if (!roomState) return;

    const ordered = this.onlinePlayersOrdered();
    if (!ordered.length) return;

    this.roomPlayers = ordered.map((player) => ({
      id: Number(player.id),
      name: player.name || `P${Number(player.id) + 1}`,
      color: player.color || "#EDF2F7",
      isHost: Boolean(player.isHost),
      isReady: Boolean(player.isReady),
      avatar: player.avatar || "",
      accessoryId: player.accessoryId || "",
      accessoryColor: player.accessoryColor || "",
    }));
    this.playerCount = this.roomPlayers.length;

    const currentSeat = Number(roomState.currentPlayer || 0);
    const currentPlayerIndex = Math.max(0, ordered.findIndex((player) => Number(player.id) === currentSeat));
    const currentColor = (roomState.currentColor || "RED") as CardColor;
    const top = this.normalizeOnlineTopCard(roomState.topCard || this.dummyCard(), currentColor);
    const previousTopIdentity = this.onlineLastTopIdentity;
    const previousTopVisual = this.onlineLastTopVisual;
    const previousCurrentSeat = this.onlineLastCurrentSeat;
    const nextTopIdentity = this.cardIdentityKey(top);
    const nextTopVisual = this.cardVisualKey(top);
    let animateDiscardFromIndex: number | null = null;
    if (!this.onlineDiscardStack.length) {
      this.onlineDiscardStack = [top];
    } else if (nextTopIdentity && nextTopIdentity !== previousTopIdentity) {
      this.onlineDiscardStack.push(top);
      this.onlineDiscardStack = this.onlineDiscardStack.slice(-12);
      const playedLocalIndex = previousCurrentSeat !== null
        ? ordered.findIndex((player) => Number(player.id) === previousCurrentSeat)
        : -1;
      if (previousTopIdentity && playedLocalIndex >= 0) animateDiscardFromIndex = playedLocalIndex;
    } else {
      this.onlineDiscardStack[this.onlineDiscardStack.length - 1] = top;
    }
    this.onlineLastTopIdentity = nextTopIdentity;
    this.onlineLastTopVisual = nextTopVisual;
    this.onlineLastCurrentSeat = currentSeat;
    const phase = roomState.phase === "finished" ? "finished" : "playing";

    this.gs = {
      deck: Array.from({ length: Math.max(0, Number(roomState.deckCount) || 0) }, () => this.dummyCard()),
      discardPile: [top],
      players: ordered.map((player, index) => ({
        id: index,
        name: player.name || `P${Number(player.id) + 1}`,
        hand: index === 0
          ? [...this.onlineHand]
          : Array.from({ length: Math.max(0, Number(player.handCount) || 0) }, () => this.dummyCard()),
        isHuman: true,
        color: player.color || "#EDF2F7",
      })),
      currentPlayerIndex,
      isClockwise: Boolean(roomState.isClockwise),
      penaltyStack: Number(roomState.penaltyStack) || 0,
      currentColor,
      phase,
      winnerIndex: Number(roomState.winnerSeat) >= 0
        ? ordered.findIndex((player) => Number(player.id) === Number(roomState.winnerSeat))
        : null,
      unoCalled: new Set(),
    };

    this.animLock = false;
    this.hasDrawnThisTurn = false;
    this.drawnCardThisTurn = null;
    const shouldRebuildDiscard = animateDiscardFromIndex !== null
      || !this.cardsLayer.querySelector(".discard-card")
      || nextTopVisual !== previousTopVisual;
    this.cardDomMap = new WeakMap();
    if (shouldRebuildDiscard) {
      this.cardsLayer.innerHTML = "";
    } else {
      this.cardsLayer.querySelectorAll(".hand-card, .deck-card").forEach((el) => el.remove());
    }
    this.createPlayerSpots(container);
    this.renderHumanHand(container);
    this.renderDeckBacks();
    if (shouldRebuildDiscard) this.renderDiscardStack(this.onlineDiscardStack, animateDiscardFromIndex);
    this.updateUI(container);
    this.updateDeckCount(container);
  }

  private orderedRoomPlayers(): Array<{ id: number; name: string; color: string }> {
    const players = [...this.roomPlayers].sort((a, b) => a.id - b.id);
    if (this.mySeat < 0) return players;
    const me = players.find((player) => player.id === this.mySeat);
    return me ? [me, ...players.filter((player) => player.id !== this.mySeat)] : players;
  }

  private startGame(container: HTMLElement, playerCount: number): void {
    (container.querySelector("#setup-overlay") as HTMLElement).style.display = "none";
    this.gs = createGame(playerCount);
    const roomPlayers = this.gameMode === "multi" ? this.orderedRoomPlayers() : [];
    this.gs.players.forEach((player, index) => {
      const roomPlayer = roomPlayers[index];
      player.name = roomPlayer?.name || (index === 0 ? (appState.playerName || t("game.me")) : `${t("game.cpu")}-${index + 1}`);
      player.color = roomPlayer?.color || player.color;
      player.isHuman = this.gameMode === "multi" ? Boolean(roomPlayer) : index === 0;
    });
    this.animLock = false;
    this.hasDrawnThisTurn = false;
    this.drawnCardThisTurn = null;
    this.cardDomMap = new WeakMap();
    this.discardZIndex = 200;
    this.playedCounts = this.gs.players.map(() => 0);

    this.cardsLayer.innerHTML = "";
    this.fxLayer.innerHTML = "";

    this.createPlayerSpots(container);
    this.renderHumanHand(container);
    this.renderDeckBacks();
    this.renderTopDiscard();
    this.updateUI(container);
    this.updateDeckCount(container);

    // 如果先手是 AI
    if (this.gs.currentPlayerIndex !== 0 && this.gameMode === "ai") {
      setTimeout(() => this.aiTurn(container), 1200);
    } else if (this.gs.currentPlayerIndex !== 0) {
      this.showToast(container, `等待 ${this.gs.players[this.gs.currentPlayerIndex].name} 操作`);
    } else {
      this.enableHumanInput(container);
    }
  }

  private resetGame(container: HTMLElement): void {
    const overlay = container.querySelector("#winner-overlay") as HTMLElement;
    if (overlay) overlay.style.display = "none";
    (container.querySelector("#setup-overlay") as HTMLElement).style.display = "flex";
    this.cardsLayer.innerHTML = "";
    this.fxLayer.innerHTML = "";
  }

  // ===================== 渲染 =====================

  private getWildChosenColor(card: Card): CardColor | null {
    return card.color === "WILD" && card.chosenColor && card.chosenColor !== "WILD"
      ? card.chosenColor
      : null;
  }

  private renderWildChoiceChip(card: Card): string {
    if (card.color !== "WILD") return "";
    const chosenColor = this.getWildChosenColor(card);
    const background = chosenColor
      ? COLOR_HEX[chosenColor]
      : `conic-gradient(${COLOR_HEX.RED} 0 25%, ${COLOR_HEX.BLU} 0 50%, ${COLOR_HEX.GRN} 0 75%, ${COLOR_HEX.YEL} 0 100%)`;
    return `<span class="wild-choice-chip" style="background:${background};"></span>`;
  }

  private updateWildChoiceOnCard(card: Card, color: CardColor): void {
    card.chosenColor = color;
    const dom = this.cardDomMap.get(card);
    if (!dom) return;

    const front = dom.querySelector(".game-card-front") as HTMLElement | null;
    if (!front) return;

    front.style.borderColor = COLOR_HEX[color];
    front.style.color = "var(--color-white)";
    front.style.textShadow = "2px 2px 0 var(--color-black)";

    let chip = front.querySelector(".wild-choice-chip") as HTMLElement | null;
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "wild-choice-chip";
      front.prepend(chip);
    }
    chip.style.background = COLOR_HEX[color];
  }

  private createCardDom(card: Card): HTMLElement {
    const el = document.createElement("div");
    const chosenColor = this.getWildChosenColor(card);
    const frontColor = card.color === "WILD" ? "var(--color-white)" : COLOR_HEX[card.color];
    const borderColor = chosenColor ? COLOR_HEX[chosenColor] : COLOR_HEX[card.color];
    const wildTextShadow = card.color === "WILD" ? "text-shadow:2px 2px 0 var(--color-black);" : "";
    el.className = "game-card";
    el.dataset.card = "true";
    el.innerHTML = `
      <div class="game-card-inner">
        <div class="game-card-front" style="color:${frontColor};border-color:${borderColor};${wildTextShadow}">
          ${this.renderWildChoiceChip(card)}
          <span style="font-size:38px;font-family:'Press Start 2P',monospace;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">${getSymbol(card.value)}</span>
          <span style="font-size:8px;font-weight:bold;position:absolute;top:4px;left:4px;">${getSymbol(card.value)}</span>
          <span style="font-size:8px;font-weight:bold;position:absolute;bottom:4px;right:4px;transform:rotate(180deg);">${getSymbol(card.value)}</span>
        </div>
        <div class="game-card-back"></div>
      </div>
    `;
    el._cardData = card;
    this.cardsLayer.appendChild(el);
    this.cardDomMap.set(card, el);
    return el;
  }

  private renderHumanHand(container: HTMLElement): void {
    const hand = this.gs.players[0].hand;
    hand.forEach((card) => {
      const dom = this.createCardDom(card);
      dom.classList.add("hand-card");
    });
    this.layoutHand(container);
  }

  private layoutHand(container: HTMLElement): void {
    const hand = this.gs.players[0].hand;
    const total = hand.length;
    if (total === 0) return;

    const centerX = 530;
    const baseY = 580;
    const maxAngle = 35;
    const spacing = Math.min(48, Math.max(26, 420 / Math.max(1, total)));
    const totalWidth = spacing * (total - 1);
    const startX = centerX - totalWidth / 2;

    const validPlays = this.getPlayableCards();

    hand.forEach((card, i) => {
      const dom = this.cardDomMap.get(card);
      if (!dom) return;
      const ratio = total === 1 ? 0.5 : i / (total - 1);
      const offsetFromCenter = (ratio - 0.5) * 2;
      const angle = offsetFromCenter * maxAngle;
      const x = startX + i * spacing - CARD_W / 2;
      const y = baseY - CARD_H;

      dom.style.transformOrigin = "center bottom";
      dom.style.transition = "left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.35s, transform 0.35s";
      dom.style.left = x + "px";
      dom.style.top = y + "px";
      dom.style.transform = `rotate(${angle}deg)`;
      dom.style.zIndex = String(100 + i);
      dom.style.opacity = "1";
      dom.style.pointerEvents = "auto";

      // 悬停
      dom.onmouseenter = () => {
        if (this.animLock || this.gs.currentPlayerIndex !== 0) return;
        dom.style.transform = `rotate(${angle}deg) translateY(-22px) scale(1.14)`;
        dom.style.zIndex = "999";
      };
      dom.onmouseleave = () => {
        dom.style.transform = `rotate(${angle}deg)`;
        dom.style.zIndex = String(100 + i);
      };

      // 点击
      dom.onclick = (e) => {
        e.stopPropagation();
        if (this.animLock || this.gs.currentPlayerIndex !== 0) return;
        if (this.hasDrawnThisTurn && this.drawnCardThisTurn && card !== this.drawnCardThisTurn) {
          this.showToast(container, t("game.drawThenPlay"));
          return;
        }
        this.handleHumanPlay(container, card, dom);
      };

      // 合法高亮
      let isPlayable = false;
      if (this.gs.currentPlayerIndex === 0 && !this.hasDrawnThisTurn) {
        isPlayable = validPlays.includes(card);
      } else if (this.gs.currentPlayerIndex === 0 && this.hasDrawnThisTurn && this.drawnCardThisTurn) {
        isPlayable = card === this.drawnCardThisTurn;
      }
      dom.style.filter = isPlayable ? "drop-shadow(0 0 8px var(--color-yellow))" : "";
    });
  }

  /** get playable cards for human player */
  private getPlayableCards(): Card[] {
    const hand = this.gs.players[0].hand;
    if (this.gs.currentPlayerIndex !== 0) return [];
    if (this.hasDrawnThisTurn && this.drawnCardThisTurn) {
      const valid = this.gs.penaltyStack > 0
        ? canPlayUnderPenalty(this.drawnCardThisTurn, this.gs)
        : isValidPlay(this.drawnCardThisTurn, this.gs);
      return valid ? [this.drawnCardThisTurn] : [];
    }
    return getValidPlays(hand, this.gs);
  }

  private renderDeckBacks(): void {
    const maxBacks = Math.min(9, Math.max(1, Math.ceil(this.gs.deck.length / 12)));
    const step = 1.8;
    for (let i = 0; i < maxBacks; i++) {
      const el = document.createElement("div");
      el.className = "game-card deck-card flipped";
      el.style.pointerEvents = "none";
      el.innerHTML = `
        <div class="game-card-inner">
          <div class="game-card-front" style="background:transparent;border-color:transparent;"></div>
          <div class="game-card-back"></div>
        </div>
      `;
      el.style.left = (DECK_X - i * step) + "px";
      el.style.top = (DECK_Y - i * step) + "px";
      el.style.zIndex = String(5 + maxBacks - i);
      this.cardsLayer.appendChild(el);
    }
  }

  private nextDiscardZIndex(): number {
    this.discardZIndex += 1;
    return this.discardZIndex;
  }

  private renderTopDiscard(): void {
    const top = this.gs.discardPile[this.gs.discardPile.length - 1];
    const dom = this.createCardDom(top);
    dom.style.left = DISCARD_X + "px";
    dom.style.top = DISCARD_Y + "px";
    dom.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg)`;
    dom.style.zIndex = String(this.nextDiscardZIndex());
    dom.style.pointerEvents = "none";
  }

  private createPlayerSpots(container: HTMLElement): void {
    const spotsEl = container.querySelector("#player-spots")!;
    spotsEl.innerHTML = "";

    const cx = 530, cy = 280;
    const count = this.gs.players.length;
    const rx = count <= 4 ? 340 : count <= 8 ? 360 : 380;
    const ry = count <= 4 ? 170 : count <= 8 ? 165 : 155;
    const avSize = count <= 4 ? 52 : count <= 8 ? 42 : 34;

    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 2 + (2 * Math.PI * i) / count;
      let x = cx + Math.cos(angle) * rx;
      let y = cy + Math.sin(angle) * ry;
      if (i === 0) { x = cx; y = count <= 4 ? 635 : count <= 8 ? 645 : 655; }

      const p = this.gs.players[i];
      const roomPlayer = this.roomPlayers[i];
      const avatarCode = roomPlayer?.avatar || (i === 0 ? appState.avatar : "");
      const accessoryHtml = roomPlayer?.accessoryId
        ? renderAccessory({ id: roomPlayer.accessoryId, color: (roomPlayer.accessoryColor || "yellow") as any }, avSize)
        : i === 0 ? renderAccessory(appState.equippedAccessory, avSize) : "";
      const avatarHtml = avatarCode ? renderAvatar(avatarCode) : "";
      const pixelClass = avatarCode ? "p-avatar-pixel" : "";
      const spot = document.createElement("div");
      spot.className = "player-spot";
      spot.id = "spot-" + i;
      spot.style.left = (x - avSize / 2) + "px";
      spot.style.top = (y - avSize / 2) + "px";
      spot.innerHTML = `
        <div class="avatar-stack" style="width:${avSize}px;height:${avSize}px;">
          ${accessoryHtml}
          <div class="p-avatar ${i === 0 ? 'is-me' : ''} ${pixelClass}" style="width:${avSize}px;height:${avSize}px;background:${i === 0 ? 'var(--color-yellow)' : p.color};font-size:${avSize <= 34 ? '7px' : '10px'};">${avatarHtml}</div>
        </div>
        <div class="p-name" style="font-size:${avSize <= 34 ? '6px' : '7px'};">${i === 0 ? t("game.me") : p.name}</div>
        <div class="p-count" style="font-size:${avSize <= 34 ? '6px' : '7px'};">${t("game.playerCards", { 0: p.hand.length })}</div>
        <div class="p-order"></div>
      `;
      const avatar = spot.querySelector(".p-avatar") as HTMLElement;
      avatar.addEventListener("click", (event) => {
        event.stopPropagation();
        audio.playClick();
        const menu = container.querySelector(i === 0 ? "#shout-menu" : "#interact-menu") as HTMLElement;
        this.hidePopupMenus(container);
        if (i !== 0) {
          this.interactTargetIndex = i;
          menu.innerHTML = this.renderInteractButtons();
        }
        this.openPopupNear(container, menu, avatar);
      });
      spotsEl.appendChild(spot);
    }
  }

  // ===================== UI 更新 =====================

  private updateUI(container: HTMLElement): void {
    const gs = this.gs;
    const p = gs.players[gs.currentPlayerIndex];
    const playerName = gs.currentPlayerIndex === 0 ? t("game.me") : p.name;
    const colorText = this.colorLabel(gs.currentColor);
    container.querySelector("#current-player-name")!.textContent = `${playerName} ${appState.settings.language === "zh" ? "出牌" : "turn"}`;
    (container.querySelector("#current-color-dot") as HTMLElement).style.background = COLOR_HEX[gs.currentColor];
    container.querySelector("#current-color-text")!.textContent = colorText;
    container.querySelector("#direction-icon")!.textContent = gs.isClockwise ? "\u21BB" : "\u21BA";
    const directionText = container.querySelector("#direction-text");
    if (directionText) directionText.textContent = gs.isClockwise ? "CW" : "CCW";

    const penaltyBadge = container.querySelector("#penalty-badge") as HTMLElement;
    if (gs.penaltyStack > 0) {
      penaltyBadge.style.display = "inline";
      penaltyBadge.textContent = "+" + gs.penaltyStack;
    } else {
      penaltyBadge.style.display = "none";
    }

    // 高亮当前玩家
    for (let i = 0; i < gs.players.length; i++) {
      const spot = container.querySelector("#spot-" + i);
      if (spot) {
        spot.classList.toggle("current", i === gs.currentPlayerIndex);
        const orderEl = spot.querySelector(".p-order");
        if (orderEl) {
          const distance = gs.isClockwise
            ? (i - gs.currentPlayerIndex + gs.players.length) % gs.players.length
            : (gs.currentPlayerIndex - i + gs.players.length) % gs.players.length;
          orderEl.textContent = distance === 0 ? (appState.settings.language === "zh" ? "当前" : "NOW") : `+${distance}`;
        }
      }
    }

    // 更新手牌计数
    for (let i = 0; i < gs.players.length; i++) {
      const spot = container.querySelector("#spot-" + i);
      const countEl = spot?.querySelector(".p-count");
      if (countEl) countEl.textContent = t("game.playerCards", { 0: gs.players[i].hand.length });
    }

    // UNO 按钮
    this.updateDeckCount(container);
  }

  private updateDeckCount(container: HTMLElement): void {
    const el = container.querySelector("#deck-count-below")!;
    el.textContent = t("game.cardsCount", { 0: this.gs.deck.length });

    const deckZone = container.querySelector("#deck-zone") as HTMLElement;

    if (this.gs.currentPlayerIndex === 0 && this.gs.phase === "playing") {
      deckZone.style.borderColor = "var(--color-blue)";
      deckZone.style.cursor = "pointer";
      deckZone.classList.add("clickable");
    } else {
      deckZone.style.borderColor = "var(--color-gray)";
      deckZone.style.cursor = "default";
      deckZone.classList.remove("clickable");
    }
  }

  // ===================== 玩家操作 =====================

  private handleHumanPlay(container: HTMLElement, card: Card, dom: HTMLElement): void {
    if (this.animLock || this.gs.currentPlayerIndex !== 0 || this.gs.phase !== "playing") return;
    if (this.hasDrawnThisTurn && this.drawnCardThisTurn && card !== this.drawnCardThisTurn) return;

    const hand = this.gs.players[0].hand;
    const idx = hand.indexOf(card);
    if (idx === -1) return;

    if (this.isRemoteGame()) {
      this.dispatchGameAction({ type: "play", cardIndex: idx });
      if (card.color === "WILD") {
        this.showWildPicker(container, true);
      }
      return;
    }

    this.dispatchGameAction({ type: "play", cardIndex: idx });
  }

  private performLocalHumanPlay(container: HTMLElement, cardIndex: number): boolean {
    const hand = this.gs.players[0].hand;
    const card = hand[cardIndex];
    const dom = card ? this.cardDomMap.get(card) : null;
    if (!card || !dom) return false;

    const valid = this.gs.penaltyStack > 0
      ? canPlayUnderPenalty(card, this.gs)
      : isValidPlay(card, this.gs);

    if (!valid) { this.showToast(container, t("game.cantPlay")); return false; }

    this.animLock = true;
    audio.playCardPlace();

    // 出牌
    playCard(this.gs, 0, cardIndex);
    this.playedCounts[0] = (this.playedCounts[0] || 0) + 1;
    this.drawnCardThisTurn = null;
    dom.onmouseenter = null;
    dom.onmouseleave = null;
    dom.onclick = null;
    dom.style.filter = "";

    // 动画移到弃牌堆
    const discardZ = this.nextDiscardZIndex();
    dom.style.transformOrigin = "center center";
    dom.style.pointerEvents = "none";
    this.animateCardToDiscard(dom, discardZ, 620);

    setTimeout(() => {
      this.layoutHand(container);
      this.updateUI(container);

      if (checkWin(this.gs) !== null) {
        this.endGame(container, 0);
        this.animLock = false;
        return;
      }

      // 清空危险标记（手牌变化）
      if (this.gs.players[0].hand.length === 1) {
        callUno(this.gs, 0);
        audio.playUno();
        this.showToast(container, t("game.unoShout"));
      } else {
        clearUnoCall(this.gs, 0);
      }

      // 万能牌
      if (card.color === "WILD") {
        this.showWildPicker(container, true);
        this.animLock = false;
      } else {
        this.animLock = false;
        applyCardEffect(this.gs, card);
        this.updateUI(container);
        this.afterTurn(container);
      }
    }, 620);

    return true;
  }

  private handleDraw(container: HTMLElement): void {
    if (this.animLock || this.gs.currentPlayerIndex !== 0 || this.gs.phase !== "playing") return;

    if (this.isRemoteGame()) {
      this.dispatchGameAction({ type: "draw" });
      window.setTimeout(() => this.dispatchGameAction({ type: "pass" }), 120);
      return;
    }

    this.dispatchGameAction({ type: "draw" });
  }

  private performLocalDraw(container: HTMLElement): boolean {
    this.animLock = true;
    audio.playDrawCard();

    if (this.gs.penaltyStack > 0) {
      const drawn = this.drawPenaltyCardsFor(container, 0);
      this.layoutHand(container);
      this.updateDeckCount(container);
      this.updateUI(container);
      this.updateDeckBacksVisual();

      setTimeout(() => {
        this.animLock = false;
        advanceTurn(this.gs);
        this.updateUI(container);
        this.afterTurn(container);
      }, Math.max(320, drawn * 90));
      return true;
    }

    const card = drawCard(this.gs, 0);
    if (!card) {
      this.animLock = false;
      this.showToast(container, t("game.deckEmpty"));
      return false;
    }

    this.hasDrawnThisTurn = false;
    this.drawnCardThisTurn = null;
    clearUnoCall(this.gs, 0);

    this.createCardDom(card);
    this.layoutHand(container);
    this.updateDeckCount(container);
    this.updateUI(container);
    this.updateDeckBacksVisual();

    setTimeout(() => {
      this.animLock = false;
      advanceTurn(this.gs);
      this.updateUI(container);
      this.afterTurn(container);
    }, 320);

    return true;
  }

  private drawPenaltyCardsFor(container: HTMLElement, playerIndex: number): number {
    const penalty = this.gs.penaltyStack;
    let drawn = 0;

    for (let i = 0; i < penalty; i++) {
      const card = drawCard(this.gs, playerIndex);
      if (!card) break;
      drawn += 1;
      if (playerIndex === 0) this.createCardDom(card);
    }

    this.gs.penaltyStack = 0;
    clearUnoCall(this.gs, playerIndex);

    if (drawn > 0) {
      this.showPenaltyPopup(playerIndex, drawn);
      this.showToast(container, `${this.gs.players[playerIndex].name} +${drawn}`);
    } else {
      this.showToast(container, t("game.deckEmpty"));
    }

    return drawn;
  }

  private resolveWildColor(container: HTMLElement, color: CardColor): void {
    const handled = this.dispatchGameAction({ type: "chooseColor", color });
    if (handled && this.isRemoteGame()) this.showWildPicker(container, false);
  }

  private performLocalWildColor(container: HTMLElement, color: CardColor): boolean {
    const top = this.gs.discardPile[this.gs.discardPile.length - 1];
    this.updateWildChoiceOnCard(top, color);
    this.gs.currentColor = color;
    this.showWildPicker(container, false);
    this.updateUI(container);
    applyCardEffect(this.gs, top);
    this.updateUI(container);
    this.afterTurn(container);
    return true;
  }

  // ===================== AI =====================

  private aiTurn(container: HTMLElement): void {
    if (this.gameMode === "multi") return;
    if (this.animLock || this.gs.phase !== "playing") return;
    const idx = this.gs.currentPlayerIndex;
    if (idx === 0) return;

    // AI 检查是否有玩家忘喊 LAST
    for (let i = 0; i < this.gs.players.length; i++) {
      if (i !== idx && isUnoDanger(this.gs, i)) {
        catchUnoFail(this.gs, idx, i);
        this.showToast(container, `${this.gs.players[idx].name} ${t("game.caughtUno", { 0: this.gs.players[i].name })}`);
        this.updateUI(container);
        break;
      }
    }

    const cardIdx = aiDecideCard(this.gs, idx);

    if (cardIdx >= 0) {
      // AI 出牌
      const card = this.gs.players[idx].hand[cardIdx];
      playCard(this.gs, idx, cardIdx);
      this.playedCounts[idx] = (this.playedCounts[idx] || 0) + 1;
      audio.playCardPlace();
      this.animateOpponentPlay(idx, card);

      // AI 自动喊 LAST
      if (this.gs.players[idx].hand.length === 1) {
        callUno(this.gs, idx);
        this.showToast(container, `${this.gs.players[idx].name}: LAST!`);
      }

      this.updateUI(container);
      this.updateDeckCount(container);

      if (checkWin(this.gs) !== null) {
        this.endGame(container, idx);
        return;
      }

      if (card.color === "WILD") {
        const chosenColor = aiChooseWildColor(this.gs, idx);
        this.updateWildChoiceOnCard(card, chosenColor);
        this.gs.currentColor = chosenColor;
        this.updateUI(container);
      }

      applyCardEffect(this.gs, card);
      this.updateUI(container);
    } else if (this.gs.penaltyStack > 0) {
      this.drawPenaltyCardsFor(container, idx);
      audio.playDrawCard();
      this.updateUI(container);
      this.updateDeckCount(container);
      this.updateDeckBacksVisual();
      advanceTurn(this.gs);
      this.updateUI(container);
    } else {
      // AI 抽牌
      drawCard(this.gs, idx);
      audio.playDrawCard();
      this.updateUI(container);
      this.updateDeckCount(container);
      advanceTurn(this.gs);
      this.updateUI(container);
    }

    this.updateDeckBacksVisual();

    if (this.gs.currentPlayerIndex === 0) {
      this.hasDrawnThisTurn = false;
      this.drawnCardThisTurn = null;
      this.layoutHand(container);
      this.updateUI(container);
      this.enableHumanInput(container);
    } else {
      setTimeout(() => this.aiTurn(container), 800 + Math.random() * 600);
    }
  }

  private afterTurn(container: HTMLElement): void {
    if (this.gs.currentPlayerIndex === 0) {
      this.hasDrawnThisTurn = false;
      this.drawnCardThisTurn = null;
      this.layoutHand(container);
      this.updateUI(container);
      this.enableHumanInput(container);
    } else {
      this.updateDeckBacksVisual();
      if (this.gameMode === "ai") {
        setTimeout(() => this.aiTurn(container), 800 + Math.random() * 600);
      } else {
        this.showToast(container, `等待 ${this.gs.players[this.gs.currentPlayerIndex].name} 操作`);
      }
    }
  }

  private enableHumanInput(container: HTMLElement): void {
    const deckZone = container.querySelector("#deck-zone") as HTMLElement;

    deckZone.style.borderColor = "var(--color-blue)";
    deckZone.style.cursor = "pointer";
    deckZone.classList.add("clickable");
  }

  private settlementCosmeticsForLocalIndex(index: number): Pick<SettlementPlayer, "avatar" | "accessoryId" | "accessoryColor"> {
    const roomPlayer = this.roomPlayers[index];
    if (this.gameMode === "multi" && roomPlayer) {
      return {
        avatar: roomPlayer.avatar,
        accessoryId: roomPlayer.accessoryId,
        accessoryColor: roomPlayer.accessoryColor,
      };
    }
    if (index === 0) {
      return {
        avatar: appState.avatar,
        accessoryId: appState.equippedAccessory?.id,
        accessoryColor: appState.equippedAccessory?.color,
      };
    }
    return {};
  }

  private settlementCosmeticsForSeat(seat: number): Pick<SettlementPlayer, "avatar" | "accessoryId" | "accessoryColor"> {
    const roomPlayer = this.roomPlayers.find((player) => Number(player.id) === Number(seat));
    if (roomPlayer) {
      return {
        avatar: roomPlayer.avatar,
        accessoryId: roomPlayer.accessoryId,
        accessoryColor: roomPlayer.accessoryColor,
      };
    }
    return this.settlementCosmeticsForLocalIndex(seat);
  }

  private enrichSettlementPlayers(players: SettlementPlayer[]): SettlementPlayer[] {
    return players.map((player, index) => {
      const cosmetics = this.gameMode === "multi"
        ? this.settlementCosmeticsForSeat(Number(player.id))
        : this.settlementCosmeticsForLocalIndex(index);
      return {
        ...player,
        avatar: player.avatar || cosmetics.avatar,
        accessoryId: player.accessoryId || cosmetics.accessoryId,
        accessoryColor: player.accessoryColor || cosmetics.accessoryColor,
      };
    });
  }

  private buildSettlement(winnerIndex: number): SettlementPlayer[] {
    const baseEntries = this.gs.players.map((player, index) => {
      const handValue = calculateScore(player.hand);
      return {
        id: index,
        name: player.name,
        cards: player.hand.length,
        played: this.playedCounts[index] || 0,
        handValue,
        color: player.color,
        isWinner: index === winnerIndex,
        ...this.settlementCosmeticsForLocalIndex(index),
      };
    });

    const ranked = [...baseEntries].sort((a, b) => {
      if (a.isWinner) return -1;
      if (b.isWinner) return 1;
      if (a.cards !== b.cards) return a.cards - b.cards;
      if (a.played !== b.played) return b.played - a.played;
      if (a.handValue !== b.handValue) return a.handValue - b.handValue;
      return a.id - b.id;
    });

    const scored = ranked.map((entry, index): SettlementPlayer => {
      const rank = index + 1;
      const rankBonus = entry.isWinner ? 120 + this.gs.players.length * 10 : Math.max(10, 90 - rank * 20);
      const playBonus = entry.played * (entry.isWinner ? 6 : 5);
      const residueBonus = entry.isWinner
        ? baseEntries.filter((p) => !p.isWinner).reduce((sum, p) => sum + p.handValue, 0)
        : 0;
      const cardPenalty = entry.isWinner ? 0 : entry.cards * 10 + Math.floor(entry.handValue * 0.35);
      const points = rankBonus + playBonus + residueBonus - cardPenalty;

      return {
        ...entry,
        rank,
        rankBonus,
        playBonus,
        residueBonus,
        cardPenalty,
        points,
      };
    });

    const winner = scored.find((entry) => entry.isWinner)!;
    const highestOtherScore = Math.max(...scored.filter((entry) => !entry.isWinner).map((entry) => entry.points), 0);
    if (winner.points <= highestOtherScore) {
      winner.points = highestOtherScore + 50;
      winner.residueBonus += 50;
    }

    return scored.sort((a, b) => a.rank - b.rank);
  }

  // ===================== 游戏结束 =====================

  private endGame(container: HTMLElement, winnerIndex: number): void {
    this.gs.phase = "finished";
    const winner = this.gs.players[winnerIndex];
    const isPlayerWin = winnerIndex === 0;

    if (isPlayerWin) {
      audio.playWin();
    } else {
      audio.playLose();
    }

    // 计算分数
    const scores = this.buildSettlement(winnerIndex);
    const winnerScore = scores.find((entry) => entry.isWinner)?.points || 0;
    const playerScore = scores.find((entry) => entry.id === 0)?.points || 0;

    // 保存结果到 sessionStorage 供结算页使用
    sessionStorage.setItem("card_party_result", JSON.stringify({
      winner: winner.name,
      winnerScore,
      isPlayerWin,
      scoring: {
        rank: "排名奖励",
        played: "出牌奖励",
        residue: "赢家收取全场剩余手牌分",
        penalty: "非赢家按剩牌数和手牌分扣分",
      },
      players: scores,
    }));

    const shouldPersistResult = this.gameMode === "ai" && appState.authToken;
    if (shouldPersistResult) {
      void api.submitGameResult({
        winner: winner.name,
        winnerScore,
        isPlayerWin,
        players: scores,
      }).then(() => api.refreshAccount()).catch(() => {
        // Local play remains available if the API is temporarily unavailable.
      });
    }

    // 更新全局状态
    if (!shouldPersistResult) {
      if (isPlayerWin) {
        const newWins = appState.wins + 1;
        const newTotal = appState.totalGames + 1;
        const newPoints = appState.points + playerScore;
        const newLevel = Math.floor(Math.sqrt(newPoints / 10)) + 1;
        appState.update({
          wins: newWins,
          totalGames: newTotal,
          points: newPoints,
          level: newLevel,
          coins: appState.coins + Math.max(0, playerScore),
        });
      } else {
        const newTotal = appState.totalGames + 1;
        const newPoints = Math.max(0, appState.points + playerScore);
        const newLevel = Math.floor(Math.sqrt(newPoints / 10)) + 1;
        appState.update({ totalGames: newTotal, points: newPoints, level: newLevel });
      }
    }

    // 显示赢家覆盖层
    const overlay = container.querySelector("#winner-overlay") as HTMLElement;
    const msg = container.querySelector("#winner-msg")!;
    msg.textContent = isPlayerWin ? t("game.youWin") : t("game.otherWin", { 0: winner.name });
    overlay.style.display = "flex";
    setTimeout(() => router.navigate("#result"), 900);
  }

  // ===================== 辅助 =====================

  private showWildPicker(container: HTMLElement, show: boolean): void {
    const picker = container.querySelector("#wild-picker") as HTMLElement;
    picker.style.display = show ? "flex" : "none";
  }

  private showToast(container: HTMLElement, msg: string): void {
    const el = container.querySelector("#msg-toast") as HTMLElement;
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout((el as any)._toastTimer);
    (el as any)._toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 2000);
  }

  private showPenaltyPopup(playerIndex: number, count: number): void {
    const center = this.playerSpotCenter(playerIndex);
    if (!center || count <= 0) return;

    const popup = document.createElement("div");
    popup.className = "penalty-popup";
    popup.textContent = `+${count}`;
    popup.style.left = `${center.x - 16}px`;
    popup.style.top = `${center.y - 70}px`;
    this.fxLayer.appendChild(popup);
    setTimeout(() => popup.remove(), 1500);
  }

  private elementBoxInBoard(element: HTMLElement): { left: number; top: number; width: number; height: number; right: number; bottom: number } {
    let left = 0;
    let top = 0;
    let node: HTMLElement | null = element;

    while (node && node !== this.boardEl) {
      left += node.offsetLeft;
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }

    if (node === this.boardEl) {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      return { left, top, width, height, right: left + width, bottom: top + height };
    }

    const boardRect = this.boardEl.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scaleX = this.boardEl.offsetWidth / Math.max(1, boardRect.width);
    const scaleY = this.boardEl.offsetHeight / Math.max(1, boardRect.height);
    const fallbackLeft = (elementRect.left - boardRect.left) * scaleX;
    const fallbackTop = (elementRect.top - boardRect.top) * scaleY;
    const fallbackWidth = elementRect.width * scaleX;
    const fallbackHeight = elementRect.height * scaleY;
    return {
      left: fallbackLeft,
      top: fallbackTop,
      width: fallbackWidth,
      height: fallbackHeight,
      right: fallbackLeft + fallbackWidth,
      bottom: fallbackTop + fallbackHeight,
    };
  }

  private openPopupNear(container: HTMLElement, menu: HTMLElement, anchor: HTMLElement): void {
    if (!menu || !anchor) return;

    const anchorBox = this.elementBoxInBoard(anchor);

    menu.style.display = "flex";
    menu.style.visibility = "hidden";
    menu.style.left = "0px";
    menu.style.top = "0px";
    menu.style.right = "auto";
    menu.style.bottom = "auto";

    const margin = 12;
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    let left = anchorBox.right + margin;
    let top = anchorBox.top;

    if (left + menuWidth > this.boardEl.clientWidth - margin) {
      left = anchorBox.left - menuWidth - margin;
    }
    if (top + menuHeight > this.boardEl.clientHeight - margin) {
      top = this.boardEl.clientHeight - menuHeight - margin;
    }
    if (left < margin) left = margin;
    if (top < 60) top = 60;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = "visible";
  }

  private hidePopupMenus(container: HTMLElement): void {
    const shoutMenu = container.querySelector("#shout-menu") as HTMLElement | null;
    const interactMenu = container.querySelector("#interact-menu") as HTMLElement | null;
    const settingsMenu = container.querySelector("#game-settings-menu") as HTMLElement | null;
    if (shoutMenu) shoutMenu.style.display = "none";
    if (interactMenu) interactMenu.style.display = "none";
    if (settingsMenu) settingsMenu.style.display = "none";
    this.interactTargetIndex = null;
  }

  private playerSpotCenter(playerIndex: number): { x: number; y: number } | null {
    const spot = this.boardEl.querySelector(`#spot-${playerIndex}`) as HTMLElement | null;
    if (!spot) return null;

    const box = this.elementBoxInBoard(spot);
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    };
  }

  private showSpeech(container: HTMLElement, playerIndex: number, msg: string): void {
    const bubble = container.querySelector("#speech-bubble") as HTMLElement;
    const center = this.playerSpotCenter(playerIndex);
    if (!center || !msg) return;

    bubble.textContent = msg;
    bubble.style.left = `${center.x}px`;
    bubble.style.top = `${Math.max(60, center.y - 82)}px`;
    bubble.style.transform = "translateX(-50%)";
    bubble.style.opacity = "1";

    clearTimeout((bubble as any)._speechTimer);
    (bubble as any)._speechTimer = setTimeout(() => {
      bubble.style.opacity = "0";
    }, 2200);
  }

  private throwEmoji(container: HTMLElement, fromIndex: number, toIndex: number, emoji: string): void {
    const from = this.playerSpotCenter(fromIndex);
    const to = this.playerSpotCenter(toIndex);
    if (!from || !to || !emoji) return;

    const projectile = document.createElement("div");
    projectile.className = "emoji-projectile";
    projectile.textContent = emoji;
    projectile.style.left = `${from.x}px`;
    projectile.style.top = `${from.y}px`;
    projectile.style.transform = "translate(-50%, -50%) scale(0.75)";
    projectile.style.transition = "left 0.65s cubic-bezier(0.34,1.56,0.64,1), top 0.65s cubic-bezier(0.34,1.56,0.64,1), transform 0.65s";
    this.fxLayer.appendChild(projectile);

    requestAnimationFrame(() => {
      projectile.style.left = `${to.x}px`;
      projectile.style.top = `${to.y}px`;
      projectile.style.transform = "translate(-50%, -50%) rotate(720deg) scale(1.25)";
    });

    setTimeout(() => {
      projectile.remove();
      this.showSpeech(container, toIndex, emoji);
    }, 700);
  }

  private animateCardToDiscard(dom: HTMLElement, discardZ: number, duration: number = 620): void {
    const startLeft = parseFloat(dom.style.left) || dom.offsetLeft;
    const startTop = parseFloat(dom.style.top) || dom.offsetTop;
    const startTransform = dom.style.transform || "rotate(0deg)";
    const midLeft = (startLeft + DISCARD_X) / 2;
    const midTop = Math.min(startTop, DISCARD_Y) - 52;
    const endTransform = `rotate(${(Math.random() - 0.5) * 40}deg)`;

    dom.getAnimations().forEach((animation) => animation.cancel());
    dom.style.transition = "none";
    dom.style.left = `${startLeft}px`;
    dom.style.top = `${startTop}px`;
    dom.style.transform = startTransform;
    dom.style.opacity = "1";
    dom.style.zIndex = String(1000 + discardZ);

    const animation = dom.animate([
      {
        left: `${startLeft}px`,
        top: `${startTop}px`,
        transform: startTransform,
        opacity: 1,
      },
      {
        left: `${midLeft}px`,
        top: `${midTop}px`,
        transform: `${startTransform} rotate(210deg) scale(1.08)`,
        opacity: 1,
        offset: 0.58,
      },
      {
        left: DISCARD_X + "px",
        top: DISCARD_Y + "px",
        transform: endTransform,
        opacity: 1,
      },
    ], {
      duration,
      easing: "cubic-bezier(0.22,1,0.36,1)",
      fill: "forwards",
    });

    animation.onfinish = () => {
      dom.style.left = DISCARD_X + "px";
      dom.style.top = DISCARD_Y + "px";
      dom.style.transform = endTransform;
      dom.style.opacity = "1";
      dom.style.zIndex = String(discardZ);
      animation.cancel();
    };
  }

  private animateOpponentPlay(playerIndex: number, card: Card): void {
    const start = this.playerSpotCenter(playerIndex) || { x: DISCARD_X + CARD_W / 2, y: DISCARD_Y + CARD_H / 2 };
    const discardZ = this.nextDiscardZIndex();
    const dom = this.createCardDom(card);

    dom.style.left = `${start.x - CARD_W / 2}px`;
    dom.style.top = `${start.y - CARD_H / 2}px`;
    dom.style.opacity = "1";
    dom.style.pointerEvents = "none";
    dom.style.transform = `scale(0.72) rotate(${(Math.random() - 0.5) * 16}deg)`;
    this.animateCardToDiscard(dom, discardZ, 650);
  }

  private updateDeckBacksVisual(): void {
    // 刷新牌堆背面视觉效果
    this.cardsLayer.querySelectorAll(".deck-card").forEach((b) => b.remove());
    this.renderDeckBacks();
  }
}

// 扩展 HTMLElement 类型
declare global {
  interface HTMLElement {
    _cardData?: Card;
  }
}
