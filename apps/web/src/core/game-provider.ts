import type { GameAction, GameProviderMode } from "@card-party/shared";

export type { GameAction, GameProviderMode, RemoteGameAction } from "@card-party/shared";

export interface RemoteRoom {
  send(message: string, payload?: unknown): void;
}

export interface GameProvider {
  readonly mode: GameProviderMode;
  send(action: GameAction): boolean;
}

export type LocalGameActionHandler = (action: GameAction) => boolean;

export class LocalGameProvider implements GameProvider {
  readonly mode = "local";

  constructor(private readonly handler?: LocalGameActionHandler) {}

  send(action: GameAction): boolean {
    return this.handler?.(action) ?? false;
  }
}

export class RemoteGameProvider implements GameProvider {
  readonly mode = "remote";

  constructor(private readonly room: RemoteRoom) {}

  send(action: GameAction): boolean {
    try {
      switch (action.type) {
        case "play":
          this.room.send("play", { cardIndex: action.cardIndex });
          return true;
        case "draw":
          this.room.send("draw", {});
          return true;
        case "pass":
          this.room.send("pass", {});
          return true;
        case "chooseColor":
          this.room.send("chooseColor", { color: action.color });
          return true;
        case "requestHand":
          this.room.send("requestHand", {});
          return true;
        case "gameShout":
          this.room.send("gameShout", { message: action.message });
          return true;
        case "throwEmoji":
          this.room.send("throwEmoji", {
            targetSeat: action.targetSeat,
            emoji: action.emoji,
          });
          return true;
      }
    } catch {
      return false;
    }
  }
}

export function createGameProvider(
  room: RemoteRoom | null | undefined,
  localHandler?: LocalGameActionHandler
): GameProvider {
  return room ? new RemoteGameProvider(room) : new LocalGameProvider(localHandler);
}
