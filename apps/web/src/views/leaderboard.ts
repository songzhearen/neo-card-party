/**
 * 排行榜视图 — 移植自 排行榜.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t, onLangChange } from "../core/i18n";
import { renderAvatar } from "../core/avatar";
import { renderTitleBadge } from "../core/cosmetics";

interface LeaderboardRow {
  rank: number;
  name: string;
  title: string;
  titleId?: string;
  titleZh?: string;
  titleEn?: string;
  avatar?: string;
  avatarEmoji?: string;
  avatarColor: string;
  points: number;
  winRate: string;
}

function html(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class LeaderboardView implements View {
  private container: HTMLElement | null = null;
  private unsubLang: (() => void) | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.renderFrame();
    this.loadData(container);
    this.bindEvents();

    this.unsubLang = onLangChange(() => {
      this.renderFrame();
      this.loadData(this.container!);
      this.bindEvents();
    });
  }

  unmount(): void {
    this.unsubLang?.();
    this.container = null;
  }

  private renderFrame(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel bg-grid leaderboard-panel" style="display:flex;flex-direction:column;">
        <div class="leaderboard-header" style="padding:30px 40px 0;display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:15px;">
            <span style="font-size:42px;animation:float 2s infinite;">\uD83C\uDFC6</span>
            <h1 class="text-shadow-yellow" id="lb-title" style="font-size:32px;margin:0;letter-spacing:-2px;">${t("leaderboard.title")}</h1>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="tab-btn active" data-tab="global">${t("leaderboard.global")}</button>
          </div>
        </div>

        <div class="scroll-pixel-red" id="rank-list" style="flex:1;margin:0 40px;border:4px solid var(--color-black);background:var(--color-gray-light);box-shadow:inset 4px 4px 0 rgba(0,0,0,0.05);overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:15px;">
          <div style="text-align:center;padding:40px;color:var(--color-gray-text);">${t("leaderboard.loading")}</div>
        </div>

        <div class="leaderboard-footer" style="padding:15px 40px 25px;border-top:4px dashed var(--color-gray);">
          <button class="neo-btn neo-btn-white" id="btn-back-leaderboard">${t("leaderboard.backToLobby")}</button>
        </div>
      </div>

      <style>
        .tab-btn {
          background: var(--color-gray-mid);
          border: 3px solid var(--color-black);
          padding: 12px 20px;
          font-family: var(--font-pixel);
          font-size: 10px;
          cursor: pointer;
          box-shadow: 4px 4px 0 var(--color-black);
          transition: all 0.1s;
        }
        .tab-btn:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 var(--color-black); }
        .tab-btn:active { transform: translate(2px,2px); box-shadow: 2px 2px 0 var(--color-black); }
        .tab-btn.active { background: var(--color-green); color: var(--color-white); }

        .rank-row {
          display: flex; align-items: center;
          background: var(--color-white); border: 3px solid var(--color-black);
          padding: 12px 20px; box-shadow: 4px 4px 0 var(--color-gray);
          transition: transform 0.1s, box-shadow 0.1s;
          animation: slideIn 0.3s ease-out forwards;
          opacity: 0; transform: translateX(-20px);
        }
        .rank-row.rank-1 { background: #FFD54F; box-shadow: 4px 4px 0 var(--color-black); }
        .rank-row.rank-2 { background: #4FC3F7; box-shadow: 4px 4px 0 var(--color-black); }
        .rank-row.rank-3 { background: #81C784; box-shadow: 4px 4px 0 var(--color-black); }
        .rank-row:hover { transform: translateX(4px) !important; box-shadow: 6px 6px 0 var(--color-black); z-index:2; }
        .rank-avatar {
          width: 44px;
          height: 44px;
          border: 3px solid var(--color-black);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: var(--color-white);
          margin-right: 20px;
          overflow: hidden;
          flex: 0 0 auto;
        }
        @media (max-width: 820px), (max-height: 520px) {
          .leaderboard-header {
            padding: 18px 16px 0 !important;
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px;
          }
          .leaderboard-header > div {
            justify-content: center;
          }
          #lb-title {
            font-size: 24px !important;
            letter-spacing: 0 !important;
          }
          .rank-row {
            flex-wrap: wrap;
          }
          .rank-row > div:nth-child(1) {
            width: 42px !important;
            font-size: 16px !important;
          }
          .rank-row > div:nth-child(2) {
            margin-right: 6px !important;
          }
          .rank-row > div:nth-child(4) {
            width: 100%;
            text-align: left !important;
            padding-left: 56px;
          }
          .leaderboard-footer {
            padding: 14px 16px 18px !important;
          }
          .leaderboard-footer .neo-btn {
            width: 100%;
          }
        }
      </style>
    `;
  }

  private async loadData(container: HTMLElement): Promise<void> {
    const list = container.querySelector("#rank-list")!;
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-gray-text);">${t("leaderboard.loading")}</div>`;

    try {
      const lang = document.documentElement.lang === "zh-CN" ? "zh" : "en";
      const data = await api.getLeaderboard() as unknown as LeaderboardRow[];
      if (data.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-gray-text);">${t("leaderboard.empty")}</div>`;
        return;
      }
      list.innerHTML = data
        .map(
          (row, i) => `
        <div class="rank-row ${i < 3 ? "rank-" + (i + 1) : ""}" style="animation-delay:${i * 0.08}s;">
          <div style="width:60px;font-size:20px;color:${i < 3 ? "var(--color-white)" : "var(--color-gray-text)"};text-align:center;">${i < 3 ? ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"][i] : "#" + (i + 1)}</div>
          ${this.renderRankAvatar(row)}
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <span style="font-family:var(--font-ui);font-weight:bold;font-size:18px;">${html(row.name)}</span>
            ${row.titleId ? renderTitleBadge(row.titleId, lang, true, undefined, lang === "zh" ? row.titleZh || row.title : row.titleEn || row.title) : `<span style="font-size:10px;color:#4A5568;background:rgba(255,255,255,0.5);padding:2px 6px;">${html(row.title)}</span>`}
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px;font-weight:bold;">${row.points.toLocaleString()}</div>
            <div style="font-size:10px;color:var(--color-gray-text);">${t("leaderboard.winRate")} ${row.winRate}</div>
          </div>
        </div>`
        )
        .join("");
    } catch {
      list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-red);">${t("leaderboard.loadFailed")}</div>`;
    }
  }

  private bindEvents(): void {
    const container = this.container!;

    container.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        audio.playClick();
        this.loadData(container);
      });
    });

    container.querySelector("#btn-back-leaderboard")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });
  }

  private renderRankAvatar(row: LeaderboardRow): string {
    return `<div class="rank-avatar" style="background:${row.avatarColor || "var(--color-yellow)"};">${renderAvatar(row.avatar)}</div>`;
  }
}
