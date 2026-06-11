/**
 * 设置视图 — 移植自 设置.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { state } from "../core/state";
import { audio } from "../core/audio";
import { t, onLangChange } from "../core/i18n";

export class SettingsView implements View {
  private container: HTMLElement | null = null;
  private unsubLang: (() => void) | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
    this.bindEvents();

    this.unsubLang = onLangChange(() => {
      this.render();
      this.bindEvents();
    });
  }

  unmount(): void {
    this.unsubLang?.();
    this.container = null;
  }

  private render(): void {
    const container = this.container!;
    const s = state.settings;
    container.innerHTML = `
      <div class="neo-panel bg-grid" style="display:flex;justify-content:center;align-items:center;">
        <div class="settings-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;margin-top:10px;">
            <h2 style="font-size:24px;text-shadow:3px 3px 0 #E2E8F0;margin:0;">${t("settings.title")}</h2>
            <button class="neo-btn neo-btn-white" id="btn-close-settings" style="padding:8px 16px;font-size:10px;">${t("common.close")}</button>
          </div>

          <div class="section-title">${t("settings.audio")}</div>
          <div class="setting-row">
            <span class="setting-label">${t("settings.bgmVolume")}</span>
            <div class="slider-group">
              <input type="range" id="bgmVolume" min="0" max="100" value="${s.bgmVolume}">
              <span class="val-display" id="bgm-val">${s.bgmVolume}</span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">${t("settings.sfxVolume")}</span>
            <div class="slider-group">
              <input type="range" id="sfxVolume" min="0" max="100" value="${s.sfxVolume}">
              <span class="val-display" id="sfx-val">${s.sfxVolume}</span>
            </div>
          </div>

          <div class="section-title">${t("settings.languageSection")}</div>
          <div class="setting-row">
            <span class="setting-label">${t("settings.uiLang")}</span>
            <div class="toggle-group" id="lang-toggle">
              <button class="toggle-btn ${s.language === 'zh' ? 'active' : ''}" data-lang="zh">中文</button>
              <button class="toggle-btn ${s.language === 'en' ? 'active' : ''}" data-lang="en">ENG</button>
            </div>
          </div>

          <div class="section-title">${t("settings.network")}</div>
          <div class="ping-monitor">
            <div class="ping-dot" style="width:12px;height:12px;background:var(--color-green);border:2px solid var(--color-black);"></div>
            <span id="ping-val">${t("settings.ping")} 24ms</span>
          </div>

          <div style="display:flex;gap:15px;margin-top:30px;">
            <button class="neo-btn neo-btn-green" id="btn-save-settings" style="flex:1;">${t("settings.save")}</button>
            <button class="neo-btn neo-btn-red" id="btn-reset-settings" style="flex:1;">${t("settings.reset")}</button>
          </div>
        </div>
      </div>

      <style>
        .settings-card {
          background: var(--color-white);
          border: 4px solid var(--color-black);
          box-shadow: 12px 12px 0 var(--color-red);
          width: 540px;
          padding: 30px 40px;
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
        }
        .settings-card::before {
          content: ''; position: absolute;
          top: 0; left: 0; width: 100%; height: 10px;
          background: repeating-linear-gradient(45deg, var(--color-yellow), var(--color-yellow) 10px, var(--color-black) 10px, var(--color-black) 20px);
          border-bottom: 4px solid var(--color-black);
        }
        .section-title {
          font-size: 12px; color: var(--color-gray-text);
          margin: 20px 0 15px;
          border-bottom: 3px dashed var(--color-gray);
          padding-bottom: 5px;
        }
        .setting-row {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
        }
        .setting-label {
          font-family: var(--font-ui); font-weight: bold; font-size: 16px;
        }
        .slider-group { display: flex; align-items: center; gap: 15px; width: 250px; }
        .val-display { width: 45px; font-size: 10px; text-align: right; }
        input[type=range] {
          -webkit-appearance: none; width: 100%; background: transparent;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%; height: 14px; cursor: pointer;
          background: var(--color-gray-mid); border: 3px solid var(--color-black);
          box-shadow: inset 2px 2px 0 rgba(0,0,0,0.1);
        }
        input[type=range]::-webkit-slider-thumb {
          height: 26px; width: 16px; border: 3px solid var(--color-black);
          cursor: pointer; -webkit-appearance: none; margin-top: -9px;
          box-shadow: 2px 2px 0 var(--color-black); transition: transform 0.1s;
        }
        #bgmVolume::-webkit-slider-thumb { background: var(--color-blue); }
        #sfxVolume::-webkit-slider-thumb { background: var(--color-green); }
        .toggle-group {
          display: flex; border: 3px solid var(--color-black); box-shadow: 4px 4px 0 var(--color-black);
        }
        .toggle-btn {
          padding: 8px 16px; font-family: var(--font-pixel); font-size: 10px;
          border: none; background: var(--color-white); cursor: pointer;
          transition: all 0.1s; border-right: 3px solid var(--color-black);
        }
        .toggle-btn:last-child { border-right: none; }
        .toggle-btn.active { background: var(--color-yellow); box-shadow: inset 3px 3px 0 rgba(0,0,0,0.15); }
        .ping-monitor {
          background: var(--color-black); color: var(--color-white);
          padding: 8px 12px; border: 3px solid var(--color-black);
          box-shadow: 4px 4px 0 var(--color-gray);
          font-size: 10px; display: flex; align-items: center; gap: 10px;
        }
      </style>
    `;
  }

  private bindEvents(): void {
    const container = this.container!;
    const bgmSlider = container.querySelector("#bgmVolume") as HTMLInputElement;
    const sfxSlider = container.querySelector("#sfxVolume") as HTMLInputElement;
    const bgmVal = container.querySelector("#bgm-val")!;
    const sfxVal = container.querySelector("#sfx-val")!;

    bgmSlider?.addEventListener("input", () => {
      bgmVal.textContent = bgmSlider.value;
      audio.setBgmVolume(parseInt(bgmSlider.value));
    });

    sfxSlider?.addEventListener("input", () => {
      sfxVal.textContent = sfxSlider.value;
      audio.setSfxVolume(parseInt(sfxSlider.value));
      audio.playClick();
    });

    // 语言切换
    container.querySelector("#lang-toggle")?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const lang = (btn as HTMLElement).dataset.lang as "zh" | "en";
      container.querySelectorAll("#lang-toggle .toggle-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.update({ settings: { ...state.settings, language: lang } });
      audio.playClick();
    });

    container.querySelector("#btn-save-settings")?.addEventListener("click", () => {
      state.update({
        settings: {
          ...state.settings,
          bgmVolume: parseInt(bgmSlider.value),
          sfxVolume: parseInt(sfxSlider.value),
        },
      });
      audio.playClick();
      router.navigate("#home");
    });

    container.querySelector("#btn-reset-settings")?.addEventListener("click", () => {
      bgmSlider.value = "80";
      sfxSlider.value = "100";
      bgmVal.textContent = "80";
      sfxVal.textContent = "100";
      audio.setBgmVolume(80);
      audio.setSfxVolume(100);
      state.update({
        settings: { bgmVolume: 80, sfxVolume: 100, language: "zh", fullscreen: false },
      });
      audio.playClick();
    });

    container.querySelector("#btn-close-settings")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });
  }
}
