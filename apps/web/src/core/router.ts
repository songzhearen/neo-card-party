/**
 * Hash SPA 路由系统
 * 每个视图实现 View 接口，通过 hash 切换
 */

export interface View {
  mount(container: HTMLElement): void;
  unmount(): void;
}

interface RouteEntry {
  view: View;
  container: HTMLElement;
}

class Router {
  private routes: Map<string, RouteEntry> = new Map();
  private currentHash: string = "";
  private appEl: HTMLElement;

  constructor(appId: string = "app") {
    this.appEl = document.getElementById(appId)!;
    window.addEventListener("hashchange", () => this.handleRoute());
  }

  /** 注册视图 */
  register(hash: string, view: View): void {
    // 为每个视图创建容器
    const container = document.createElement("div");
    container.className = "view-container";
    container.id = "view-" + hash.replace("#", "");
    this.appEl.appendChild(container);

    this.routes.set(hash, { view, container });
  }

  /** 导航到指定 hash */
  navigate(hash: string): void {
    window.location.hash = hash;
  }

  private resolveRouteHash(hash: string): string {
    if (/^#\/room\/[^/?#]+/.test(hash)) return "#waiting";
    return hash;
  }

  /** 处理路由变化 */
  private handleRoute(): void {
    const hash = window.location.hash || "#home";
    const routeHash = this.resolveRouteHash(hash);

    // 隐藏所有视图
    for (const [, entry] of this.routes) {
      entry.container.classList.remove("active");
    }

    // 卸载当前视图
    if (this.currentHash && this.routes.has(this.currentHash)) {
      const entry = this.routes.get(this.currentHash)!;
      entry.view.unmount();
    }

    // 挂载目标视图
    const route = this.routes.get(routeHash);
    if (route) {
      route.container.classList.add("active");
      route.view.mount(route.container);
      this.currentHash = routeHash;
    } else {
      // fallback to home
      this.navigate("#home");
    }
  }

  /** 启动路由 */
  start(): void {
    if (!window.location.hash) {
      window.location.hash = "#home";
    } else {
      this.handleRoute();
    }
  }
}

/** 全局路由单例 */
export const router = new Router("app");
