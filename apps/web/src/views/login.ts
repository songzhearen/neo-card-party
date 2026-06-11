/**
 * 登录 / 注册视图
 */

import { View } from "../core/router";
import { router } from "../core/router";
import { api } from "../core/api";
import { audio } from "../core/audio";
import { t } from "../core/i18n";

type AuthMode = "login" | "register";

export class LoginView implements View {
  private container: HTMLElement | null = null;
  private mode: AuthMode = "login";

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
    const primaryText = this.mode === "login" ? t("login.submit") : t("login.registerSubmit");

    container.innerHTML = `
      <div class="neo-panel bg-grid" style="display:flex;justify-content:center;align-items:center;background-color:var(--color-bg);background-image:linear-gradient(#D9E2EC 2px, transparent 2px),linear-gradient(90deg, #D9E2EC 2px, transparent 2px);background-size:30px 30px;">
        <div class="login-box">
          <div style="text-align:center;margin-bottom:24px;margin-top:10px;">
            <div style="font-size:48px;margin-bottom:15px;animation:float 2s ease-in-out infinite;">\uD83D\uDC7E</div>
            <h1 style="font-size:20px;text-shadow:2px 2px 0 #E2E8F0;">${t("login.title")}</h1>
          </div>

          <div class="auth-mode-tabs" id="auth-mode-tabs">
            <button type="button" class="auth-mode-btn ${this.mode === "login" ? "active" : ""}" data-mode="login">${t("login.loginTab")}</button>
            <button type="button" class="auth-mode-btn ${this.mode === "register" ? "active" : ""}" data-mode="register">${t("login.registerTab")}</button>
          </div>

          <form id="loginForm">
            <div style="margin-bottom:20px;">
              <label style="display:block;font-size:10px;margin-bottom:8px;color:#4A5568;">${t("login.playerId")}</label>
              <input type="text" class="neo-input" id="login-user" placeholder="player_account" autocomplete="username" style="font-family:var(--font-pixel);">
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:10px;margin-bottom:8px;color:#4A5568;">${t("login.secretCode")}</label>
              <input type="password" class="neo-input" id="login-pass" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="${this.mode === "login" ? "current-password" : "new-password"}" style="font-family:var(--font-pixel);">
            </div>
            <div class="auth-message" id="auth-message"></div>
            <button type="submit" class="neo-btn ${this.mode === "login" ? "neo-btn-green" : "neo-btn-yellow"}" id="loginBtn" style="width:100%;padding:16px;font-size:12px;margin-top:22px;">
              <span class="login-btn-text">${primaryText}</span>
              <div class="login-loading-bar"></div>
            </button>
          </form>
          <button class="neo-btn neo-btn-white" id="btn-back-login" style="margin-top:20px;width:100%;">${t("login.back")}</button>
        </div>
      </div>

      <style>
        .login-box {
          background: var(--color-white);
          border: 4px solid var(--color-black);
          box-shadow: 12px 12px 0 var(--color-blue);
          width: 420px;
          padding: 40px 30px;
          position: relative;
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .login-box::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 12px;
          background: repeating-linear-gradient(45deg, var(--color-red), var(--color-red) 10px, var(--color-black) 10px, var(--color-black) 20px);
          border-bottom: 4px solid var(--color-black);
        }
        .auth-mode-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
        }
        .auth-mode-btn {
          border: 3px solid var(--color-black);
          background: var(--color-white);
          box-shadow: 4px 4px 0 var(--color-black);
          font-family: var(--font-pixel);
          font-size: 10px;
          padding: 12px 10px;
          cursor: pointer;
        }
        .auth-mode-btn.active {
          background: var(--color-yellow);
          transform: translate(2px, 2px);
          box-shadow: 2px 2px 0 var(--color-black);
        }
        .auth-message {
          min-height: 18px;
          color: var(--color-red);
          font-family: var(--font-ui);
          font-size: 13px;
          font-weight: bold;
        }
        .auth-diagnostic {
          margin-top: 8px;
          padding: 8px;
          border: 2px solid var(--color-black);
          background: var(--color-gray-light);
          color: var(--color-black);
          font-size: 11px;
          font-weight: 700;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .login-loading-bar {
          position: absolute; top: 0; left: 0; height: 100%; width: 0%;
          background: rgba(255,255,255,0.3); z-index: 1; transition: width 0.2s;
        }
        #loginBtn { position: relative; overflow: hidden; }
      </style>
    `;
  }

  private bindEvents(): void {
    const container = this.container!;
    const form = container.querySelector("#loginForm") as HTMLFormElement;
    const userInput = container.querySelector("#login-user") as HTMLInputElement;
    const passInput = container.querySelector("#login-pass") as HTMLInputElement;
    const loginBtn = container.querySelector("#loginBtn") as HTMLButtonElement;
    const btnText = container.querySelector(".login-btn-text") as HTMLElement;
    const loadingBar = container.querySelector(".login-loading-bar") as HTMLElement;
    const message = container.querySelector("#auth-message") as HTMLElement;

    container.querySelector("#auth-mode-tabs")?.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest(".auth-mode-btn") as HTMLElement | null;
      if (!btn) return;
      this.mode = btn.dataset.mode as AuthMode;
      audio.playClick();
      this.render();
      this.bindEvents();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = userInput.value.trim();
      const password = passInput.value.trim();

      if (!username) {
        message.textContent = t("login.usernameRequired");
        return;
      }
      if (!password) {
        message.textContent = t("login.passwordRequired");
        return;
      }

      loginBtn.disabled = true;
      loginBtn.style.cursor = "not-allowed";
      btnText.textContent = t("login.connecting");
      loadingBar.style.width = "65%";
      message.textContent = "";
      audio.playClick();

      try {
        if (this.mode === "login") {
          await api.login(username, password);
          btnText.textContent = t("login.connected");
        } else {
          await api.register(username, password);
          btnText.textContent = t("login.registered");
        }
        loadingBar.style.width = "100%";
        loginBtn.style.background = "var(--color-blue)";
        setTimeout(() => router.navigate("#home"), 450);
      } catch (err: any) {
        loadingBar.style.width = "0%";
        loginBtn.disabled = false;
        loginBtn.style.cursor = "pointer";
        loginBtn.style.background = "";
        btnText.textContent = this.mode === "login" ? t("login.submit") : t("login.registerSubmit");
        message.textContent = err?.message || t("login.failed");
        try {
          const diagnostic = await api.diagnoseRest();
          message.innerHTML = `
            <div>${err?.message || t("login.failed")}</div>
            <div class="auth-diagnostic">
              API: ${diagnostic.apiBase}<br>
              online: ${String(diagnostic.online)}<br>
              health: ${diagnostic.health}<br>
              no-cors: ${diagnostic.healthNoCors}<br>
              leaderboard: ${diagnostic.leaderboard}
            </div>
          `;
        } catch {
          // Keep the original error if diagnostics also fail.
        }
      }
    });

    container.querySelector("#btn-back-login")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#home");
    });
  }
}
