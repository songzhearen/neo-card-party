import { describe, expect, it, vi } from "vitest";
import type { Client } from "colyseus";
import { UnoRoom } from "./UnoRoom";
import type { GameCard, UnoPrivateState } from "./uno-private-state";

interface SentMessage {
  type: string | number;
  message: any;
}

interface BroadcastMessage {
  type: string | number;
  message: any;
  options?: any;
}

type TestClient = Client & {
  sent: SentMessage[];
};

function createClient(sessionId: string): TestClient {
  const sent: SentMessage[] = [];
  return {
    sessionId,
    sent,
    send: vi.fn((type: string | number, message: any) => {
      sent.push({ type, message });
    }),
  } as unknown as TestClient;
}

function createRoom(playerCount: number = 2): { room: UnoRoom; broadcasts: BroadcastMessage[] } {
  const room = new UnoRoom();
  const broadcasts: BroadcastMessage[] = [];

  room.setPatchRate(null);
  room.autoDispose = false;
  room.roomId = "room-flow-test";
  (room as any).listing = {
    metadata: {},
    updateOne: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
    markModified: vi.fn(),
  };
  room.broadcast = vi.fn((type: string | number, message: any, options?: any) => {
    broadcasts.push({ type, message, options });
  }) as any;

  room.onCreate({
    name: "Host",
    roomName: "Flow Test Room",
    playerCount,
    mode: "casual",
  });

  return { room, broadcasts };
}

function join(room: UnoRoom, client: TestClient, name: string, previousSessionId?: string): void {
  room.clients.push(client);
  room.onJoin(client, { name, previousSessionId });
}

function sendRoomMessage(room: UnoRoom, client: TestClient, type: string, message?: any): void {
  const handler = (room as any).onMessageHandlers[type];
  if (!handler) throw new Error(`Missing room message handler: ${type}`);
  handler(client, message);
}

function messagesOf(client: TestClient, type: string | number): SentMessage[] {
  return client.sent.filter((message) => message.type === type);
}

function lastMessageOf(client: TestClient, type: string | number): SentMessage | undefined {
  return messagesOf(client, type).at(-1);
}

function card(value: number, color: GameCard["color"] = "RED", type: GameCard["type"] = "number"): GameCard {
  return { color, value, type };
}

function arrangePlayableHand(room: UnoRoom): void {
  const privateState = (room as any).privateState as UnoPrivateState;
  privateState.reset([
    card(5, "RED"),
    card(1, "YEL"),
    card(2, "GRN"),
    card(9, "BLU"),
    card(7, "RED"),
  ]);
  privateState.dealHands(2, 2);
  const firstDiscard = privateState.startDiscardNonWild();
  room.state.currentColor = firstDiscard!.color;
  room.state.currentPlayer = 0;
  room.state.penaltyStack = 0;
  room.state.phase = "playing";
  room.state.winnerSeat = -1;
  (room as any).stateProjector.syncCards(room.state, 2);
}

function readyAndStart(room: UnoRoom, host: TestClient, guest: TestClient): void {
  sendRoomMessage(room, host, "ready", { isReady: true });
  sendRoomMessage(room, guest, "ready", { isReady: true });
  sendRoomMessage(room, host, "startGame");
}

describe("UnoRoom multiplayer flow", () => {
  it("keeps a stable room id while players join seats from an invite-style room instance", () => {
    const { room, broadcasts } = createRoom(4);
    const host = createClient("host-session");
    const guest = createClient("guest-session");

    join(room, host, "Host");
    join(room, guest, "Guest");

    expect(room.roomId).toBe("room-flow-test");
    expect(room.state.players[0]!.sessionId).toBe("host-session");
    expect(room.state.players[0]!.isHost).toBe(true);
    expect(room.state.players[1]!.sessionId).toBe("guest-session");
    expect(room.state.players[1]!.isHost).toBe(false);
    expect(lastMessageOf(host, "roomState")?.message.seat).toBe(0);
    expect(lastMessageOf(guest, "roomState")?.message.seat).toBe(1);
    expect(broadcasts.filter((event) => event.type === "playerJoined")).toHaveLength(2);
  });

  it("requires all connected players to be ready before starting and dealing hands", () => {
    const { room, broadcasts } = createRoom(2);
    const host = createClient("host-session");
    const guest = createClient("guest-session");
    join(room, host, "Host");
    join(room, guest, "Guest");

    sendRoomMessage(room, host, "startGame");
    expect(lastMessageOf(host, "error")).toBeTruthy();
    expect(room.state.phase).toBe("waiting");

    readyAndStart(room, host, guest);

    expect(room.state.phase).toBe("playing");
    expect(room.state.players).toHaveLength(2);
    expect(room.state.players[0]!.handCount).toBe(7);
    expect(room.state.players[1]!.handCount).toBe(7);
    expect(room.state.topCard.type).not.toBe("wild");
    expect(room.state.topCard.type).not.toBe("wild4");
    expect(lastMessageOf(host, "hand")?.message.cards).toHaveLength(7);
    expect(lastMessageOf(guest, "hand")?.message.cards).toHaveLength(7);
    expect(broadcasts.some((event) => event.type === "gameStarted")).toBe(true);
  });

  it("routes play messages through the online room flow", () => {
    const { room } = createRoom(2);
    const host = createClient("host-session");
    const guest = createClient("guest-session");
    join(room, host, "Host");
    join(room, guest, "Guest");
    readyAndStart(room, host, guest);
    arrangePlayableHand(room);
    host.sent.length = 0;

    sendRoomMessage(room, host, "play", { cardIndex: 0 });

    expect(lastMessageOf(host, "hand")?.message.cards).toHaveLength(1);
    expect(room.state.topCard.value).toBe(7);
    expect(room.state.players[0]!.handCount).toBe(1);
    expect(room.state.currentPlayer).toBe(1);
  });

  it("broadcasts server settlement when a player wins", async () => {
    const { room, broadcasts } = createRoom(2);
    const host = createClient("host-session");
    const guest = createClient("guest-session");
    join(room, host, "Host");
    join(room, guest, "Guest");
    readyAndStart(room, host, guest);

    const privateState = (room as any).privateState as UnoPrivateState;
    privateState.reset([card(9, "BLU")]);
    privateState.getHand(0).push(card(5, "RED"));
    privateState.getHand(1).push(card(1, "YEL"), card(2, "GRN"));
    privateState.addToDiscard(card(7, "RED"));
    room.state.currentColor = "RED";
    room.state.currentPlayer = 0;
    room.state.penaltyStack = 0;
    room.state.phase = "playing";
    room.state.winnerSeat = -1;
    (room as any).stateProjector.syncCards(room.state, 2);
    const persistSpy = vi.spyOn(room as any, "persistGameResult").mockResolvedValue(321);

    sendRoomMessage(room, host, "play", { cardIndex: 0 });
    await Promise.resolve();

    const gameOver = broadcasts.find((event) => event.type === "gameOver");
    expect(persistSpy).toHaveBeenCalledOnce();
    expect(gameOver?.message).toMatchObject({
      winnerSeat: 0,
      winner: "Host",
      gameId: 321,
    });
    expect(gameOver?.message.players).toHaveLength(2);
    expect(gameOver?.message.players[0]).toMatchObject({
      id: 0,
      name: "Host",
      cards: 0,
      isWinner: true,
    });
  });

  it("routes draw and pass messages through the online room flow", () => {
    const { room } = createRoom(2);
    const host = createClient("host-session");
    const guest = createClient("guest-session");
    join(room, host, "Host");
    join(room, guest, "Guest");
    readyAndStart(room, host, guest);
    host.sent.length = 0;

    sendRoomMessage(room, host, "draw");

    expect(lastMessageOf(host, "drawResult")?.message.card).toBeTruthy();
    expect(lastMessageOf(host, "hand")?.message.cards).toHaveLength(8);
    expect(room.state.players[0]!.handCount).toBe(8);

    sendRoomMessage(room, host, "pass");

    expect(room.state.currentPlayer).toBe(1);
  });

  it("resolves stacked draw penalties through the room message flow", () => {
    const { room } = createRoom(2);
    const host = createClient("host-session");
    const guest = createClient("guest-session");
    join(room, host, "Host");
    join(room, guest, "Guest");
    readyAndStart(room, host, guest);
    host.sent.length = 0;
    room.state.penaltyStack = 4;

    sendRoomMessage(room, host, "draw");

    const result = lastMessageOf(host, "drawResult")?.message;
    expect(result.penalty).toBe(4);
    expect(result.cards).toHaveLength(4);
    expect(room.state.penaltyStack).toBe(0);
    expect(room.state.players[0]!.handCount).toBe(11);
    expect(lastMessageOf(host, "hand")?.message.cards).toHaveLength(11);
  });

  it("reclaims a disconnected seat by previous session id in the same room", () => {
    const { room, broadcasts } = createRoom(2);
    const host = createClient("host-session");
    const guest = createClient("guest-session");
    join(room, host, "Host");
    join(room, guest, "Guest");

    room.state.players[0]!.connected = false;
    (room as any).seatMap.delete("host-session");

    const reconnectedHost = createClient("host-session-new");
    join(room, reconnectedHost, "Host Reconnected", "host-session");

    expect(room.state.players[0]!.sessionId).toBe("host-session-new");
    expect(room.state.players[0]!.connected).toBe(true);
    expect(room.state.players[0]!.isHost).toBe(true);
    expect(lastMessageOf(reconnectedHost, "roomState")?.message.seat).toBe(0);
    expect(broadcasts.some((event) => event.type === "playerReconnected" && event.message.seat === 0)).toBe(true);
  });
});
