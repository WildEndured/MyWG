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
    this._mouse = { isDown: false, isDragging: false, startX: 0, startY: 0, startTime: 0 };
    
    // Состояние для тача (одиночный палец)
    this._touchStart = null;
    
    this._pinch = null;
    this._bind();
  }

  setWorldSize(size) { this.worldSize = size; }

  _bind() {
    const c = this.canvas;

    // --- МЫШЬ ---
    c.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // ЛКМ
        this._mouse.isDown = true;
        this._mouse.isDragging = false;
        this._mouse.startX = e.clientX;
        this._mouse.startY = e.clientY;
        this._mouse.startTime = performance.now();
      } else if (e.button === 2) { // ПКМ (камера)
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
      if (this._mouse.isDown) {
        const dx = Math.abs(e.clientX - this._mouse.startX);
        const dy = Math.abs(e.clientY - this._mouse.startY);
        
        if (dx > 10 || dy > 10) {
          this._mouse.isDragging = true;
          EventBus.emit('input:dragBox', {
            startX: this._mouse.startX, startY: this._mouse.startY,
            endX: e.clientX, endY: e.clientY
          });
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.pointers.delete('mouse-right');

      if (e.button === 0 && this._mouse.isDown) {
        this._mouse.isDown = false;
        
        if (this._mouse.isDragging) {
          EventBus.emit('input:boxSelect', {
            startX: this._mouse.startX, startY: this._mouse.startY,
            endX: e.clientX, endY: e.clientY
          });
          EventBus.emit('input:clearBox');
        } else {
          const dt = performance.now() - this._mouse.startTime;
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

    // --- ТАЧ ---
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      if (this.pointers.size === 1) {
        const t = e.changedTouches[0];
        this._touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
      } else if (this.pointers.size === 2) {
        this._pinch = this._pinchState();
        this._touchStart = null; // Отменяем тап при мультитаче
      }
    }, { passive: false });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      if (this.pointers.size === 1) {
        const t = e.changedTouches[0];
        const prev = this.pointers.get(t.identifier);
        if (prev) {
          const dx = t.clientX - prev.x;
          const dy = t.clientY - prev.y;
          
          // Если палец сдвинулся больше чем на 10 пикселей — это свайп камеры
          if (this._touchStart) {
            const totalDx = Math.abs(t.clientX - this._touchStart.x);
            const totalDy = Math.abs(t.clientY - this._touchStart.y);
            if (totalDx > 10 || totalDy > 10) {
              // Отменяем потенциальный тап
              this._touchStart = null;
            }
          }
          
          this.camera.x -= dx / this.camera.zoom;
          this.camera.y -= dy / this.camera.zoom;
          this.camera.clampTo(this.worldSize, this.worldSize);
          this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      } else if (this.pointers.size === 2) {
        for (const t of e.changedTouches) {
          this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
        const now = this._pinchState();
        if (this._pinch) {
          this.camera.x -= (now.cx - this._pinch.cx) / this.camera.zoom;
          this.camera.y -= (now.cy - this._pinch.cy) / this.camera.zoom;
          if (this._pinch.dist > 0) {
            this.camera.zoomAt(now.cx, now.cy, Math.pow(now.dist / this._pinch.dist, CONFIG.PINCH_SENS));
          }
          this.camera.clampTo(this.worldSize, this.worldSize);
        }
        this._pinch = now;
      }
    }, { passive: false });

    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      
      // Если был ровно один палец и тап не отменен свайпом — это клик
      if (this.pointers.size === 1 && this._touchStart) {
        const t = e.changedTouches[0];
        const dt = performance.now() - this._touchStart.time;
        
        if (dt <= CONFIG.TAP_MAX_TIME_MS) {
          const world = this.camera.screenToWorld(t.clientX, t.clientY);
          EventBus.emit('input:tap', { x: world.x, y: world.y });
        }
      }

      for (const t of e.changedTouches) this.pointers.delete(t.identifier);
      
      if (this.pointers.size < 2) this._pinch = null;
      if (this.pointers.size === 0) this._touchStart = null;
    }, { passive: false });

    c.addEventListener('touchcancel', () => {
      this.pointers.clear();
      this._pinch = null;
      this._touchStart = null;
    });

    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pinchState() {
    const pts = [...this.pointers.values()].slice(0, 2);
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return { dist: Math.hypot(dx, dy), cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
  }
}
