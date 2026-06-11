/**
 * 等待房间视图 — 移植自 等待房间.html
 * 支持两种模式：人机对战（AI）和多人联机（Multi）
 * AI模式：房主一人即可开始，可控制人机数量
 * 多人联机：全员准备后才可开始游戏
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { state } from "../core/state";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t, onLangChange } from "../core/i18n";
import { renderAvatar } from "../core/avatar";
import { renderAccessory, renderTitleBadge } from "../core/cosmetics";
import type { GameMode, GameModeContext } from "@card-party/shared";

// ---- 玩家类型 ----
interface RoomPlayer {
  id: number;
  name: string;
  avatar: string;
  accessory: string;
  isPixelAvatar: boolean;
  color: string;
  isReady: boolean;
  isHost: boolean;
  isAI: boolean;
  avatarCode?: string;
  accessoryId?: string;
  accessoryColor?: string;
  titleId?: string;
  titleZh?: string;
  titleEn?: string;
}

interface ChatMessage {
  sender: string;
  text: string;
  isSystem: boolean;
}

// ---- 游戏模式 ----
const BOT_NAMES = ["CPU-2", "CPU-3", "CPU-4", "CPU-5", "CPU-6", "CPU-7", "CPU-8", "CPU-9", "CPU-10", "CPU-11", "CPU-12"];
const BOT_COLORS = ["#4FC3F7", "#81C784", "#E57373", "#9B59B6", "#ED8936", "#38B2AC", "#F56565", "#9F7AEA", "#A0AEC0", "#F687B3", "#68D391"];
const ROOM_CONTEXT_KEY = "uno_room_context";

function loadRoomContext(): GameModeContext | null {
  try {
    const raw = sessionStorage.getItem(ROOM_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.mode !== "ai" && parsed?.mode !== "multi") return null;
    return {
      mode: parsed.mode,
      playerCount: Math.max(2, Number(parsed.playerCount) || 4),
      roomId: typeof parsed.roomId === "string" ? parsed.roomId : null,
      players: Array.isArray(parsed.players) ? parsed.players : [],
      mySeat: Number.isFinite(parsed.mySeat) ? parsed.mySeat : -1,
    };
  } catch {
    return null;
  }
}

function saveRoomContext(): void {
  try {
    sessionStorage.setItem(ROOM_CONTEXT_KEY, JSON.stringify({
      mode: pendingGameMode,
      playerCount: pendingPlayerCount,
      roomId: pendingRoomId,
      players: pendingPlayers,
      mySeat: pendingMySeat,
    }));
  } catch {
    // ignore storage failures
  }
}

// 跨视图传递的模式信息
const savedContext = loadRoomContext();
let pendingGameMode: GameMode = savedContext?.mode || "ai";
let pendingPlayerCount: number = savedContext?.playerCount || 4;
let pendingRoomId: string | null = savedContext?.roomId || null;
let pendingPlayers: GameModeContext["players"] = savedContext?.players || [];
let pendingMySeat: number = savedContext?.mySeat ?? -1;

function getRoomIdFromHash(): string | null {
  const match = window.location.hash.match(/^#\/room\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

export function roomRouteHash(roomId: string): string {
  return `#/room/${encodeURIComponent(roomId)}`;
}

export function setGameMode(mode: GameMode, playerCount?: number, roomId?: string | null): void {
  const nextRoomId = roomId ?? null;
  const roomChanged = mode === "multi" && Boolean(nextRoomId) && nextRoomId !== pendingRoomId;

  pendingGameMode = mode;
  if (playerCount) pendingPlayerCount = playerCount;
  pendingRoomId = nextRoomId;
  if (mode === "ai" || roomChanged) {
    pendingPlayers = [];
    pendingMySeat = -1;
  }
  saveRoomContext();
}

export function getGameMode(): GameModeContext {
  const fresh = loadRoomContext();
  if (fresh) {
    pendingGameMode = fresh.mode;
    pendingPlayerCount = fresh.playerCount;
    pendingRoomId = fresh.roomId;
    pendingPlayers = fresh.players;
    pendingMySeat = fresh.mySeat;
  }
  return {
    mode: pendingGameMode,
    playerCount: pendingPlayerCount,
    roomId: pendingRoomId,
    players: pendingPlayers,
    mySeat: pendingMySeat,
  };
}

export class WaitingRoomView implements View {
  private container: HTMLElement | null = null;
  private unsubLang: (() => void) | null = null;

  // 房间状态
  private mode: GameMode = "ai";
  private maxCapacity: number = 4;
  private roomId: string | null = null;
  private players: RoomPlayer[] = [];
  private chatMessages: ChatMessage[] = [];
  private playerIdCounter: number = 0;
  private onlineRoom: any = null;
  private onlineDisposers: Array<() => void> = [];
  private mySeat: number = -1;

  mount(container: HTMLElement): void {
    this.container = container;
    const roomIdFromHash = getRoomIdFromHash();
    let context = getGameMode();
    if (roomIdFromHash) {
      const playerCount = context.roomId === roomIdFromHash ? context.playerCount : 4;
      setGameMode("multi", playerCount, roomIdFromHash);
      context = getGameMode();
    }

    this.mode = context.mode;
    this.roomId = context.roomId;
    this.maxCapacity = context.playerCount;
    this.mySeat = context.mySeat;

    // 初始化房间
    this.initRoom();
    this.render();
    this.bindEvents();
    this.addSystemMsg(t("waiting.roomCreated"));

    this.unsubLang = onLangChange(() => {
      this.render();
      this.bindEvents();
    });
  }

  unmount(): void {
    this.unsubLang?.();
    this.cleanupOnlineRoom();
    this.container = null;
  }

  // ---- 初始化 ----
  private initRoom(): void {
    const activeRoom = api.room;
    const activeRoomId = activeRoom?.roomId || activeRoom?.id;
    this.onlineRoom = this.mode === "multi" && (!pendingRoomId || activeRoomId === pendingRoomId)
      ? activeRoom
      : null;
    if (this.onlineRoom) {
      this.initOnlineRoom();
      return;
    }

    if (this.mode === "multi") {
      this.playerIdCounter = 0;
      this.chatMessages = [];
      this.maxCapacity = pendingPlayerCount;
      this.players = pendingPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar ? renderAvatar(p.avatar) : "",
        accessory: p.accessoryId ? renderAccessory({ id: p.accessoryId, color: (p.accessoryColor || "yellow") as any }, 48) : "",
        isPixelAvatar: Boolean(p.avatar),
        color: p.color,
        isReady: p.isReady,
        isHost: p.isHost,
        isAI: false,
        avatarCode: p.avatar,
        accessoryId: p.accessoryId,
        accessoryColor: p.accessoryColor,
        titleId: (p as any).titleId,
        titleZh: (p as any).titleZh,
        titleEn: (p as any).titleEn,
      }));
      if (pendingRoomId) void this.rejoinOnlineRoom();
      return;
    }

    this.playerIdCounter = 0;
    this.chatMessages = [];

    // 房主 (本人)
    this.players = [{
      id: ++this.playerIdCounter,
      name: state.playerName || "PLAYER_1",
      avatar: renderAvatar(state.avatar),
      accessory: renderAccessory(state.equippedAccessory, 48),
      isPixelAvatar: true,
      color: "#FFB300",
      isReady: false,
      isHost: true,
      isAI: false,
      titleId: state.equippedTitleId,
      titleZh: state.titleZh,
      titleEn: state.titleEn,
    }];

    if (this.mode === "ai") {
      this.maxCapacity = pendingPlayerCount;
      // 自动添加 AI
      for (let i = 1; i < this.maxCapacity; i++) {
        this.players.push(this.createAIPlayer(i));
      }
    } else {
      this.maxCapacity = pendingPlayerCount;
    }
  }

  private initOnlineRoom(): void {
    this.cleanupOnlineRoom();
    this.playerIdCounter = 0;
    this.chatMessages = [];
    this.mySeat = -1;
    this.roomId = this.onlineRoom?.roomId || this.onlineRoom?.id || pendingRoomId;
    this.syncFromOnlineRoom();
    this.bindOnlineRoom();
  }

  private async rejoinOnlineRoom(): Promise<void> {
    const roomId = pendingRoomId;
    if (!roomId) return;
    const joined = await api.reconnectGameRoom(state.playerName || "PLAYER_1", roomId) || await api.joinGameRoom(state.playerName || "PLAYER_1", {
      roomId,
      playerCount: pendingPlayerCount,
      mode: "casual",
    });
    if (!this.container || !joined) {
      this.addSystemMsg("房间重连失败，请返回大厅重新加入");
      return;
    }
    this.onlineRoom = joined;
    this.initOnlineRoom();
    this.render();
    this.bindEvents();
  }

  private bindOnlineRoom(): void {
    const room = this.onlineRoom;
    if (!room) return;

    this.trackOnlineDisposer(room.onStateChange?.(() => {
      this.syncFromOnlineRoom();
    }));

    this.trackOnlineDisposer(room.onMessage?.("roomState", (snapshot: any) => {
      this.applyOnlineSnapshot(snapshot);
    }));

    this.trackOnlineDisposer(room.onMessage?.("playerJoined", () => {
      this.syncFromOnlineRoom();
    }));

    this.trackOnlineDisposer(room.onMessage?.("playerReconnected", () => {
      this.syncFromOnlineRoom();
    }));

    this.trackOnlineDisposer(room.onMessage?.("playerReady", () => {
      this.syncFromOnlineRoom();
    }));

    this.trackOnlineDisposer(room.onMessage?.("playerLeft", () => {
      this.syncFromOnlineRoom();
    }));

    this.trackOnlineDisposer(room.onMessage?.("chat", (msg: any) => {
      this.chatMessages.push({
        sender: msg?.sender || "",
        text: String(msg?.text || "").slice(0, 60),
        isSystem: false,
      });
      this.updateChatDisplay();
    }));

    this.trackOnlineDisposer(room.onMessage?.("gameStarted", () => {
      pendingPlayerCount = this.maxCapacity;
      pendingGameMode = "multi";
      pendingRoomId = this.roomId;
      saveRoomContext();
      router.navigate("#game");
    }));

    this.trackOnlineDisposer(room.onMessage?.("error", (msg: any) => {
      this.addSystemMsg(String(msg?.message || "Room error"));
    }));
  }

  private trackOnlineDisposer(disposer: any): void {
    if (typeof disposer === "function") {
      this.onlineDisposers.push(disposer);
    } else if (disposer && typeof disposer.remove === "function") {
      this.onlineDisposers.push(() => disposer.remove());
    }
  }

  private cleanupOnlineRoom(): void {
    for (const dispose of this.onlineDisposers) {
      try { dispose(); } catch { /* ignore */ }
    }
    this.onlineDisposers = [];
  }

  private applyOnlineSnapshot(snapshot: any): void {
    if (!snapshot) return;
    if (typeof snapshot.maxPlayers === "number") {
      this.maxCapacity = snapshot.maxPlayers;
    }
    if (typeof snapshot.seat === "number") {
      this.mySeat = snapshot.seat;
    }
    if (Array.isArray(snapshot.players)) {
      this.players = snapshot.players
        .filter((p: any) => Boolean(p.connected))
        .map((p: any, index: number) => this.toRoomPlayer(p, index));
    }
    this.persistOnlineContext();
    this.rerender();
  }

  private syncFromOnlineRoom(): void {
    const room = this.onlineRoom;
    const rawPlayers = Array.from(room?.state?.players || []) as any[];
    this.maxCapacity = rawPlayers.length || pendingPlayerCount;
    this.roomId = room?.roomId || room?.id || pendingRoomId;

    const sessionId = room?.sessionId || state.sessionId;
    const myIndex = rawPlayers.findIndex((p) => p?.sessionId === sessionId);
    if (myIndex >= 0) {
      this.mySeat = Number(rawPlayers[myIndex]?.id ?? myIndex);
    } else if (this.mySeat < 0) {
      const fallbackIndex = rawPlayers.findIndex((p) => p?.connected && p?.name === state.playerName);
      if (fallbackIndex >= 0) this.mySeat = Number(rawPlayers[fallbackIndex]?.id ?? fallbackIndex);
    }

    this.players = rawPlayers
      .filter((p) => Boolean(p?.connected))
      .map((p, index) => this.toRoomPlayer(p, index));

    this.persistOnlineContext();
    this.rerender();
  }

  private toRoomPlayer(p: any, fallbackIndex: number): RoomPlayer {
    const seat = Number(p?.id ?? fallbackIndex);
    const sessionId = this.onlineRoom?.sessionId || state.sessionId;
    const isMe = Boolean(sessionId && p?.sessionId === sessionId) || seat === this.mySeat;
    const isHuman = Boolean(p?.isHuman || p?.connected);
    const avatarCode = p?.avatar || (isMe ? state.avatar : "");
    const accessoryId = p?.accessoryId || (isMe ? state.equippedAccessory?.id : "");
    const accessoryColor = p?.accessoryColor || (isMe ? state.equippedAccessory?.color : "");
    const titleId = p?.titleId || (isMe ? state.equippedTitleId : "newbie");

    return {
      id: seat,
      name: p?.name || `P${seat + 1}`,
      avatar: avatarCode ? renderAvatar(avatarCode) : "",
      accessory: accessoryId ? renderAccessory({ id: accessoryId, color: (accessoryColor || "yellow") as any }, 48) : "",
      isPixelAvatar: Boolean(avatarCode),
      color: p?.color || BOT_COLORS[seat % BOT_COLORS.length],
      isReady: Boolean(p?.isReady),
      isHost: Boolean(p?.isHost),
      isAI: !isHuman,
      avatarCode,
      accessoryId,
      accessoryColor,
      titleId,
      titleZh: p?.titleZh || (isMe ? state.titleZh : "新手"),
      titleEn: p?.titleEn || (isMe ? state.titleEn : "Newbie"),
    };
  }

  private persistOnlineContext(): void {
    pendingGameMode = "multi";
    pendingPlayerCount = this.maxCapacity;
    pendingRoomId = this.roomId;
    pendingPlayers = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isHost: p.isHost,
      isReady: p.isReady,
      avatar: p.avatarCode,
      accessoryId: p.accessoryId,
      accessoryColor: p.accessoryColor,
      titleId: p.titleId,
      titleZh: p.titleZh,
      titleEn: p.titleEn,
    }));
    pendingMySeat = this.mySeat;
    saveRoomContext();
  }

  private createAIPlayer(index: number): RoomPlayer {
    return {
      id: ++this.playerIdCounter,
      name: `${t("game.cpu")}-${index + 1}`,
      avatar: "",
      accessory: "",
      isPixelAvatar: false,
      color: BOT_COLORS[(index - 1) % BOT_COLORS.length],
      isReady: true,
      isHost: false,
      isAI: true,
    };
  }

  // ---- 渲染 ----
  private persistLocalContext(clearPlayers: boolean = false): void {
    pendingGameMode = this.mode;
    pendingPlayerCount = this.maxCapacity;
    pendingRoomId = this.roomId;
    if (clearPlayers) {
      pendingPlayers = [];
      pendingMySeat = -1;
    }
    saveRoomContext();
  }

  private render(): void {
    const container = this.container!;
    const styleEl = this.getStyles();
    container.innerHTML = styleEl + `
      <div class="neo-panel bg-grid wr-panel" style="width:1050px;height:720px;display:flex;flex-direction:column;padding:20px 30px;">
        <!-- 顶部 -->
        <div class="wr-header" style="display:flex;justify-content:space-between;align-items:center;padding-bottom:15px;border-bottom:4px solid var(--color-black);margin-bottom:15px;">
          <div style="display:flex;align-items:center;gap:20px;">
            <button class="neo-btn neo-btn-white" id="btn-leave" style="padding:10px 16px;font-size:12px;">${t("waiting.leave")}</button>
            <span style="font-size:24px;font-weight:bold;text-shadow:4px 4px 0 #E2E8F0;letter-spacing:2px;">${t("waiting.title")}</span>
            <span class="neo-tag ${this.mode === 'ai' ? 'neo-tag-red' : 'neo-tag-blue'}">
              ${this.mode === 'ai' ? t("waiting.aiMode") : t("waiting.multiMode")}
            </span>
            ${this.roomId ? `<span class="neo-tag">#${this.roomId.slice(0, 6)}</span>` : ""}
          </div>
          <div class="wr-badge" style="background:var(--color-yellow);padding:10px 15px;border:3px solid var(--color-black);box-shadow:4px 4px 0 var(--color-black);font-size:12px;font-weight:bold;" id="room-badge">
            ${t("waiting.roomBadge", { 0: this.players.length, 1: this.maxCapacity })}
          </div>
        </div>

        <!-- 内容区 -->
        <div class="wr-main" style="display:flex;flex:1;gap:30px;height:100%;min-height:0;">
          <!-- 左侧：玩家区域 -->
          <div class="wr-roster-pane" style="flex:1.6;display:flex;flex-direction:column;gap:12px;min-height:0;">
            <!-- 控制栏 -->
            <div class="wr-controls" style="display:flex;justify-content:space-between;background:var(--color-gray-mid);border:3px solid var(--color-black);padding:10px 15px;font-size:11px;font-weight:bold;">
              ${this.mode === 'ai' ? this.renderAIControls() : this.renderMultiControls()}
            </div>

            <!-- 玩家网格 -->
            <div class="wr-players-grid scroll-pixel" id="players-grid" style="flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));grid-auto-rows:min-content;gap:15px;overflow-y:auto;padding-right:10px;">
              ${this.renderPlayerCards()}
            </div>
          </div>

          <!-- 右侧：操作区 -->
          <div class="wr-action-pane" style="flex:1;display:flex;flex-direction:column;gap:20px;">
            <!-- 聊天 -->
            <div class="wr-chat-box" style="flex:1;display:flex;flex-direction:column;border:4px solid var(--color-black);background:var(--color-white);box-shadow:8px 8px 0 var(--color-black);min-height:0;">
              <div style="padding:12px 15px;background:var(--color-gray-mid);border-bottom:4px solid var(--color-black);font-size:11px;font-weight:bold;">
                ${t("waiting.chatRoom", { 0: this.players.length, 1: this.maxCapacity })}
              </div>
              <div class="wr-chat-msgs scroll-pixel" id="chat-msgs" style="flex:1;padding:15px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;font-family:'Microsoft YaHei',monospace;font-size:13px;">
                ${this.renderChatMessages()}
              </div>
              <div style="display:flex;border-top:4px solid var(--color-black);height:50px;">
                <input type="text" class="wr-chat-input" id="chat-input" placeholder="${t("waiting.chatPlaceholder")}" maxlength="30" style="flex:1;border:none;padding:0 15px;font-family:'Microsoft YaHei',monospace;font-size:14px;font-weight:bold;outline:none;background:var(--color-gray-light);">
                <button class="wr-chat-send" id="btn-send" style="width:60px;border:none;border-left:4px solid var(--color-black);background:var(--color-blue);color:var(--color-white);font-family:'Press Start 2P',monospace;font-size:18px;cursor:pointer;">&gt;</button>
              </div>
            </div>

            <!-- 主操作按钮 -->
            <button class="neo-btn ${this.getMe()?.isReady ? 'neo-btn-green' : 'neo-btn-red'}" id="btn-main-action" style="width:100%;height:70px;font-size:20px;letter-spacing:2px;border-width:4px;box-shadow:8px 8px 0 var(--color-black);">
              ${this.getMe()?.isReady ? t("waiting.readyDone") : t("waiting.clickReady")}
            </button>
            ${this.isHost() && this.allReady() ? `
            <button class="neo-btn neo-btn-green" id="btn-start" style="width:100%;height:60px;font-size:18px;letter-spacing:2px;border-width:4px;box-shadow:8px 8px 0 var(--color-black);">
              ${t("waiting.startGame")}
            </button>` : ''}
          </div>
        </div>
      </div>`;
  }

  private renderAIControls(): string {
    return `
      <div style="display:flex;align-items:center;gap:10px;">
        <span>${t("waiting.aiCount")}:</span>
        <button class="neo-btn neo-btn-white" id="btn-ai-minus" style="padding:4px 8px;font-size:10px;">\u2212</button>
        <span id="ai-count-text" style="font-size:16px;min-width:24px;text-align:center;">${this.maxCapacity}</span>
        <button class="neo-btn neo-btn-white" id="btn-ai-plus" style="padding:4px 8px;font-size:10px;">+</button>
      </div>
      <span style="color:#718096;">${t("waiting.aiHint")}</span>
    `;
  }

  private renderMultiControls(): string {
    if (this.onlineRoom) {
      return `
        <div style="display:flex;align-items:center;gap:10px;">
          <span>${t("waiting.capacity")}:</span>
          <span id="cap-text" style="font-size:16px;min-width:24px;text-align:center;">${this.maxCapacity}</span>
        </div>
        ${this.renderInviteControls()}
      `;
    }

    return `
      <div style="display:flex;align-items:center;gap:10px;">
        <span>${t("waiting.capacity")}:</span>
        <button class="neo-btn neo-btn-white" id="btn-cap-minus" style="padding:4px 8px;font-size:10px;">\u2212</button>
        <span id="cap-text" style="font-size:16px;min-width:24px;text-align:center;">${this.maxCapacity}</span>
        <button class="neo-btn neo-btn-white" id="btn-cap-plus" style="padding:4px 8px;font-size:10px;">+</button>
      </div>
      ${this.renderInviteControls()}
    `;
  }

  private renderInviteControls(): string {
    return `
      <div class="wr-invite-actions">
        ${this.roomId ? `<button class="neo-btn neo-btn-yellow" id="btn-copy-invite" type="button">${t("waiting.copyInvite")}</button>` : ""}
        <button class="neo-btn neo-btn-blue" id="btn-open-friends" type="button">${t("waiting.inviteFriends")}</button>
      </div>
    `;
  }

  private renderPlayerCards(): string {
    let html = "";
    for (let i = 0; i < this.maxCapacity; i++) {
      const p = this.players[i];
      if (p) {
        html += `
        <div class="wr-player-card ${p.isReady ? 'wr-ready' : ''}" data-player-id="${p.id}">
          ${p.isHost ? '<div class="wr-host-icon">\u2605</div>' : ''}
          ${p.isPixelAvatar ? `<div class="avatar-stack" style="width:48px;height:48px;">${p.accessory}<div class="wr-avatar wr-avatar-pixel" style="background:${p.color};">${p.avatar}</div></div>` : `<div class="wr-avatar" style="background:${p.color};">${p.avatar}</div>`}
          <div class="wr-pname" title="${p.name}">${p.name}</div>
          ${this.renderPlayerTitle(p)}
          <div class="wr-status ${p.isReady ? 'wr-status-ready' : ''}">${p.isReady ? t("waiting.ready") : t("waiting.notReady")}</div>
          ${p.isAI ? '<div class="wr-ai-tag">AI</div>' : ''}
        </div>`;
      } else {
        html += `
        <div class="wr-player-card wr-empty">
          <div class="wr-avatar wr-avatar-empty">?</div>
          <div class="wr-pname wr-waiting-text">${t("waiting.waitingPlayer")}</div>
        </div>`;
      }
    }
    return html;
  }

  private renderPlayerTitle(player: RoomPlayer): string {
    const titleId = player.titleId || "newbie";
    const lang = state.settings.language === "zh" ? "zh" : "en";
    const fallback = lang === "zh" ? player.titleZh : player.titleEn;
    return `<div class="wr-title">${renderTitleBadge(titleId, lang, true, state.customTitles, fallback)}</div>`;
  }

  private renderChatMessages(): string {
    if (this.chatMessages.length === 0) {
      return `<div class="wr-msg-sys">- ${t("waiting.roomCreated")} -</div>`;
    }
    return this.chatMessages.map((m) => {
      if (m.isSystem) {
        return `<div class="wr-msg-sys">${m.text}</div>`;
      }
      return `<div class="wr-msg-user"><span class="wr-msg-name">${m.sender}:</span> ${m.text}</div>`;
    }).join("");
  }

  // ---- 事件绑定 ----
  private bindEvents(): void {
    const container = this.container!;

    // 离开按钮
    container.querySelector("#btn-leave")?.addEventListener("click", async () => {
      audio.playClick();
      if (this.onlineRoom) {
        await api.leaveGameRoom();
        this.onlineRoom = null;
      }
      setGameMode("ai", 4, null);
      router.navigate("#lobby");
    });

    // AI 模式：人数控制
    container.querySelector("#btn-ai-minus")?.addEventListener("click", () => {
      audio.playClick();
      this.changeAICount(-1);
    });
    container.querySelector("#btn-ai-plus")?.addEventListener("click", () => {
      audio.playClick();
      this.changeAICount(1);
    });

    // 多人模式：容量控制
    container.querySelector("#btn-cap-minus")?.addEventListener("click", () => {
      audio.playClick();
      this.changeCapacity(-1);
    });
    container.querySelector("#btn-cap-plus")?.addEventListener("click", () => {
      audio.playClick();
      this.changeCapacity(1);
    });

    container.querySelector("#btn-copy-invite")?.addEventListener("click", () => {
      audio.playClick();
      void this.copyInviteLink();
    });

    container.querySelector("#btn-open-friends")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#friends");
    });

    // 准备按钮
    container.querySelector("#btn-main-action")?.addEventListener("click", () => {
      audio.playClick();
      this.toggleReady();
    });

    // 开始游戏按钮
    container.querySelector("#btn-start")?.addEventListener("click", () => {
      audio.playClick();
      this.startGame();
    });

    // 聊天
    const chatInput = container.querySelector("#chat-input") as HTMLInputElement;
    container.querySelector("#btn-send")?.addEventListener("click", () => {
      this.sendChat(chatInput);
    });
    chatInput?.addEventListener("keypress", (e: KeyboardEvent) => {
      if (e.key === "Enter") this.sendChat(chatInput);
    });

    // 玩家卡片点击
    container.querySelectorAll(".wr-player-card").forEach((card) => {
      card.addEventListener("click", () => {
        const playerId = parseInt((card as HTMLElement).dataset.playerId || "0");
        // 只有房主可以踢非 AI 的非自己玩家
        if (!this.onlineRoom && this.isHost() && this.mode === "multi") {
          const idx = this.players.findIndex((p) => p.id === playerId);
          if (idx > 0 && !this.players[idx].isAI) {
            this.removePlayer(idx);
          }
        }
      });
    });
  }

  // ---- 操作方法 ----

  private inviteUrl(): string | null {
    if (!this.roomId) return null;
    const url = new URL(window.location.href);
    url.hash = roomRouteHash(this.roomId);
    return url.toString();
  }

  private async copyInviteLink(): Promise<void> {
    const inviteUrl = this.inviteUrl();
    if (!inviteUrl) return;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      this.addSystemMsg(`- ${t("waiting.inviteCopied")} -`);
    } catch {
      this.addSystemMsg(`- ${inviteUrl} -`);
    }
  }

  private changeAICount(delta: number): void {
    let newCount = this.maxCapacity + delta;
    if (newCount < 2) newCount = 2;
    if (newCount > 12) newCount = 12;

    if (newCount === this.maxCapacity) return;

    const oldCount = this.maxCapacity;
    this.maxCapacity = newCount;

    if (newCount > oldCount) {
      // 增加 AI
      for (let i = oldCount; i < newCount; i++) {
        this.players.push(this.createAIPlayer(i));
      }
      this.addSystemMsg(`+ ${t("waiting.aiJoined", { 0: this.players[this.players.length - 1].name })}`);
    } else {
      // 减少 AI（从尾部移除）
      while (this.players.length > newCount) {
        const removed = this.players.pop()!;
        if (!removed.isAI) {
          this.players.push(removed); // 不要移除真人
          break;
        }
        this.addSystemMsg(`- ${removed.name} ${t("waiting.left")}`);
      }
    }

    this.persistLocalContext(true);
    this.rerender();
  }

  private changeCapacity(delta: number): void {
    if (this.onlineRoom) return;

    let newCap = this.maxCapacity + delta;
    if (newCap < 2) newCap = 2;
    if (newCap > 12) newCap = 12;

    if (newCap === this.maxCapacity) return;

    // 缩小容量时踢出尾部非 AI 玩家
    const humanCount = this.players.filter((p) => !p.isAI).length;
    if (newCap < humanCount) {
      this.addSystemMsg(t("waiting.cantReduce"));
      return;
    }

    if (newCap < this.maxCapacity) {
      while (this.players.length > newCap) {
        const last = this.players[this.players.length - 1];
        if (last.isAI || last.isHost) break;
        const removed = this.players.pop()!;
        this.addSystemMsg(`- ${removed.name} ${t("waiting.left")}`);
      }
      // 如果还是太多，移除空位
      this.maxCapacity = Math.max(this.players.length, newCap);
    } else {
      this.maxCapacity = newCap;
    }

    this.addSystemMsg(`${t("waiting.capacityChanged", { 0: this.maxCapacity })}`);
    this.persistLocalContext(false);
    this.rerender();
  }

  private removePlayer(index: number): void {
    if (index <= 0 || index >= this.players.length) return;
    const removed = this.players.splice(index, 1)[0];
    this.addSystemMsg(`- ${removed.name} ${t("waiting.kicked")}`);
    this.rerender();
  }

  private getMe(): RoomPlayer | undefined {
    if (this.onlineRoom) return this.players.find((p) => p.id === this.mySeat);
    return this.players[0];
  }

  private toggleReady(): void {
    if (this.onlineRoom) {
      const me = this.getMe();
      this.onlineRoom.send("ready", { isReady: !me?.isReady });
      return;
    }

    const me = this.players[0];
    me.isReady = !me.isReady;

    if (me.isReady) {
      this.addSystemMsg(`- ${me.name} ${t("waiting.readyAnnounce")} -`);
    } else {
      this.addSystemMsg(`- ${me.name} ${t("waiting.cancelReady")} -`);
    }

    this.rerender();
  }

  private isHost(): boolean {
    return Boolean(this.getMe()?.isHost);
  }

  private allReady(): boolean {
    if (this.mode === "ai") {
      // AI 模式：至少 2 人总人数，房主准备好即可
      return this.players.length >= 2 && Boolean(this.getMe()?.isReady);
    }
    // 多人模式：至少 2 人，全部准备
    if (this.players.length < 2) return false;
    return this.players.every((p) => p.isReady);
  }

  private startGame(): void {
    if (!this.allReady()) return;
    if (this.onlineRoom) {
      this.onlineRoom.send("startGame");
      return;
    }

    // 传递参数给游戏
    pendingPlayerCount = this.maxCapacity;
    pendingGameMode = this.mode;
    pendingRoomId = this.roomId;
    this.persistLocalContext(this.mode === "ai");

    // 模拟加入服务端房间（或直接用本地 AI 模式）
    if (this.mode === "ai") {
      // AI 模式：本地单机
      router.navigate("#game");
    } else {
      // 多人模式：尝试连接服务端（通过 api）
      router.navigate("#game");
    }
  }

  // ---- 聊天 ----
  private sendChat(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text) return;

    if (this.onlineRoom) {
      this.onlineRoom.send("chat", { text });
      input.value = "";
      return;
    }

    const me = this.players[0];
    this.chatMessages.push({ sender: me.name, text, isSystem: false });
    input.value = "";
    this.updateChatDisplay();
  }

  private addSystemMsg(text: string): void {
    this.chatMessages.push({ sender: "", text, isSystem: true });
    if (this.container) this.updateChatDisplay();
  }

  private updateChatDisplay(): void {
    const msgsEl = this.container?.querySelector("#chat-msgs");
    if (!msgsEl) return;

    msgsEl.innerHTML = this.chatMessages.map((m) => {
      if (m.isSystem) {
        return `<div class="wr-msg-sys">${m.text}</div>`;
      }
      return `<div class="wr-msg-user"><span class="wr-msg-name">${m.sender}:</span> ${m.text}</div>`;
    }).join("");

    // 滚动到底部
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  // ---- 局部重渲染 ----
  private rerender(): void {
    // 更新玩家网格
    const grid = this.container?.querySelector("#players-grid");
    if (grid) grid.innerHTML = this.renderPlayerCards();

    // 更新 badge
    const badge = this.container?.querySelector("#room-badge");
    if (badge) badge.textContent = t("waiting.roomBadge", {
      0: this.players.length, 1: this.maxCapacity,
    });

    // 更新聊天标题
    const chatHeader = this.container?.querySelector(".wr-chat-box > div");
    if (chatHeader) chatHeader.textContent = t("waiting.chatRoom", {
      0: this.players.length, 1: this.maxCapacity,
    });

    // 更新 AI 计数
    const aiCountEl = this.container?.querySelector("#ai-count-text");
    if (aiCountEl) aiCountEl.textContent = String(this.maxCapacity);

    // 更新容量计数
    const capEl = this.container?.querySelector("#cap-text");
    if (capEl) capEl.textContent = String(this.maxCapacity);

    // 更新准备按钮
    const me = this.getMe();
    const btnAction = this.container?.querySelector("#btn-main-action") as HTMLElement;
    if (btnAction) {
      if (me?.isReady) {
        btnAction.style.background = "var(--color-green)";
        btnAction.textContent = t("waiting.readyDone");
      } else {
        btnAction.style.background = "var(--color-red)";
        btnAction.textContent = t("waiting.clickReady");
      }
    }

    // 更新提示文字
    const hintEl = this.container?.querySelector("#ready-hint-text");
    if (hintEl) {
      const readyCount = this.players.filter((p) => p.isReady).length;
      hintEl.textContent = `${readyCount}/${this.players.length} ${t("waiting.readyStatus")}`;
    }

    // 更新开始按钮
    const startArea = this.container?.querySelector("#btn-start")?.parentElement;
    // 移除旧开始按钮
    const oldStart = this.container?.querySelector("#btn-start");
    if (this.isHost() && this.allReady()) {
      if (!oldStart) {
        btnAction?.insertAdjacentHTML("afterend", `
          <button class="neo-btn neo-btn-green" id="btn-start" style="width:100%;height:60px;font-size:18px;letter-spacing:2px;border-width:4px;box-shadow:8px 8px 0 var(--color-black);margin-top:12px;">
            ${t("waiting.startGame")}
          </button>`);
        // 绑定事件
        this.container?.querySelector("#btn-start")?.addEventListener("click", () => {
          audio.playClick();
          this.startGame();
        });
      }
    } else {
      oldStart?.remove();
    }

    // 重新绑定玩家卡片事件
    this.container?.querySelectorAll(".wr-player-card").forEach((card) => {
      card.addEventListener("click", () => {
        const playerId = parseInt((card as HTMLElement).dataset.playerId || "0");
        if (!this.onlineRoom && this.isHost() && this.mode === "multi") {
          const idx = this.players.findIndex((p) => p.id === playerId);
          if (idx > 0 && !this.players[idx].isAI) {
            this.removePlayer(idx);
          }
        }
      });
    });
  }

  // ---- 样式 ----
  private getStyles(): string {
    return `<style>
      .wr-player-card {
        background:var(--color-white);border:3px solid var(--color-black);
        box-shadow:4px 4px 0 var(--color-gray);padding:15px 10px;
        display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;
        position:relative;transition:all 0.2s;height:172px;cursor:default;
      }
      .wr-player-card.wr-ready {
        border-color:var(--color-green);box-shadow:4px 4px 0 var(--color-green);
      }
      .wr-player-card.wr-empty {
        border:3px dashed var(--color-black);box-shadow:none;background:var(--color-gray-light);
      }
      .wr-avatar {
        width:48px;height:48px;border:3px solid var(--color-black);
        box-shadow:3px 3px 0 var(--color-black);display:flex;
        align-items:center;justify-content:center;font-size:18px;color:var(--color-white);
        text-shadow:2px 2px 0 var(--color-black);
      }
      .wr-avatar-pixel {
        overflow:hidden;text-shadow:none;color:inherit;background:var(--color-yellow) !important;
      }
      .wr-avatar-empty {
        background:transparent !important;color:#CBD5E0;border-style:dashed;
        box-shadow:none;text-shadow:none;
      }
      .wr-pname {
        font-size:11px;font-weight:bold;color:var(--color-black);text-align:center;
        width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      }
      .wr-title {
        min-height:18px;max-width:100%;display:flex;align-items:center;justify-content:center;
        overflow:hidden;
      }
      .wr-title .title-badge {
        max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      }
      .wr-waiting-text { color:#A0AEC0;font-size:9px; }
      .wr-status {
        padding:3px 6px;border:2px solid var(--color-black);
        font-size:8px;font-weight:bold;background:var(--color-red);color:var(--color-white);
      }
      .wr-status.wr-status-ready { background:var(--color-green); }
      .wr-host-icon {
        position:absolute;top:-8px;left:-8px;width:26px;height:26px;
        background:var(--color-yellow);border:2px solid var(--color-black);
        display:flex;align-items:center;justify-content:center;font-size:11px;
        box-shadow:2px 2px 0 var(--color-black);transform:rotate(-15deg);z-index:10;
      }
      .wr-ai-tag {
        position:absolute;top:6px;right:6px;font-size:7px;font-weight:bold;
        background:var(--color-blue);color:var(--color-white);padding:2px 4px;
        border:2px solid var(--color-black);
      }
      .wr-invite-actions {
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }
      .wr-invite-actions .neo-btn {
        padding:6px 10px;
        font-size:10px;
        white-space:nowrap;
      }
      .wr-msg-sys { color:var(--color-gray-text);font-size:10px;text-align:center;font-family:'Press Start 2P',monospace; }
      .wr-msg-user { color:var(--color-black);line-height:1.4; }
      .wr-msg-name { font-weight:bold;font-family:'Press Start 2P',monospace;font-size:10px;margin-right:4px; }
      .wr-chat-send:active { background:var(--color-black); }
      @media (max-width: 820px), (max-height: 520px) {
        .wr-panel {
          padding: 14px !important;
          min-height: calc(100dvh - 16px) !important;
        }
        .wr-header {
          flex-direction: column;
          align-items: stretch !important;
          gap: 12px;
          padding-bottom: 12px !important;
          margin-bottom: 12px !important;
        }
        .wr-header > div:first-child {
          flex-wrap: wrap;
          gap: 10px !important;
        }
        .wr-header span[style*="font-size:24px"] {
          font-size: 17px !important;
          letter-spacing: 0 !important;
          line-height: 1.35;
        }
        .wr-badge {
          width: 100%;
          text-align: center;
          font-size: 10px !important;
          padding: 9px 10px !important;
        }
        .wr-main {
          flex-direction: column !important;
          gap: 14px !important;
          height: auto !important;
          overflow: visible;
        }
        .wr-roster-pane,
        .wr-action-pane {
          flex: none !important;
          min-height: 0 !important;
        }
        .wr-controls {
          flex-direction: column;
          align-items: stretch !important;
          gap: 10px;
          padding: 10px !important;
          line-height: 1.5;
        }
        .wr-controls > div {
          justify-content: center;
          flex-wrap: wrap;
        }
        .wr-invite-actions {
          justify-content: center;
        }
        .wr-invite-actions .neo-btn {
          flex: 1 1 130px;
          min-height: 36px;
        }
        .wr-players-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
          overflow: visible !important;
          padding-right: 0 !important;
        }
        .wr-player-card {
          height: 146px;
          padding: 12px 8px;
          gap: 8px;
        }
        .wr-chat-box {
          min-height: 220px !important;
          box-shadow: 4px 4px 0 var(--color-black) !important;
        }
        #btn-main-action,
        #btn-start {
          height: auto !important;
          min-height: 56px !important;
          font-size: 14px !important;
          letter-spacing: 1px !important;
          box-shadow: 4px 4px 0 var(--color-black) !important;
        }
      }
      @media (max-width: 420px) {
        .wr-players-grid {
          grid-template-columns: 1fr !important;
        }
      }
    </style>`;
  }
}
