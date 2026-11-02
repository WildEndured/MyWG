// js/core/Input.js
import { CONFIG } from '../data/config.js';
import { EventBus } from './EventBus.js';

export class Input {
  constructor(canvas, camera, getViewport) {
    this.canvas = canvas;
    this.camera = camera;
    this.getViewport = getViewport; // Функция, возвращающая { w, h }
    this.pointers = new Map();
    this._dragStart = null;
    this._pinch = null;
    this._bind();
  }

  _bind() {
    const c = this.canvas;

    // ... (mousedown, mouseup без изменений)

    window.addEventListener('mousemove', (e) => {
      if (!this.pointers.has('mouse')) return;
      const prev = this.pointers.get('mouse');
      const { w, h } = this.getViewport();
      
      // Двигаем камеру
      this.camera.x -= (e.clientX - prev.x) / this.camera.zoom;
      this.camera.y -= (e.clientY - prev.y) / this.camera.zoom;
      this.camera.clampTo(1000, 1000, w, h); // TODO: брать размер мира откуда-то (например, из EventBus или GameMap)
      
      this.pointers.set('mouse', { x: e.clientX, y: e.clientY });
    });

    // ... (колесико мыши)
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { w, h } = this.getViewport();
      this.camera.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015), w, h);
    }, { passive: false });

    // ... (touchmove, пинч - аналогично, передаем w, h)
  }

  _maybeTap(x, y, id) {
    // ...
    if (moved <= CONFIG.TAP_MAX_MOVE_PX && dt <= CONFIG.TAP_MAX_TIME_MS) {
      const { w, h } = this.getViewport();
      const world = this.camera.screenToWorld(x, y, w, h);
      EventBus.emit('input:tap', { x: world.x, y: world.y });
    }
    this._dragStart = null;
  }
}
