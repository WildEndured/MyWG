import { EventBus, EVENTS } from './EventBus.js';

class TimeManagerClass {
  constructor() {
    this.timeScale = 1.0;
    this._prevScale = 1.0;
    this.isPaused = false;
    this.isTacticalPause = false;

    // Фиксированный шаг
    this.FIXED_DT = 1 / 60;
    this._accumulator = 0;
    this._maxStepsPerFrame = 4; // защита от "спирали смерти"
    this.alpha = 0; // для интерполяции (0..1)
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

  toggleTacticalPause() {
    this.isTacticalPause = !this.isTacticalPause;
    EventBus.emit(EVENTS.TIME_CHANGED, {
      scale: this.timeScale,
      isPaused: this.isPaused,
      isTacticalPause: this.isTacticalPause,
    });
  }

  // Старое API — оставлено для совместимости
  getScaledDt(realDt) {
    if (this.isPaused || this.isTacticalPause) return 0;
    const capped = Math.min(realDt, 0.1);
    return capped * this.timeScale;
  }

  // Новое API: фиксированный шаг с аккумулятором.
  // stepFn(dt) вызывается фиксированное число раз.
  // Возвращает число шагов.
  stepFixed(realDt, stepFn) {
    if (this.isPaused || this.isTacticalPause) {
      this.alpha = 0;
      return 0;
    }

    const scaled = Math.min(realDt, 0.1) * this.timeScale;
    this._accumulator += scaled;

    let steps = 0;
    while (this._accumulator >= this.FIXED_DT && steps < this._maxStepsPerFrame) {
      stepFn(this.FIXED_DT);
      this._accumulator -= this.FIXED_DT;
      steps++;
    }

    // Если накопилось слишком много — сбрасываем (чтобы не залипало)
    if (this._accumulator > this.FIXED_DT * this._maxStepsPerFrame) {
      this._accumulator = 0;
    }

    this.alpha = this._accumulator / this.FIXED_DT;
    return steps;
  }

  reset() {
    this.timeScale = 1.0;
    this._prevScale = 1.0;
    this.isPaused = false;
    this.isTacticalPause = false;
    this._accumulator = 0;
    this.alpha = 0;
  }
}

export const TimeManager = new TimeManagerClass();
