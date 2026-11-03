import { CONFIG } from '../data/config.js';

class AudioManagerClass {
  constructor() {
    this.ctx = null;
    this.isReady = false;
  }

  init() {
    if (this.isReady) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.isReady = true;
  }

  // Выстрел с задержкой
  playGunshot(x, y, camera, loudness) {
    if (!this.isReady || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Вычисляем расстояние от камеры до выстрела
    const dx = x - camera.x;
    const dy = y - camera.y;
    const dist = Math.hypot(dx, dy);

    // Задержка = расстояние / скорость звука
    const delay = dist / CONFIG.AUDIO.SPEED_OF_SOUND;
    // Затухание (чем дальше, тем тише)
    const volume = Math.min(1, 1.0 / (1 + dist * 0.01)) * (loudness / 1000);

    if (volume < 0.01) return; // Слишком далеко, не слышно

    setTimeout(() => {
      this._synthGunshot(volume, dx > 0 ? 0.5 : -0.5);
    }, delay * 1000);
  }

  _synthGunshot(volume, pan) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(pan, this.ctx.currentTime);
      gain.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
}

export const AudioManager = new AudioManagerClass();
