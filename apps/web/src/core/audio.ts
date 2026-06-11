/**
 * 全局音频管理器 (Web Audio API)
 * 移植自 8bit音乐.html 的音效合成逻辑
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isPowered: boolean = false;

  /** 获取或创建 AudioContext */
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.5;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.connect(this.masterGain);
      this.bgmGain.gain.value = 0.8;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = 1.0;
    }
    return this.ctx;
  }

  /** 开机 */
  powerOn(): void {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    this.isPowered = true;
    console.log("[Audio] Powered ON");
  }

  /** 关机 */
  powerOff(): void {
    this.isPowered = false;
    console.log("[Audio] Powered OFF");
  }

  get powered(): boolean {
    return this.isPowered;
  }

  /** 播放一个 8-bit 音效 */
  playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "square",
    volume: number = 0.3
  ): void {
    if (!this.isPowered) return;
    const ctx = this.getCtx();
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  /** 播放卡牌放置音效 */
  playCardPlace(): void {
    this.playTone(800, 0.08, "square", 0.15);
    setTimeout(() => this.playTone(1000, 0.06, "square", 0.1), 50);
  }

  /** 播放抽卡音效 */
  playDrawCard(): void {
    this.playTone(400, 0.1, "triangle", 0.12);
  }

  /** 播放 UNO 音效 */
  playUno(): void {
    this.playTone(523, 0.15, "square", 0.2);
    setTimeout(() => this.playTone(659, 0.15, "square", 0.2), 150);
    setTimeout(() => this.playTone(784, 0.3, "square", 0.25), 300);
  }

  /** 播放胜利音效 */
  playWin(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, "square", 0.2), i * 150);
    });
  }

  /** 播放失败音效 */
  playLose(): void {
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.25, "triangle", 0.15), i * 200);
    });
  }

  /** 播放开箱音效 */
  playLootbox(): void {
    this.playTone(200, 0.3, "sawtooth", 0.1);
    setTimeout(() => this.playTone(600, 0.15, "square", 0.15), 150);
    setTimeout(() => this.playTone(1200, 0.4, "square", 0.2), 300);
  }

  /** 播放按钮点击音效 */
  playClick(): void {
    this.playTone(660, 0.05, "square", 0.08);
  }

  /** 设置 BGM 音量 */
  setBgmVolume(value: number): void {
    if (this.bgmGain) {
      this.bgmGain.gain.value = value / 100;
    }
  }

  /** 设置 SFX 音量 */
  setSfxVolume(value: number): void {
    if (this.sfxGain) {
      this.sfxGain.gain.value = value / 100;
    }
  }
}

/** 全局音频单例 */
export const audio = new AudioManager();
