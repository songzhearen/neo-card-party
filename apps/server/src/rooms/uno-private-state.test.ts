import { describe, expect, it } from "vitest";
import type { GameCard } from "./uno-private-state";
import { UnoPrivateState } from "./uno-private-state";

function card(value: number, color: GameCard["color"] = "RED", type: GameCard["type"] = "number"): GameCard {
  return { color, value, type };
}

describe("UnoPrivateState", () => {
  it("deals private hands from the deck", () => {
    const state = new UnoPrivateState();
    state.reset();
    state.dealHands(4, 7);

    expect(state.getHand(0)).toHaveLength(7);
    expect(state.getHand(3)).toHaveLength(7);
    expect(state.deckCount).toBe(108 - 28);
  });

  it("starts discard with a non-wild card", () => {
    const state = new UnoPrivateState();
    state.reset([
      card(13, "WILD", "wild"),
      card(14, "WILD", "wild4"),
      card(5, "BLU", "number"),
    ]);

    const firstCard = state.startDiscardNonWild();

    expect(firstCard).toEqual(card(5, "BLU", "number"));
    expect(state.topCard).toEqual(firstCard);
    expect(state.discardCount).toBe(1);
  });

  it("moves cards from hand to discard", () => {
    const state = new UnoPrivateState();
    state.reset([card(1), card(2), card(3)]);
    state.dealHands(1, 2);

    const played = state.removeFromHand(0, 0);
    expect(played).not.toBeNull();
    state.addToDiscard(played!);

    expect(state.getHand(0)).toHaveLength(1);
    expect(state.topCard).toEqual(played);
  });

  it("draws cards into an existing hand", () => {
    const state = new UnoPrivateState();
    state.reset([card(1), card(2), card(3)]);
    state.dealHands(1, 1);

    const drawn = state.drawToHand(0, 2);

    expect(drawn).toHaveLength(2);
    expect(state.getHand(0)).toHaveLength(3);
    expect(state.deckCount).toBe(0);
  });

  it("reshuffles discard into deck while keeping the top discard", () => {
    const state = new UnoPrivateState();
    state.reset([card(1)]);
    state.startDiscardNonWild();
    state.addToDiscard(card(2, "BLU"));
    state.addToDiscard(card(3, "GRN"));

    const drawn = state.drawToHand(0, 1);

    expect(drawn).toHaveLength(1);
    expect(state.topCard).toEqual(card(3, "GRN"));
    expect(state.discardCount).toBe(1);
  });
});
