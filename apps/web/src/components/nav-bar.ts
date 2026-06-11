/**
 * 全局导航栏 — Web Component <app-nav>
 * 显示在页面底部，用于切换视图
 */

import { router } from "../core/router";
import { audio } from "../core/audio";
import { t, onLangChange } from "../core/i18n";

const NAV_HASHES = ["#home", "#lobby", "#game", "#shop", "#profile", "#settings"];
const NAV_ICONS = ["🏠", "🏟️", "🎮", "🛒", "👤", "⚙️"];
const NAV_KEYS = ["nav.home", "nav.lobby", "nav.game", "nav.shop", "nav.profile", "nav.settings"];

export class AppNav extends HTMLElement {
  private unsubLang: (() => void) | null = null;

  constructor() {
    super();
  }

  connectedCallback(): void {
    this.render();
    this.bindEvents();
    this.highlightCurrent();

    window.addEventListener("hashchange", () => this.highlightCurrent());
    this.unsubLang = onLangChange(() => this.render());
  }

  disconnectedCallback(): void {
    this.unsubLang?.();
  }

  private render(): void {
    this.className = "app-nav";
    this.innerHTML = NAV_HASHES.map(
      (hash, i) =>
        `<button class="app-nav-btn" data-hash="${hash}" title="${t(NAV_KEYS[i])}">${NAV_ICONS[i]}</button>`
    ).join("");
    this.bindEvents();
  }

  private bindEvents(): void {
    this.querySelectorAll(".app-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hash = (btn as HTMLElement).dataset.hash!;
        audio.playClick();
        router.navigate(hash);
      });
    });
  }

  private highlightCurrent(): void {
    const currentHash = window.location.hash || "#home";
    this.querySelectorAll(".app-nav-btn").forEach((btn) => {
      const hash = (btn as HTMLElement).dataset.hash;
      if (hash === currentHash) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
}

// 注册 Web Component
if (!customElements.get("app-nav")) {
  customElements.define("app-nav", AppNav);
}
