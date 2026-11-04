import { CONFIG } from '../data/config.js';

class AudioManagerClass {
  constructor() {
    this.ctx = null;
    this.isReady = false;
    this.noiseBuffer = null;
    this.activeVoices = 0;
    this.maxVoices = 6;
    this.masterGain = null;
  }

  init() {
    if (this.isReady) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);
    this._buildNoiseBuffer();
    this.isReady = true;
  }

  _buildNoiseBuffer() {
    // 0.15 сек шума — переиспользуем для всех выстрелов
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 0.15);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
    this.noiseBuffer = buf;
  }

  playGunshot(x, y, camera, loudness) {
    if (!this.isReady || !this.ctx || !this.noiseBuffer) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const cx = (camera && Number.isFinite(camera.x)) ? camera.x : 0;
    const cy = (camera && Number.isFinite(camera.y)) ? camera.y : 0;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    let volume = Math.min(1, 1.0 / (1 + dist * 0.02)) * Math.min(1, loudness / 1000);
    if (dist > 50) volume *= CONFIG.AUDIO_WALL_MULT;
    if (!Number.isFinite(volume) || volume < 0.05) return;

    // Лимит голосов
    if (this.activeVoices >= this.maxVoices) return;

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      // Низкочастотный "удар" выстрела
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800 + volume * 1200;

      const gain = this.ctx.createGain();
      const t0 = this.ctx.currentTime;
      gain.gain.setValueAtTime(volume * 0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);

      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) panner.pan.value = Math.max(-1, Math.min(1, dx / Math.max(20, Math.abs(dx) + Math.abs(dy))));

      src.connect(filter);
      filter.connect(gain);
      if (panner) { gain.connect(panner); panner.connect(this.masterGain); }
      else gain.connect(this.masterGain);

      src.start(t0);
      src.stop(t0 + 0.15);

      this.activeVoices++;
      src.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    } catch (e) {
      // не роняем игру
    }
  }
}

export const AudioManager = new AudioManagerClass();
