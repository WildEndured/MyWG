// js/core/Input.js
import { CONFIG } from '../data/config.js';
import { EventBus } from './EventBus.js';

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.worldSize = 100;
    this.pointers = new Map();
    
    // Состояние для мыши
    this._mouseState = {
      isDown: false,
      isDraggingBox: false,
      startX: 0,
      startY: 0,
      startTime: 0
    };

    this._pinch = null;
    this._bind();
  }

  setWorldSize(size) { this.worldSize = size; }

  _bind() {
    const c = this.canvas;

    // --- МЫШЬ ---
    c.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // ЛКМ
        this._mouseState.isDown = true;
        this._mouseState.isDraggingBox = false;
        this._mouseState.startX = e.clientX;
        this._mouseState.startY = e.clientY;
        this._mouseState.startTime = performance.now();
      } else if (e.button === 2) { // ПКМ (панорамирование)
        this.pointers.set('mouse-right', { x: e.clientX, y: e.clientY });
      }
    });

    window.addEventListener('mousemove', (e) => {
      // Панорамирование ПКМ
      if (this.pointers.has('mouse-right')) {
        const prev = this.pointers.get('mouse-right');
        this.camera.x -= (e.clientX - prev.x) / this.camera.zoom;
        this.camera.y -= (e.clientY - prev.y) / this.camera.zoom;
        this.camera.clampTo(this.worldSize, this.worldSize);
        this.pointers.set('mouse-right', { x: e.clientX, y: e.clientY });
      }

      // Рамка ЛКМ
      if (this._mouseState.isDown) {
        const dx = Math.abs(e.clientX - this._mouseState.startX);
        const dy = Math.abs(e.clientY - this._mouseState.startY);
        
        if (dx > 10 || dy > 10) {
          this._mouseState.isDraggingBox = true;
          EventBus.emit('input:dragBox', {
            startX: this._mouseState.startX,
            startY: this._mouseState.startY,
            endX: e.clientX,
            endY: e.clientY
          });
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.pointers.delete('mouse-right');
      }

      if (e.button === 0 && this._mouseState.isDown) {
        this._mouseState.isDown = false;
        
        if (this._mouseState.isDraggingBox) {
          // Завершаем выделение рамкой
          EventBus.emit('input:boxSelect', {
            startX: this._mouseState.startX,
            startY: this._mouseState.startY,
            endX: e.clientX,
            endY: e.clientY
          });
          EventBus.emit('input:clearBox');
        } else {
          // Это был обычный клик
          const dt = performance.now() - this._mouseState.startTime;
          if (dt < CONFIG.TAP_MAX_TIME_MS) {
            const world = this.camera.screenToWorld(e.clientX, e.clientY);
            EventBus.emit('input:tap', { x: world.x, y: world.y });
          }
        }
      }
    });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    // --- ТАЧ (Мобилки) ---
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (this.pointers.size === 2) {
        this._pinch = this._pinchState();
      }
    }, { passive: false });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.pointers.size === 1) {
        const t = e.changedTouches[0];
        const prev = this.pointers.get(t.identifier);
        if (prev) {
          this.camera.x -= (t.clientX - prev.x) / this.camera.zoom;
          this.camera.y -= (t.clientY - prev.y) / this.camera.zoom;
          this.camera.clampTo(this.worldSize, this.worldSize);
          this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      } else if (this.pointers.size === 2) {
        for (const t of e.changedTouches) this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        const now = this._pinchState();
        if (this._pinch) {
          this.camera.x -= (now.cx - this._pinch.cx) / this.camera.zoom;
          this.camera.y -= (now.cy - this._pinch.cy) / this.camera.zoom;
          if (this._pinch.dist > 0) {
            const factor = Math.pow(now.dist / this._pinch.dist, CONFIG.PINCH_SENS);
            this.camera.zoomAt(now.cx, now.cy, factor);
          }
          this.camera.clampTo(this.worldSize, this.worldSize);
        }
        this._pinch = now;
      }
    }, { passive: false });

    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      const wasSingle = this.pointers.size === 1;
      
      for (const t of e.changedTouches) {
        this.pointers.delete(t.identifier);
      }
      
      if (wasSingle && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        // Для тача мы считаем любой тап (свайп камеры мы уже отследили выше)
        const world = this.camera.screenToWorld(t.clientX, t.clientY);
        EventBus.emit('input:tap', { x: world.x, y: world.y });
      }
      
      if (this.pointers.size < 2) this._pinch = null;
    }, { passive: false });

    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pinchState() {
    const pts = [...this.pointers.values()].slice(0, 2);
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return { dist: Math.hypot(dx, dy), cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
  }
}
