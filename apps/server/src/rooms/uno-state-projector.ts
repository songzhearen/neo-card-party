import type { UnoState } from "../schema/UnoState";
import type { UnoPrivateState } from "./uno-private-state";

export class UnoStateProjector {
  constructor(private readonly privateState: UnoPrivateState) {}

  syncCards(state: UnoState, playerCount: number): void {
    this.syncTopCard(state);
    this.syncDeckCounts(state, playerCount);
  }

  syncTopCard(state: UnoState): void {
    const top = this.privateState.topCard;
    if (!top) return;

    state.topCard.color = top.color;
    state.topCard.value = top.value;
    state.topCard.type = top.type;
    state.discardCount = this.privateState.discardCount;
  }

  syncDeckCounts(state: UnoState, playerCount: number): void {
    state.deckCount = this.privateState.deckCount;
    for (let seat = 0; seat < playerCount; seat++) {
      state.players[seat]!.handCount = this.privateState.handCount(seat);
    }
  }
}
