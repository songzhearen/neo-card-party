import type { UnoCard, UnoCardColor, UnoCardType, UnoPlayableColor } from "./contracts";

export type CardColor = UnoCardColor;
export type CardType = UnoCardType;

export interface Card extends UnoCard {}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  isHuman: boolean;
  color: string;
}

export type GamePhase = "setup" | "playing" | "finished";

export interface GameState {
  deck: Card[];
  discardPile: Card[];
  players: Player[];
  currentPlayerIndex: number;
  isClockwise: boolean;
  penaltyStack: number;
  currentColor: CardColor;
  phase: GamePhase;
  winnerIndex: number | null;
  unoCalled: Set<number>;
}

export const COLORS: CardColor[] = ["RED", "BLU", "GRN", "YEL"];
export const COLOR_HEX: Record<string, string> = {
  RED: "#FF2A5F",
  BLU: "#0077FF",
  GRN: "#00C853",
  YEL: "#FFB300",
  WILD: "#1A1A1A",
};
export const SYMBOLS: Record<number, string> = { 10: "\u2298", 11: "\u21C4", 12: "+2", 13: "W", 14: "+4" };
export const PLAYER_COLORS = [
  "#FFD54F", "#4FC3F7", "#81C784", "#E57373", "#9B59B6", "#ED8936",
  "#38B2AC", "#F56565", "#9F7AEA", "#A0AEC0", "#F687B3", "#68D391",
];
export const PLAYER_NAMES = [
  "\u6211", "CPU-2", "CPU-3", "CPU-4", "CPU-5", "CPU-6",
  "CPU-7", "CPU-8", "CPU-9", "CPU-10", "CPU-11", "CPU-12",
];

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getSymbol(v: number): string {
  return SYMBOLS[v] !== undefined ? SYMBOLS[v] : String(v);
}

export function generateDeck(): Card[] {
  const deck: Card[] = [];
  for (const color of COLORS) {
    deck.push({ color, value: 0, type: "number" });
    for (let value = 1; value <= 9; value++) {
      deck.push({ color, value, type: "number" });
      deck.push({ color, value, type: "number" });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({ color, value: 10, type: "skip" });
      deck.push({ color, value: 11, type: "reverse" });
      deck.push({ color, value: 12, type: "draw2" });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "WILD", value: 13, type: "wild" });
    deck.push({ color: "WILD", value: 14, type: "wild4" });
  }
  return deck;
}

export function createGame(playerCount: number = 4): GameState {
  const deck = shuffle(generateDeck());
  const players: Player[] = [];
  const handSize = playerCount > 8 ? 5 : 7;

  for (let i = 0; i < playerCount; i++) {
    const hand: Card[] = [];
    for (let j = 0; j < handSize; j++) {
      hand.push(deck.pop()!);
    }
    players.push({
      id: i,
      name: PLAYER_NAMES[i] || `CPU-${i + 1}`,
      hand,
      isHuman: i === 0,
      color: PLAYER_COLORS[i] || "#EDF2F7",
    });
  }

  let firstCard: Card;
  do {
    const idx = Math.floor(Math.random() * deck.length);
    firstCard = deck.splice(idx, 1)[0];
  } while (firstCard.type === "wild" || firstCard.type === "wild4");

  return {
    deck,
    discardPile: [firstCard],
    players,
    currentPlayerIndex: 0,
    isClockwise: true,
    penaltyStack: 0,
    currentColor: firstCard.color,
    phase: "playing",
    winnerIndex: null,
    unoCalled: new Set(),
  };
}

export function topCard(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

export function isValidPlay(card: Card, state: GameState): boolean {
  const top = topCard(state);
  if (card.color === "WILD") return true;
  if (card.color === state.currentColor) return true;
  if (card.value === top.value && card.type === top.type) return true;
  return false;
}

export function canPlayUnderPenalty(card: Card, state: GameState): boolean {
  if (state.penaltyStack <= 0) return isValidPlay(card, state);
  if (card.type === "wild4") return true;
  if (state.penaltyStack >= 2 && card.type === "draw2") return true;
  return false;
}

export function getValidPlays(hand: Card[], state: GameState): Card[] {
  if (state.penaltyStack > 0) return hand.filter((card) => canPlayUnderPenalty(card, state));
  return hand.filter((card) => isValidPlay(card, state));
}

export function drawCard(state: GameState, playerIndex: number): Card | null {
  if (state.deck.length === 0) {
    if (state.discardPile.length <= 1) return null;
    const top = state.discardPile.pop()!;
    state.deck = shuffle(state.discardPile);
    state.discardPile = [top];
  }
  if (state.deck.length === 0) return null;
  const card = state.deck.pop()!;
  state.players[playerIndex].hand.push(card);
  return card;
}

export function playCard(state: GameState, playerIndex: number, cardIndex: number): boolean {
  const player = state.players[playerIndex];
  const card = player.hand[cardIndex];
  if (!card) return false;

  const valid = state.penaltyStack > 0 ? canPlayUnderPenalty(card, state) : isValidPlay(card, state);
  if (!valid) return false;

  player.hand.splice(cardIndex, 1);
  state.discardPile.push(card);
  state.currentColor = card.color;
  return true;
}

export function applyCardEffect(state: GameState, card: Card): void {
  switch (card.type) {
    case "skip":
      advanceTurn(state);
      advanceTurn(state);
      break;
    case "reverse":
      state.isClockwise = !state.isClockwise;
      if (state.players.length === 2) advanceTurn(state);
      advanceTurn(state);
      break;
    case "draw2":
      state.penaltyStack += 2;
      advanceTurn(state);
      break;
    case "wild4":
      state.penaltyStack += 4;
      advanceTurn(state);
      break;
    default:
      advanceTurn(state);
      break;
  }
}

export function advanceTurn(state: GameState): void {
  const playerCount = state.players.length;
  if (state.isClockwise) {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % playerCount;
  } else {
    state.currentPlayerIndex = (state.currentPlayerIndex - 1 + playerCount) % playerCount;
  }
}

export function checkWin(state: GameState): number | null {
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].hand.length === 0) {
      state.phase = "finished";
      state.winnerIndex = i;
      return i;
    }
  }
  return null;
}

export function aiDecideCard(state: GameState, playerIndex: number): number {
  const hand = state.players[playerIndex].hand;
  const validPlays = getValidPlays(hand, state);
  if (validPlays.length === 0) return -1;

  validPlays.sort((a, b) => b.value - a.value);
  return hand.indexOf(validPlays[0]);
}

export function aiChooseWildColor(state: GameState, playerIndex: number): CardColor {
  const hand = state.players[playerIndex].hand;
  const counts: Record<UnoPlayableColor, number> = { RED: 0, BLU: 0, GRN: 0, YEL: 0 };
  for (const card of hand) {
    if (card.color !== "WILD") counts[card.color]++;
  }

  let bestColor: CardColor = "RED";
  let bestCount = -1;
  for (const color of COLORS) {
    if (color !== "WILD" && counts[color] > bestCount) {
      bestCount = counts[color];
      bestColor = color;
    }
  }
  return bestColor;
}

export function calculateScore(hand: Card[]): number {
  let score = 0;
  for (const card of hand) {
    if (card.type === "wild" || card.type === "wild4") score += 50;
    else if (card.type === "draw2" || card.type === "skip" || card.type === "reverse") score += 20;
    else score += card.value;
  }
  return score;
}

export function callUno(state: GameState, playerIndex: number): void {
  state.unoCalled.add(playerIndex);
}

export function isUnoDanger(state: GameState, playerIndex: number): boolean {
  return state.players[playerIndex].hand.length === 1 && !state.unoCalled.has(playerIndex);
}

export function catchUnoFail(state: GameState, _catcherIndex: number, targetIndex: number): boolean {
  if (!isUnoDanger(state, targetIndex)) return false;
  state.unoCalled.delete(targetIndex);
  for (let i = 0; i < 2; i++) {
    drawCard(state, targetIndex);
  }
  return true;
}

export function clearUnoCall(state: GameState, playerIndex: number): void {
  state.unoCalled.delete(playerIndex);
}
