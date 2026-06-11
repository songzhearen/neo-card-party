import { describe, expect, it } from "vitest";
import { LocalGameProvider, RemoteGameProvider, RemoteRoom, createGameProvider } from "./game-provider";

interface SentMessage {
  message: string;
  payload?: unknown;
}

class FakeRoom implements RemoteRoom {
  sent: SentMessage[] = [];

  send(message: string, payload?: unknown): void {
    this.sent.push({ message, payload });
  }
}

describe("RemoteGameProvider", () => {
  it("maps card actions to room messages", () => {
    const room = new FakeRoom();
    const provider = new RemoteGameProvider(room);

    expect(provider.send({ type: "play", cardIndex: 3 })).toBe(true);
    expect(provider.send({ type: "chooseColor", color: "RED" })).toBe(true);

    expect(room.sent).toEqual([
      { message: "play", payload: { cardIndex: 3 } },
      { message: "chooseColor", payload: { color: "RED" } },
    ]);
  });

  it("maps turn actions to room messages", () => {
    const room = new FakeRoom();
    const provider = new RemoteGameProvider(room);

    provider.send({ type: "draw" });
    provider.send({ type: "pass" });
    provider.send({ type: "requestHand" });

    expect(room.sent).toEqual([
      { message: "draw", payload: {} },
      { message: "pass", payload: {} },
      { message: "requestHand", payload: {} },
    ]);
  });

  it("maps table interaction actions to room messages", () => {
    const room = new FakeRoom();
    const provider = new RemoteGameProvider(room);

    provider.send({ type: "gameShout", message: "LAST!" });
    provider.send({ type: "throwEmoji", targetSeat: 2, emoji: "!" });

    expect(room.sent).toEqual([
      { message: "gameShout", payload: { message: "LAST!" } },
      { message: "throwEmoji", payload: { targetSeat: 2, emoji: "!" } },
    ]);
  });

  it("returns false when the room send fails", () => {
    const provider = new RemoteGameProvider({
      send() {
        throw new Error("offline");
      },
    });

    expect(provider.send({ type: "draw" })).toBe(false);
  });
});

describe("LocalGameProvider", () => {
  it("uses the shared provider surface without handling local actions yet", () => {
    const provider = new LocalGameProvider();

    expect(provider.mode).toBe("local");
    expect(provider.send({ type: "draw" })).toBe(false);
  });

  it("delegates local actions to the provided handler", () => {
    const handled: string[] = [];
    const provider = new LocalGameProvider((action) => {
      handled.push(action.type);
      return action.type === "draw";
    });

    expect(provider.send({ type: "draw" })).toBe(true);
    expect(provider.send({ type: "pass" })).toBe(false);
    expect(handled).toEqual(["draw", "pass"]);
  });
});

describe("createGameProvider", () => {
  it("creates a remote provider when a room is available", () => {
    const provider = createGameProvider(new FakeRoom());

    expect(provider.mode).toBe("remote");
    expect(provider.send({ type: "requestHand" })).toBe(true);
  });

  it("creates a local provider without a room", () => {
    const provider = createGameProvider(null);

    expect(provider.mode).toBe("local");
    expect(provider.send({ type: "pass" })).toBe(false);
  });
});
