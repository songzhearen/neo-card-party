import { View } from "../core/router";
import { router } from "../core/router";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { state } from "../core/state";
import { Toast } from "../components/toast";

interface MailRow {
  id: number;
  title: string;
  body: string;
  reward_coins: number;
  reward_item_id: string | null;
  reward_quantity: number;
  reward_item_icon?: string;
  reward_item_name_zh?: string;
  reward_item_name_en?: string;
  is_read: boolean | number;
  claimed_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  sender_nickname?: string | null;
  sender_account?: string | null;
}

function html(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortDate(value?: string | null): string {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 19);
}

export class MailView implements View {
  private container: HTMLElement | null = null;
  private loading = false;
  private message = "";
  private mails: MailRow[] = [];

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
    this.bindEvents();
    if (state.authToken) void this.load();
  }

  unmount(): void {
    this.container = null;
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.message = "";
    this.render();
    this.bindEvents();

    try {
      this.mails = await api.getMail(60) as MailRow[];
    } catch (err: any) {
      this.message = err?.message || "邮箱加载失败";
    } finally {
      this.loading = false;
      this.render();
      this.bindEvents();
    }
  }

  private render(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel bg-grid mail-panel">
        <div class="mail-header">
          <div>
            <div class="mail-kicker">INBOX</div>
            <h1 class="text-shadow-yellow">邮箱</h1>
          </div>
          <div class="mail-actions">
            <button class="neo-btn neo-btn-yellow" id="mail-refresh">刷新</button>
            <button class="neo-btn neo-btn-white" id="mail-back">返回</button>
          </div>
        </div>
        ${this.renderBody()}
      </div>

      <style>
        .mail-panel {
          width: min(980px, calc(100vw - 32px));
          height: min(780px, calc(100dvh - 32px));
          max-height: calc(100dvh - 32px);
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px;
          overflow: hidden;
        }
        .mail-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 4px solid var(--color-black);
          flex: 0 0 auto;
        }
        .mail-header h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: 0;
        }
        .mail-kicker {
          width: fit-content;
          margin-bottom: 8px;
          padding: 5px 8px;
          border: 3px solid var(--color-black);
          background: var(--color-blue);
          color: var(--color-white);
          box-shadow: 3px 3px 0 var(--color-black);
          font-size: 9px;
        }
        .mail-actions {
          display: flex;
          gap: 10px;
        }
        .mail-message {
          border: 3px solid var(--color-black);
          background: var(--color-yellow);
          box-shadow: 4px 4px 0 var(--color-black);
          padding: 10px 12px;
          font-family: var(--font-ui);
          font-weight: bold;
          font-size: 13px;
        }
        .mail-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: var(--font-ui);
          font-weight: bold;
          line-height: 1.8;
          padding: 28px;
        }
        .mail-list {
          min-height: 0;
          flex: 1 1 auto;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 6px;
        }
        .mail-row {
          border: 3px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 5px 5px 0 var(--color-gray);
          padding: 13px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
        }
        .mail-row.unread {
          background: #FFF6C7;
          box-shadow: 5px 5px 0 var(--color-blue);
        }
        .mail-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-pixel);
          font-size: 13px;
          margin-bottom: 8px;
        }
        .mail-badge {
          flex: 0 0 auto;
          border: 2px solid var(--color-black);
          background: var(--color-red);
          color: var(--color-white);
          padding: 2px 5px;
          font-family: var(--font-ui);
          font-size: 10px;
        }
        .mail-body {
          font-family: var(--font-ui);
          font-weight: bold;
          color: var(--color-gray-text);
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 8px;
        }
        .mail-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 12px;
          font-family: var(--font-ui);
          font-weight: bold;
          font-size: 11px;
          color: var(--color-gray-text);
        }
        .mail-reward {
          color: var(--color-blue);
        }
        .mail-row-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 116px;
        }
        @media (max-width: 700px), (max-height: 560px) {
          .mail-panel {
            height: auto;
            max-height: none;
            overflow: auto;
            padding: 14px;
          }
          .mail-header {
            align-items: stretch;
            flex-direction: column;
          }
          .mail-header h1 {
            font-size: 24px;
          }
          .mail-row {
            grid-template-columns: 1fr;
          }
          .mail-row-actions {
            min-width: 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      </style>
    `;
  }

  private renderBody(): string {
    if (!state.authToken) {
      return `
        <div class="mail-empty">
          <div>
            <div style="font-family:var(--font-pixel);font-size:18px;margin-bottom:14px;">需要登录</div>
            <button class="neo-btn neo-btn-blue" id="mail-login">去登录</button>
          </div>
        </div>
      `;
    }

    if (this.loading && !this.mails.length) {
      return `<div class="mail-empty">正在读取邮箱...</div>`;
    }

    return `
      ${this.message ? `<div class="mail-message">${html(this.message)}</div>` : ""}
      <div class="mail-list scroll-pixel">
        ${this.mails.length ? this.mails.map((mail) => this.renderMailRow(mail)).join("") : `<div class="mail-empty">暂无邮件</div>`}
      </div>
    `;
  }

  private renderMailRow(mail: MailRow): string {
    const unread = !Boolean(mail.is_read);
    const hasReward = this.hasReward(mail);
    const claimed = Boolean(mail.claimed_at);
    const expired = this.isExpired(mail);
    return `
      <div class="mail-row ${unread ? "unread" : ""}">
        <div style="min-width:0;">
          <div class="mail-title">
            ${unread ? `<span class="mail-badge">NEW</span>` : ""}
            <span style="overflow:hidden;text-overflow:ellipsis;">${html(mail.title)}</span>
          </div>
          <div class="mail-body">${html(mail.body || "无正文")}</div>
          <div class="mail-meta">
            <span>来自 ${html(mail.sender_nickname || mail.sender_account || "SYSTEM")}</span>
            <span>${shortDate(mail.created_at)}</span>
            ${hasReward ? `<span class="mail-reward">${this.rewardLabel(mail)}</span>` : `<span>无附件</span>`}
            ${expired ? `<span style="color:var(--color-red);">已过期</span>` : ""}
          </div>
        </div>
        <div class="mail-row-actions">
          ${unread ? `<button class="neo-btn neo-btn-white mail-read" data-mail-id="${mail.id}" type="button">已读</button>` : `<button class="neo-btn neo-btn-white" disabled type="button">已读</button>`}
          ${hasReward
            ? `<button class="neo-btn ${claimed || expired ? "neo-btn-white" : "neo-btn-green"} mail-claim" data-mail-id="${mail.id}" type="button" ${claimed || expired ? "disabled" : ""}>${claimed ? "已领取" : expired ? "已过期" : "领取"}</button>`
            : `<button class="neo-btn neo-btn-white" disabled type="button">无附件</button>`}
        </div>
      </div>
    `;
  }

  private hasReward(mail: MailRow): boolean {
    return Number(mail.reward_coins || 0) > 0 || Boolean(mail.reward_item_id);
  }

  private rewardLabel(mail: MailRow): string {
    const parts: string[] = [];
    const coins = Number(mail.reward_coins || 0);
    if (coins > 0) parts.push(`${coins.toLocaleString()} 金币`);
    if (mail.reward_item_id) {
      const name = mail.reward_item_name_zh || mail.reward_item_id;
      parts.push(`${mail.reward_item_icon || ""}${name} x${Number(mail.reward_quantity || 1)}`);
    }
    return parts.join(" / ");
  }

  private isExpired(mail: MailRow): boolean {
    if (!mail.expires_at) return false;
    const time = new Date(mail.expires_at).getTime();
    return Number.isFinite(time) && time < Date.now();
  }

  private bindEvents(): void {
    const container = this.container;
    if (!container) return;

    container.querySelector("#mail-back")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });

    container.querySelector("#mail-login")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#login");
    });

    container.querySelector("#mail-refresh")?.addEventListener("click", () => {
      audio.playClick();
      void this.load();
    });

    container.querySelectorAll<HTMLButtonElement>(".mail-read").forEach((button) => {
      button.addEventListener("click", async () => {
        const mailId = Number(button.dataset.mailId || 0);
        if (!mailId) return;
        audio.playClick();
        button.disabled = true;
        try {
          const result = await api.readMail(mailId);
          this.mails = this.mails.map((mail) => mail.id === mailId ? result.mail : mail);
          this.render();
          this.bindEvents();
        } catch (err: any) {
          Toast.show(err?.message || "操作失败");
          button.disabled = false;
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".mail-claim").forEach((button) => {
      button.addEventListener("click", async () => {
        const mailId = Number(button.dataset.mailId || 0);
        if (!mailId) return;
        audio.playClick();
        button.disabled = true;
        try {
          await api.claimMail(mailId);
          Toast.show("领取成功");
          await this.load();
        } catch (err: any) {
          Toast.show(err?.message || "领取失败");
          button.disabled = false;
        }
      });
    });
  }
}
