/**
 * 开箱视图 — 移植自 开箱.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { api } from "../core/api";
import { state } from "../core/state";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { Toast } from "../components/toast";
import { formatCoins, LOOTBOX_PRICE } from "../core/cosmetics";

export class LootboxView implements View {
  private isOpening: boolean = false;
  private container: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  unmount(): void {
    this.container = null;
  }

  private render(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel bg-grid" id="lootbox-panel" style="display:flex;flex-direction:column;overflow:hidden;transition:background 0.5s;">
        <div class="loot-dark-overlay" id="loot-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(26,26,26,0.85);opacity:0;pointer-events:none;transition:opacity 0.5s;z-index:5;"></div>

        <!-- 波普光芒 -->
        <div class="loot-rays" id="loot-rays" style="position:absolute;top:50%;left:50%;width:800px;height:800px;margin-left:-400px;margin-top:-400px;background:repeating-conic-gradient(var(--color-yellow) 0 15deg, transparent 15deg 30deg);animation:spin 10s linear infinite;opacity:0;transform:scale(0.1);transition:all 0.5s cubic-bezier(0.175,0.885,0.32,1.275);z-index:6;"></div>

        <!-- 标题 -->
        <div style="position:absolute;top:40px;left:40px;z-index:20;">
          <h1 style="font-size:32px;color:var(--color-black);text-shadow:4px 4px 0 var(--color-yellow),6px 6px 0 var(--color-black);margin:0;letter-spacing:-2px;">${t("lootbox.title")}</h1>
          <div style="font-family:var(--font-ui);font-weight:bold;font-size:14px;color:var(--color-gray-text);margin-top:10px;background:var(--color-white);border:3px solid var(--color-black);padding:4px 8px;display:inline-block;">${t("lootbox.subtitle")}</div>
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--color-yellow);margin-top:10px;background:var(--color-black);border:3px solid var(--color-black);box-shadow:4px 4px 0 var(--color-yellow);padding:8px 10px;display:inline-flex;gap:8px;">
            <span>\uD83E\uDE99</span><span id="loot-coins">${formatCoins(state)}</span><span style="color:var(--color-white);">- ${LOOTBOX_PRICE}</span>
          </div>
        </div>

        <!-- 舞台 -->
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;display:flex;justify-content:center;align-items:center;z-index:10;">
          <!-- 宝箱 -->
          <div class="loot-chest" id="loot-chest" style="cursor:pointer;transition:transform 0.1s;z-index:15;position:relative;">
            <div class="chest-lid" style="position:absolute;top:-60px;left:-8px;width:220px;height:70px;background:var(--color-red);border:8px solid var(--color-black);border-radius:40px 40px 0 0;transform-origin:bottom center;transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1);z-index:2;
              background-image:linear-gradient(90deg, transparent 30px, #A0AEC0 30px, #A0AEC0 54px, transparent 54px, transparent 166px, #A0AEC0 166px, #A0AEC0 190px, transparent 190px);"></div>
            <div class="chest-body" style="width:220px;height:140px;background:var(--color-red);border:8px solid var(--color-black);box-shadow:16px 16px 0 var(--color-black);position:relative;
              background-image:linear-gradient(90deg, transparent 30px, #A0AEC0 30px, #A0AEC0 54px, transparent 54px, transparent 166px, #A0AEC0 166px, #A0AEC0 190px, transparent 190px);"></div>
            <div class="chest-lock" style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);width:40px;height:40px;background:var(--color-yellow);border:6px solid var(--color-black);border-radius:50%;z-index:3;box-shadow:4px 4px 0 rgba(0,0,0,0.2);">
              <div style="position:absolute;top:10px;left:10px;width:8px;height:12px;background:var(--color-black);border-radius:4px;"></div>
            </div>
          </div>

          <!-- 战利品 -->
          <div class="loot-result" id="loot-result" style="position:absolute;top:50%;left:50%;width:140px;height:200px;background:var(--color-white);border:6px solid var(--color-black);border-radius:8px;box-shadow:0 0 0 transparent;display:flex;flex-direction:column;justify-content:center;align-items:center;opacity:0;transform:translate(-50%,-50%) scale(0.5);z-index:20;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);">
            <span id="loot-icon" style="font-size:64px;">\uD83C\uDF81</span>
            <span id="loot-name" style="font-family:var(--font-ui);font-weight:bold;font-size:14px;margin-top:10px;">???</span>
            <span id="loot-rarity" style="font-size:10px;margin-top:5px;font-family:var(--font-pixel);"></span>
          </div>
        </div>

        <!-- 按钮 -->
        <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);display:flex;gap:20px;z-index:20;">
          <button class="neo-btn neo-btn-blue" id="btn-loot-again" style="font-size:12px;">${t("lootbox.openAgain")}</button>
          <button class="neo-btn neo-btn-green" id="btn-loot-ten" style="font-size:12px;">${t("lootbox.openTen")}</button>
          <button class="neo-btn neo-btn-white" id="btn-back-lootbox">${t("lootbox.back")}</button>
        </div>
      </div>

      <style>
        .loot-chest:hover { transform: scale(1.05); }
        .loot-chest:active { transform: scale(0.95); }
        .loot-chest.opened { pointer-events: none; }
        .loot-chest.opened .chest-lid { transform: translateY(-50px) rotate(-15deg) scale(1.1); }
        .shaking { animation: rumble 0.1s infinite; }
      </style>
    `;
  }

  private bindEvents(): void {
    const container = this.container!;
    const chest = container.querySelector("#loot-chest") as HTMLElement;
    const rays = container.querySelector("#loot-rays") as HTMLElement;
    const overlay = container.querySelector("#loot-overlay") as HTMLElement;
    const result = container.querySelector("#loot-result") as HTMLElement;
    const lootIcon = container.querySelector("#loot-icon") as HTMLElement;
    const lootName = container.querySelector("#loot-name") as HTMLElement;
    const lootRarity = container.querySelector("#loot-rarity") as HTMLElement;

    const openChest = async () => {
      if (this.isOpening) return;
      this.isOpening = true;

      chest.classList.add("shaking");
      audio.playLootbox();

      setTimeout(async () => {
        chest.classList.remove("shaking");
        chest.classList.add("opened");

        const loot = await api.openLootbox();
        const coinsEl = container.querySelector("#loot-coins") as HTMLElement;
        if (coinsEl) coinsEl.textContent = formatCoins(state);
        if (loot.success === false) {
          chest.classList.remove("opened");
          this.isOpening = false;
          Toast.show(t("shop.noCoins"));
          return;
        }

        if (loot.rarity === "legendary" || loot.rarity === "chromatic" || loot.rarity === "mythic") {
          rays.classList.add("active");
          overlay.style.opacity = "0.85";
        }

        setTimeout(() => {
          result.style.opacity = "1";
          result.style.transform = "translate(-50%, -50%) scale(1)";
          result.style.boxShadow = "10px 10px 0 var(--color-black)";
          result.style.borderColor = loot.item.color;
          lootIcon.textContent = loot.item.icon;
          lootName.textContent = loot.item.name;
          lootRarity.textContent = loot.rarity.toUpperCase();
          lootRarity.style.color = loot.item.color;
          this.isOpening = false;
        }, 400);
      }, 800);
    };

    chest.addEventListener("click", openChest);

    container.querySelector("#btn-loot-again")?.addEventListener("click", () => {
      chest.classList.remove("opened");
      rays.classList.remove("active");
      overlay.style.opacity = "0";
      result.style.opacity = "0";
      result.style.transform = "translate(-50%, -50%) scale(0.5)";
      audio.playClick();
      setTimeout(openChest, 300);
    });

    container.querySelector("#btn-back-lootbox")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#shop");
    });

    container.querySelector("#btn-loot-ten")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#gacha");
    });
  }
}
