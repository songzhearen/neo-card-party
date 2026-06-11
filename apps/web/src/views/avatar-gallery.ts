/**
 * Avatar gallery view based on the neo-brutalist default avatar reference.
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { state } from "../core/state";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { normalizeAvatarCode, randomAvatarCode, renderAvatar } from "../core/avatar";

export class AvatarGalleryView implements View {
  private container: HTMLElement | null = null;
  private choices: string[] = [];

  mount(container: HTMLElement): void {
    this.container = container;
    this.choices = this.createChoices();
    this.render();
    this.renderAvatars();
    this.bindEvents();
  }

  unmount(): void {
    this.container = null;
  }

  private createChoices(): string[] {
    const codes = new Set<string>([normalizeAvatarCode(state.avatar)]);
    while (codes.size < 24) codes.add(randomAvatarCode());
    return Array.from(codes);
  }

  private render(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel bg-grid" style="display:flex;flex-direction:column;padding:30px 40px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:4px solid var(--color-black);margin-bottom:20px;gap:20px;">
          <h2 style="font-size:28px;font-weight:bold;text-shadow:4px 4px 0 var(--color-yellow);letter-spacing:2px;margin:0;">${t("avatarGallery.title")}</h2>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="neo-btn neo-btn-blue" id="btn-reroll">${t("avatarGallery.reroll")}</button>
            <button class="neo-btn neo-btn-yellow" id="btn-draw-avatar">${t("avatarGallery.draw")}</button>
            <button class="neo-btn neo-btn-white" id="btn-back-avatars">${t("avatarGallery.back")}</button>
          </div>
        </div>

        <div class="scroll-pixel" style="flex:1;overflow-y:auto;padding:6px 20px 20px 0;">
          <div id="avatar-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:20px;align-items:start;"></div>
        </div>
      </div>

      <style>
        .avatar-choice {
          position: relative;
          width: 86px;
          height: 86px;
          padding: 0;
          border: 4px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 5px 5px 0 var(--color-black);
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s, background 0.1s;
          overflow: hidden;
        }
        .avatar-choice:hover {
          transform: translate(-3px, -3px) scale(1.05);
          box-shadow: 8px 8px 0 var(--color-black);
          z-index: 10;
        }
        .avatar-choice.is-selected {
          background: var(--color-yellow);
          box-shadow: 5px 5px 0 var(--color-blue);
        }
        .avatar-choice-check {
          position: absolute;
          right: -4px;
          top: -4px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid var(--color-black);
          background: var(--color-green);
          color: var(--color-white);
          font-family: var(--font-pixel);
          font-size: 12px;
          box-shadow: 3px 3px 0 var(--color-black);
        }
      </style>
    `;
  }

  private renderAvatars(): void {
    const grid = this.container!.querySelector("#avatar-grid")!;
    const current = normalizeAvatarCode(state.avatar);
    grid.innerHTML = this.choices.map((code, index) => {
      const selected = code === current;
      return `
        <button class="avatar-choice ${selected ? "is-selected" : ""}" data-avatar-index="${index}" aria-label="${t("avatarGallery.choose")}">
          ${renderAvatar(code)}
          ${selected ? '<span class="avatar-choice-check">✓</span>' : ""}
        </button>
      `;
    }).join("");

    grid.querySelectorAll<HTMLButtonElement>(".avatar-choice").forEach((button) => {
      button.addEventListener("click", async () => {
        const index = Number(button.dataset.avatarIndex || "0");
        const avatar = this.choices[index];
        if (!avatar) return;

        state.update({ avatar });
        audio.playClick();
        try {
          await api.updateProfile({ avatar });
        } catch { /* offline */ }
        router.navigate("#profile");
      });
    });
  }

  private bindEvents(): void {
    const container = this.container!;
    container.querySelector("#btn-reroll")?.addEventListener("click", () => {
      audio.playClick();
      this.choices = this.createChoices();
      this.renderAvatars();
    });

    container.querySelector("#btn-draw-avatar")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#avatar-editor");
    });

    container.querySelector("#btn-back-avatars")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#profile");
    });
  }
}
