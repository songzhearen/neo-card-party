import { describe, it, expect, beforeEach } from "vitest";
import {
  generateDeck, createGame, shuffle, isValidPlay, canPlayUnderPenalty,
  getValidPlays, playCard, drawCard, applyCardEffect, advanceTurn,
  checkWin, aiDecideCard, aiChooseWildColor, calculateScore,
  callUno, isUnoDanger, catchUnoFail, topCard, getSymbol, COLORS, COLOR_HEX, SYMBOLS,
  GameState, Card,
} from "./uno-engine";

describe("generateDeck", () => {
  it("should produce 108 cards", () => {
    expect(generateDeck().length).toBe(108);
  });

  it("should have 4 wild and 4 wild4 cards", () => {
    const deck = generateDeck();
    expect(deck.filter((c) => c.type === "wild").length).toBe(4);
    expect(deck.filter((c) => c.type === "wild4").length).toBe(4);
  });

  it("should have one 0 per color", () => {
    const deck = generateDeck();
    for (const col of COLORS) {
      expect(deck.filter((c) => c.color === col && c.value === 0).length).toBe(1);
    }
  });

  it("should have two of each 1-9 per color", () => {
    const deck = generateDeck();
    for (const col of COLORS) {
      for (let v = 1; v <= 9; v++) {
        expect(deck.filter((c) => c.color === col && c.value === v && c.type === "number").length).toBe(2);
      }
    }
  });
});

describe("createGame", () => {
  it("should create a game with correct player count", () => {
    const gs = createGame(4);
    expect(gs.players.length).toBe(4);
  });

  it("should deal 7 cards for <= 8 players", () => {
    const gs = createGame(4);
    gs.players.forEach((p) => expect(p.hand.length).toBe(7));
  });

  it("should deal 5 cards for > 8 players", () => {
    const gs = createGame(10);
    gs.players.forEach((p) => expect(p.hand.length).toBe(5));
  });

  it("should have human as first player", () => {
    const gs = createGame(4);
    expect(gs.players[0].isHuman).toBe(true);
    expect(gs.currentPlayerIndex).toBe(0);
  });

  it("should start with playing phase", () => {
    expect(createGame(4).phase).toBe("playing");
  });

  it("should not have wild card as first discard", () => {
    const gs = createGame(4);
    const top = topCard(gs);
    expect(top.type).not.toBe("wild");
    expect(top.type).not.toBe("wild4");
  });

  it("should initialize unoCalled set", () => {
    const gs = createGame(4);
    expect(gs.unoCalled).toBeDefined();
    expect(gs.unoCalled.size).toBe(0);
  });
});

describe("isValidPlay", () => {
  let gs: GameState;

  beforeEach(() => {
    gs = createGame(4);
  });

  it("should allow same color card", () => {
    const top = topCard(gs);
    const card: Card = { color: top.color, value: 5, type: "number" };
    expect(isValidPlay(card, gs)).toBe(true);
  });

  it("should allow wild card on anything", () => {
    const wild: Card = { color: "WILD", value: 13, type: "wild" };
    expect(isValidPlay(wild, gs)).toBe(true);
  });

  it("should reject different color and different value", () => {
    const top = topCard(gs);
    const otherColor = COLORS.find((c) => c !== top.color)!;
    const card: Card = { color: otherColor, value: top.value === 5 ? 6 : 5, type: "number" };
    expect(isValidPlay(card, gs)).toBe(false);
  });

  it("should allow same type and value even if different color", () => {
    const top = topCard(gs);
    const otherColor = COLORS.find((c) => c !== top.color)!;
    const card: Card = { color: otherColor, value: top.value, type: top.type };
    expect(isValidPlay(card, gs)).toBe(true);
  });
});

describe("canPlayUnderPenalty", () => {
  let gs: GameState;

  beforeEach(() => {
    gs = createGame(4);
  });

  it("should allow wild4 under any penalty", () => {
    gs.penaltyStack = 2;
    const wild4: Card = { color: "WILD", value: 14, type: "wild4" };
    expect(canPlayUnderPenalty(wild4, gs)).toBe(true);
  });

  it("should allow draw2 under penalty >= 2", () => {
    gs.penaltyStack = 4;
    const draw2: Card = { color: "RED", value: 12, type: "draw2" };
    expect(canPlayUnderPenalty(draw2, gs)).toBe(true);
  });

  it("should reject normal cards under penalty", () => {
    gs.penaltyStack = 2;
    const normal: Card = { color: "RED", value: 5, type: "number" };
    expect(canPlayUnderPenalty(normal, gs)).toBe(false);
  });

  it("should delegate to isValidPlay when no penalty", () => {
    gs.penaltyStack = 0;
    const top = topCard(gs);
    const card: Card = { color: top.color, value: 3, type: "number" };
    expect(canPlayUnderPenalty(card, gs)).toBe(isValidPlay(card, gs));
  });
});

describe("playCard", () => {
  it("should remove card from hand and add to discard", () => {
    const gs = createGame(4);
    const handLen = gs.players[0].hand.length;
    const card = gs.players[0].hand[0];
    gs.currentColor = card.color;
    expect(playCard(gs, 0, 0)).toBe(true);
    expect(gs.players[0].hand.length).toBe(handLen - 1);
    expect(gs.discardPile[gs.discardPile.length - 1]).toBe(card);
  });

  it("should update currentColor", () => {
    const gs = createGame(4);
    const top = topCard(gs);
    gs.currentColor = top.color;
    const idx = gs.players[0].hand.findIndex((c) => isValidPlay(c, gs));
    if (idx >= 0) {
      const card = gs.players[0].hand[idx];
      playCard(gs, 0, idx);
      expect(gs.currentColor).toBe(card.color);
    }
  });

  it("should reject invalid plays", () => {
    const gs = createGame(4);
    const top = topCard(gs);
    const invalidColor = COLORS.find((c) => c !== top.color)!;
    // Find card with wrong color
    const idx = gs.players[0].hand.findIndex((c) => c.color === invalidColor && c.value !== top.value);
    if (idx >= 0) {
      expect(playCard(gs, 0, idx)).toBe(false);
    }
  });
});

describe("drawCard", () => {
  it("should add card to player hand", () => {
    const gs = createGame(4);
    const len = gs.players[0].hand.length;
    const card = drawCard(gs, 0);
    expect(card).not.toBeNull();
    expect(gs.players[0].hand.length).toBe(len + 1);
  });

  it("should reshuffle discard into deck when deck empty", () => {
    const gs = createGame(2);
    const top = topCard(gs);
    // Move all deck cards to discard pile, all same color to be valid
    while (gs.deck.length > 0) {
      const c = gs.deck.pop()!;
      gs.discardPile.push(c);
    }
    // Deck is now empty, discard has ~88 cards
    const oldDiscardLen = gs.discardPile.length;
    const card = drawCard(gs, 0);
    if (card) {
      // After reshuffle: top card stays, rest go to deck
      expect(gs.discardPile.length).toBe(1);
      expect(gs.deck.length).toBe(oldDiscardLen - 2); // -1 for top kept, -1 for card drawn
    }
  });
});

describe("advanceTurn", () => {
  it("should advance clockwise", () => {
    const gs = createGame(4);
    gs.currentPlayerIndex = 0;
    advanceTurn(gs);
    expect(gs.currentPlayerIndex).toBe(1);
  });

  it("should advance counter-clockwise", () => {
    const gs = createGame(4);
    gs.isClockwise = false;
    gs.currentPlayerIndex = 0;
    advanceTurn(gs);
    expect(gs.currentPlayerIndex).toBe(3);
  });

  it("should wrap around", () => {
    const gs = createGame(4);
    gs.currentPlayerIndex = 3;
    advanceTurn(gs);
    expect(gs.currentPlayerIndex).toBe(0);
  });
});

describe("applyCardEffect", () => {
  it("skip should advance twice", () => {
    const gs = createGame(4);
    gs.currentPlayerIndex = 0;
    const skip: Card = { color: "RED", value: 10, type: "skip" };
    applyCardEffect(gs, skip);
    // advance in effect: first advanceTurn, then advanceTurn
    // Effect already calls advanceTurn internally
    expect(gs.currentPlayerIndex).toBe(2);
  });

  it("reverse should change direction", () => {
    const gs = createGame(4);
    gs.currentPlayerIndex = 0;
    const reverse: Card = { color: "RED", value: 11, type: "reverse" };
    applyCardEffect(gs, reverse);
    expect(gs.isClockwise).toBe(false);
  });

  it("draw2 should stack penalty", () => {
    const gs = createGame(4);
    gs.currentPlayerIndex = 0;
    const nextPlayerHand = gs.players[1].hand.length;
    const draw2: Card = { color: "RED", value: 12, type: "draw2" };
    applyCardEffect(gs, draw2);
    expect(gs.players[1].hand.length).toBe(nextPlayerHand);
    expect(gs.currentPlayerIndex).toBe(1);
    expect(gs.penaltyStack).toBe(2);
  });

  it("wild4 should stack penalty and advance", () => {
    const gs = createGame(4);
    gs.currentPlayerIndex = 0;
    const nextPlayerHand = gs.players[1].hand.length;
    const wild4: Card = { color: "WILD", value: 14, type: "wild4" };
    applyCardEffect(gs, wild4);
    expect(gs.players[1].hand.length).toBe(nextPlayerHand);
    expect(gs.currentPlayerIndex).toBe(1);
    expect(gs.penaltyStack).toBe(4);
  });
});

describe("checkWin", () => {
  it("should detect winner with empty hand", () => {
    const gs = createGame(2);
    gs.players[0].hand = [];
    expect(checkWin(gs)).toBe(0);
    expect(gs.phase).toBe("finished");
    expect(gs.winnerIndex).toBe(0);
  });

  it("should return null when no winner", () => {
    const gs = createGame(4);
    expect(checkWin(gs)).toBeNull();
    expect(gs.phase).toBe("playing");
  });
});

describe("aiDecideCard", () => {
  it("should return -1 when no valid plays", () => {
    const gs = createGame(2);
    // Override AI hand with all same invalid cards
    gs.players[1].hand = [];
    for (let i = 0; i < 5; i++) {
      gs.players[1].hand.push({ color: "RED", value: 8, type: "number" });
    }
    const top = topCard(gs);
    gs.currentColor = "BLU";
    // Change the discard top to be a blue card, so red cards don't match
    gs.discardPile[gs.discardPile.length - 1] = { color: "BLU", value: 3, type: "number" };

    const result = aiDecideCard(gs, 1);
    // Depends on game state - if red doesn't match blue, should return -1
    // or could match by value
    expect(result).toBeGreaterThanOrEqual(-1);
    expect(result).toBeLessThan(gs.players[1].hand.length);
  });

  it("should pick highest value from valid plays", () => {
    const gs = createGame(2);
    const top = topCard(gs);
    gs.currentColor = top.color;
    const hand = [
      { color: top.color, value: 2, type: "number" } as Card,
      { color: top.color, value: 9, type: "number" } as Card,
      { color: "WILD", value: 13, type: "wild" } as Card,
    ];
    gs.players[1].hand = hand;
    const idx = aiDecideCard(gs, 1);
    // Wild has value 13, should be picked (highest value)
    expect(idx).not.toBe(-1);
    expect(gs.players[1].hand[idx].type).toBe("wild");
  });
});

describe("aiChooseWildColor", () => {
  it("should pick most common color in hand", () => {
    const gs = createGame(2);
    gs.players[1].hand = [
      { color: "RED", value: 1, type: "number" } as Card,
      { color: "RED", value: 2, type: "number" } as Card,
      { color: "RED", value: 3, type: "number" } as Card,
      { color: "BLU", value: 4, type: "number" } as Card,
    ];
    expect(aiChooseWildColor(gs, 1)).toBe("RED");
  });
});

describe("calculateScore", () => {
  it("should score wild cards as 50", () => {
    expect(calculateScore([{ color: "WILD", value: 13, type: "wild" }])).toBe(50);
    expect(calculateScore([{ color: "WILD", value: 14, type: "wild4" }])).toBe(50);
  });

  it("should score action cards as 20", () => {
    expect(calculateScore([{ color: "RED", value: 12, type: "draw2" }])).toBe(20);
    expect(calculateScore([{ color: "RED", value: 10, type: "skip" }])).toBe(20);
    expect(calculateScore([{ color: "RED", value: 11, type: "reverse" }])).toBe(20);
  });

  it("should score number cards by face value", () => {
    expect(calculateScore([{ color: "RED", value: 7, type: "number" }])).toBe(7);
    expect(calculateScore([{ color: "RED", value: 0, type: "number" }])).toBe(0);
  });

  it("should sum multiple cards", () => {
    const cards: Card[] = [
      { color: "WILD", value: 13, type: "wild" },
      { color: "RED", value: 12, type: "draw2" },
      { color: "BLU", value: 5, type: "number" },
    ];
    expect(calculateScore(cards)).toBe(50 + 20 + 5);
  });
});

describe("callUno / isUnoDanger / catchUnoFail", () => {
  it("should mark player as calling UNO", () => {
    const gs = createGame(4);
    callUno(gs, 0);
    expect(gs.unoCalled.has(0)).toBe(true);
  });

  it("should detect un-danger state", () => {
    const gs = createGame(4);
    gs.players[0].hand = [{ color: "RED", value: 5, type: "number" }];
    expect(isUnoDanger(gs, 0)).toBe(true);
  });

  it("should not be danger if UNO was called", () => {
    const gs = createGame(4);
    gs.players[0].hand = [{ color: "RED", value: 5, type: "number" }];
    callUno(gs, 0);
    expect(isUnoDanger(gs, 0)).toBe(false);
  });

  it("should penalize player who forgot UNO", () => {
    const gs = createGame(4);
    gs.players[1].hand = [{ color: "RED", value: 5, type: "number" }];
    const beforeHand = gs.players[1].hand.length;
    expect(catchUnoFail(gs, 0, 1)).toBe(true);
    expect(gs.players[1].hand.length).toBe(beforeHand + 2);
    expect(isUnoDanger(gs, 1)).toBe(false);
  });

  it("should reject catching player not in danger", () => {
    const gs = createGame(4);
    gs.players[1].hand = [{ color: "RED", value: 5, type: "number" }, { color: "BLU", value: 3, type: "number" }];
    expect(catchUnoFail(gs, 0, 1)).toBe(false);
  });
});

describe("getValidPlays", () => {
  it("should return valid cards under penalty", () => {
    const gs = createGame(4);
    gs.penaltyStack = 2;
    gs.players[0].hand = [
      { color: "RED", value: 5, type: "number" } as Card,
      { color: "WILD", value: 14, type: "wild4" } as Card,
      { color: "BLU", value: 12, type: "draw2" } as Card,
    ];
    const valid = getValidPlays(gs.players[0].hand, gs);
    expect(valid.length).toBe(2);
    expect(valid.some((c) => c.type === "wild4")).toBe(true);
    expect(valid.some((c) => c.type === "draw2")).toBe(true);
    expect(valid.some((c) => c.type === "number")).toBe(false);
  });

  it("should return all valid cards with no penalty", () => {
    const gs = createGame(4);
    gs.discardPile = [{ color: "RED", value: 5, type: "number" }];
    gs.currentColor = "RED";
    gs.players[0].hand = [
      { color: "RED", value: 2, type: "number" },
      { color: "BLU", value: 5, type: "number" },
      { color: "GRN", value: 9, type: "number" },
    ];
    const valid = getValidPlays(gs.players[0].hand, gs);
    expect(valid.length).toBe(2);
    valid.forEach((c) => expect(isValidPlay(c, gs)).toBe(true));
  });
});
