/**
 * 房间大厅视图 — 移植自 房间大厅.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { api } from "../core/api";
import { state } from "../core/state";
import { audio } from "../core/audio";
import { t, onLangChange } from "../core/i18n";
import { renderAvatar } from "../core/avatar";
import { renderAccessory } from "../core/cosmetics";
import { roomRouteHash, setGameMode } from "./waiting-room";

export class LobbyView implements View {
  private container: HTMLElement | null = null;
  private unsubLang: (() => void) | null = null;
  private pollTimer: number | null = null;
  private isJoining: boolean = false;
  private createCapacity: number = 4;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
    this.loadRooms(container);
    this.bindEvents();

    this.pollTimer = window.setInterval(() => {
      if (this.container) this.loadRooms(this.container);
    }, 5000);

    this.unsubLang = onLangChange(() => {
      this.render();
      this.loadRooms(this.container!);
      this.bindEvents();
    });
  }

  unmount(): void {
    this.unsubLang?.();
    if (this.pollTimer) { window.clearInterval(this.pollTimer); this.pollTimer = null; }
    this.container = null;
  }

  private render(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel bg-grid lobby-panel" style="display:flex;flex-direction:column;padding:30px 40px;">
        <!-- 顶部 -->
        <div class="lobby-header" style="display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:4px solid var(--color-black);margin-bottom:30px;">
          <button class="neo-btn neo-btn-white" id="btn-back-lobby" style="padding:10px 16px;font-size:12px;">${t("lobby.back")}</button>
          <h2 style="font-size:32px;font-weight:bold;text-shadow:4px 4px 0 #E2E8F0;letter-spacing:2px;">${t("lobby.title")}</h2>
          <div style="display:flex;align-items:center;gap:15px;font-size:14px;font-weight:bold;">
            <span id="lobby-player-name">${state.playerName}</span>
            <div class="avatar-stack" style="width:48px;height:48px;">
              ${renderAccessory(state.equippedAccessory, 48)}
              <div class="avatar-base" style="width:48px;height:48px;background:var(--color-yellow);border:3px solid var(--color-black);box-shadow:3px 3px 0 var(--color-black);display:flex;align-items:center;justify-content:center;">${renderAvatar(state.avatar)}</div>
            </div>
          </div>
        </div>

        <!-- 内容 -->
        <div class="lobby-main" style="display:flex;flex:1;gap:40px;overflow:hidden;">
          <!-- 房间列表 -->
          <div class="lobby-list-pane" style="flex:2;display:flex;flex-direction:column;">
            <div style="font-size:14px;color:var(--color-gray-text);margin-bottom:15px;display:flex;justify-content:space-between;">
              <span>${t("lobby.onlineRooms")} (<span id="room-count">0</span>)</span>
              <span style="cursor:pointer;" id="btn-refresh-rooms">${t("lobby.refresh")}</span>
            </div>
            <div class="scroll-pixel" id="room-list" style="flex:1;overflow-y:auto;padding-right:15px;display:flex;flex-direction:column;gap:20px;">
              <div style="text-align:center;padding:40px;color:var(--color-gray-text);">${t("lobby.loading")}</div>
            </div>
          </div>

          <!-- 操作面板 -->
          <div class="lobby-action-pane" style="flex:1;background:var(--color-gray-light);border:4px dashed var(--color-gray);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:30px;padding:30px;position:relative;">
            <div style="position:absolute;top:40px;left:40px;width:40px;height:60px;border:3px solid var(--color-black);background:var(--color-white);box-shadow:3px 3px 0 rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--color-red);transform:rotate(-20deg);">+4</div>
            <div style="position:absolute;bottom:40px;right:40px;width:40px;height:60px;border:3px solid var(--color-black);background:var(--color-white);box-shadow:3px 3px 0 rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--color-blue);transform:rotate(15deg);">\u21BA</div>
            <div class="lobby-capacity-picker">
              <span>${t("waiting.capacity")}</span>
              <div>
                <button class="neo-btn neo-btn-white" id="lobby-cap-minus" style="padding:6px 10px;font-size:12px;">-</button>
                <strong id="lobby-capacity-value">${this.createCapacity}</strong>
                <button class="neo-btn neo-btn-white" id="lobby-cap-plus" style="padding:6px 10px;font-size:12px;">+</button>
              </div>
            </div>
            <button class="neo-btn neo-btn-green" id="btn-create-room" style="width:100%;padding:24px;font-size:20px;letter-spacing:2px;">${t("lobby.createRoom")}</button>
            <button class="neo-btn neo-btn-yellow" id="btn-quick-join" style="width:100%;padding:24px;font-size:20px;letter-spacing:2px;">${t("lobby.quickJoin")}</button>
          </div>
        </div>
        <style>
          .lobby-capacity-picker {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 16px;
            border: 3px solid var(--color-black);
            background: var(--color-white);
            box-shadow: 5px 5px 0 var(--color-gray);
            font-family: var(--font-ui);
            font-weight: bold;
            z-index: 1;
          }
          .lobby-capacity-picker > div {
            display: grid;
            grid-template-columns: 44px 1fr 44px;
            align-items: center;
            gap: 12px;
          }
          #lobby-capacity-value {
            text-align: center;
            font-family: var(--font-pixel);
            font-size: 26px;
          }
          @media (max-width: 820px), (max-height: 520px) {
            .lobby-panel { padding: 14px !important; }
            .lobby-header {
              flex-direction: column;
              align-items: stretch !important;
              gap: 12px;
              margin-bottom: 16px !important;
            }
            .lobby-header h2 {
              font-size: 22px !important;
              text-align: center;
              letter-spacing: 0 !important;
            }
            .lobby-header > div {
              justify-content: center;
            }
            .lobby-main {
              flex-direction: column;
              gap: 16px !important;
              overflow: visible !important;
            }
            .lobby-list-pane,
            .lobby-action-pane {
              flex: none !important;
            }
            #room-list {
              overflow: visible !important;
              padding-right: 0 !important;
            }
            .lobby-action-pane {
              gap: 14px !important;
              padding: 18px !important;
            }
            .lobby-action-pane > div {
              display: none !important;
            }
            .lobby-capacity-picker {
              display: flex !important;
            }
            #btn-create-room,
            #btn-quick-join {
              min-height: 54px !important;
              padding: 12px !important;
              font-size: 14px !important;
              letter-spacing: 1px !important;
            }
          }
        </style>
      </div>
    `;
  }

  private async loadRooms(container: HTMLElement): Promise<void> {
    const list = container.querySelector("#room-list")!;
    try {
      const rooms = await api.getRooms();
      const countEl = container.querySelector("#room-count")!;
      countEl.textContent = String(rooms.length);

      if (rooms.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-gray-text);grid-column:1/-1;">${t("lobby.noRooms")}</div>`;
      } else {
        list.innerHTML = rooms
          .map(
          (room, i) => `
        <div class="neo-card" style="display:flex;justify-content:space-between;align-items:center;${room.players >= room.max ? "opacity:0.6;pointer-events:none;" : ""}">
          <div style="display:flex;flex-direction:column;gap:10px;">
            <span style="font-size:18px;font-weight:bold;">${room.name}</span>
            <div style="display:flex;gap:10px;font-size:10px;">
              <span class="neo-tag ${room.modeKey === 'casual' ? 'neo-tag-green' : 'neo-tag-red'}">${room.mode}</span>
              <span class="neo-tag">${t("lobby.ante")}: ${room.ante}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:20px;">
            <span style="font-size:18px;letter-spacing:-1px;">${room.players}/${room.max}</span>
            <button class="neo-btn neo-btn-blue ${room.players >= room.max ? 'join-room-disabled' : 'join-room-btn'}" data-room-index="${i}" style="padding:10px 20px;font-size:12px;" ${room.players >= room.max ? "disabled" : ""}>${room.players >= room.max ? t("lobby.full") : t("lobby.join")}</button>
          </div>
        </div>`
        )
        .join("");
      }

      list.querySelectorAll(".join-room-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          audio.playClick();
          const index = parseInt((btn as HTMLElement).dataset.roomIndex || "0", 10);
          await this.enterRoom(rooms[index]);
        });
      });
    } catch {
      list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-red);">${t("lobby.loadFailed")}</div>`;
    }
  }

  private bindEvents(): void {
    const container = this.container!;

    container.querySelector("#btn-back-lobby")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });

    container.querySelector("#btn-refresh-rooms")?.addEventListener("click", () => {
      audio.playClick();
      this.loadRooms(container);
    });

    container.querySelector("#lobby-cap-minus")?.addEventListener("click", () => {
      audio.playClick();
      this.changeCreateCapacity(-1);
    });

    container.querySelector("#lobby-cap-plus")?.addEventListener("click", () => {
      audio.playClick();
      this.changeCreateCapacity(1);
    });

    container.querySelector("#btn-quick-join")?.addEventListener("click", async () => {
      audio.playClick();
      const rooms = await api.getRooms();
      const firstOpen = rooms.find((room) => room.players < room.max);
      await this.enterRoom(firstOpen);
    });

    container.querySelector("#btn-create-room")?.addEventListener("click", async () => {
      audio.playClick();
      await this.enterRoom();
    });
  }

  private changeCreateCapacity(delta: number): void {
    this.createCapacity = Math.max(2, Math.min(12, this.createCapacity + delta));
    const value = this.container?.querySelector("#lobby-capacity-value");
    if (value) value.textContent = String(this.createCapacity);
  }

  private async enterRoom(room?: any): Promise<void> {
    if (this.isJoining) return;
    this.isJoining = true;

    const capacity = room?.max || this.createCapacity;
    const joined = await api.joinGameRoom(state.playerName || "PLAYER_1", {
      roomId: room?.roomId,
      create: !room,
      playerCount: capacity,
      roomName: room ? undefined : `${state.playerName || "PLAYER"} 的房间`,
      mode: "casual",
      ante: room?.ante || 100,
    });

    if (!joined) {
      this.isJoining = false;
      return;
    }

    const roomId = joined?.id || joined?.roomId || room?.roomId;
    setGameMode("multi", capacity, roomId);
    this.isJoining = false;
    router.navigate(roomId ? roomRouteHash(roomId) : "#waiting");
  }
}
