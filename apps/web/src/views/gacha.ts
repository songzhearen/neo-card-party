/**
 * 十连开箱视图 — 移植自 十连开箱.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { api } from "../core/api";
import { state } from "../core/state";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { Toast } from "../components/toast";
import { formatCoins, LOOTBOX_PRICE } from "../core/cosmetics";

export class GachaView implements View {
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
      <div class="neo-panel bg-grid" style="display:flex;flex-direction:column;overflow:hidden;">
        <div class="gacha-overlay" id="gacha-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(26,26,26,0.85);opacity:0;pointer-events:none;transition:opacity 0.5s;z-index:5;"></div>

        <!-- 光芒 -->
        <div class="gacha-rays" id="gacha-rays" style="position:absolute;top:50%;left:50%;width:800px;height:800px;margin-left:-400px;margin-top:-400px;background:repeating-conic-gradient(var(--color-yellow) 0 15deg, transparent 15deg 30deg);animation:spin 10s linear infinite;opacity:0;transform:scale(0.1);transition:all 0.5s cubic-bezier(0.175,0.885,0.32,1.275);z-index:6;"></div>

        <!-- 头部 -->
        <div style="padding:30px 40px;display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid var(--color-black);background:var(--color-gray-light);z-index:10;">
          <div style="display:flex;align-items:center;gap:15px;">
            <span style="font-size:38px;">\uD83C\uDFB0</span>
            <h1 style="font-size:28px;margin:0;letter-spacing:-2px;text-shadow:4px 4px 0 var(--color-yellow),6px 6px 0 var(--color-black);">${t("gacha.title")}</h1>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div id="gacha-badge" style="background:var(--color-black);color:var(--color-yellow);border:3px solid var(--color-yellow);padding:10px 15px;font-size:12px;">${t("gacha.badge")}</div>
            <div style="background:var(--color-white);color:var(--color-black);border:3px solid var(--color-black);box-shadow:4px 4px 0 var(--color-yellow);padding:8px 12px;font-family:var(--font-pixel);font-size:11px;display:flex;gap:8px;">
              <span>\uD83E\uDE99</span><span id="gacha-coins">${formatCoins(state)}</span><span style="color:var(--color-red);">- ${LOOTBOX_PRICE * 10}</span>
            </div>
          </div>
        </div>

        <!-- 主区域 -->
        <div style="flex:1;display:flex;flex-direction:column;padding:30px 40px 20px;position:relative;z-index:10;">
          <!-- 宝箱舞台 -->
          <div style="flex:1;position:relative;display:flex;justify-content:center;align-items:flex-end;padding-bottom:6%;z-index:10;">
            <div class="gacha-chest" id="gacha-chest" style="cursor:pointer;transition:transform 0.1s;z-index:15;position:relative;">
              <div class="chest-lid" style="position:absolute;top:-60px;left:-8px;width:220px;height:70px;background:var(--color-red);border:8px solid var(--color-black);border-radius:40px 40px 0 0;transform-origin:bottom center;transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1);z-index:2;
                background-image:linear-gradient(90deg, transparent 30px, #A0AEC0 30px, #A0AEC0 54px, transparent 54px, transparent 166px, #A0AEC0 166px, #A0AEC0 190px, transparent 190px);"></div>
              <div class="chest-body" style="width:220px;height:140px;background:var(--color-red);border:8px solid var(--color-black);box-shadow:16px 16px 0 var(--color-black);position:relative;
                background-image:linear-gradient(90deg, transparent 30px, #A0AEC0 30px, #A0AEC0 54px, transparent 54px, transparent 166px, #A0AEC0 166px, #A0AEC0 190px, transparent 190px);"></div>
              <div class="chest-lock" style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);width:40px;height:40px;background:var(--color-yellow);border:6px solid var(--color-black);border-radius:50%;z-index:3;box-shadow:4px 4px 0 rgba(0,0,0,0.2);">
                <div style="position:absolute;top:10px;left:10px;width:8px;height:12px;background:var(--color-black);border-radius:4px;"></div>
              </div>
            </div>
          </div>

          <!-- 战利品展示区 -->
          <div id="gacha-results" style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;min-height:120px;padding:10px 0;"></div>

          <!-- 按钮 -->
          <div style="display:flex;gap:15px;justify-content:center;margin-top:10px;">
            <button class="neo-btn neo-btn-green" id="btn-gacha-again" style="font-size:12px;">${t("gacha.again")}</button>
            <button class="neo-btn neo-btn-white" id="btn-back-gacha">${t("gacha.back")}</button>
          </div>
        </div>
      </div>

      <style>
        .gacha-chest:hover { transform: scale(1.05); }
        .gacha-chest:active { transform: scale(0.95); }
        .gacha-chest.opened { pointer-events: none; }
        .gacha-chest.opened .chest-lid { transform: translateY(-50px) rotate(-15deg) scale(1.1); }
      </style>
    `;
  }

  private bindEvents(): void {
    const container = this.container!;
    const chest = container.querySelector("#gacha-chest") as HTMLElement;
    const rays = container.querySelector("#gacha-rays") as HTMLElement;
    const overlay = container.querySelector("#gacha-overlay") as HTMLElement;
    const results = container.querySelector("#gacha-results") as HTMLElement;

    const doGacha = async () => {
      if (this.isOpening) return;
      if (!state.isRoot && !state.authToken && state.coins < LOOTBOX_PRICE * 10) {
        Toast.show(t("shop.noCoins"));
        return;
      }
      this.isOpening = true;
      results.innerHTML = "";

      chest.classList.add("shaking");
      audio.playLootbox();

      setTimeout(async () => {
        chest.classList.remove("shaking");
        chest.classList.add("opened");

        const items = await api.openGacha();
        const coinsEl = container.querySelector("#gacha-coins") as HTMLElement;
        if (coinsEl) coinsEl.textContent = formatCoins(state);
        if (!items.length || items.some((i) => i.success === false)) {
          chest.classList.remove("opened");
          this.isOpening = false;
          Toast.show(t("shop.noCoins"));
          return;
        }

        const hasLegendary = items.some((i) => i.rarity === "legendary" || i.rarity === "chromatic" || i.rarity === "mythic");
        if (hasLegendary) {
          rays.classList.add("active");
          overlay.style.opacity = "0.85";
        }

        items.forEach((item, i) => {
          setTimeout(() => {
            const el = document.createElement("div");
            el.style.cssText = `
              width:60px;height:80px;background:var(--color-white);border:3px solid ${item.item.color};
              box-shadow:3px 3px 0 var(--color-black);display:flex;flex-direction:column;
              align-items:center;justify-content:center;font-size:28px;
              animation:popIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
            `;
            el.innerHTML = `<span>${item.item.icon}</span><span style="font-size:7px;color:${item.item.color};">${item.rarity.toUpperCase()}</span>`;
            results.appendChild(el);
          }, i * 150);
        });

        setTimeout(() => { this.isOpening = false; }, items.length * 150 + 300);
      }, 800);
    };

    chest.addEventListener("click", doGacha);

    container.querySelector("#btn-gacha-again")?.addEventListener("click", () => {
      chest.classList.remove("opened");
      rays.classList.remove("active");
      overlay.style.opacity = "0";
      results.innerHTML = "";
      audio.playClick();
      setTimeout(doGacha, 300);
    });

    container.querySelector("#btn-back-gacha")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#shop");
    });
  }
}
