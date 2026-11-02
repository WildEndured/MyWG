// js/core/Input.js
import { CONFIG } from '../data/config.js';
import { EventBus } from './EventBus.js'; // <-- Импортируем шину

export class Input {
  // Убираем onTapWorld из конструктора
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.pointers = new Map();
    this._dragStart = null;
    this._pinch = null;
    this._bind();
  }

  // ... (код _bind, _pinchState остается БЕЗ ИЗМЕНЕНИЙ) ...
  
  // ... методы _bind() и _pinchState() пропущены для краткости, они не меняются ...

  _maybeTap(x, y, id) {
    const ds = this._dragStart;
    if (!ds || ds.id !== id) return;
    const moved = Math.hypot(x - ds.x, y - ds.y);
    const dt = performance.now() - ds.t;
    
    if (moved <= CONFIG.TAP_MAX_MOVE_PX && dt <= CONFIG.TAP_MAX_TIME_MS) {
      const w = this.camera.screenToWorld(x, y);
      
      // ВМЕСТО this.onTapWorld?.() -> ГЕНЕРИРУЕМ СОБЫТИЕ
      EventBus.emit('input:tap', { x: w.x, y: w.y });
    }
    this._dragStart = null;
  }
}
