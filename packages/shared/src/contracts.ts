export const CARD_PARTY_PROTOCOL_VERSION = "0.1.0" as const;

export type UnoPlayableColor = "RED" | "BLU" | "GRN" | "YEL";
export type UnoCardColor = UnoPlayableColor | "WILD";
export type UnoCardType = "number" | "skip" | "reverse" | "draw2" | "wild" | "wild4";

export interface UnoCard {
  color: UnoCardColor;
  value: number;
  type: UnoCardType;
  chosenColor?: UnoCardColor;
}

export type GameProviderMode = "local" | "remote";

export type GameAction =
  | { type: "play"; cardIndex: number }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "chooseColor"; color: UnoCardColor }
  | { type: "requestHand" }
  | { type: "gameShout"; message: string }
  | { type: "throwEmoji"; targetSeat: number; emoji: string };

export type PlayCardAction = Extract<GameAction, { type: "play" }>;
export type ChooseColorAction = Extract<GameAction, { type: "chooseColor" }>;
export type GameShoutAction = Extract<GameAction, { type: "gameShout" }>;
export type ThrowEmojiAction = Extract<GameAction, { type: "throwEmoji" }>;
export type RemoteGameAction = GameAction;

export type PlayCardPayload = Omit<PlayCardAction, "type">;
export type ChooseColorPayload = Omit<ChooseColorAction, "type">;
export type GameShoutPayload = Omit<GameShoutAction, "type">;
export type ThrowEmojiPayload = Omit<ThrowEmojiAction, "type">;

export type RoomMode = "casual" | "ranked";
export type GameMode = "ai" | "multi";

export interface JoinRoomOptions {
  roomId?: string;
  create?: boolean;
  playerCount?: number;
  roomName?: string;
  mode?: RoomMode;
  ante?: number;
}

export interface JoinRoomPayload {
  name: string;
  avatar: string;
  accessoryId: string;
  accessoryColor: string;
  titleId?: string;
  titleZh?: string;
  titleEn?: string;
  authToken?: string;
  previousSessionId?: string;
  playerCount: number;
  roomName?: string;
  mode: RoomMode;
  ante: number;
}

export interface ReadyRoomPayload {
  isReady: boolean;
}

export interface ChatRoomPayload {
  text: string;
}

export interface RoomContextPlayer {
  id: number;
  name: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  avatar?: string;
  accessoryId?: string;
  accessoryColor?: string;
  titleId?: string;
  titleZh?: string;
  titleEn?: string;
}

export interface GameModeContext {
  mode: GameMode;
  playerCount: number;
  roomId: string | null;
  players: RoomContextPlayer[];
  mySeat: number;
}

export interface RoomSnapshotPlayer extends RoomContextPlayer {
  sessionId: string;
  connected: boolean;
  isHuman: boolean;
}

export interface RoomStateSnapshot {
  seat: number;
  maxPlayers: number;
  players: RoomSnapshotPlayer[];
  hostSessionId: string;
}

export interface HandMessage {
  cards: UnoCard[];
}

export interface DrawResultMessage {
  card?: UnoCard | null;
  cards?: UnoCard[];
  penalty?: number;
}

export interface GameShoutMessage {
  seat: number;
  message: string;
}

export interface ThrowEmojiMessage {
  fromSeat: number;
  targetSeat: number;
  emoji: string;
}

export interface GameOverMessage {
  winnerSeat: number;
  winner?: string;
  winnerScore?: number;
  gameId?: number | null;
  players?: Array<{
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
  }>;
}
