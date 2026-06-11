/**
 * 头像编辑器视图 — 移植自 头像绘制系统.html
 * 8x8 像素网格绘制 + 序列化编码导出
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { state } from "../core/state";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { decodeAvatarCode, encodeAvatarPixels, isAvatarCode, normalizeAvatarCode } from "../core/avatar";

export class AvatarEditorView implements View {
  private pixelData: (string | null)[] = new Array(64).fill(null);
  private currentTool: "brush" | "eraser" = "brush";
  private currentColor: string = "#FF2A5F";
  private isDrawing: boolean = false;
  private container: HTMLElement | null = null;
  private stopDrawing = () => { this.isDrawing = false; };

  mount(container: HTMLElement): void {
    this.container = container;
    this.pixelData = decodeAvatarCode(state.avatar);
    this.render();
    this.initGrid(container);
    this.bindEvents();
    window.addEventListener("mouseup", this.stopDrawing);
  }

  unmount(): void {
    window.removeEventListener("mouseup", this.stopDrawing);
    this.container = null;
  }

  private render(): void {
    const container = this.container!;
    container.innerHTML = `
      <div class="neo-panel" style="display:flex;justify-content:center;align-items:center;background:var(--color-bg);background-image:linear-gradient(#D9E2EC 2px,transparent 2px),linear-gradient(90deg,#D9E2EC 2px,transparent 2px);background-size:30px 30px;">
        <div class="editor-container">
          <!-- 画布区 -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:15px;">
            <div class="pixel-grid" id="pixel-grid" style="display:grid;grid-template-columns:repeat(8,40px);grid-template-rows:repeat(8,40px);border:4px solid var(--color-black);box-shadow:6px 6px 0 var(--color-black);cursor:crosshair;user-select:none;"></div>
            <input type="color" id="editor-color" value="${this.currentColor}" style="-webkit-appearance:none;border:3px solid var(--color-black);width:100%;height:40px;padding:0;cursor:pointer;box-shadow:4px 4px 0 var(--color-black);">
            <div style="display:flex;gap:15px;width:100%;">
              <button class="neo-btn ${this.currentTool === 'brush' ? 'active-tool' : ''}" id="btn-brush" style="flex:1;padding:10px;">${t("avatarEditor.brush")}</button>
              <button class="neo-btn ${this.currentTool === 'eraser' ? 'active-tool' : ''}" id="btn-eraser" style="flex:1;padding:10px;">${t("avatarEditor.eraser")}</button>
              <button class="neo-btn neo-btn-red" id="btn-clear" style="flex:1;padding:10px;">${t("avatarEditor.clear")}</button>
            </div>
          </div>

          <!-- 数据区 -->
          <div style="flex:1;display:flex;flex-direction:column;gap:15px;margin-left:40px;">
            <h2 style="font-family:var(--font-pixel);font-size:16px;margin:0 0 10px;line-height:1.5;">${t("avatarEditor.title")}<br><span style="font-size:10px;color:var(--color-gray-text);font-family:var(--font-ui);">${t("avatarEditor.subtitle")}</span></h2>
            <textarea id="code-output" placeholder="${t("avatarEditor.placeholder")}" style="width:100%;flex:1;resize:none;border:4px solid var(--color-black);background:var(--color-gray-light);padding:15px;font-family:monospace;font-size:14px;line-height:1.5;word-break:break-all;box-shadow:inset 4px 4px 0 rgba(0,0,0,0.05);"></textarea>
            <div style="display:flex;gap:15px;">
              <button class="neo-btn neo-btn-blue" id="btn-import" style="flex:1;">${t("avatarEditor.import")}</button>
              <button class="neo-btn neo-btn-green" id="btn-copy-code" style="flex:1;">${t("avatarEditor.copy")}</button>
            </div>
            <button class="neo-btn neo-btn-yellow" id="btn-save-avatar" style="margin-top:10px;">${t("avatarEditor.save")}</button>
            <button class="neo-btn neo-btn-white" id="btn-back-editor" style="margin-top:10px;">${t("avatarEditor.back")}</button>
          </div>
        </div>
      </div>

      <style>
        .editor-container {
          background: var(--color-white); border: 4px solid var(--color-black);
          box-shadow: 12px 12px 0 var(--color-red); padding: 30px;
          display: flex; gap: 40px; width: 800px;
        }
        .active-tool { background: var(--color-yellow); }
        .pixel-grid { background-color: var(--color-gray-mid); }
        .neo-btn { font-family: var(--font-pixel); border: 3px solid var(--color-black); background: var(--color-white); cursor: pointer; box-shadow: 3px 3px 0 var(--color-black); }
        .neo-btn-red { background: var(--color-red); color: var(--color-white); }
        .neo-btn-blue { background: var(--color-blue); color: var(--color-white); }
        .neo-btn-green { background: var(--color-green); color: var(--color-white); }
        .neo-btn-yellow { background: var(--color-yellow); color: var(--color-black); }
        .neo-btn-white { background: var(--color-white); }
      </style>
    `;
  }

  private initGrid(container: HTMLElement): void {
    const grid = container.querySelector("#pixel-grid")!;
    grid.innerHTML = "";

    for (let i = 0; i < 64; i++) {
      const cell = document.createElement("div");
      cell.style.cssText = `
        width:40px;height:40px;border:1px solid rgba(26,26,26,0.1);
        transition:transform 0.05s;
        background:${this.pixelData[i] || "transparent"};
      `;
      cell.dataset.index = String(i);

      cell.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.isDrawing = true;
        this.paintCell(cell, i);
      });
      cell.addEventListener("mouseenter", () => {
        if (this.isDrawing) this.paintCell(cell, i);
        cell.style.transform = "scale(1.1)";
        cell.style.border = "2px solid var(--color-black)";
        cell.style.zIndex = "10";
      });
      cell.addEventListener("mouseleave", () => {
        cell.style.transform = "";
        cell.style.border = "1px solid rgba(26,26,26,0.1)";
        cell.style.zIndex = "";
      });

      grid.appendChild(cell);
    }

    this.updateCode();
  }

  private paintCell(cell: HTMLElement, index: number): void {
    if (this.currentTool === "brush") {
      this.pixelData[index] = this.currentColor;
      cell.style.background = this.currentColor;
    } else {
      this.pixelData[index] = null;
      cell.style.background = "transparent";
    }
    this.updateCode();
  }

  private updateCode(): void {
    const code = encodeAvatarPixels(this.pixelData);
    const codeOutput = this.container?.querySelector("#code-output") as HTMLTextAreaElement | null;
    if (codeOutput) codeOutput.value = code;
  }

  private refreshGrid(): void {
    this.container?.querySelectorAll("#pixel-grid > div").forEach((cell, index) => {
      (cell as HTMLElement).style.background = this.pixelData[index] || "transparent";
    });
  }

  private bindEvents(): void {
    const container = this.container!;

    container.querySelector("#btn-brush")?.addEventListener("click", () => {
      this.currentTool = "brush";
      container.querySelector("#btn-brush")?.classList.add("active-tool");
      container.querySelector("#btn-eraser")?.classList.remove("active-tool");
    });

    container.querySelector("#btn-eraser")?.addEventListener("click", () => {
      this.currentTool = "eraser";
      container.querySelector("#btn-eraser")?.classList.add("active-tool");
      container.querySelector("#btn-brush")?.classList.remove("active-tool");
    });

    container.querySelector("#btn-clear")?.addEventListener("click", () => {
      this.pixelData = new Array(64).fill(null);
      container.querySelectorAll("#pixel-grid > div").forEach((cell) => {
        (cell as HTMLElement).style.background = "transparent";
      });
      this.updateCode();
      audio.playClick();
    });

    container.querySelector("#editor-color")?.addEventListener("input", (e) => {
      this.currentColor = (e.target as HTMLInputElement).value;
    });

    container.querySelector("#btn-copy-code")?.addEventListener("click", () => {
      const codeOutput = container.querySelector("#code-output") as HTMLTextAreaElement;
      navigator.clipboard.writeText(codeOutput.value).then(() => {
        audio.playClick();
      });
    });

    container.querySelector("#btn-import")?.addEventListener("click", () => {
      const codeOutput = container.querySelector("#code-output") as HTMLTextAreaElement;
      const rawCode = codeOutput.value;
      const valid = isAvatarCode(rawCode);
      const normalized = normalizeAvatarCode(rawCode);
      this.pixelData = decodeAvatarCode(normalized);
      this.refreshGrid();
      this.updateCode();
      codeOutput.style.borderColor = valid ? "var(--color-black)" : "var(--color-red)";
      window.setTimeout(() => { codeOutput.style.borderColor = "var(--color-black)"; }, 700);
      audio.playClick();
    });

    container.querySelector("#btn-save-avatar")?.addEventListener("click", async () => {
      const code = normalizeAvatarCode((container.querySelector("#code-output") as HTMLTextAreaElement).value);
      state.update({ avatar: code });
      if (api.isServerAvailable) {
        try { await api.updateProfile({ avatar: code }); } catch { /* offline */ }
      }
      audio.playClick();
      router.navigate("#profile");
    });

    container.querySelector("#btn-back-editor")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#profile");
    });
  }
}
