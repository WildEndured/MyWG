import { EventBus, EVENTS } from './EventBus.js';

class TimeManagerClass {
  constructor() {
    this.timeScale = 1.0;
    this._prevScale = 1.0;
    this.isPaused = false;
    // FIX: тактическая пауза (Волна 2)
    this.isTacticalPause = false;
  }

  setTimeScale(scale) {
    if (!Number.isFinite(scale) || scale < 0) return;
    if (this.timeScale > 0) this._prevScale = this.timeScale;
    this.timeScale = scale;
    this.isPaused = (scale === 0);
    if (this.isPaused) this.isTacticalPause = false;
    EventBus.emit(EVENTS.TIME_CHANGED, { scale: this.timeScale, isPaused: this.isPaused, isTacticalPause: this.isTacticalPause });
  }

  togglePause() {
    if (this.isPaused) this.setTimeScale(this._prevScale || 1.0);
    else this.setTimeScale(0);
  }

  // FIX: тактическая пауза (Волна 2)
  toggleTacticalPause() {
    this.isTacticalPause = !this.isTacticalPause;
    EventBus.emit(EVENTS.TIME_CHANGED, {
      scale: this.timeScale,
      isPaused: this.isPaused,
      isTacticalPause: this.isTacticalPause,
    });
  }

  getScaledDt(realDt) {
    if (this.isPaused) return 0;
    if (this.isTacticalPause) return 0; // симуляция стоит
    const capped = Math.min(realDt, 0.1);
    return capped * this.timeScale;
  }

  reset() {
    this.timeScale = 1.0;
    this._prevScale = 1.0;
    this.isPaused = false;
    this.isTacticalPause = false;
  }
}

export const TimeManager = new TimeManagerClass();
