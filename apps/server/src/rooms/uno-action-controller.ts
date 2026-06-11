import { COLORS } from "@card-party/shared";
import type { CardColor } from "@card-party/shared";
import type { UnoState } from "../schema/UnoState";
import type { GameCard, UnoPrivateState } from "./uno-private-state";
import {
  advanceServerTurn,
  applyServerCardEffect,
  isServerValidPlay,
} from "./uno-rule-adapter";
import type { ServerRulePatch, ServerRuleState } from "./uno-rule-adapter";
import type { UnoStateProjector } from "./uno-state-projector";

export interface UnoPlayResult {
  hand: GameCard[];
  winnerSeat: number | null;
}

export type UnoDrawResult =
  | {
      kind: "penalty";
      hand: GameCard[];
      card: GameCard | null;
      cards: GameCard[];
      penalty: number;
    }
  | {
      kind: "draw";
      hand: GameCard[];
      card: GameCard;
    };

export class UnoActionController {
  private pendingWildSeat: number = -1;
  private pendingWildCard: GameCard | null = null;

  constructor(
    private readonly privateState: UnoPrivateState,
    private readonly stateProjector: UnoStateProjector
  ) {}

  play(state: UnoState, playerCount: number, seat: number, cardIndex: number): UnoPlayResult | null {
    if (!this.isActiveTurn(state, seat)) return null;

    const hand = this.privateState.getHand(seat);
    if (cardIndex < 0 || cardIndex >= hand.length) return null;

    const card = hand[cardIndex];
    if (!card || !this.isValidPlay(state, playerCount, card)) return null;

    const playedCard = this.privateState.removeFromHand(seat, cardIndex);
    if (!playedCard) return null;

    this.privateState.addToDiscard(playedCard);
    state.currentColor = playedCard.color;

    let winnerSeat: number | null = null;
    if (hand.length === 0) {
      winnerSeat = seat;
      state.winnerSeat = seat;
      state.phase = "finished";
    }

    if (!state.phase.includes("finished") && playedCard.color === "WILD") {
      this.pendingWildSeat = seat;
      this.pendingWildCard = playedCard;
    } else if (!state.phase.includes("finished")) {
      this.applyCardEffect(state, playerCount, playedCard);
    }

    this.stateProjector.syncCards(state, playerCount);
    return { hand, winnerSeat };
  }

  draw(state: UnoState, playerCount: number, seat: number): UnoDrawResult | null {
    if (!this.isActiveTurn(state, seat)) return null;

    const hand = this.privateState.getHand(seat);
    if (state.penaltyStack > 0) {
      const penalty = state.penaltyStack;
      const cards = this.privateState.drawToHand(seat, penalty);

      state.penaltyStack = 0;
      this.stateProjector.syncDeckCounts(state, playerCount);
      return { kind: "penalty", hand, card: cards[0] || null, cards, penalty };
    }

    const [card] = this.privateState.drawToHand(seat, 1);
    if (!card) return null;

    this.stateProjector.syncDeckCounts(state, playerCount);
    return { kind: "draw", hand, card };
  }

  pass(state: UnoState, playerCount: number, seat: number): boolean {
    if (!this.isActiveTurn(state, seat)) return false;

    this.advanceTurn(state, playerCount);
    this.stateProjector.syncDeckCounts(state, playerCount);
    return true;
  }

  chooseColor(state: UnoState, playerCount: number, seat: number, color: string): boolean {
    if (seat !== this.pendingWildSeat || !this.pendingWildCard) return false;
    if (!COLORS.includes(color as CardColor)) return false;

    state.currentColor = color;
    const card = this.pendingWildCard;
    this.pendingWildSeat = -1;
    this.pendingWildCard = null;
    this.applyCardEffect(state, playerCount, card);
    this.stateProjector.syncDeckCounts(state, playerCount);
    return true;
  }

  private isActiveTurn(state: UnoState, seat: number): boolean {
    return seat === state.currentPlayer && state.phase === "playing";
  }

  private getRuleState(state: UnoState, playerCount: number): ServerRuleState {
    return {
      currentPlayer: state.currentPlayer,
      playerCount,
      currentColor: state.currentColor as CardColor,
      isClockwise: state.isClockwise,
      penaltyStack: state.penaltyStack,
      topCard: this.privateState.topCard,
    };
  }

  private applyRulePatch(state: UnoState, patch: ServerRulePatch): void {
    state.currentPlayer = patch.currentPlayer;
    state.isClockwise = patch.isClockwise;
    state.penaltyStack = patch.penaltyStack;
  }

  private isValidPlay(state: UnoState, playerCount: number, card: GameCard): boolean {
    return isServerValidPlay(card, this.getRuleState(state, playerCount));
  }

  private applyCardEffect(state: UnoState, playerCount: number, card: GameCard): void {
    this.applyRulePatch(state, applyServerCardEffect(card, this.getRuleState(state, playerCount)));
  }

  private advanceTurn(state: UnoState, playerCount: number): void {
    this.applyRulePatch(state, advanceServerTurn(this.getRuleState(state, playerCount)));
  }
}
