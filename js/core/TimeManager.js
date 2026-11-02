// js/core/TimeManager.js
import { EventBus } from './EventBus.js';

class TimeManagerClass {
  constructor() {
    this.timeScale = 1.0; // 1.0 = норма, 0 = пауза, 2.0 = ускорение
    this.isPaused = false;
  }

  setTimeScale(scale) {
    this.timeScale = scale;
    this.isPaused = (scale === 0);
    EventBus.emit('time:changed', { scale: this.timeScale, isPaused: this.isPaused });
  }

  togglePause() {
    if (this.isPaused) {
      this.setTimeScale(1.0); // Выход из паузы в нормальную скорость
    } else {
      this.setTimeScale(0);
    }
  }

  // Возвращает модифицированную дельту времени
  getScaledDt(realDt) {
    // Защита от слишком больших скачков (например, при сворачивании вкладки)
    const cappedDt = Math.min(realDt, 0.1);
    return cappedDt * this.timeScale;
  }
}

export const TimeManager = new TimeManagerClass();
