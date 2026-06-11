/**
 * 8bit 音效合成器视图 — 移植自 8bit音乐.html
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { audio } from "../core/audio";
import { t, onLangChange } from "../core/i18n";

export class MusicSynthView implements View {
  private isPowered: boolean = false;
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
    container.innerHTML = `
      <div class="neo-panel bg-grid" style="display:flex;flex-direction:column;">
        <!-- 头部 -->
        <div style="padding:30px 40px;display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid var(--color-black);background:var(--color-gray-light);">
          <div style="display:flex;align-items:center;gap:15px;">
            <span style="font-size:38px;">\uD83C\uDFB9</span>
            <h1 style="font-size:32px;margin:0;letter-spacing:-2px;text-shadow:4px 4px 0 var(--color-blue),6px 6px 0 var(--color-black);">${t("synth.title")}</h1>
          </div>
          <button class="power-btn ${this.isPowered ? 'on' : ''}" id="synth-power">${this.isPowered ? t("synth.powerOn") : t("synth.powerOff")}</button>
        </div>

        <!-- 主内容 -->
        <div class="synth-content" id="synth-content" style="flex:1;display:flex;padding:30px 40px;gap:40px;opacity:${this.isPowered ? '1' : '0.4'};pointer-events:${this.isPowered ? 'auto' : 'none'};transition:opacity 0.3s;">
          <!-- SFX 面板 -->
          <div style="flex:1;">
            <div style="font-size:14px;margin-bottom:20px;border-bottom:3px dashed var(--color-gray);padding-bottom:8px;">${t("synth.sfxPanel")}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;" id="sfx-grid">
              ${this.sfxButtons.map(sfx => `
                <button class="sfx-btn" data-freq="${sfx.freq}" data-type="${sfx.type}">
                  <span style="font-size:24px;">${sfx.icon}</span>
                  <span style="font-size:10px;">${sfx.label}</span>
                </button>
              `).join("")}
            </div>
          </div>

          <!-- 旋律面板 -->
          <div style="flex:1;">
            <div style="font-size:14px;margin-bottom:20px;border-bottom:3px dashed var(--color-gray);padding-bottom:8px;">${t("synth.melodyPanel")}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;" id="melody-grid">
              ${this.melodies.map(m => `
                <button class="melody-btn" data-notes="${m.notes}">
                  <span style="font-size:20px;">${m.icon}</span>
                  <span style="font-size:9px;">${m.label}</span>
                </button>
              `).join("")}
            </div>
          </div>
        </div>

        <div style="padding:15px 40px 25px;border-top:4px dashed var(--color-gray);">
          <button class="neo-btn neo-btn-white" id="btn-back-music">${t("synth.back")}</button>
        </div>
      </div>

      <style>
        .power-btn {
          background: var(--color-red); color: var(--color-white);
          border: 4px solid var(--color-black); padding: 12px 24px;
          font-family: var(--font-pixel); font-size: 14px; cursor: pointer;
          box-shadow: 6px 6px 0 var(--color-black); transition: all 0.1s;
          animation: pulse 2s infinite;
        }
        .power-btn:active { transform: translate(4px,4px); box-shadow: 2px 2px 0 var(--color-black); }
        .power-btn.on { background: var(--color-green); animation: none; box-shadow: 2px 2px 0 var(--color-black); transform: translate(4px,4px); }

        .sfx-btn, .melody-btn {
          background: var(--color-white); border: 3px solid var(--color-black);
          padding: 16px; cursor: pointer; box-shadow: 4px 4px 0 var(--color-black);
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          transition: all 0.1s; font-family: var(--font-pixel);
        }
        .sfx-btn:hover, .melody-btn:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 var(--color-black); }
        .sfx-btn:active, .melody-btn:active { transform: translate(2px,2px); box-shadow: 2px 2px 0 var(--color-black); background: var(--color-yellow); }
      </style>
    `;
  }

  private get sfxButtons() {
    return [
      { freq: 800, type: "square" as OscillatorType, icon: "\uD83C\uDCCF", label: t("synth.sfx.play") },
      { freq: 400, type: "triangle" as OscillatorType, icon: "\uD83C\uDFB4", label: t("synth.sfx.draw") },
      { freq: 523, type: "square" as OscillatorType, icon: "\uD83D\uDCE2", label: t("synth.sfx.uno") },
      { freq: 200, type: "sawtooth" as OscillatorType, icon: "\uD83D\uDCE6", label: t("synth.sfx.open") },
      { freq: 660, type: "square" as OscillatorType, icon: "\uD83D\uDC46", label: t("synth.sfx.click") },
      { freq: 1000, type: "square" as OscillatorType, icon: "\u2705", label: t("synth.sfx.success") },
      { freq: 300, type: "triangle" as OscillatorType, icon: "\u274C", label: t("synth.sfx.fail") },
      { freq: 500, type: "sine" as OscillatorType, icon: "\uD83D\uDD14", label: t("synth.sfx.hint") },
    ];
  }

  private get melodies() {
    return [
      { notes: "523,659,784,1047", icon: "\uD83C\uDFC6", label: t("synth.melody.win") },
      { notes: "400,350,300,250", icon: "\uD83D\uDC80", label: t("synth.melody.lose") },
      { notes: "262,294,330,349,392,440,494,523", icon: "\uD83C\uDFB5", label: t("synth.melody.scale") },
      { notes: "523,523,784,784,880,880,784", icon: "\u2B50", label: t("synth.melody.star") },
    ];
  }

  private bindEvents(): void {
    const container = this.container!;
    const powerBtn = container.querySelector("#synth-power") as HTMLElement;
    const content = container.querySelector("#synth-content") as HTMLElement;

    powerBtn?.addEventListener("click", () => {
      this.isPowered = !this.isPowered;
      if (this.isPowered) {
        audio.powerOn();
        powerBtn.textContent = t("synth.powerOn");
        powerBtn.classList.add("on");
        content.style.opacity = "1";
        content.style.pointerEvents = "auto";
      } else {
        audio.powerOff();
        powerBtn.textContent = t("synth.powerOff");
        powerBtn.classList.remove("on");
        content.style.opacity = "0.4";
        content.style.pointerEvents = "none";
      }
    });

    // SFX 按钮
    container.querySelectorAll(".sfx-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const freq = parseInt((btn as HTMLElement).dataset.freq!);
        const type = (btn as HTMLElement).dataset.type as OscillatorType;
        audio.playTone(freq, 0.2, type, 0.3);
      });
    });

    // 旋律按钮
    container.querySelectorAll(".melody-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const notes = (btn as HTMLElement).dataset.notes!.split(",").map(Number);
        notes.forEach((freq, i) => {
          setTimeout(() => audio.playTone(freq, 0.2, "square", 0.2), i * 150);
        });
      });
    });

    container.querySelector("#btn-back-music")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });
  }
}
