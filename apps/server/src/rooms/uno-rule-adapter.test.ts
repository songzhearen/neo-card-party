import { describe, expect, it } from "vitest";
import type { Card } from "@card-party/shared";
import {
  ServerRuleState,
  advanceServerTurn,
  applyServerCardEffect,
  isServerValidPlay,
} from "./uno-rule-adapter";

function state(overrides: Partial<ServerRuleState> = {}): ServerRuleState {
  return {
    currentPlayer: 0,
    playerCount: 4,
    currentColor: "RED",
    isClockwise: true,
    penaltyStack: 0,
    topCard: { color: "RED", value: 5, type: "number" },
    ...overrides,
  };
}

describe("uno-rule-adapter", () => {
  it("validates color, value, and wild plays through shared rules", () => {
    const ruleState = state();

    expect(isServerValidPlay({ color: "RED", value: 9, type: "number" }, ruleState)).toBe(true);
    expect(isServerValidPlay({ color: "BLU", value: 5, type: "number" }, ruleState)).toBe(true);
    expect(isServerValidPlay({ color: "WILD", value: 13, type: "wild" }, ruleState)).toBe(true);
    expect(isServerValidPlay({ color: "GRN", value: 7, type: "number" }, ruleState)).toBe(false);
  });

  it("allows only stackable draw cards while penalty is active", () => {
    const ruleState = state({ penaltyStack: 2 });

    expect(isServerValidPlay({ color: "RED", value: 9, type: "number" }, ruleState)).toBe(false);
    expect(isServerValidPlay({ color: "BLU", value: 12, type: "draw2" }, ruleState)).toBe(true);
    expect(isServerValidPlay({ color: "WILD", value: 14, type: "wild4" }, ruleState)).toBe(true);
  });

  it("stacks draw penalties and advances the turn", () => {
    const afterDraw2 = applyServerCardEffect(
      { color: "RED", value: 12, type: "draw2" },
      state()
    );

    expect(afterDraw2).toEqual({
      currentPlayer: 1,
      isClockwise: true,
      penaltyStack: 2,
    });

    const afterWild4 = applyServerCardEffect(
      { color: "WILD", value: 14, type: "wild4" },
      state({ ...afterDraw2 })
    );

    expect(afterWild4.currentPlayer).toBe(2);
    expect(afterWild4.penaltyStack).toBe(6);
  });

  it("applies skip and reverse turn movement", () => {
    const skip = applyServerCardEffect(
      { color: "RED", value: 10, type: "skip" },
      state()
    );
    expect(skip.currentPlayer).toBe(2);

    const reverse = applyServerCardEffect(
      { color: "RED", value: 11, type: "reverse" },
      state()
    );
    expect(reverse.isClockwise).toBe(false);
    expect(reverse.currentPlayer).toBe(3);
  });

  it("keeps two-player reverse behavior compatible with the shared engine", () => {
    const reverse = applyServerCardEffect(
      { color: "RED", value: 11, type: "reverse" },
      state({ playerCount: 2 })
    );

    expect(reverse.currentPlayer).toBe(0);
    expect(reverse.isClockwise).toBe(false);
  });

  it("advances clockwise and counter-clockwise", () => {
    expect(advanceServerTurn(state()).currentPlayer).toBe(1);
    expect(advanceServerTurn(state({ currentPlayer: 0, isClockwise: false })).currentPlayer).toBe(3);
  });

  it("does not require private hands to validate a rule state", () => {
    const ruleState = state({ topCard: null });
    const anyCard: Card = { color: "GRN", value: 7, type: "number" };

    expect(isServerValidPlay(anyCard, ruleState)).toBe(true);
  });
});
