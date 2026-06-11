/**
 * 可复用加载过渡组件 — Web Component <app-loading>
 * 移植自 加载界面.html
 */

import { t } from "../core/i18n";

export class AppLoading extends HTMLElement {
  private barEl!: HTMLElement;
  private percentEl!: HTMLElement;
  private jokeEl!: HTMLElement;
  private dotsEl!: HTMLElement;

  private jokes: string[] = [];
  private jokeIndex: number = 0;
  private jokeTimer: number = 0;
  private progressTimer: number = 0;
  private onComplete: (() => void) | null = null;

  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    clearInterval(this.jokeTimer);
    clearTimeout(this.progressTimer);
  }

  private render(): void {
    this.innerHTML = `
      <div class="neo-panel bg-grid" style="display:flex;flex-direction:column;justify-content:center;align-items:center;">
        <!-- 四色方块旋转器 -->
        <div style="width:80px;height:80px;position:relative;animation:spin 2s linear infinite;margin-bottom:40px;">
          <div style="position:absolute;top:0;left:0;width:32px;height:32px;background:var(--color-red);border:4px solid var(--color-black);box-shadow:2px 2px 0 var(--color-black);animation:pulse 1s ease-in-out infinite alternate;"></div>
          <div style="position:absolute;top:0;right:0;width:32px;height:32px;background:var(--color-blue);border:4px solid var(--color-black);box-shadow:2px 2px 0 var(--color-black);animation:pulse 1s ease-in-out 0.2s infinite alternate;"></div>
          <div style="position:absolute;bottom:0;right:0;width:32px;height:32px;background:var(--color-green);border:4px solid var(--color-black);box-shadow:2px 2px 0 var(--color-black);animation:pulse 1s ease-in-out 0.4s infinite alternate;"></div>
          <div style="position:absolute;bottom:0;left:0;width:32px;height:32px;background:var(--color-yellow);border:4px solid var(--color-black);box-shadow:2px 2px 0 var(--color-black);animation:pulse 1s ease-in-out 0.6s infinite alternate;"></div>
        </div>

        <h1 style="font-size:48px;font-weight:bold;color:var(--color-black);text-shadow:4px 4px 0 var(--color-gray);margin:0 0 10px;display:flex;align-items:center;letter-spacing:4px;">
          ${t("loading.title")}<span class="loading-dots"></span>
        </h1>

        <div style="width:600px;height:48px;background:var(--color-gray-mid);border:4px solid var(--color-black);box-shadow:8px 8px 0 var(--color-black);margin-top:40px;position:relative;padding:4px;">
          <span class="loading-percent" style="position:absolute;top:-35px;right:0;font-size:20px;font-weight:bold;">0%</span>
          <div class="loading-bar-fill" style="height:100%;background:var(--color-green);width:0%;transition:width 0.3s ease-out;background-image:repeating-linear-gradient(-45deg,transparent,transparent 10px,rgba(0,0,0,0.1) 10px,rgba(0,0,0,0.1) 20px);border:2px solid var(--color-black);"></div>
        </div>

        <div class="loading-joke" style="margin-top:25px;font-size:14px;color:#4A5568;font-weight:bold;letter-spacing:1px;min-height:20px;transition:opacity 0.2s;">${t("loading.initSystem")}</div>
      </div>
    `;

    this.barEl = this.querySelector(".loading-bar-fill")!;
    this.percentEl = this.querySelector(".loading-percent")!;
    this.jokeEl = this.querySelector(".loading-joke")!;
    this.dotsEl = this.querySelector(".loading-dots")!;
  }

  /** 开始加载动画 */
  start(onComplete?: () => void): void {
    this.onComplete = onComplete || null;

    // 刷新笑话列表
    this.jokes = [
      t("loading.joke1"),
      t("loading.joke2"),
      t("loading.joke3"),
      t("loading.joke4"),
      t("loading.joke5"),
      t("loading.joke6"),
      t("loading.joke7"),
      t("loading.joke8"),
      t("loading.joke9"),
      t("loading.joke10"),
    ];

    // 闪烁省略号
    let dotCount = 0;
    this.jokeTimer = window.setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      this.dotsEl!.textContent = ".".repeat(dotCount);
    }, 400);

    // 笑话轮播
    window.setInterval(() => {
      this.jokeEl!.style.opacity = "0";
      setTimeout(() => {
        this.jokeIndex = (this.jokeIndex + 1) % this.jokes.length;
        this.jokeEl!.textContent = this.jokes[this.jokeIndex];
        this.jokeEl!.style.opacity = "1";
      }, 200);
    }, 2500);

    // 进度条模拟
    this.simulateProgress();
  }

  private simulateProgress(): void {
    let progress = 0;
    const tick = () => {
      const increment = Math.random() * 8 + 1;
      progress += increment;

      if (progress > 95 && progress < 99.9) {
        progress = 99;
      }
      if (progress > 100) progress = 100;

      this.barEl.style.width = progress + "%";
      this.percentEl.textContent =
        (progress === 99 ? "99" : Math.floor(progress)) + "%";

      if (progress < 100) {
        const nextTick = progress === 99 ? 3000 : Math.random() * 500 + 100;
        this.progressTimer = window.setTimeout(tick, nextTick);
      } else {
        clearInterval(this.jokeTimer);
        this.jokeEl.textContent = t("loading.done");
        this.jokeEl.style.color = "var(--color-green)";
        if (this.onComplete) {
          setTimeout(this.onComplete, 800);
        }
      }
    };
    this.progressTimer = window.setTimeout(tick, 500);
  }
}

if (!customElements.get("app-loading")) {
  customElements.define("app-loading", AppLoading);
}
