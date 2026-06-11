import { generateDeck, shuffle } from "@card-party/shared";
import type { UnoCard } from "@card-party/shared";

export type GameCard = UnoCard;

export class UnoPrivateState {
  private deck: GameCard[] = [];
  private discardPile: GameCard[] = [];
  private hands: Map<number, GameCard[]> = new Map();

  get deckCount(): number {
    return this.deck.length;
  }

  get discardCount(): number {
    return this.discardPile.length;
  }

  get topCard(): GameCard | null {
    return this.discardPile[this.discardPile.length - 1] || null;
  }

  reset(deck: GameCard[] = shuffle(generateDeck())): void {
    this.deck = deck;
    this.discardPile = [];
    this.hands.clear();
  }

  getHand(seat: number): GameCard[] {
    return this.ensureHand(seat);
  }

  handCount(seat: number): number {
    return this.hands.get(seat)?.length ?? 0;
  }

  dealHands(playerCount: number, handSize: number): void {
    for (let seat = 0; seat < playerCount; seat++) {
      const hand: GameCard[] = [];
      for (let i = 0; i < handSize; i++) {
        const card = this.deck.pop();
        if (card) hand.push(card);
      }
      this.hands.set(seat, hand);
    }
  }

  startDiscardNonWild(): GameCard | null {
    const candidateIndexes = this.deck
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.type !== "wild" && card.type !== "wild4")
      .map(({ index }) => index);
    if (candidateIndexes.length === 0) return null;

    const idx = candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)];
    if (idx === undefined) return null;

    const firstCard = this.deck.splice(idx, 1)[0];
    if (!firstCard) return null;

    this.discardPile.push(firstCard);
    return firstCard;
  }

  removeFromHand(seat: number, cardIndex: number): GameCard | null {
    const hand = this.hands.get(seat);
    if (!hand || cardIndex < 0 || cardIndex >= hand.length) return null;
    return hand.splice(cardIndex, 1)[0] || null;
  }

  addToDiscard(card: GameCard): void {
    this.discardPile.push(card);
  }

  drawToHand(seat: number, count: number): GameCard[] {
    const hand = this.ensureHand(seat);
    const cards: GameCard[] = [];

    for (let i = 0; i < count; i++) {
      const card = this.drawOne();
      if (!card) break;
      hand.push(card);
      cards.push(card);
    }

    return cards;
  }

  reshuffleDiscard(): void {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop()!;
    this.deck = shuffle(this.discardPile);
    this.discardPile = [top];
  }

  private drawOne(): GameCard | null {
    if (this.deck.length === 0) this.reshuffleDiscard();
    return this.deck.pop() || null;
  }

  private ensureHand(seat: number): GameCard[] {
    let hand = this.hands.get(seat);
    if (!hand) {
      hand = [];
      this.hands.set(seat, hand);
    }
    return hand;
  }
}
