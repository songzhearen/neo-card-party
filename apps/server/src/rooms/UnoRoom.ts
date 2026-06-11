/**
 * UNO 游戏房间 — Colyseus Room
 * 服务端运行完整游戏引擎，客户端仅做渲染
 * 支持等待房间机制：全员准备后才可开始游戏
 */

import { Room, Client } from "colyseus";
import { UnoState, Player } from "../schema/UnoState";
import { PLAYER_COLORS, calculateScore } from "@card-party/shared";
import { UnoActionController } from "./uno-action-controller";
import { UnoPrivateState } from "./uno-private-state";
import { UnoStateProjector } from "./uno-state-projector";
import { accountEventRepo, gameRepo, userRepo } from "../db";
import { markRoomConnected, markRoomJoin, markRoomLeave, markRoomReconnecting } from "../presence";
import type {
  ChatRoomPayload,
  ChooseColorPayload,
  GameShoutPayload,
  JoinRoomPayload,
  PlayCardPayload,
  ReadyRoomPayload,
  ThrowEmojiPayload,
} from "@card-party/shared";

// ---- 游戏常量（与前端 core/uno-engine.ts 保持一致）----

const PLAYER_NAMES = [
  "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12",
];

type AuthJoinRoomPayload = Partial<JoinRoomPayload> & {
  authToken?: string;
  titleId?: string;
  titleZh?: string;
  titleEn?: string;
};

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
  userId: number | null;
}
// ---- 内部类型 ----

// ---- Room 实现 ----

export class UnoRoom extends Room<UnoState> {
  maxClients: number = 12;

  // 内部状态（不暴露给客户端）
  private privateState = new UnoPrivateState();
  private stateProjector = new UnoStateProjector(this.privateState);
  private actionController = new UnoActionController(this.privateState, this.stateProjector);
  private maxPlayers: number = 4;
  private hostSessionId: string = "";
  private seatMap: Map<string, number> = new Map(); // sessionId -> seat
  private seatUserIds: Map<number, number> = new Map(); // seat -> database user id
  private playedCounts: number[] = [];
  private resultPersisted: boolean = false;

  onCreate(options: AuthJoinRoomPayload): void {
    this.maxPlayers = Math.min(12, Math.max(2, options.playerCount || 4));
    this.maxClients = this.maxPlayers;
    void this.setMetadata({
      name: options.roomName || `${options.name || "PLAYER"} 的房间`,
      mode: options.mode || "casual",
      ante: options.ante || 100,
      maxPlayers: this.maxPlayers,
      phase: "waiting",
    });

    this.setState(new UnoState());

    // 初始化玩家槽位
    for (let i = 0; i < this.maxPlayers; i++) {
      const p = new Player();
      p.id = i;
      p.name = PLAYER_NAMES[i];
      p.color = PLAYER_COLORS[i];
      p.connected = false;
      p.isReady = false;
      p.isHost = false;
      this.state.players.push(p);
    }

    // 消息处理
    this.onMessage("play", (client, msg: PlayCardPayload) => {
      this.handlePlay(client, msg.cardIndex);
    });

    this.onMessage("draw", (client) => {
      this.handleDraw(client);
    });

    this.onMessage("pass", (client) => {
      this.handlePass(client);
    });

    this.onMessage("chooseColor", (client, msg: ChooseColorPayload) => {
      this.handleChooseColor(client, msg.color);
    });

    this.onMessage("requestHand", (client) => {
      const seat = this.getSeatByClient(client);
      if (seat < 0) return;
      client.send("hand", { cards: this.privateState.getHand(seat) });
    });

    this.onMessage("uno", (client) => {
      const seat = this.getSeatByClient(client);
      if (seat < 0) return;
      this.broadcast("shout", { seat, message: "LAST! 📢" });
    });

    // 等待房间消息
    this.onMessage("ready", (client, msg: ReadyRoomPayload) => {
      this.handleReady(client, msg.isReady);
    });

    this.onMessage("startGame", (client) => {
      this.handleStartGame(client);
    });

    this.onMessage("chat", (client, msg: ChatRoomPayload) => {
      const seat = this.getSeatByClient(client);
      if (seat < 0) return;
      this.broadcast("chat", {
        sender: this.state.players[seat]!.name,
        text: msg.text,
        seat,
      });
    });

    this.onMessage("gameShout", (client, msg: GameShoutPayload) => {
      const seat = this.getSeatByClient(client);
      if (seat < 0) return;
      this.broadcast("gameShout", {
        seat,
        message: String(msg.message || "").slice(0, 80),
      });
    });

    this.onMessage("throwEmoji", (client, msg: ThrowEmojiPayload) => {
      const seat = this.getSeatByClient(client);
      if (seat < 0) return;
      this.broadcast("throwEmoji", {
        fromSeat: seat,
        targetSeat: msg.targetSeat,
        emoji: String(msg.emoji || "").slice(0, 8),
      });
    });

    console.log(`[UnoRoom] Created room for ${this.maxPlayers} players`);
  }

  onJoin(client: Client, options: AuthJoinRoomPayload): void {
    const previousSessionId = typeof options.previousSessionId === "string" ? options.previousSessionId : "";
    let seat = -1;
    let isReclaimingSeat = false;

    if (previousSessionId) {
      for (let i = 0; i < this.maxPlayers; i++) {
        const candidate = this.state.players[i]!;
        if (!candidate.connected && candidate.sessionId === previousSessionId) {
          seat = i;
          isReclaimingSeat = true;
          break;
        }
      }
    }

    // 分配最近的空槽位
    if (seat < 0) {
      for (let i = 0; i < this.maxPlayers; i++) {
        if (!this.state.players[i]!.connected) {
          seat = i;
          break;
        }
      }
    }
    if (seat < 0) {
      console.log(`[UnoRoom] ${client.sessionId} joined as spectator`);
      return;
    }

    const player = this.state.players[seat]!;
    const wasReady = Boolean(player.isReady);
    const wasHost = Boolean(player.isHost) || (previousSessionId !== "" && this.hostSessionId === previousSessionId);
    player.name = options.name || PLAYER_NAMES[seat];
    player.sessionId = client.sessionId;
    player.avatar = options.avatar || "";
    player.accessoryId = options.accessoryId || "";
    player.accessoryColor = options.accessoryColor || "";
    player.titleId = options.titleId || "newbie";
    player.titleZh = options.titleZh || "新手";
    player.titleEn = options.titleEn || "Newbie";
    player.connected = true;
    player.isHuman = true;
    player.isReady = isReclaimingSeat ? wasReady : false;
    player.isHost = wasHost;

    if (previousSessionId) this.seatMap.delete(previousSessionId);
    this.seatMap.set(client.sessionId, seat);
    this.bindAuthenticatedUser(seat, client.sessionId, options.authToken);

    // 第一个加入的设为房主
    if (wasHost || !this.hostSessionId) {
      this.hostSessionId = client.sessionId;
      player.isHost = true;
    }

    console.log(`[UnoRoom] ${client.sessionId} → seat ${seat} (${player!.name})${player.isHost ? " [HOST]" : ""}`);

    this.broadcast(isReclaimingSeat ? "playerReconnected" : "playerJoined", {
      seat,
      player: {
        id: seat,
        name: player.name,
        sessionId: player.sessionId,
        avatar: player.avatar,
        accessoryId: player.accessoryId,
        accessoryColor: player.accessoryColor,
        titleId: player.titleId,
        titleZh: player.titleZh,
        titleEn: player.titleEn,
        color: player.color,
        isHost: player.isHost,
        isReady: player.isReady,
        isHuman: player.isHuman,
      },
    });

    this.sendRoomSnapshot(client, seat);
    if (this.state.phase === "playing") {
      client.send("hand", { cards: this.privateState.getHand(seat) });
      client.send("gameStarted", {});
    }
  }

  private getPresenceRoomName(): string {
    const name = this.metadata?.name;
    return typeof name === "string" ? name : "";
  }

  private sendRoomSnapshot(client: Client, seat: number): void {
    client.send("roomState", {
      seat,
      maxPlayers: this.maxPlayers,
      players: this.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        sessionId: p.sessionId,
        avatar: p.avatar,
        accessoryId: p.accessoryId,
        accessoryColor: p.accessoryColor,
        titleId: p.titleId,
        titleZh: p.titleZh,
        titleEn: p.titleEn,
        color: p.color,
        isHost: p.isHost,
        isReady: p.isReady,
        connected: p.connected,
        isHuman: p.isHuman,
      })),
      hostSessionId: this.hostSessionId,
    });
  }

  private bindAuthenticatedUser(seat: number, sessionId: string, authToken?: string): void {
    const token = String(authToken || "").trim();
    if (!token) {
      this.seatUserIds.delete(seat);
      return;
    }

    userRepo.findByToken(token).then((user) => {
      const player = this.state.players[seat];
      if (!user || !player || player.sessionId !== sessionId) return;

      this.seatUserIds.set(seat, user.id);
      player.name = user.nickname || user.username;
      player.avatar = user.avatar || player.avatar;
      player.titleId = user.equipped_title_id || player.titleId || "newbie";
      player.titleZh = user.title_zh || player.titleZh || "新手";
      player.titleEn = user.title_en || player.titleEn || "Newbie";
      player.isHuman = true;
      markRoomJoin(user, {
        roomId: this.roomId,
        roomName: this.getPresenceRoomName(),
        sessionId,
        seat,
      });

      this.broadcast("playerProfileUpdated", {
        seat,
        player: {
          id: seat,
          name: player.name,
          sessionId: player.sessionId,
          avatar: player.avatar,
          accessoryId: player.accessoryId,
          accessoryColor: player.accessoryColor,
          titleId: player.titleId,
          titleZh: player.titleZh,
          titleEn: player.titleEn,
          color: player.color,
          isHost: player.isHost,
          isReady: player.isReady,
          isHuman: player.isHuman,
        },
      });
    }).catch((err) => {
      console.warn("[UnoRoom] Failed to bind auth user:", err?.message || err);
    });
  }

  onLeave(client: Client, consented: boolean): void {
    const seat = this.getSeatByClient(client);
    if (seat >= 0 && !consented) {
      const player = this.state.players[seat]!;
      const userId = this.seatUserIds.get(seat);
      this.seatMap.delete(client.sessionId);
      player.connected = false;
      if (userId) {
        markRoomReconnecting(userId, {
          roomId: this.roomId,
          roomName: this.getPresenceRoomName(),
          sessionId: client.sessionId,
          seat,
        });
      }

      this.allowReconnection(client, 90).then((reconnected) => {
        player.connected = true;
        player.sessionId = reconnected.sessionId;
        this.seatMap.set(reconnected.sessionId, seat);
        if (userId) {
          markRoomConnected(userId, {
            roomId: this.roomId,
            roomName: this.getPresenceRoomName(),
            sessionId: reconnected.sessionId,
            seat,
          });
        }
        if (player.isHost) this.hostSessionId = reconnected.sessionId;
        this.sendRoomSnapshot(reconnected, seat);
        if (this.state.phase === "playing") {
          reconnected.send("hand", { cards: this.privateState.getHand(seat) });
          reconnected.send("gameStarted", {});
        }
        this.broadcast("playerReconnected", { seat });
      }).catch(() => {
        if (player.connected || player.sessionId !== client.sessionId) return;
        this.seatMap.set(client.sessionId, seat);
        this.onLeave(client, true);
      });
      return;
    }
    this.seatMap.delete(client.sessionId);
    if (seat >= 0) {
      const p = this.state.players[seat]!;
      const userId = this.seatUserIds.get(seat);
      p.connected = false;
      p.isReady = false;
      p.sessionId = "";
      p.avatar = "";
      p.accessoryId = "";
      p.accessoryColor = "";
      p.titleId = "newbie";
      p.titleZh = "新手";
      p.titleEn = "Newbie";
      if (userId) {
        markRoomLeave(userId, {
          roomId: this.roomId,
          sessionId: client.sessionId,
        });
      }
      this.seatUserIds.delete(seat);
      const wasHost = p.isHost;
      p.isHost = false;

      // 如果房主离开，转移房主
      if (wasHost) {
        this.hostSessionId = "";
        for (let i = 0; i < this.maxPlayers; i++) {
          const next = this.state.players[i]!;
          if (next.connected && i !== seat) {
            next.isHost = true;
            const nextClient = this.getClientBySeat(i);
            if (nextClient) {
              this.hostSessionId = nextClient.sessionId;
            }
            break;
          }
        }
      }

      this.broadcast("playerLeft", { seat });

      console.log(`[UnoRoom] Seat ${seat} (${p!.name}) left`);
    }
  }

  // ---- 等待房间逻辑 ----

  onDispose(): void {
    for (const [seat, userId] of this.seatUserIds) {
      markRoomLeave(userId, {
        roomId: this.roomId,
        sessionId: this.state.players[seat]?.sessionId || null,
      });
    }
    this.seatUserIds.clear();
  }

  private handleReady(client: Client, isReady: boolean): void {
    if (this.state.phase !== "waiting") return;

    const seat = this.getSeatByClient(client);
    if (seat < 0) return;

    this.state.players[seat]!.isReady = isReady;
    this.broadcast("playerReady", { seat, isReady });
  }

  private handleStartGame(client: Client): void {
    if (this.state.phase !== "waiting") return;

    // 只有房主可以开始
    if (client.sessionId !== this.hostSessionId) {
      client.send("error", { message: "只有房主可以开始游戏" });
      return;
    }

    // 检查条件
    const connectedPlayers = this.state.players.filter((p) => p.connected);
    const readyPlayers = connectedPlayers.filter((p) => p.isReady);

    if (connectedPlayers.length < 2) {
      client.send("error", { message: "至少需要 2 名玩家" });
      return;
    }

    if (readyPlayers.length < connectedPlayers.length) {
      client.send("error", { message: "等待所有玩家准备" });
      return;
    }

    this.startGame();
  }

  // ======================== 游戏流程 ========================

  private compactConnectedPlayers(): void {
    const connectedPlayers = this.state.players.filter((p) => p.connected);
    const previousUserIds = new Map(this.seatUserIds);
    this.state.players.splice(0, this.state.players.length);
    this.seatMap.clear();
    this.seatUserIds.clear();

    connectedPlayers.forEach((player, index) => {
      const previousSeat = player.id;
      player.id = index;
      player.handCount = 0;
      this.state.players.push(player);
      if (player.sessionId) {
        this.seatMap.set(player.sessionId, index);
      }
      const userId = previousUserIds.get(previousSeat);
      if (userId) {
        this.seatUserIds.set(index, userId);
        markRoomConnected(userId, {
          roomId: this.roomId,
          roomName: this.getPresenceRoomName(),
          sessionId: player.sessionId || null,
          seat: index,
        });
      }
    });

    this.maxPlayers = connectedPlayers.length;
    this.maxClients = this.maxPlayers;
  }

  private startGame(): void {
    console.log(`[UnoRoom] Starting game...`);
    void this.lock();
    this.compactConnectedPlayers();
    void this.setMetadata({ ...this.metadata, phase: "playing" });

    this.privateState.reset();
    this.playedCounts = Array.from({ length: this.maxPlayers }, () => 0);
    this.resultPersisted = false;

    const handSize = this.maxPlayers > 8 ? 5 : 7;
    this.privateState.dealHands(this.maxPlayers, handSize);

    // 首张弃牌（不能是万能牌）
    const firstCard = this.privateState.startDiscardNonWild();
    if (!firstCard) {
      this.state.phase = "waiting";
      console.warn("[UnoRoom] Unable to start game: no playable first discard card");
      return;
    }

    this.state.currentColor = firstCard.color;
    this.state.currentPlayer = 0;
    this.state.isClockwise = true;
    this.state.penaltyStack = 0;
    this.state.phase = "playing";
    this.state.winnerSeat = -1;

    this.stateProjector.syncCards(this.state, this.maxPlayers);

    // 广播游戏开始
    this.broadcast("gameStarted", {});

    // 通知各玩家手牌（私密消息）
    for (let i = 0; i < this.maxPlayers; i++) {
      if (this.state.players[i]!.connected) {
        const client = this.getClientBySeat(i);
        if (client) {
          client.send("hand", { cards: this.privateState.getHand(i) });
        }
      }
    }
  }

  // ======================== 玩家消息 ========================

  private handlePlay(client: Client, cardIndex: number): void {
    const seat = this.getSeatByClient(client);
    if (seat < 0) return;

    const result = this.actionController.play(this.state, this.maxPlayers, seat, cardIndex);
    if (!result) return;

    this.playedCounts[seat] = (this.playedCounts[seat] || 0) + 1;
    client.send("hand", { cards: result.hand });
    if (result.winnerSeat !== null) {
      void this.finishGame(seat);
    }
  }

  private handleDraw(client: Client): void {
    const seat = this.getSeatByClient(client);
    if (seat < 0) return;

    const result = this.actionController.draw(this.state, this.maxPlayers, seat);
    if (!result) return;

    if (result.kind === "penalty") {
      client.send("drawResult", {
        card: result.card,
        cards: result.cards,
        penalty: result.penalty,
      });
      client.send("hand", { cards: result.hand });
      return;
    }

    client.send("drawResult", { card: result.card });
    client.send("hand", { cards: result.hand });
  }

  private handlePass(client: Client): void {
    const seat = this.getSeatByClient(client);
    if (seat < 0) return;

    this.actionController.pass(this.state, this.maxPlayers, seat);
  }

  private handleChooseColor(client: Client, color: string): void {
    const seat = this.getSeatByClient(client);
    if (seat < 0) return;

    this.actionController.chooseColor(this.state, this.maxPlayers, seat, color);
  }

  // ======================== 辅助 ========================

  private buildSettlement(winnerSeat: number): SettlementPlayer[] {
    const baseEntries = this.state.players.slice(0, this.maxPlayers).map((player) => {
      const seat = Number(player.id);
      const hand = this.privateState.getHand(seat);
      return {
        id: seat,
        name: player.name || PLAYER_NAMES[seat] || `P${seat + 1}`,
        cards: hand.length,
        played: this.playedCounts[seat] || 0,
        handValue: calculateScore(hand as any),
        color: player.color || PLAYER_COLORS[seat] || "#EDF2F7",
        isWinner: seat === winnerSeat,
        userId: this.seatUserIds.get(seat) ?? null,
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
      const rankBonus = entry.isWinner ? 120 + this.maxPlayers * 10 : Math.max(10, 90 - rank * 20);
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

    const winner = scored.find((entry) => entry.isWinner);
    if (winner) {
      const highestOtherScore = Math.max(...scored.filter((entry) => !entry.isWinner).map((entry) => entry.points), 0);
      if (winner.points <= highestOtherScore) {
        winner.points = highestOtherScore + 50;
        winner.residueBonus += 50;
      }
    }

    return scored.sort((a, b) => a.rank - b.rank);
  }

  private async finishGame(winnerSeat: number): Promise<void> {
    const settlement = this.buildSettlement(winnerSeat);
    const winner = settlement.find((entry) => entry.isWinner) || settlement[0];
    let gameId: number | null = null;

    try {
      gameId = await this.persistGameResult(winnerSeat, settlement);
    } catch (err: any) {
      console.warn("[UnoRoom] Failed to persist game result:", err?.message || err);
    }

    this.broadcast("gameOver", {
      winnerSeat,
      winner: winner?.name || PLAYER_NAMES[winnerSeat] || "P1",
      winnerScore: winner?.points || 0,
      gameId,
      players: settlement.map(({ userId, ...player }) => player),
    });
  }

  private async persistGameResult(winnerSeat: number, settlement: SettlementPlayer[]): Promise<number | null> {
    if (this.resultPersisted) return null;
    this.resultPersisted = true;

    const winner = settlement.find((entry) => entry.id === winnerSeat) || settlement[0];
    const gameId = await gameRepo.createRecord({
      room_id: this.roomId,
      player_count: this.maxPlayers,
      winner_user_id: winner?.userId ?? null,
      winner_name: winner?.name || PLAYER_NAMES[winnerSeat] || "P1",
      winner_score: winner?.points || 0,
      players: settlement.map((entry) => ({
        user_id: entry.userId,
        player_name: entry.name,
        cards_remaining: entry.cards,
        points: entry.points,
        color: entry.color,
      })),
    });

    for (const entry of settlement) {
      if (!entry.userId) continue;
      await userRepo.updateStats(entry.userId, {
        wins: entry.isWinner ? 1 : 0,
        totalGames: 1,
        points: entry.points,
        coins: entry.isWinner ? Math.max(0, Math.floor(entry.points / 10)) : 0,
      });
      await userRepo.syncLevel(entry.userId);
      try {
        await accountEventRepo.create({
          userId: entry.userId,
          type: "game_result",
          deltaCoins: entry.isWinner ? Math.max(0, Math.floor(entry.points / 10)) : 0,
          metadata: { gameId, roomId: this.roomId, points: entry.points, isWin: entry.isWinner },
        });
      } catch (err: any) {
        console.warn("[UnoRoom] Failed to record account event:", err?.message || err);
      }
    }

    return gameId;
  }

  private getSeatByClient(client: Client): number {
    return this.seatMap.get(client.sessionId) ?? -1;
  }

  private getClientBySeat(seat: number): Client | undefined {
    for (const [sessionId, s] of this.seatMap) {
      if (s === seat) {
        return this.clients.find((c) => c.sessionId === sessionId);
      }
    }
    return undefined;
  }
}
