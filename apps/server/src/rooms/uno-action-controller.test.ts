import { describe, expect, it } from "vitest";
import { Player, UnoState } from "../schema/UnoState";
import { UnoActionController } from "./uno-action-controller";
import type { GameCard } from "./uno-private-state";
import { UnoPrivateState } from "./uno-private-state";
import { UnoStateProjector } from "./uno-state-projector";

function card(value: number, color: GameCard["color"] = "RED", type: GameCard["type"] = "number"): GameCard {
  return { color, value, type };
}

function stateWithPlayers(playerCount: number): UnoState {
  const state = new UnoState();
  state.phase = "playing";
  state.currentPlayer = 0;
  state.currentColor = "RED";
  state.isClockwise = true;
  state.penaltyStack = 0;
  state.winnerSeat = -1;

  for (let seat = 0; seat < playerCount; seat++) {
    const player = new Player();
    player.id = seat;
    state.players.push(player);
  }

  return state;
}

function controllerFor(privateState: UnoPrivateState): UnoActionController {
  return new UnoActionController(privateState, new UnoStateProjector(privateState));
}

describe("UnoActionController", () => {
  it("plays a valid card and projects public state", () => {
    const privateState = new UnoPrivateState();
    privateState.reset([
      card(5, "RED"),
      card(1, "YEL"),
      card(2, "GRN"),
      card(9, "BLU"),
      card(7, "RED"),
    ]);
    privateState.dealHands(2, 2);
    const firstDiscard = privateState.startDiscardNonWild();

    const state = stateWithPlayers(2);
    state.currentColor = firstDiscard!.color;
    const result = controllerFor(privateState).play(state, 2, 0, 0);

    expect(result).not.toBeNull();
    expect(result!.winnerSeat).toBeNull();
    expect(result!.hand).toHaveLength(1);
    expect(privateState.topCard).toEqual(card(7, "RED"));
    expect(state.topCard.value).toBe(7);
    expect(state.players[0]!.handCount).toBe(1);
    expect(state.currentPlayer).toBe(1);
  });

  it("draws stacked penalty cards and clears the penalty", () => {
    const privateState = new UnoPrivateState();
    privateState.reset([card(1, "BLU"), card(2, "GRN")]);

    const state = stateWithPlayers(2);
    state.penaltyStack = 2;
    const result = controllerFor(privateState).draw(state, 2, 0);

    expect(result?.kind).toBe("penalty");
    if (result?.kind !== "penalty") throw new Error("Expected penalty draw result");
    expect(result.cards).toHaveLength(2);
    expect(result.hand).toHaveLength(2);
    expect(result.penalty).toBe(2);
    expect(state.penaltyStack).toBe(0);
    expect(state.players[0]!.handCount).toBe(2);
    expect(state.deckCount).toBe(0);
  });

  it("waits for color selection after a wild card", () => {
    const privateState = new UnoPrivateState();
    privateState.reset([
      card(5, "RED"),
      card(1, "YEL"),
      card(2, "GRN"),
      card(9, "BLU"),
      card(13, "WILD", "wild"),
    ]);
    privateState.dealHands(2, 2);
    const firstDiscard = privateState.startDiscardNonWild();

    const state = stateWithPlayers(2);
    state.currentColor = firstDiscard!.color;
    const controller = controllerFor(privateState);

    const playResult = controller.play(state, 2, 0, 0);
    expect(playResult).not.toBeNull();
    expect(state.currentColor).toBe("WILD");
    expect(state.currentPlayer).toBe(0);

    expect(controller.chooseColor(state, 2, 0, "GRN")).toBe(true);
    expect(state.currentColor).toBe("GRN");
    expect(state.currentPlayer).toBe(1);
  });
});
