import { describe, expect, it } from "vitest";
import {
  COLORS,
  Card,
  advanceTurn,
  applyCardEffect,
  calculateScore,
  canPlayUnderPenalty,
  catchUnoFail,
  createGame,
  drawCard,
  generateDeck,
  getValidPlays,
  isValidPlay,
  topCard,
} from "./uno-engine";

describe("shared uno engine", () => {
  it("generates a standard 108-card deck", () => {
    const deck = generateDeck();

    expect(deck).toHaveLength(108);
    expect(deck.filter((card) => card.type === "wild")).toHaveLength(4);
    expect(deck.filter((card) => card.type === "wild4")).toHaveLength(4);

    for (const color of COLORS) {
      expect(deck.filter((card) => card.color === color && card.value === 0)).toHaveLength(1);
      expect(deck.filter((card) => card.color === color && card.value === 9)).toHaveLength(2);
    }
  });

  it("creates games with local hand-size rules", () => {
    const fourPlayers = createGame(4);
    const tenPlayers = createGame(10);

    expect(fourPlayers.players).toHaveLength(4);
    expect(fourPlayers.players.every((player) => player.hand.length === 7)).toBe(true);
    expect(tenPlayers.players.every((player) => player.hand.length === 5)).toBe(true);
    expect(topCard(fourPlayers).color).not.toBe("WILD");
  });

  it("validates matching color, matching value, and wild plays", () => {
    const state = createGame(4);
    state.discardPile = [{ color: "RED", value: 5, type: "number" }];
    state.currentColor = "RED";

    expect(isValidPlay({ color: "RED", value: 1, type: "number" }, state)).toBe(true);
    expect(isValidPlay({ color: "BLU", value: 5, type: "number" }, state)).toBe(true);
    expect(isValidPlay({ color: "WILD", value: 13, type: "wild" }, state)).toBe(true);
    expect(isValidPlay({ color: "GRN", value: 7, type: "number" }, state)).toBe(false);
  });

  it("limits playable cards during penalty stacking", () => {
    const state = createGame(4);
    state.penaltyStack = 2;
    const hand: Card[] = [
      { color: "RED", value: 4, type: "number" },
      { color: "BLU", value: 12, type: "draw2" },
      { color: "WILD", value: 14, type: "wild4" },
    ];

    expect(canPlayUnderPenalty(hand[0], state)).toBe(false);
    expect(getValidPlays(hand, state).map((card) => card.type)).toEqual(["draw2", "wild4"]);
  });

  it("stacks draw penalties without drawing immediately", () => {
    const state = createGame(4);

    applyCardEffect(state, { color: "RED", value: 12, type: "draw2" });
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.penaltyStack).toBe(2);

    applyCardEffect(state, { color: "WILD", value: 14, type: "wild4" });
    expect(state.currentPlayerIndex).toBe(2);
    expect(state.penaltyStack).toBe(6);
  });

  it("advances in both directions", () => {
    const state = createGame(4);

    advanceTurn(state);
    expect(state.currentPlayerIndex).toBe(1);

    state.isClockwise = false;
    advanceTurn(state);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it("reshuffles discard cards into the deck when drawing from an empty deck", () => {
    const state = createGame(2);
    state.deck = [];
    state.discardPile = [
      { color: "RED", value: 1, type: "number" },
      { color: "BLU", value: 2, type: "number" },
      { color: "GRN", value: 3, type: "number" },
    ];

    const before = state.players[0].hand.length;
    const drawn = drawCard(state, 0);

    expect(drawn).not.toBeNull();
    expect(state.players[0].hand).toHaveLength(before + 1);
    expect(state.discardPile).toHaveLength(1);
  });

  it("scores hands and catches missed UNO calls", () => {
    const state = createGame(4);
    state.players[1].hand = [{ color: "RED", value: 7, type: "number" }];

    expect(calculateScore([
      { color: "WILD", value: 13, type: "wild" },
      { color: "RED", value: 12, type: "draw2" },
      { color: "BLU", value: 7, type: "number" },
    ])).toBe(77);

    expect(catchUnoFail(state, 0, 1)).toBe(true);
    expect(state.players[1].hand.length).toBeGreaterThan(1);
  });
});
