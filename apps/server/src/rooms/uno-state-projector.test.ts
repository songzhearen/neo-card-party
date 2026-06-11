import { describe, expect, it } from "vitest";
import { Player, UnoState } from "../schema/UnoState";
import type { GameCard } from "./uno-private-state";
import { UnoPrivateState } from "./uno-private-state";
import { UnoStateProjector } from "./uno-state-projector";

function card(value: number, color: GameCard["color"] = "RED", type: GameCard["type"] = "number"): GameCard {
  return { color, value, type };
}

function stateWithPlayers(playerCount: number): UnoState {
  const state = new UnoState();
  for (let seat = 0; seat < playerCount; seat++) {
    const player = new Player();
    player.id = seat;
    state.players.push(player);
  }
  return state;
}

describe("UnoStateProjector", () => {
  it("projects private card state into public Colyseus counts", () => {
    const privateState = new UnoPrivateState();
    privateState.reset([card(1), card(2), card(3), card(4), card(5, "BLU")]);
    privateState.dealHands(2, 2);
    const firstDiscard = privateState.startDiscardNonWild();

    const state = stateWithPlayers(2);
    new UnoStateProjector(privateState).syncCards(state, 2);

    expect(state.topCard.color).toBe(firstDiscard!.color);
    expect(state.topCard.value).toBe(firstDiscard!.value);
    expect(state.topCard.type).toBe(firstDiscard!.type);
    expect(state.discardCount).toBe(1);
    expect(state.deckCount).toBe(0);
    expect(state.players[0]!.handCount).toBe(2);
    expect(state.players[1]!.handCount).toBe(2);
  });
});
