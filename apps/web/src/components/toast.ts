/**
 * 全局 Toast 通知单例
 */

class ToastManager {
  private el: HTMLElement | null = null;
  private timer: number = 0;

  /** 显示一条 Toast */
  show(message: string, duration: number = 2000): void {
    this.hide();

    this.el = document.createElement("div");
    this.el.className = "neo-toast";
    this.el.textContent = message;
    document.body.appendChild(this.el);

    this.timer = window.setTimeout(() => this.hide(), duration);
  }

  /** 隐藏 Toast */
  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}

export const Toast = new ToastManager();
