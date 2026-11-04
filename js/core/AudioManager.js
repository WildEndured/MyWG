import { CONFIG } from '../data/config.js';

class AudioManagerClass {
  constructor() {
    this.ctx = null;
    this.isReady = false;
    this.gunshotBuffer = null;
    this.activeVoices = 0;
    this.maxVoices = 8;
    this.masterGain = null;
    this._panSupported = false;
  }

  init() {
    if (this.isReady) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);
      this._panSupported = typeof this.ctx.createStereoPanner === 'function';
      this._buildGunshotBuffer();
      this.isReady = true;
    } catch (e) {
      this.ctx = null;
      this.isReady = false;
    }
  }

  _buildGunshotBuffer() {
    // Один буфер ~0.18 сек шума с "ударом" в начале — переиспользуем для всех выстрелов
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 0.18);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    // 1) Резкий "щелчок" в начале (0–3 мс)
    const clickLen = Math.floor(sr * 0.003);
    for (let i = 0; i < clickLen; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
    }
    // 2) Затухающий шум (3–180 мс)
    let lp = 0;
    const lpCoeff = 0.35; // низкочастотный фильтр
    for (let i = clickLen; i < len; i++) {
      const env = 1 - (i - clickLen) / (len - clickLen);
      const noise = (Math.random() * 2 - 1) * env * env;
      lp = lp + lpCoeff * (noise - lp);
      data[i] = lp;
    }
    this.gunshotBuffer = buf;
  }

  playGunshot(x, y, camera, loudness) {
    if (!this.isReady || !this.ctx || !this.gunshotBuffer) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    if (this.activeVoices >= this.maxVoices) return;

    const cx = (camera && Number.isFinite(camera.x)) ? camera.x : 0;
    const cy = (camera && Number.isFinite(camera.y)) ? camera.y : 0;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    let volume = Math.min(1, 1.0 / (1 + dist * 0.02)) * Math.min(1, loudness / 1000);
    if (dist > 50) volume *= (CONFIG.AUDIO_WALL_MULT || 0.6);
    if (!Number.isFinite(volume) || volume < 0.04) return;

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.gunshotBuffer;

      const gain = this.ctx.createGain();
      const t0 = this.ctx.currentTime;
      gain.gain.setValueAtTime(volume * 0.6, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);

      if (this._panSupported) {
        const panner = this.ctx.createStereoPanner();
        const pan = dist > 0.5 ? Math.max(-1, Math.min(1, dx / (Math.abs(dx) + Math.abs(dy) + 1))) : 0;
        panner.pan.value = pan;
        src.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        src.connect(gain);
        gain.connect(this.masterGain);
      }

      src.start(t0);
      src.stop(t0 + 0.18);

      this.activeVoices++;
      src.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    } catch (e) {
      // не роняем
    }
  }
}

export const AudioManager = new AudioManagerClass();
