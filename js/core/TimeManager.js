import { EventBus, EVENTS } from './EventBus.js';

class TimeManagerClass {
  constructor() {
    this.timeScale = 1.0;
    this._prevScale = 1.0;
    this.isPaused = false;
  }

  setTimeScale(scale) {
    if (!Number.isFinite(scale) || scale < 0) return; // FIX: валидация
    if (this.timeScale > 0) this._prevScale = this.timeScale;
    this.timeScale = scale;
    this.isPaused = (scale === 0);
    EventBus.emit(EVENTS.TIME_CHANGED, { scale: this.timeScale, isPaused: this.isPaused });
  }

  togglePause() {
    // FIX: возвращаемся к предыдущему множителю, а не к 1.0
    if (this.isPaused) this.setTimeScale(this._prevScale || 1.0);
    else this.setTimeScale(0);
  }

  getScaledDt(realDt) {
    if (this.isPaused) return 0;
    const capped = Math.min(realDt, 0.1);
    return capped * this.timeScale;
  }

  reset() { this.timeScale = 1.0; this._prevScale = 1.0; this.isPaused = false; }
}

export const TimeManager = new TimeManagerClass();
