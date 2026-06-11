import { View } from "../core/router";
import { router } from "../core/router";
import { api, type FriendEntry } from "../core/api";
import { state } from "../core/state";
import { audio } from "../core/audio";
import { renderAvatar } from "../core/avatar";
import { Toast } from "../components/toast";
import { roomRouteHash, setGameMode } from "./waiting-room";

function html(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusText(friend: FriendEntry): string {
  if (!friend.online) return "\u79bb\u7ebf";
  if (friend.onlineStatus === "room") return friend.roomName ? `\u623f\u95f4 ${friend.roomName}` : "\u5bf9\u5c40\u4e2d";
  if (friend.onlineStatus === "reconnecting") return "\u91cd\u8fde\u4e2d";
  return "\u5927\u5385\u5728\u7ebf";
}

function statusClass(friend: FriendEntry): string {
  if (!friend.online) return "offline";
  if (friend.onlineStatus === "room") return "room";
  if (friend.onlineStatus === "reconnecting") return "reconnecting";
  return "online";
}

export class FriendsView implements View {
  private container: HTMLElement | null = null;
  private friends: FriendEntry[] = [];
  private loading = false;
  private message = "";

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
    if (!state.authToken) return;
    this.loading = true;
    this.render();
    this.bindEvents();
    try {
      this.friends = await api.getFriends();
    } catch (err: any) {
      this.message = err?.message || "\u597d\u53cb\u5217\u8868\u52a0\u8f7d\u5931\u8d25";
    } finally {
      this.loading = false;
      this.render();
      this.bindEvents();
    }
  }

  private render(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="neo-panel bg-grid friends-panel">
        <div class="friends-header">
          <div>
            <div class="friends-kicker">SOCIAL</div>
            <h1>\u597d\u53cb</h1>
          </div>
          <div class="friends-actions">
            <button class="neo-btn neo-btn-yellow" id="friends-refresh">\u5237\u65b0</button>
            <button class="neo-btn neo-btn-white" id="friends-back">\u8fd4\u56de</button>
          </div>
        </div>
        ${this.renderContent()}
      </div>
      <style>
        .friends-panel {
          width: min(1120px, calc(100vw - 24px));
          height: min(720px, calc(100vh - 24px));
          margin: 12px auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow: hidden;
        }
        .friends-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex: 0 0 auto;
        }
        .friends-header h1 {
          margin: 0;
          font-family: var(--font-pixel);
          font-size: 34px;
          color: var(--color-black);
          text-shadow: 3px 3px 0 var(--color-yellow);
        }
        .friends-kicker {
          font-family: var(--font-pixel);
          font-size: 10px;
          color: var(--color-blue);
          margin-bottom: 8px;
        }
        .friends-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .friends-message {
          border: 3px solid var(--color-black);
          background: var(--color-yellow);
          padding: 10px 12px;
          font-family: var(--font-ui);
          font-weight: 800;
        }
        .friends-add {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          flex: 0 0 auto;
        }
        .friends-grid {
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          overflow: hidden;
        }
        .friends-section {
          min-height: 0;
          border: 3px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 4px 4px 0 var(--color-black);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .friends-section-title {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-bottom: 3px solid var(--color-black);
          padding: 10px 12px;
          background: var(--color-gray-light);
          font-family: var(--font-ui);
          font-weight: 900;
        }
        .friends-list {
          min-height: 0;
          overflow: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .friend-row {
          border: 3px solid var(--color-black);
          background: var(--color-white);
          padding: 10px;
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }
        .friend-avatar {
          width: 44px;
          height: 44px;
          border: 3px solid var(--color-black);
          background: var(--color-yellow);
          overflow: hidden;
        }
        .friend-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .friend-name {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          font-family: var(--font-ui);
          font-weight: 900;
        }
        .friend-name strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .friend-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          font-family: var(--font-ui);
          font-size: 12px;
          color: var(--color-gray-dark);
        }
        .friend-status {
          border: 2px solid var(--color-black);
          padding: 2px 6px;
          background: var(--color-gray-light);
          font-size: 11px;
          white-space: nowrap;
        }
        .friend-status.online { background: var(--color-green); color: var(--color-white); }
        .friend-status.room { background: var(--color-blue); color: var(--color-white); }
        .friend-status.reconnecting { background: var(--color-yellow); }
        .friend-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .friend-actions .neo-btn {
          padding: 7px 9px;
          font-size: 12px;
          font-family: var(--font-ui);
        }
        .friends-empty {
          border: 3px dashed var(--color-black);
          padding: 14px;
          text-align: center;
          font-family: var(--font-ui);
          font-weight: 800;
          color: var(--color-gray-dark);
        }
        @media (max-width: 900px) {
          .friends-panel {
            height: auto;
            min-height: calc(100vh - 24px);
            overflow: visible;
          }
          .friends-header,
          .friends-add {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: stretch;
          }
          .friends-header h1 {
            font-size: 28px;
          }
          .friends-grid {
            grid-template-columns: 1fr;
            overflow: visible;
          }
          .friends-section,
          .friends-list {
            overflow: visible;
          }
        }
      </style>
    `;
  }

  private renderContent(): string {
    if (!state.authToken) {
      return `
        <div class="friends-empty">
          \u767b\u5f55\u540e\u4f7f\u7528\u597d\u53cb\u7cfb\u7edf
          <div style="margin-top:12px;"><button class="neo-btn neo-btn-blue" id="friends-login">\u53bb\u767b\u5f55</button></div>
        </div>
      `;
    }

    const incoming = this.friends.filter((friend) => friend.direction === "incoming");
    const outgoing = this.friends.filter((friend) => friend.direction === "outgoing");
    const accepted = this.friends.filter((friend) => friend.direction === "friend");

    return `
      ${this.message ? `<div class="friends-message">${html(this.message)}</div>` : ""}
      <form class="friends-add" id="friends-add-form">
        <input class="neo-input" name="account" maxlength="50" placeholder="\u8f93\u5165\u5bf9\u65b9\u8d26\u53f7">
        <button class="neo-btn neo-btn-green" type="submit">\u6dfb\u52a0\u597d\u53cb</button>
      </form>
      ${this.loading ? `<div class="friends-empty">\u6b63\u5728\u540c\u6b65\u597d\u53cb...</div>` : ""}
      <div class="friends-grid">
        ${this.renderSection("\u6536\u5230\u7684\u8bf7\u6c42", incoming)}
        ${this.renderSection("\u5df2\u53d1\u9001", outgoing)}
        ${this.renderSection("\u6211\u7684\u597d\u53cb", accepted)}
      </div>
    `;
  }

  private renderSection(title: string, rows: FriendEntry[]): string {
    return `
      <section class="friends-section">
        <div class="friends-section-title">
          <span>${title}</span>
          <small>${rows.length}</small>
        </div>
        <div class="friends-list scroll-pixel">
          ${rows.length ? rows.map((friend) => this.renderFriendRow(friend)).join("") : `<div class="friends-empty">\u6682\u65e0\u6570\u636e</div>`}
        </div>
      </section>
    `;
  }

  private renderFriendRow(friend: FriendEntry): string {
    return `
      <div class="friend-row">
        <div class="friend-avatar">${renderAvatar(friend.avatar, 44)}</div>
        <div class="friend-main">
          <div class="friend-name">
            <strong>${html(friend.nickname || friend.account)}</strong>
            <span class="friend-status ${statusClass(friend)}">${html(statusText(friend))}</span>
          </div>
          <div class="friend-meta">
            <span>@${html(friend.account)}</span>
            ${friend.titleZh ? `<span>${html(friend.titleZh)}</span>` : ""}
          </div>
          ${this.renderActions(friend)}
        </div>
      </div>
    `;
  }

  private renderActions(friend: FriendEntry): string {
    if (friend.direction === "incoming") {
      return `
        <div class="friend-actions">
          <button class="neo-btn neo-btn-green friend-accept" data-friendship-id="${friend.friendshipId}" type="button">\u63a5\u53d7</button>
          <button class="neo-btn neo-btn-white friend-reject" data-friendship-id="${friend.friendshipId}" type="button">\u62d2\u7edd</button>
        </div>
      `;
    }
    if (friend.direction === "outgoing") {
      return `<div class="friend-actions"><button class="neo-btn neo-btn-white" disabled type="button">\u7b49\u5f85\u5bf9\u65b9</button></div>`;
    }
    return `
      <div class="friend-actions">
        ${friend.roomId ? `<button class="neo-btn neo-btn-blue friend-join-room" data-room-id="${html(friend.roomId)}" type="button">\u52a0\u5165\u623f\u95f4</button>` : ""}
        <button class="neo-btn neo-btn-red friend-remove" data-user-id="${friend.userId}" type="button">\u5220\u9664</button>
      </div>
    `;
  }

  private bindEvents(): void {
    const container = this.container;
    if (!container) return;

    container.querySelector("#friends-back")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });

    container.querySelector("#friends-login")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#login");
    });

    container.querySelector("#friends-refresh")?.addEventListener("click", () => {
      audio.playClick();
      void this.load();
    });

    container.querySelector("#friends-add-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const account = String(data.get("account") || "").trim();
      if (!account) return;
      audio.playClick();
      try {
        await api.requestFriend(account);
        this.message = "\u597d\u53cb\u8bf7\u6c42\u5df2\u53d1\u9001";
        await this.load();
      } catch (err: any) {
        this.message = err?.message || "\u53d1\u9001\u597d\u53cb\u8bf7\u6c42\u5931\u8d25";
        Toast.show(this.message);
        this.render();
        this.bindEvents();
      }
    });

    container.querySelectorAll<HTMLButtonElement>(".friend-accept").forEach((button) => {
      button.addEventListener("click", async () => {
        audio.playClick();
        try {
          await api.acceptFriend(Number(button.dataset.friendshipId || 0));
          this.message = "\u5df2\u6dfb\u52a0\u597d\u53cb";
          await this.load();
        } catch (err: any) {
          Toast.show(err?.message || "\u64cd\u4f5c\u5931\u8d25");
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".friend-reject").forEach((button) => {
      button.addEventListener("click", async () => {
        audio.playClick();
        try {
          await api.rejectFriend(Number(button.dataset.friendshipId || 0));
          this.message = "\u5df2\u62d2\u7edd\u8bf7\u6c42";
          await this.load();
        } catch (err: any) {
          Toast.show(err?.message || "\u64cd\u4f5c\u5931\u8d25");
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".friend-remove").forEach((button) => {
      button.addEventListener("click", async () => {
        audio.playClick();
        try {
          await api.removeFriend(Number(button.dataset.userId || 0));
          this.message = "\u5df2\u5220\u9664\u597d\u53cb";
          await this.load();
        } catch (err: any) {
          Toast.show(err?.message || "\u5220\u9664\u5931\u8d25");
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>(".friend-join-room").forEach((button) => {
      button.addEventListener("click", () => {
        const roomId = String(button.dataset.roomId || "").trim();
        if (!roomId) return;
        audio.playClick();
        setGameMode("multi", 4, roomId);
        router.navigate(roomRouteHash(roomId));
      });
    });
  }
}
