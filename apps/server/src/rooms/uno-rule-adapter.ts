import {
  advanceTurn,
  applyCardEffect,
  canPlayUnderPenalty,
  isValidPlay,
} from "@card-party/shared";
import type { Card, CardColor, GameState } from "@card-party/shared";

export interface ServerRuleState {
  currentPlayer: number;
  playerCount: number;
  currentColor: CardColor;
  isClockwise: boolean;
  penaltyStack: number;
  topCard: Card | null;
}

export interface ServerRulePatch {
  currentPlayer: number;
  isClockwise: boolean;
  penaltyStack: number;
}

function toSharedRuleState(state: ServerRuleState): GameState {
  const topCard = state.topCard ?? { color: state.currentColor, value: -1, type: "number" };

  return {
    deck: [],
    discardPile: [topCard],
    players: Array.from({ length: state.playerCount }, (_, id) => ({
      id,
      name: `P${id + 1}`,
      hand: [],
      isHuman: true,
      color: "",
    })),
    currentPlayerIndex: state.currentPlayer,
    isClockwise: state.isClockwise,
    penaltyStack: state.penaltyStack,
    currentColor: state.currentColor,
    phase: "playing",
    winnerIndex: null,
    unoCalled: new Set(),
  };
}

function toPatch(state: GameState): ServerRulePatch {
  return {
    currentPlayer: state.currentPlayerIndex,
    isClockwise: state.isClockwise,
    penaltyStack: state.penaltyStack,
  };
}

export function isServerValidPlay(card: Card, state: ServerRuleState): boolean {
  if (!state.topCard) return true;
  const sharedState = toSharedRuleState(state);
  if (state.penaltyStack > 0) return canPlayUnderPenalty(card, sharedState);
  return isValidPlay(card, sharedState);
}

export function applyServerCardEffect(card: Card, state: ServerRuleState): ServerRulePatch {
  const sharedState = toSharedRuleState(state);
  applyCardEffect(sharedState, card);
  return toPatch(sharedState);
}

export function advanceServerTurn(state: ServerRuleState): ServerRulePatch {
  const sharedState = toSharedRuleState(state);
  advanceTurn(sharedState);
  return toPatch(sharedState);
}
