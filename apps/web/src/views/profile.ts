/**
 * 个人主页视图 — 移植自 个人主页.html + 头戴网管.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { state } from "../core/state";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { renderAvatar } from "../core/avatar";
import { Toast } from "../components/toast";
import {
  AccessoryColorId,
  accessoryItemId,
  formatCoins,
  getAccessory,
  getAccessoryColor,
  getTitle,
  getUnlockedTitles,
  renderAccessory,
  renderTitleBadge,
  titleItemId,
} from "../core/cosmetics";

interface GameHistoryRow {
  id: number;
  room_id?: string;
  player_count?: number;
  winner_name?: string;
  winner_score?: number;
  ended_at?: string;
  isWin?: boolean;
  selfPoints?: number;
  selfCards?: number;
  players?: any[];
}

type ProfileTab = "overview" | "cosmetics" | "history";

export class ProfileView implements View {
  private nameInput!: HTMLInputElement;
  private container: HTMLElement | null = null;
  private gameHistory: GameHistoryRow[] = [];
  private activeTab: ProfileTab = "overview";

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
    this.bindEvents();
    void this.refreshAccount();
  }

  unmount(): void {
    this.container = null;
  }

  private render(): void {
    const container = this.container!;
    const s = state;

    if (!s.authToken) {
      this.renderGuestProfile(container);
      return;
    }

    const lang = s.settings.language === "zh" ? "zh" : "en";
    const title = getTitle(s.equippedTitleId, state.customTitles);
    container.innerHTML = `
      <div class="neo-panel bg-grid profile-panel" data-profile-tab="${this.activeTab}" style="display:flex;flex-direction:column;padding:30px 40px;">
        <!-- 顶部 -->
        <div class="profile-header" style="display:flex;justify-content:space-between;align-items:center;padding-bottom:18px;border-bottom:4px solid var(--color-black);margin-bottom:24px;">
          <h2 style="font-size:32px;font-weight:bold;text-shadow:4px 4px 0 #E2E8F0;letter-spacing:2px;margin:0;">${t("profile.title")}</h2>
          <button class="neo-btn neo-btn-white" id="btn-back-profile">${t("profile.back")}</button>
        </div>

        <!-- 核心内容 -->
        <div class="profile-tabs" role="tablist" aria-label="Profile sections">
          <button class="profile-tab ${this.activeTab === "overview" ? "active" : ""}" type="button" data-profile-tab="overview">概览</button>
          <button class="profile-tab ${this.activeTab === "cosmetics" ? "active" : ""}" type="button" data-profile-tab="cosmetics">装扮</button>
          <button class="profile-tab ${this.activeTab === "history" ? "active" : ""}" type="button" data-profile-tab="history">战绩</button>
        </div>

        <div class="profile-main" style="display:flex;flex:1;gap:36px;min-height:0;">
          <!-- 左侧：编辑区 -->
          <div class="profile-edit-pane" style="flex:1;display:flex;flex-direction:column;gap:18px;background:var(--color-gray-light);border:4px dashed var(--color-gray);padding:36px 30px 20px;position:relative;min-height:0;overflow:hidden;">
            <!-- 头像 -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:14px;flex-shrink:0;">
              <div class="avatar-stack" id="profile-avatar-stack" style="margin-top:22px;">
                ${renderAccessory(s.equippedAccessory, 120)}
                <div class="profile-avatar avatar-base" id="profile-avatar-preview" style="position:relative;width:120px;height:120px;background:var(--color-yellow);border:4px solid var(--color-black);box-shadow:6px 6px 0 var(--color-black);display:flex;align-items:center;justify-content:center;cursor:pointer;">
                  ${renderAvatar(s.avatar)}
                </div>
              </div>
              <button class="neo-btn neo-btn-blue" id="btn-edit-avatar" style="font-size:10px;padding:8px 16px;">${t("profile.editAvatar")}</button>
            </div>

            <!-- 昵称 -->
            <div style="display:flex;flex-direction:column;gap:10px;width:100%;flex-shrink:0;">
              <label style="font-size:14px;color:#4A5568;font-weight:bold;">${t("profile.nickname")}</label>
              <input type="text" class="neo-input" id="profile-name" value="${s.playerName}" style="font-family:var(--font-pixel);font-size:18px;font-weight:bold;box-shadow:6px 6px 0 var(--color-black);">
            </div>

            ${this.renderAccessoryPanel()}
          </div>

          <!-- 右侧：统计 -->
          <div class="profile-stats-pane" style="flex:1.2;display:flex;flex-direction:column;gap:14px;min-height:0;overflow:hidden;">
            <div class="stats-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;flex-shrink:0;">
              <div class="stat-card">
                <span class="stat-title">${t("profile.totalGames")}</span>
                <span class="stat-value">${s.totalGames}</span>
              </div>
              <div class="stat-card">
                <span class="stat-title">${t("profile.wins")}</span>
                <span class="stat-value" style="color:var(--color-green);">${s.wins}</span>
              </div>
              <div class="stat-card">
                <span class="stat-title">${t("profile.level")}</span>
                <span class="stat-value">Lv.${s.level}</span>
              </div>
              <div class="stat-card">
                <span class="stat-title">${t("profile.coins")}</span>
                <span class="stat-value" style="color:var(--color-yellow);">${formatCoins(s)}</span>
              </div>
              <div class="stat-card">
                <span class="stat-title">${t("profile.points")}</span>
                <span class="stat-value" style="color:var(--color-blue);">${s.points?.toLocaleString() ?? 0}</span>
              </div>
              <div class="stat-card">
                <span class="stat-title">${t("profile.titleLabel")}</span>
                <span class="stat-value" style="font-size:16px;">${renderTitleBadge(title.id, lang, false, state.customTitles)}</span>
              </div>
            </div>

            ${this.renderTitlePanel()}
            ${this.renderHistoryPanel()}

            <div class="profile-actions">
              <button class="neo-btn neo-btn-green profile-action-btn" id="btn-save-profile" type="button">${t("profile.save")}</button>
              <button class="neo-btn neo-btn-red profile-action-btn" id="btn-logout" type="button">${t("profile.logout")}</button>
            </div>
          </div>
        </div>
      </div>

      <style>
        .profile-panel {
          width: min(1180px, calc(100vw - 32px));
          height: min(840px, calc(100dvh - 32px));
          max-height: calc(100dvh - 32px);
          overflow: auto;
        }
        .profile-main {
          display: grid !important;
          grid-template-columns: minmax(340px, 0.9fr) minmax(520px, 1.3fr);
          gap: 28px !important;
        }
        .profile-tabs {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: -8px 0 18px;
        }
        .profile-tab {
          border: 3px solid var(--color-black);
          background: var(--color-gray-mid);
          box-shadow: 4px 4px 0 var(--color-black);
          padding: 10px 18px;
          font-family: var(--font-pixel);
          font-size: 11px;
          cursor: pointer;
        }
        .profile-tab:hover {
          transform: translate(-1px, -1px);
          box-shadow: 5px 5px 0 var(--color-black);
        }
        .profile-tab.active {
          background: var(--color-yellow);
        }
        .profile-edit-pane,
        .profile-stats-pane {
          min-height: 0;
          overflow: auto !important;
        }
        .profile-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: auto;
          flex-shrink: 0;
          padding-top: 10px;
          border-top: 3px solid var(--color-black);
          background: var(--color-white);
          position: sticky;
          bottom: 0;
          z-index: 2;
        }
        .profile-action-btn {
          min-height: 48px;
          padding: 12px 16px;
          font-family: var(--font-ui);
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0;
        }
        .profile-panel[data-profile-tab="overview"] .profile-edit-pane > .cosmetic-panel,
        .profile-panel[data-profile-tab="overview"] .title-panel,
        .profile-panel[data-profile-tab="overview"] .history-panel,
        .profile-panel[data-profile-tab="cosmetics"] .stats-grid,
        .profile-panel[data-profile-tab="cosmetics"] .history-panel,
        .profile-panel[data-profile-tab="cosmetics"] .profile-actions,
        .profile-panel[data-profile-tab="history"] .profile-edit-pane,
        .profile-panel[data-profile-tab="history"] .stats-grid,
        .profile-panel[data-profile-tab="history"] .title-panel,
        .profile-panel[data-profile-tab="history"] .profile-actions {
          display: none !important;
        }
        .profile-panel[data-profile-tab="history"] .profile-main {
          grid-template-columns: 1fr;
        }
        .profile-panel[data-profile-tab="history"] .profile-stats-pane {
          overflow: hidden !important;
        }
        .profile-panel[data-profile-tab="history"] .history-panel {
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
        }
        .profile-panel[data-profile-tab="history"] .history-list {
          flex: 1 1 auto;
          max-height: none;
        }
        .stat-card {
          background: var(--color-white); border: 4px solid var(--color-black);
          box-shadow: 6px 6px 0 var(--color-gray); padding: 16px 18px;
          display: flex; flex-direction: column; gap: 8px; transition: all 0.2s;
          min-height: 92px;
        }
        .stat-card:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 var(--color-black); }
        .stat-title { font-size: 12px; color: var(--color-gray-text); font-weight: bold; }
        .stat-value { font-size: 30px; font-weight: bold; font-family: var(--font-pixel); line-height: 1.15; }
        .cosmetic-panel {
          border: 3px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 5px 5px 0 var(--color-gray);
          padding: 12px;
          min-height: 0;
          overflow: hidden;
        }
        .cosmetic-title {
          display:flex;justify-content:space-between;align-items:center;
          font-size:11px;font-weight:bold;margin-bottom:10px;color:var(--color-black);
        }
        .cosmetic-grid {
          display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;
          max-height:180px;overflow-y:auto;padding-right:4px;
        }
        .cosmetic-chip {
          border:2px solid var(--color-black);background:var(--color-gray-light);
          min-height:48px;padding:6px;display:flex;align-items:center;gap:7px;
          font-family:var(--font-ui);font-weight:bold;font-size:11px;cursor:pointer;
          box-shadow:3px 3px 0 var(--color-gray);
        }
        .cosmetic-chip:hover { transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--color-black); }
        .cosmetic-chip.is-equipped { background:var(--color-yellow);box-shadow:3px 3px 0 var(--color-blue); }
        .cosmetic-swatch {
          width:30px;height:30px;border:2px solid var(--color-black);
          display:flex;align-items:center;justify-content:center;flex:0 0 auto;
        }
        .title-panel {
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
        }
        .title-panel .cosmetic-grid {
          flex: 1 1 auto;
          min-height: 0;
          max-height: none !important;
          grid-auto-rows: minmax(48px, max-content);
        }
        .history-panel {
          flex: 0 0 auto;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
          max-height: 166px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .history-row {
          display: grid;
          grid-template-columns: 56px 1fr auto;
          gap: 8px;
          align-items: center;
          border: 2px solid var(--color-black);
          background: var(--color-gray-light);
          box-shadow: 3px 3px 0 var(--color-gray);
          padding: 7px 8px;
          font-family: var(--font-ui);
          font-size: 11px;
          font-weight: bold;
        }
        .history-row.history-win { background: #E8F8EF; }
        .history-row.history-lose { background: #FFF1F1; }
        .history-result { color: var(--color-black); }
        .history-meta { color: var(--color-gray-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .history-points { font-family: var(--font-pixel); color: var(--color-blue); }
        @media (max-width: 820px), (max-height: 520px) {
          .profile-panel {
            height: auto !important;
            max-height: none;
            padding: 14px !important;
            overflow: auto;
          }
          .profile-header {
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px;
            margin-bottom: 14px !important;
          }
          .profile-header h2 {
            font-size: 22px !important;
            text-align: center;
            letter-spacing: 0 !important;
          }
          .profile-main {
            display: flex !important;
            flex-direction: column;
            gap: 14px !important;
            overflow: visible;
          }
          .profile-edit-pane,
          .profile-stats-pane {
            flex: none !important;
            overflow: visible !important;
            padding: 18px 14px !important;
          }
          .stats-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }
          .stat-card {
            min-height: 74px;
            padding: 12px;
            box-shadow: 4px 4px 0 var(--color-gray);
          }
          .stat-title { font-size: 10px; }
          .stat-value { font-size: 20px; }
          .cosmetic-grid {
            max-height: none;
            overflow: visible;
          }
          .history-list {
            max-height: none;
            overflow: visible;
          }
          .profile-actions {
            grid-template-columns: 1fr;
            position: static;
          }
        }
      </style>
    `;

    this.nameInput = container.querySelector("#profile-name") as HTMLInputElement;
  }

  private renderGuestProfile(container: HTMLElement): void {
    container.innerHTML = `
      <div class="neo-panel bg-grid profile-panel profile-guest-panel">
        <div class="profile-header">
          <h2>${t("profile.title")}</h2>
          <button class="neo-btn neo-btn-white profile-top-btn" id="btn-back-profile" type="button">${t("profile.back")}</button>
        </div>
        <div class="profile-guest-card">
          <div class="profile-guest-avatar">${renderAvatar(state.avatar)}</div>
          <div class="profile-guest-copy">
            <h3>${t("profile.loginPromptTitle")}</h3>
            <p>${t("profile.loginPromptDesc")}</p>
          </div>
          <div class="profile-guest-actions">
            <button class="neo-btn neo-btn-green profile-action-btn" id="btn-profile-login" type="button">${t("profile.loginAction")}</button>
            <button class="neo-btn neo-btn-white profile-action-btn" id="btn-back-profile-secondary" type="button">${t("profile.back")}</button>
          </div>
        </div>
      </div>

      <style>
        .profile-guest-panel {
          width: min(720px, calc(100vw - 32px));
          min-height: 420px;
          padding: 28px 34px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding-bottom: 18px;
          border-bottom: 4px solid var(--color-black);
        }
        .profile-header h2 {
          font-size: 32px;
          font-weight: bold;
          text-shadow: 4px 4px 0 #E2E8F0;
          letter-spacing: 2px;
          margin: 0;
        }
        .profile-guest-card {
          flex: 1;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 22px;
          align-items: center;
          border: 4px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 8px 8px 0 var(--color-gray);
          padding: 24px;
        }
        .profile-guest-avatar {
          width: 118px;
          height: 118px;
          border: 4px solid var(--color-black);
          background: var(--color-yellow);
          box-shadow: 6px 6px 0 var(--color-black);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .profile-guest-copy h3 {
          margin: 0 0 10px;
          font-family: var(--font-ui);
          font-size: 22px;
          font-weight: 900;
        }
        .profile-guest-copy p {
          margin: 0;
          color: var(--color-gray-text);
          font-family: var(--font-ui);
          font-size: 15px;
          font-weight: 700;
          line-height: 1.6;
        }
        .profile-guest-actions {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          border-top: 3px solid var(--color-black);
          padding-top: 14px;
        }
        .profile-action-btn,
        .profile-top-btn {
          font-family: var(--font-ui);
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0;
        }
        @media (max-width: 640px) {
          .profile-guest-panel {
            width: min(100vw - 20px, 720px);
            padding: 16px;
          }
          .profile-header {
            flex-direction: column;
            align-items: stretch;
          }
          .profile-header h2 {
            text-align: center;
            font-size: 24px;
            letter-spacing: 0;
          }
          .profile-guest-card {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
            padding: 18px;
          }
          .profile-guest-actions {
            width: 100%;
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;
  }

  private renderAccessoryPanel(): string {
    const lang = state.settings.language === "zh" ? "zh" : "en";
    const entries = Object.entries(state.accessoryInventory)
      .flatMap(([id, colors]) => colors.map((color) => ({ id, color: color as AccessoryColorId })));

    return `
      <div class="cosmetic-panel">
        <div class="cosmetic-title">
          <span>${t("profile.accessories")}</span>
          <span style="color:var(--color-gray-text);font-size:9px;">${entries.length}</span>
        </div>
        <div class="cosmetic-grid scroll-pixel">
          ${entries.map(({ id, color }) => {
            const accessory = getAccessory(id);
            const dye = getAccessoryColor(color);
            const equipped = state.equippedAccessory?.id === id && state.equippedAccessory?.color === color;
            const swatchBg = dye.id === "rainbow"
              ? "linear-gradient(90deg,var(--color-red),var(--color-yellow),var(--color-green),var(--color-blue),var(--color-pink))"
              : dye.hex;
            return `
              <button class="cosmetic-chip equip-accessory ${equipped ? "is-equipped" : ""}" data-accessory-id="${id}" data-accessory-color="${color}">
                <span class="cosmetic-swatch ${dye.id === "rainbow" ? "rainbow-swatch" : ""}" style="background:${swatchBg};color:${dye.id === "white" || dye.id === "yellow" ? "var(--color-black)" : "var(--color-white)"};">${accessory.icon}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${lang === "zh" ? accessory.nameZh : accessory.nameEn}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  private renderTitlePanel(): string {
    const lang = state.settings.language === "zh" ? "zh" : "en";
    const unlocked = getUnlockedTitles(state);

    return `
      <div class="cosmetic-panel title-panel">
        <div class="cosmetic-title">
          <span>${t("profile.titles")}</span>
          <span style="color:var(--color-gray-text);font-size:9px;">${t("profile.titleRule")}</span>
        </div>
        <div class="cosmetic-grid scroll-pixel" style="grid-template-columns:1fr;">
          ${unlocked.map((title) => {
            const equipped = state.equippedTitleId === title.id;
            return `
              <button class="cosmetic-chip equip-title ${equipped ? "is-equipped" : ""}" data-title-id="${title.id}">
                ${renderTitleBadge(title.id, lang, true, state.customTitles)}
                <span style="font-size:11px;color:var(--color-gray-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${lang === "zh" ? title.descZh : title.descEn}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  private renderHistoryPanel(): string {
    const rows = this.gameHistory.slice(0, 5);
    return `
      <div class="cosmetic-panel history-panel">
        <div class="cosmetic-title">
          <span>${t("profile.recentMatches")}</span>
          <span style="color:var(--color-gray-text);font-size:9px;">${rows.length}</span>
        </div>
        <div class="history-list scroll-pixel">
          ${rows.length ? rows.map((row) => {
            const win = Boolean(row.isWin);
            const points = Number(row.selfPoints ?? 0);
            const mode = row.room_id ? t("profile.historyOnline") : t("profile.historyAi");
            const date = this.formatHistoryDate(row.ended_at);
            const playerCount = Number(row.player_count || row.players?.length || 0);
            return `
              <div class="history-row ${win ? "history-win" : "history-lose"}">
                <span class="history-result">${win ? t("profile.historyWin") : t("profile.historyLose")}</span>
                <span class="history-meta">${mode}${playerCount ? ` · ${playerCount}P` : ""}${date ? ` · ${date}` : ""}</span>
                <span class="history-points">${points >= 0 ? "+" : ""}${points}</span>
              </div>
            `;
          }).join("") : `<div style="text-align:center;padding:18px;color:var(--color-gray-text);font-size:11px;">${t("profile.historyEmpty")}</div>`}
        </div>
      </div>
    `;
  }

  private formatHistoryDate(value: unknown): string {
    if (!value) return "";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(state.settings.language === "zh" ? "zh-CN" : "en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private bindEvents(): void {
    const container = this.container!;

    container.querySelector("#btn-save-profile")?.addEventListener("click", async () => {
      const name = this.nameInput.value.trim() || state.playerName;
      state.update({ playerName: name });
      audio.playClick();
      try {
        await api.updateProfile({ nickname: name, username: name });
      } catch { /* offline */ }
      router.navigate("#home");
    });

    container.querySelectorAll("#btn-back-profile, #btn-back-profile-secondary").forEach((button) => {
      button.addEventListener("click", () => {
        audio.playClick();
        router.navigate("#home");
      });
    });

    container.querySelector("#btn-profile-login")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#login");
    });

    container.querySelector("#btn-edit-avatar")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#avatars");
    });

    container.querySelectorAll<HTMLButtonElement>(".profile-tab").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.profileTab as ProfileTab | undefined;
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        audio.playClick();
        this.render();
        this.bindEvents();
      });
    });

    container.querySelector("#btn-logout")?.addEventListener("click", () => {
      audio.playClick();
      state.reset();
      router.navigate("#login");
    });

    container.querySelectorAll<HTMLButtonElement>(".equip-accessory").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.accessoryId || "crown";
        const color = (button.dataset.accessoryColor || "yellow") as AccessoryColorId;
        audio.playClick();
        button.disabled = true;
        const result = await api.equipItem(accessoryItemId(id, color));
        if (result.success) {
          Toast.show(t("shop.equipped"));
          this.render();
          this.bindEvents();
        } else {
          Toast.show(t("shop.invalidCode"));
          button.disabled = false;
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".equip-title").forEach((button) => {
      button.addEventListener("click", async () => {
        const title = getTitle(button.dataset.titleId || "newbie", state.customTitles);
        audio.playClick();
        button.disabled = true;
        const result = await api.equipItem(titleItemId(title.id));
        if (result.success) {
          Toast.show(t("shop.equipped"));
          this.render();
          this.bindEvents();
        } else {
          Toast.show(t("shop.invalidCode"));
          button.disabled = false;
        }
      });
    });

    // 头像悬停交互
    const avatar = container.querySelector("#profile-avatar-preview") as HTMLElement;
    const avatarStack = container.querySelector("#profile-avatar-stack") as HTMLElement;
    if (avatar) {
      avatar.addEventListener("click", () => {
        audio.playClick();
        router.navigate("#avatars");
      });
      avatar.addEventListener("mouseenter", () => {
        if (avatarStack) avatarStack.style.transform = "translate(-4px, -4px)";
        avatar.style.boxShadow = "14px 14px 0 var(--color-black)";
      });
      avatar.addEventListener("mouseleave", () => {
        if (avatarStack) avatarStack.style.transform = "";
        avatar.style.boxShadow = "6px 6px 0 var(--color-black)";
      });
    }
  }

  private async refreshAccount(): Promise<void> {
    if (!state.authToken) return;
    try {
      await api.refreshAccount();
      this.gameHistory = await api.getGameHistory(5).catch(() => this.gameHistory);
      if (!this.container) return;
      this.render();
      this.bindEvents();
    } catch {
      // Cached profile remains usable if the API is temporarily unavailable.
    }
  }
}
