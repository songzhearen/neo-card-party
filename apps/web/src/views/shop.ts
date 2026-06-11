/**
 * 商城视图 — 移植自 商城系统.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { api } from "../core/api";
import { state } from "../core/state";
import { audio } from "../core/audio";
import { Toast } from "../components/toast";
import { t, onLangChange } from "../core/i18n";
import {
  AccessoryColorId,
  formatCoins,
  getAccessory,
  getAccessoryColor,
  getThrowable,
  getTitle,
  parseAccessoryItemId,
  parseThrowableItemId,
  parseTitleItemId,
  renderAccessory,
  renderTitleBadge,
} from "../core/cosmetics";

interface ShopItem {
  id: string; type: string; icon: string; name: string; desc: string;
  price: number; stock: number;
  isEquipped?: boolean; isConsumable?: boolean;
}

interface RedeemReward {
  coins?: number;
  itemId?: string | null;
  quantity?: number;
}

export class ShopView implements View {
  private mode: "shop" | "inventory" = "shop";
  private items: ShopItem[] = [];
  private container: HTMLElement | null = null;
  private unsubLang: (() => void) | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.renderFrame();
    this.loadItems(container);

    this.unsubLang = onLangChange(() => {
      this.renderFrame();
      this.renderGrid(this.container!);
    });
  }

  unmount(): void {
    this.unsubLang?.();
    this.container = null;
  }

  private renderFrame(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel bg-grid shop-panel" style="display:flex;flex-direction:column;">
        <div class="shop-header" style="padding:30px 40px 15px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:15px;">
            <span style="font-size:38px;animation:float 2s infinite;">\uD83D\uDED2</span>
            <h1 id="shop-title" style="font-size:32px;margin:0;letter-spacing:-2px;text-shadow:4px 4px 0 var(--color-green),6px 6px 0 var(--color-black);">${t("shop.store")}</h1>
          </div>
          <div style="background:var(--color-black);color:var(--color-yellow);border:4px solid var(--color-black);box-shadow:4px 4px 0 var(--color-yellow);padding:10px 20px;font-size:18px;display:flex;align-items:center;gap:10px;">
            <span>\uD83E\uDE99</span> <span id="shop-coins">${formatCoins(state)}</span>
          </div>
        </div>

        <div class="shop-tools" style="padding:0 40px 20px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid var(--color-black);background:var(--color-gray-light);">
          <div style="display:flex;gap:10px;" id="shop-tabs">
            <button class="shop-tab ${this.mode === 'shop' ? 'active' : ''}" data-tab="shop">${t("shop.shopTab")}</button>
            <button class="shop-tab ${this.mode === 'inventory' ? 'active' : ''}" data-tab="inventory">${t("shop.inventoryTab")}</button>
          </div>
          <div class="shop-actions" style="display:flex;align-items:center;gap:10px;">
            <button class="neo-btn neo-btn-yellow" id="btn-open-lootbox" style="font-family:var(--font-ui);font-size:14px;padding:12px 18px;">${t("shop.openBox")}</button>
            <button class="neo-btn neo-btn-green" id="btn-open-gacha" style="font-family:var(--font-ui);font-size:14px;padding:12px 18px;">${t("lootbox.openTen")}</button>
            <input type="text" class="neo-input" id="redeem-code" placeholder="${t("shop.redeemPlaceholder")}" maxlength="20" style="width:200px;font-family:var(--font-pixel);font-size:10px;text-transform:uppercase;">
            <button class="neo-btn neo-btn-red" id="btn-redeem" style="font-family:var(--font-ui);font-size:14px;padding:12px 20px;">${t("shop.redeem")}</button>
          </div>
        </div>

        <div class="scroll-pixel-yellow" id="shop-grid" style="flex:1;padding:30px 40px;display:grid;grid-template-columns:repeat(4,1fr);gap:25px;overflow-y:auto;">
          <div style="text-align:center;padding:40px;grid-column:1/-1;color:var(--color-gray-text);">${t("shop.loading")}</div>
        </div>

        <div class="shop-footer" style="padding:15px 40px 25px;border-top:4px dashed var(--color-gray);">
          <button class="neo-btn neo-btn-white" id="btn-back-shop" style="font-family:var(--font-ui);font-size:16px;">${t("shop.backToLobby")}</button>
        </div>
      </div>

      <style>
        .shop-tab {
          background: var(--color-gray-mid); border: 3px solid var(--color-black);
          padding: 14px 24px; font-family: var(--font-pixel); font-size: 12px;
          cursor: pointer; box-shadow: 4px 4px 0 var(--color-black); transition: all 0.1s;
        }
        .shop-tab:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 var(--color-black); }
        .shop-tab.active { background: var(--color-blue); color: var(--color-white); }

        .item-card {
          background: var(--color-white); border: 4px solid var(--color-black);
          box-shadow: 6px 6px 0 var(--color-gray);
          display: flex; flex-direction: column; align-items: center;
          padding: 20px; transition: transform 0.1s, box-shadow 0.1s; position: relative;
        }
        .item-card:hover { transform: translateY(-5px); box-shadow: 8px 8px 0 var(--color-black); }
        @media (max-width: 820px), (max-height: 520px) {
          .shop-header {
            padding: 18px 16px 12px !important;
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px;
          }
          .shop-header > div {
            justify-content: center;
          }
          #shop-title {
            font-size: 24px !important;
            letter-spacing: 0 !important;
          }
          .shop-tools {
            padding: 12px 16px !important;
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px;
          }
          #shop-tabs,
          .shop-actions {
            flex-wrap: wrap;
            width: 100%;
          }
          #shop-tabs > *,
          .shop-actions > * {
            flex: 1 1 130px;
          }
          #redeem-code {
            width: 100% !important;
            min-width: 0;
          }
          .shop-tab {
            padding: 10px 12px;
            font-size: 10px;
          }
          .shop-footer {
            padding: 14px 16px 18px !important;
          }
          .shop-footer .neo-btn {
            width: 100%;
          }
        }
      </style>
    `;

    this.bindTabEvents();
  }

  private async loadItems(container: HTMLElement): Promise<void> {
    try {
      this.items = await api.getShopItems() as unknown as ShopItem[];
      this.renderGrid(container);
    } catch {
      const grid = container.querySelector("#shop-grid")!;
      grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-red);grid-column:1/-1;">${t("shop.loadFailed")}</div>`;
    }
  }

  private renderGrid(container: HTMLElement): void {
    const grid = container.querySelector("#shop-grid")!;
    const title = container.querySelector("#shop-title") as HTMLElement;

    if (this.mode === "inventory") {
      title.textContent = t("shop.inventory");
      title.style.textShadow = "4px 4px 0 var(--color-blue),6px 6px 0 var(--color-black)";
    } else {
      title.textContent = t("shop.store");
      title.style.textShadow = "4px 4px 0 var(--color-green),6px 6px 0 var(--color-black)";
    }

    if (this.mode === "inventory") {
      grid.innerHTML = this.renderAccessoryInventory();
      this.bindItemEvents(container);
      return;
    }

    grid.innerHTML = this.items
      .filter((item) => item.type === "accessory" || item.type === "emoji" || item.type === "title")
      .map(
        (item) => `
      <div class="item-card">
        <div style="width:80px;height:80px;background:var(--color-gray-mid);border:3px solid var(--color-black);display:flex;align-items:center;justify-content:center;font-size:48px;margin-bottom:15px;position:relative;">
          <span style="position:absolute;top:-10px;right:-10px;background:${item.type === "title" ? "var(--color-pink)" : item.type === "emoji" ? "var(--color-red)" : "var(--color-blue)"};color:var(--color-white);font-family:var(--font-pixel);font-size:8px;padding:4px 6px;border:2px solid var(--color-black);">${this.itemTypeLabel(item)}</span>
          ${item.icon}
        </div>
        <div style="font-family:var(--font-ui);font-weight:bold;font-size:16px;margin-bottom:5px;">${item.name}</div>
        <div style="font-size:10px;color:var(--color-gray-text);text-align:center;height:24px;margin-bottom:15px;">${item.desc}</div>
        ${this.getButtonHtml(item)}
      </div>`
      )
      .join("");

    this.bindItemEvents(container);
  }

  private itemTypeLabel(item: ShopItem): string {
    if (item.type === "emoji") return state.settings.language === "zh" ? "投掷物" : "Throw";
    if (item.type === "title") return state.settings.language === "zh" ? "称号" : "Title";
    return t("shop.accessory");
  }

  private renderAccessoryInventory(): string {
    const lang = state.settings.language === "zh" ? "zh" : "en";
    const accessoryEntries = Object.entries(state.accessoryInventory)
      .flatMap(([id, colors]) => colors.map((color) => ({ id, color: color as AccessoryColorId })));
    const throwableEntries = Object.entries(state.throwableInventory).filter(([, count]) => count > 0);
    const titleEntries = state.ownedTitleIds
      .filter((id) => id !== "newbie")
      .map((id) => getTitle(id, state.customTitles));

    if (!accessoryEntries.length && !throwableEntries.length && !titleEntries.length) {
      return `<div style="text-align:center;padding:40px;grid-column:1/-1;color:var(--color-gray-text);">${t("shop.loading")}</div>`;
    }

    const accessoryCards = accessoryEntries.map(({ id, color }) => {
      const accessory = getAccessory(id);
      const dye = getAccessoryColor(color);
      const itemId = `acc_${id}_${color}`;
      const equipped = state.equippedAccessory?.id === id && state.equippedAccessory?.color === color;
      const swatchBg = dye.id === "rainbow"
        ? "linear-gradient(90deg,var(--color-red),var(--color-yellow),var(--color-green),var(--color-blue),var(--color-pink))"
        : dye.hex;
      return `
        <div class="item-card">
          <div class="avatar-stack" style="width:82px;height:82px;align-items:center;justify-content:center;margin-bottom:15px;">
            ${renderAccessory({ id, color }, 82)}
            <div class="${dye.id === "rainbow" ? "rainbow-swatch" : ""}" style="width:64px;height:64px;background:${swatchBg};border:3px solid var(--color-black);box-shadow:4px 4px 0 var(--color-black);display:flex;align-items:center;justify-content:center;font-size:32px;color:${dye.id === "white" || dye.id === "yellow" ? "var(--color-black)" : "var(--color-white)"};">${accessory.icon}</div>
          </div>
          <div style="font-family:var(--font-ui);font-weight:bold;font-size:15px;margin-bottom:5px;">${lang === "zh" ? accessory.nameZh : accessory.nameEn}</div>
          <div style="font-size:10px;color:var(--color-gray-text);text-align:center;height:24px;margin-bottom:15px;">${lang === "zh" ? dye.nameZh : dye.nameEn}</div>
          ${equipped
            ? `<button class="neo-btn neo-btn-white" disabled style="width:100%;font-size:10px;">${t("shop.equipped")}</button>`
            : `<button class="neo-btn neo-btn-yellow equip-btn" data-id="${itemId}" style="width:100%;font-size:10px;">${t("shop.equip")}</button>`}
        </div>
      `;
    });

    const throwableCards = throwableEntries.map(([id, count]) => {
      const item = getThrowable(id);
      return `
        <div class="item-card">
          <div style="width:80px;height:80px;background:var(--color-gray-mid);border:3px solid var(--color-black);display:flex;align-items:center;justify-content:center;font-size:44px;margin-bottom:15px;position:relative;">
            <span style="position:absolute;right:-10px;top:-10px;background:var(--color-red);color:var(--color-white);border:2px solid var(--color-black);font-family:var(--font-pixel);font-size:8px;padding:4px 6px;">x${state.isRoot ? "∞" : count}</span>
            ${item.icon}
          </div>
          <div style="font-family:var(--font-ui);font-weight:bold;font-size:15px;margin-bottom:5px;">${lang === "zh" ? item.nameZh : item.nameEn}</div>
          <div style="font-size:10px;color:var(--color-gray-text);text-align:center;height:24px;margin-bottom:15px;">${lang === "zh" ? "局内投掷物" : "In-game throwable"}</div>
          <button class="neo-btn neo-btn-black" disabled style="width:100%;font-size:10px;">x${state.isRoot ? "∞" : count}</button>
        </div>
      `;
    });

    const titleCards = titleEntries.map((title) => {
      const equipped = state.equippedTitleId === title.id;
      return `
        <div class="item-card">
          <div style="height:80px;display:flex;align-items:center;justify-content:center;margin-bottom:15px;">${renderTitleBadge(title.id, lang, false, state.customTitles)}</div>
          <div style="font-family:var(--font-ui);font-weight:bold;font-size:15px;margin-bottom:5px;">${lang === "zh" ? title.nameZh : title.nameEn}</div>
          <div style="font-size:10px;color:var(--color-gray-text);text-align:center;height:24px;margin-bottom:15px;">${lang === "zh" ? title.descZh : title.descEn}</div>
          ${equipped
            ? `<button class="neo-btn neo-btn-white" disabled style="width:100%;font-size:10px;">${t("shop.equipped")}</button>`
            : `<button class="neo-btn neo-btn-yellow equip-btn" data-id="title_${title.id}" style="width:100%;font-size:10px;">${t("shop.equip")}</button>`}
        </div>
      `;
    });

    return [...accessoryCards, ...throwableCards, ...titleCards].join("");
  }

  private getButtonHtml(item: ShopItem): string {
    const accessory = parseAccessoryItemId(item.id);
    const throwable = parseThrowableItemId(item.id);
    const titleId = parseTitleItemId(item.id);
    const owned = accessory ? state.accessoryInventory[accessory.id]?.includes(accessory.color) : false;
    if (this.mode === "shop") {
      if (owned) return `<button class="neo-btn neo-btn-white" disabled style="width:100%;font-size:10px;">${t("shop.owned")}</button>`;
      if (titleId && state.ownedTitleIds.includes(titleId)) return `<button class="neo-btn neo-btn-white" disabled style="width:100%;font-size:10px;">${t("shop.owned")}</button>`;
      if (item.isEquipped) return `<button class="neo-btn neo-btn-white" disabled style="width:100%;font-size:10px;">${t("shop.owned")}</button>`;
      if (throwable) {
        const count = state.throwableInventory[throwable] || 0;
        return `<button class="neo-btn neo-btn-red buy-btn" data-id="${item.id}" data-price="${item.price}" style="width:100%;font-size:12px;">\uD83E\uDE99 ${item.price}${count ? ` · x${state.isRoot ? "∞" : count}` : ""}</button>`;
      }
      return `<button class="neo-btn neo-btn-green buy-btn" data-id="${item.id}" data-price="${item.price}" style="width:100%;font-size:12px;">\uD83E\uDE99 ${item.price}</button>`;
    } else {
      if (item.isConsumable) return `<button class="neo-btn neo-btn-black" disabled style="width:100%;font-size:10px;">${t("shop.consumable")}</button>`;
      if (item.isEquipped) return `<button class="neo-btn neo-btn-white" disabled style="width:100%;font-size:10px;">${t("shop.equipped")}</button>`;
      return `<button class="neo-btn neo-btn-yellow equip-btn" data-id="${item.id}" style="width:100%;font-size:10px;">${t("shop.equip")}</button>`;
    }
  }

  private bindTabEvents(): void {
    const container = this.container!;

    container.querySelector("#shop-tabs")?.addEventListener("click", (e) => {
      const tab = (e.target as HTMLElement).closest(".shop-tab") as HTMLElement;
      if (!tab) return;
      this.mode = tab.dataset.tab as "shop" | "inventory";
      container.querySelectorAll(".shop-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      audio.playClick();
      this.renderGrid(container);
    });

    container.querySelector("#btn-back-shop")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });

    container.querySelector("#btn-open-lootbox")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#lootbox");
    });

    container.querySelector("#btn-open-gacha")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#gacha");
    });

    container.querySelector("#btn-redeem")?.addEventListener("click", async () => {
      const input = container.querySelector("#redeem-code") as HTMLInputElement;
      const button = container.querySelector("#btn-redeem") as HTMLButtonElement;
      const code = input.value.trim();
      if (!code) return;
      if (!state.authToken) {
        Toast.show(t("shop.redeemLoginRequired"));
        audio.playClick();
        router.navigate("#login");
        return;
      }
      try {
        button.disabled = true;
        const data = await api.redeemCode(code);
        if (data.success) {
          const coinsEl = container.querySelector("#shop-coins")!;
          state.update({ coins: data.coins ?? state.coins });
          coinsEl.textContent = formatCoins(state);
          Toast.show(this.redeemSuccessMessage(data.reward));
          input.value = "";
          await this.loadItems(container);
        } else {
          Toast.show(this.redeemErrorMessage(data.error));
        }
      } catch (err: any) {
        Toast.show(this.redeemErrorMessage(err?.message));
      } finally {
        button.disabled = false;
      }
      audio.playClick();
    });
  }

  private redeemErrorMessage(error?: string): string {
    const key = String(error || "").trim().toUpperCase().replace(/\s+/g, "_");
    const map: Record<string, string> = {
      LOGIN_REQUIRED: t("shop.redeemLoginRequired"),
      CODE_REQUIRED: t("shop.redeemCodeRequired"),
      INVALID_CODE: t("shop.invalidCode"),
      CODE_DISABLED: t("shop.redeemDisabled"),
      CODE_EXPIRED: t("shop.redeemExpired"),
      CODE_EXHAUSTED: t("shop.redeemExhausted"),
      ALREADY_REDEEMED: t("shop.redeemAlreadyUsed"),
    };
    return map[key] || t("shop.invalidCode");
  }

  private redeemSuccessMessage(reward?: RedeemReward): string {
    const lang = state.settings.language === "zh" ? "zh" : "en";
    const coins = Number(reward?.coins || 0);
    const itemId = reward?.itemId ? String(reward.itemId) : "";
    const quantity = Number(reward?.quantity || 0);
    const parts: string[] = [];
    if (coins > 0) parts.push(lang === "zh" ? `${coins.toLocaleString()} 金币` : `${coins.toLocaleString()} coins`);
    if (itemId && quantity > 0) {
      const itemName = this.rewardItemName(itemId, lang);
      parts.push(lang === "zh" ? `${itemName} x${quantity}` : `${itemName} x${quantity}`);
    }
    if (!parts.length) return t("shop.redeemSuccess");
    return lang === "zh" ? `兑换成功：获得 ${parts.join(" + ")}` : `Redeemed: ${parts.join(" + ")}`;
  }

  private rewardItemName(itemId: string, lang: "zh" | "en"): string {
    const accessory = parseAccessoryItemId(itemId);
    if (accessory) {
      const item = getAccessory(accessory.id);
      const color = getAccessoryColor(accessory.color);
      return lang === "zh" ? `${item.nameZh}（${color.nameZh}）` : `${item.nameEn} (${color.nameEn})`;
    }
    const throwable = parseThrowableItemId(itemId);
    if (throwable) {
      const item = getThrowable(throwable);
      return lang === "zh" ? item.nameZh : item.nameEn;
    }
    const titleId = parseTitleItemId(itemId);
    if (titleId) {
      const title = getTitle(titleId, state.customTitles);
      if (title.id === titleId) return lang === "zh" ? title.nameZh : title.nameEn;
    }
    const shopItem = this.items.find((item) => item.id === itemId);
    return shopItem?.name || itemId;
  }

  private bindItemEvents(container: HTMLElement): void {
    container.querySelectorAll(".buy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = (btn as HTMLElement).dataset.id!;
        const price = parseInt((btn as HTMLElement).dataset.price!);
        audio.playClick();
        const result = await api.buyItem(id, price);
        if (result.success) {
          const coinsEl = container.querySelector("#shop-coins")!;
          coinsEl.textContent = formatCoins(state);
          Toast.show(t("shop.buySuccess"));
          await this.loadItems(container);
        } else {
          Toast.show(t("shop.noCoins"));
        }
      });
    });

    container.querySelectorAll(".equip-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = (btn as HTMLElement).dataset.id!;
        audio.playClick();
        const result = await api.equipItem(id);
        if (result.success) {
          Toast.show(t("shop.equipped"));
          this.renderGrid(container);
        }
      });
    });
  }
}
