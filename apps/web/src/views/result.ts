import { View } from "../core/router";
import { router } from "../core/router";
import { state } from "../core/state";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { renderAvatar } from "../core/avatar";
import { renderAccessory } from "../core/cosmetics";
import { getGameMode, roomRouteHash, setGameMode } from "./waiting-room";

interface ResultPlayer {
  id?: number;
  name: string;
  cards: number;
  played?: number;
  handValue?: number;
  rank?: number;
  rankBonus?: number;
  playBonus?: number;
  residueBonus?: number;
  cardPenalty?: number;
  points: number;
  color: string;
  isWinner?: boolean;
  avatar?: string;
  accessoryId?: string;
  accessoryColor?: string;
}

interface GameResult {
  winner: string;
  winnerScore: number;
  isPlayerWin: boolean;
  players: ResultPlayer[];
  source?: "server" | "local";
  gameId?: number | null;
}

export class ResultView implements View {
  private result: GameResult | null = null;
  private container: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    const saved = sessionStorage.getItem("card_party_result");
    if (saved) {
      try { this.result = JSON.parse(saved); } catch { /* ignore bad session payload */ }
    }

    if (!this.result) {
      this.renderEmpty();
      this.bindEvents();
      return;
    }

    this.render();
    this.bindEvents();
  }

  unmount(): void {
    this.container = null;
  }

  private renderEmpty(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel bg-grid" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;padding:60px;">
        <div style="font-size:64px;">\uD83C\uDFC6</div>
        <h2 style="font-size:24px;">${t("result.noResult")}</h2>
        <button class="neo-btn neo-btn-green" id="btn-back-result" style="font-size:14px;padding:16px 40px;">${t("result.backHome")}</button>
      </div>
    `;
  }

  private render(): void {
    const container = this.container!;
    const r = this.result!;
    const players = [...r.players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.points - a.points);
    const winner = players.find((p) => p.isWinner) || players[0];

    container.innerHTML = `
      <div class="neo-panel bg-grid result-board">
        <div class="winner-panel">
          <div class="confetti-strip">
            ${Array.from({ length: 24 }, (_, i) => `<span style="left:${(i * 37) % 100}%;animation-delay:${(i % 8) * 0.12}s;background:${["var(--color-red)", "var(--color-blue)", "var(--color-green)", "var(--color-yellow)", "var(--color-black)"][i % 5]};"></span>`).join("")}
          </div>
          <div class="victory-title">${r.isPlayerWin ? t("result.victory") : t("result.defeat")}</div>
          <div class="crown-icon">\uD83D\uDC51</div>
          <div class="mvp-avatar" style="background:${winner.color};">${this.renderResultAvatar(winner, 126)}
            <span class="mvp-label">${t("result.mvp")}</span>
          </div>
          <div class="mvp-name">${winner.name}</div>
          <div class="mvp-score">+${r.winnerScore} ${t("result.pts")}</div>
          <div class="settle-rule">${t("result.formula")}</div>
        </div>

        <div class="scoreboard-panel">
          <div class="score-content">
            <div class="section-title">${t("result.scoreboard")}</div>
            <div class="score-list">
              ${players.map((p, i) => `
                <div class="score-row ${p.isWinner ? "score-rank-1" : ""}" style="animation-delay:${i * 0.1}s;">
                  <div class="rank-num">${t("result.rankLabel", { 0: p.rank ?? i + 1 })}</div>
                  <div class="row-avatar" style="background:${p.color};">${this.renderResultAvatar(p, 42)}</div>
                  <div class="row-info">
                    <span class="row-name">${p.name}</span>
                    <span class="row-cards">${t("result.remainingCards", { 0: p.cards })} · ${t("result.playedCards", { 0: p.played ?? 0 })} · ${t("result.handValue", { 0: p.handValue ?? 0 })}</span>
                    <span class="score-breakdown">
                      <b>${t("result.rankBonus", { 0: p.rankBonus ?? 0 })}</b>
                      <b>${t("result.playBonus", { 0: p.playBonus ?? 0 })}</b>
                      ${(p.residueBonus ?? 0) > 0 ? `<b>${t("result.residueBonus", { 0: p.residueBonus ?? 0 })}</b>` : ""}
                      ${(p.cardPenalty ?? 0) > 0 ? `<b class="score-minus">${t("result.cardPenalty", { 0: p.cardPenalty ?? 0 })}</b>` : ""}
                    </span>
                  </div>
                  <div class="row-points ${p.points >= 0 ? "points-up" : "points-down"}">${p.points >= 0 ? "+" : ""}${p.points}</div>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="result-actions">
            <button class="neo-btn neo-btn-green" id="btn-play-again">${t("result.playAgain")}</button>
            <button class="neo-btn neo-btn-blue" id="btn-back-result">${t("result.backHome")}</button>
          </div>
        </div>
      </div>

      <style>
        .result-board {
          width: min(1060px, 100%);
          height: min(700px, calc(100vh - 36px));
          min-height: 0;
          display: flex;
        }
        .winner-panel {
          flex: 0 0 42%;
          border-right: 4px dashed var(--color-gray);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255, 213, 79, 0.12);
          position: relative;
          overflow: hidden;
        }
        .victory-title {
          font-size: 48px;
          color: var(--color-yellow);
          text-shadow: 6px 6px 0 var(--color-black), -2px -2px 0 var(--color-white);
          margin-bottom: 16px;
          animation: floatBounce 2s infinite;
          z-index: 2;
        }
        .crown-icon {
          font-size: 56px;
          margin-bottom: -15px;
          z-index: 3;
          animation: float 1.5s infinite;
        }
        .mvp-avatar {
          width: 126px;
          height: 126px;
          border: 6px solid var(--color-black);
          box-shadow: 8px 8px 0 var(--color-black);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 54px;
          color: var(--color-white);
          text-shadow: 3px 3px 0 var(--color-black);
          margin-bottom: 24px;
          position: relative;
        }
        .result-avatar-base {
          border: 0;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .result-avatar-fallback {
          font-family: var(--font-pixel);
          color: var(--color-white);
          text-shadow: 2px 2px 0 var(--color-black);
        }
        .mvp-avatar .mvp-label {
          position: absolute;
          bottom: -16px;
          background: var(--color-red);
          color: var(--color-white);
          font-size: 14px;
          padding: 6px 12px;
          border: 3px solid var(--color-black);
          transform: rotate(-5deg);
        }
        .mvp-name {
          font-size: 24px;
          font-weight: bold;
          font-family: var(--font-ui);
          margin-bottom: 10px;
        }
        .mvp-score {
          font-size: 20px;
          color: var(--color-green);
          text-shadow: 2px 2px 0 var(--color-black);
        }
        .settle-rule {
          margin-top: 16px;
          padding: 8px 12px;
          background: var(--color-black);
          color: var(--color-yellow);
          border: 3px solid var(--color-yellow);
          font-size: 9px;
          box-shadow: 4px 4px 0 var(--color-gray);
        }
        .scoreboard-panel {
          flex: 1;
          min-height: 0;
          padding: 26px 34px 22px;
          display: flex;
          flex-direction: column;
          justify-content: stretch;
        }
        .score-content {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .section-title {
          font-size: 24px;
          margin-bottom: 14px;
          text-shadow: 3px 3px 0 #E2E8F0;
        }
        .score-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 8px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .score-row {
          display: flex;
          align-items: center;
          padding: 11px 16px;
          background: var(--color-white);
          border: 3px solid var(--color-black);
          box-shadow: 4px 4px 0 var(--color-gray);
          transition: transform 0.1s;
          animation: slideIn 0.3s ease-out forwards;
          opacity: 0;
        }
        .score-row:hover {
          transform: translateX(5px);
          box-shadow: 6px 6px 0 var(--color-black);
        }
        .score-rank-1 {
          background: var(--color-yellow);
          box-shadow: 4px 4px 0 var(--color-black);
        }
        .rank-num {
          font-size: 16px;
          width: 46px;
          color: var(--color-gray-text);
        }
        .score-rank-1 .rank-num { color: var(--color-black); }
        .row-avatar {
          width: 42px;
          height: 42px;
          border: 3px solid var(--color-black);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: var(--color-white);
          margin-right: 14px;
          overflow: visible;
        }
        .row-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }
        .row-name {
          font-family: var(--font-ui);
          font-weight: bold;
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row-cards {
          font-size: 9px;
          color: #4A5568;
        }
        .score-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          font-size: 8px;
        }
        .score-breakdown b {
          background: #EDF2F7;
          border: 2px solid var(--color-black);
          padding: 2px 5px;
          box-shadow: 2px 2px 0 var(--color-gray);
        }
        .score-breakdown .score-minus {
          background: #FFE3EA;
          color: var(--color-red);
        }
        .row-points {
          min-width: 74px;
          font-size: 16px;
          text-align: right;
        }
        .points-up { color: var(--color-green); text-shadow: 2px 2px 0 var(--color-black); }
        .points-down { color: var(--color-red); }
        .result-actions {
          flex-shrink: 0;
          display: flex;
          gap: 20px;
          margin-top: 16px;
        }
        .result-actions .neo-btn {
          flex: 1;
          min-height: 48px;
          font-size: 13px;
          padding: 10px 16px;
        }
        .confetti-strip span {
          position: absolute;
          top: -20px;
          width: 10px;
          height: 10px;
          border: 2px solid var(--color-black);
          animation: resultFall 2.2s linear infinite;
        }
        @keyframes resultFall {
          to { transform: translateY(760px) rotate(540deg); }
        }
      </style>
    `;
  }

  private initialFor(name: string): string {
    return (name || "?").trim().slice(0, 1).toUpperCase();
  }

  private renderResultAvatar(player: ResultPlayer, size: number): string {
    if (!player.avatar) {
      return `<div class="result-avatar-base result-avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.max(14, Math.floor(size * 0.42))}px;">${this.initialFor(player.name)}</div>`;
    }

    const accessory = player.accessoryId
      ? renderAccessory({ id: player.accessoryId, color: (player.accessoryColor || "yellow") as any }, size)
      : "";

    return `
      <div class="avatar-stack" style="width:${size}px;height:${size}px;">
        ${accessory}
        <div class="result-avatar-base avatar-base" style="width:${size}px;height:${size}px;background:var(--color-yellow);">
          ${renderAvatar(player.avatar)}
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const container = this.container!;
    container.querySelector("#btn-play-again")?.addEventListener("click", () => {
      audio.playClick();
      void this.playAgain();
    });
    container.querySelector("#btn-back-result")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });
  }

  private async playAgain(): Promise<void> {
    const context = getGameMode();
    const playerCount = Math.max(2, Math.min(12, this.result?.players?.length || context.playerCount || 4));
    sessionStorage.removeItem("card_party_result");

    if (this.result?.source === "server" || context.mode === "multi") {
      await api.leaveGameRoom().catch(() => {
        // Ignore stale room cleanup errors; the next room is what matters.
      });
      const room = await api.joinGameRoom(state.playerName || "PLAYER_1", {
        create: true,
        playerCount,
        roomName: `${state.playerName || "PLAYER"} room`,
        mode: "casual",
      });
      const roomId = room?.id || room?.roomId || null;
      if (roomId) {
        setGameMode("multi", playerCount, roomId);
        router.navigate(roomRouteHash(roomId));
        return;
      }
      setGameMode("multi", playerCount, null);
      router.navigate("#lobby");
      return;
    }

    setGameMode("ai", playerCount, null);
    router.navigate("#waiting");
  }
}
