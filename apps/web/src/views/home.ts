import { View } from "../core/router";
import { router } from "../core/router";
import { audio } from "../core/audio";
import { t } from "../core/i18n";
import { state } from "../core/state";
import { api } from "../core/api";
import { setGameMode } from "./waiting-room";

export class HomeView implements View {
  private refreshingProfile = false;
  private tipTimer: number | null = null;

  mount(container: HTMLElement): void {
    this.render(container);
    this.startTipRotation(container);
    void this.refreshProfile(container);
  }

  private accountLabel(): string {
    if (!state.authToken) return t("login.submit");
    return state.playerName || state.accountName || t("home.profile");
  }

  private tips(): string[] {
    if (state.settings.language === "en") {
      return [
        "TIP: Replacing the server potato...",
        "TIP: Praying to the cyber deity...",
        "TIP: Convincing the deck this is totally fair...",
        "TIP: Drawing cards is not surrender. It is research.",
        "TIP: Friendship is temporary. Reverse cards are forever.",
        "TIP: The discard pile has seen things.",
        "TIP: Official rules say no +4 stacking. The table has opinions.",
        "TIP: Your next mistake is being pre-rendered.",
        "TIP: Shuffling the deck with suspicious confidence...",
        "TIP: Loading the friendship stress test...",
        "TIP: The server does not hate you. The deck might.",
        "TIP: If you do not know what to play, neither does destiny.",
      ];
    }
    return [
      "TIP: 正在更换新鲜土豆...",
      "TIP: 正在祈祷赛博佛祖...",
      "TIP: 正在说服牌堆保持公平...",
      "TIP: 摸牌不是逃避，是战略性撤退。",
      "TIP: 友谊是暂时的，反转牌是永恒的。",
      "TIP: 弃牌堆已经看淡了一切。",
      "TIP: 冷知识：官方规则不允许 +4 叠加，但牌桌有自己的想法。",
      "TIP: 正在预渲染你的下一次失误...",
      "TIP: 正在用迷之自信洗牌...",
      "TIP: 正在加载友情压力测试...",
      "TIP: 服务器没有针对你，牌堆可能有。",
      "TIP: 如果你不知道出什么，命运也不知道。",
    ];
  }

  private randomTip(): string {
    const tips = this.tips();
    return tips[Math.floor(Math.random() * tips.length)] || t("home.subtitle");
  }

  private render(container: HTMLElement): void {
    container.innerHTML = `
      <div class="neo-panel home-pop-grid" style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:54px 0 42px;">
        <div class="home-pop-block block-red"></div>
        <div class="home-pop-block block-blue"></div>
        <div class="home-pop-block block-yellow"></div>

        <div class="home-topbar">
          <button class="home-account-btn home-btn-pink" id="btn-account" type="button">
            <span>@</span>
            <strong>${this.accountLabel()}</strong>
          </button>
          <div class="home-toolbox">
            <button class="home-icon-btn home-btn-white" id="btn-mail" type="button" aria-label="邮箱" title="邮箱"><span>M</span></button>
            <button class="home-icon-btn home-btn-white" id="btn-settings" type="button" aria-label="${t("nav.settings")}" title="${t("nav.settings")}"><span>*</span></button>
          </div>
        </div>

        <div style="text-align:center;z-index:10;">
          <h1 class="home-title" style="font-size:72px;color:var(--color-black);letter-spacing:0;text-shadow:6px 6px 0 var(--color-red),12px 12px 0 var(--color-blue);margin:0;font-family:var(--font-pixel);">CARD PARTY</h1>
          <div class="home-subtitle" id="home-tip">${this.randomTip()}</div>
        </div>

        <div class="home-card-stage" style="position:relative;width:400px;height:190px;display:flex;justify-content:center;align-items:center;margin-top:-8px;z-index:5;">
          <div class="home-card" id="home-card-1" style="position:absolute;transform:rotate(-15deg) translateX(-90px);z-index:1;">
            <div class="card-front c-red">
              <div class="card-value">7</div>
              <div class="card-symbol-mini top-left">7</div>
              <div class="card-symbol-mini bottom-right">7</div>
            </div>
          </div>
          <div class="home-card" id="home-card-2" style="position:absolute;transform:rotate(-5deg) translateX(-30px);z-index:2;">
            <div class="card-front c-blu">
              <div class="card-value" style="font-size:40px;">\u21C4</div>
              <div class="card-symbol-mini top-left">\u21C4</div>
              <div class="card-symbol-mini bottom-right">\u21C4</div>
            </div>
          </div>
          <div class="home-card" id="home-card-3" style="position:absolute;transform:rotate(5deg) translateX(30px);z-index:3;">
            <div class="card-front c-grn">
              <div class="card-value" style="font-size:32px;">+2</div>
              <div class="card-symbol-mini top-left">+2</div>
              <div class="card-symbol-mini bottom-right">+2</div>
            </div>
          </div>
          <div class="home-card" id="home-card-4" style="position:absolute;transform:rotate(15deg) translateX(90px);z-index:4;">
            <div class="card-front c-wild">
              <div class="card-value" style="font-size:48px;">W</div>
              <div class="card-symbol-mini top-left">W</div>
              <div class="card-symbol-mini bottom-right">W</div>
            </div>
          </div>
        </div>

        <div class="home-menu-grid">
          <button class="home-menu-btn home-main-btn home-btn-red" id="btn-start"><span>\u25B6</span>${t("home.startGame")}</button>
          <button class="home-menu-btn home-main-btn home-btn-blue" id="btn-lobby"><span>#</span>${t("home.lobby")}</button>
          <div class="home-bottom-row">
            <button class="home-menu-btn home-btn-yellow" id="btn-shop"><span>$</span>${t("nav.shop")}</button>
            <button class="home-menu-btn home-btn-blue" id="btn-friends"><span>F</span>好友</button>
            <button class="home-menu-btn home-btn-green" id="btn-leaderboard"><span>1</span>${t("leaderboard.title")}</button>
          </div>
        </div>
      </div>

      <style>
        .home-pop-grid {
          overflow: hidden;
          background-color: var(--color-white);
          background-image:
            radial-gradient(circle, rgba(255, 42, 95, 0.38) 0 4px, transparent 4px),
            radial-gradient(circle, rgba(0, 119, 255, 0.28) 0 3px, transparent 3px),
            linear-gradient(var(--color-gray-light) 2px, transparent 2px),
            linear-gradient(90deg, var(--color-gray-light) 2px, transparent 2px);
          background-position: 0 0, 14px 14px, 0 0, 0 0;
          background-size: 28px 28px, 28px 28px, 20px 20px, 20px 20px;
        }
        .home-pop-block {
          position: absolute;
          border: 4px solid var(--color-black);
          box-shadow: 6px 6px 0 var(--color-black);
          z-index: 0;
          pointer-events: none;
        }
        .block-red { width: 150px; height: 84px; left: 58px; top: 88px; background: var(--color-red); transform: rotate(-8deg); }
        .block-blue { width: 130px; height: 130px; right: 70px; top: 116px; background: var(--color-blue); transform: rotate(10deg); }
        .block-yellow { width: 190px; height: 58px; right: 170px; bottom: 58px; background: var(--color-yellow); transform: rotate(-3deg); }

        .home-topbar {
          position: absolute;
          top: 18px;
          left: 18px;
          right: 18px;
          z-index: 30;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          pointer-events: none;
        }
        .home-account-btn,
        .home-icon-btn {
          pointer-events: auto;
          border: 4px solid var(--color-black);
          box-shadow: 5px 5px 0 var(--color-black);
          cursor: pointer;
          font-family: var(--font-pixel);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .home-account-btn {
          min-height: 46px;
          max-width: min(360px, calc(100vw - 150px));
          padding: 8px 12px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--color-white);
          font-size: 11px;
          line-height: 1.2;
        }
        .home-account-btn strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: 0;
        }
        .home-toolbox {
          display: flex;
          gap: 10px;
        }
        .home-icon-btn {
          width: 48px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--color-black);
        }
        .home-account-btn span,
        .home-icon-btn span {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--color-white);
          color: var(--color-black);
          border: 3px solid var(--color-black);
          box-shadow: 2px 2px 0 var(--color-black);
          flex: 0 0 auto;
        }
        .home-account-btn:hover,
        .home-icon-btn:hover {
          transform: translate(-2px, -2px);
          box-shadow: 7px 7px 0 var(--color-black);
        }
        .home-account-btn:active,
        .home-icon-btn:active {
          transform: translate(3px, 3px);
          box-shadow: 2px 2px 0 var(--color-black);
        }

        .home-card {
          width: 102px;
          height: 150px;
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease;
          cursor: pointer;
          transform-style: preserve-3d;
          animation: homeFloat 4s ease-in-out infinite alternate;
        }
        #home-card-1 { animation-delay: 0s; }
        #home-card-2 { animation-delay: 0.5s; }
        #home-card-3 { animation-delay: 1s; }
        #home-card-4 { animation-delay: 1.5s; }

        @keyframes homeFloat {
          0% { margin-top: 0px; }
          100% { margin-top: -15px; }
        }

        .home-card:hover {
          transform: translateY(-20px) scale(1.15) !important;
          z-index: 999 !important;
          filter: drop-shadow(0 15px 0px rgba(0,0,0,0.15));
          animation-play-state: paused;
        }

        .card-front {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: var(--color-white);
          border-radius: 8px;
          border: 4px solid var(--color-black);
          box-shadow: 4px 4px 0 rgba(0,0,0,0.05);
        }

        .c-red { color: var(--color-red); border-color: var(--color-red); }
        .c-blu { color: var(--color-blue); border-color: var(--color-blue); }
        .c-grn { color: var(--color-green); border-color: var(--color-green); }
        .c-wild {
          color: var(--color-black);
          border-image: linear-gradient(45deg, var(--color-red), var(--color-blue), var(--color-green), var(--color-yellow)) 4;
        }

        .card-value {
          font-size: 56px;
          font-family: var(--font-pixel);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .card-symbol-mini {
          font-size: 14px;
          position: absolute;
          font-weight: bold;
          font-family: var(--font-pixel);
        }
        .top-left { top: 8px; left: 8px; }
        .bottom-right { bottom: 8px; right: 8px; transform: rotate(180deg); }

        .home-menu-grid {
          width: min(760px, calc(100% - 80px));
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          z-index: 20;
        }
        .home-menu-btn {
          min-height: 56px;
          padding: 12px 14px;
          border: 4px solid var(--color-black);
          box-shadow: 6px 6px 0 var(--color-black);
          color: var(--color-white);
          cursor: pointer;
          font-family: var(--font-pixel);
          font-size: 12px;
          line-height: 1.25;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-align: center;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .home-main-btn {
          width: 100%;
          min-height: 64px;
        }
        .home-bottom-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }
        .home-menu-btn span {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--color-white);
          color: var(--color-black);
          border: 3px solid var(--color-black);
          box-shadow: 2px 2px 0 var(--color-black);
          flex: 0 0 auto;
        }
        .home-menu-btn:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0 var(--color-black); }
        .home-menu-btn:active { transform: translate(3px, 3px); box-shadow: 3px 3px 0 var(--color-black); }
        .home-btn-red { background: var(--color-red); }
        .home-btn-blue { background: var(--color-blue); }
        .home-btn-yellow { background: var(--color-yellow); color: var(--color-black); }
        .home-btn-green { background: var(--color-green); }
        .home-btn-pink { background: var(--color-pink); }
        .home-btn-white { background: var(--color-white); color: var(--color-black); }
        .home-subtitle {
          margin-top:15px;
          max-width:min(720px, calc(100vw - 48px));
          min-height:36px;
          color:var(--color-gray-text);
          font-size:14px;
          font-weight:bold;
          letter-spacing:0;
          line-height:1.45;
          background:var(--color-white);
          border:3px solid var(--color-black);
          box-shadow:4px 4px 0 var(--color-yellow);
          padding:6px 12px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          overflow-wrap:anywhere;
        }

        @media (max-width: 760px), (max-height: 620px) {
          .home-pop-grid {
            padding: 76px 14px 24px !important;
            min-height: calc(100dvh - 16px);
          }
          .home-topbar {
            top: 12px;
            left: 12px;
            right: 12px;
          }
          .home-account-btn {
            max-width: calc(100vw - 128px);
            min-height: 42px;
            padding: 7px 10px;
            font-size: 10px;
          }
          .home-icon-btn {
            width: 42px;
            height: 42px;
          }
          .home-title {
            font-size: 52px !important;
            letter-spacing: 0 !important;
          }
          .home-subtitle {
            font-size: 11px !important;
            letter-spacing: 1px !important;
          }
          .home-card-stage {
            width: min(340px, 100%) !important;
            height: 156px !important;
            margin-top: 0 !important;
          }
          .home-card {
            width: 84px;
            height: 124px;
          }
          #home-card-1 { transform: rotate(-15deg) translateX(-72px) !important; }
          #home-card-2 { transform: rotate(-5deg) translateX(-24px) !important; }
          #home-card-3 { transform: rotate(5deg) translateX(24px) !important; }
          #home-card-4 { transform: rotate(15deg) translateX(72px) !important; }
          .home-menu-grid {
            width: min(520px, 100%);
          }
          .home-bottom-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .home-menu-btn,
          .home-main-btn {
            min-height: 52px;
            font-size: 11px;
            padding: 10px 12px;
          }
        }
      </style>
    `;

    this.bindEvents(container);
  }

  unmount(): void {
    if (this.tipTimer !== null) {
      window.clearInterval(this.tipTimer);
      this.tipTimer = null;
    }
  }

  private startTipRotation(container: HTMLElement): void {
    if (this.tipTimer !== null) {
      window.clearInterval(this.tipTimer);
      this.tipTimer = null;
    }
    this.tipTimer = window.setInterval(() => {
      if (!container.isConnected) {
        this.unmount();
        return;
      }
      const tip = container.querySelector("#home-tip");
      if (tip) tip.textContent = this.randomTip();
    }, 6000);
  }

  private async refreshProfile(container: HTMLElement): Promise<void> {
    if (!state.authToken || this.refreshingProfile) return;
    this.refreshingProfile = true;
    try {
      await api.refreshProfile();
      await api.refreshInventory();
      if (container.isConnected) this.render(container);
    } catch {
      // Keep the cached profile when the API is temporarily unavailable.
    } finally {
      this.refreshingProfile = false;
    }
  }

  private bindEvents(container: HTMLElement): void {
    container.querySelector("#btn-start")?.addEventListener("click", () => {
      audio.playClick();
      setGameMode("ai", 4);
      router.navigate("#waiting");
    });

    container.querySelector("#btn-lobby")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#lobby");
    });

    container.querySelector("#btn-shop")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#shop");
    });

    container.querySelector("#btn-mail")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#mail");
    });

    container.querySelector("#btn-friends")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#friends");
    });

    container.querySelector("#btn-leaderboard")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#leaderboard");
    });

    container.querySelector("#btn-account")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate(state.authToken ? "#profile" : "#login");
    });

    container.querySelector("#btn-settings")?.addEventListener("click", () => {
      audio.playClick();
      router.navigate("#settings");
    });

    container.querySelectorAll(".home-card").forEach((card) => {
      card.addEventListener("click", () => {
        audio.playClick();
        setGameMode("ai", 4);
        router.navigate("#waiting");
      });
    });
  }
}
