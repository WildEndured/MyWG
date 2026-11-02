// js/core/Input.js
import { CONFIG } from '../data/config.js';
import { EventBus } from './EventBus.js';

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.worldSize = 100;
    this.pointers = new Map();
    
    this._pointerState = {
      isDown: false,
      isPanning: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      id: null
    };

    // Для отслеживания двойного тапа
    this._lastTap = {
      time: 0,
      x: 0,
      y: 0
    };

    this._pinch = null;
    this._bind();
  }

  setWorldSize(size) { this.worldSize = size; }

  _bind() {
    const c = this.canvas;

    // --- МЫШЬ ---
    c.addEventListener('mousedown', (e) => {
      if (e.button === 0) { 
        this._pointerState = {
          isDown: true,
          isPanning: false,
          startX: e.clientX,
          startY: e.clientY,
          startTime: performance.now(),
          id: 'mouse'
        };
      } else if (e.button === 2) { 
        this.pointers.set('mouse-right', { x: e.clientX, y: e.clientY });
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.pointers.has('mouse-right')) {
        const prev = this.pointers.get('mouse-right');
        this.camera.x -= (e.clientX - prev.x) / this.camera.zoom;
        this.camera.y -= (e.clientY - prev.y) / this.camera.zoom;
        this.camera.clampTo(this.worldSize, this.worldSize);
        this.pointers.set('mouse-right', { x: e.clientX, y: e.clientY });
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.pointers.delete('mouse-right');

      if (e.button === 0 && this._pointerState.isDown && this._pointerState.id === 'mouse') {
        this._endPointer(e.clientX, e.clientY, 'mouse');
      }
    });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    // --- ТАЧ (Мобилки) ---
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      
      for (const t of e.changedTouches) {
        this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        
        if (this.pointers.size === 1 && !this._pointerState.isDown) {
          this._pointerState = {
            isDown: true,
            isPanning: false,
            startX: t.clientX,
            startY: t.clientY,
            startTime: performance.now(),
            id: t.identifier
          };
        }
      }

      if (this.pointers.size === 2) {
        this._pinch = this._pinchState();
        this._pointerState.isDown = false; 
      }
    }, { passive: false });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      for (const t of e.changedTouches) {
        const prev = this.pointers.get(t.identifier);
        if (!prev) continue;

        if (t.identifier === this._pointerState.id && this.pointers.size === 1) {
          const dx = Math.abs(t.clientX - this._pointerState.startX);
          const dy = Math.abs(t.clientY - this._pointerState.startY);
          
          if (dx > 10 || dy > 10) {
            this._pointerState.isPanning = true;
            this.camera.x -= (t.clientX - prev.x) / this.camera.zoom;
            this.camera.y -= (t.clientY - prev.y) / this.camera.zoom;
            this.camera.clampTo(this.worldSize, this.worldSize);
          }
        }
        
        this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      if (this.pointers.size === 2) {
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
      
      for (const t of e.changedTouches) {
        this.pointers.delete(t.identifier);
        
        if (t.identifier === this._pointerState.id) {
          this._endPointer(t.clientX, t.clientY, t.identifier);
        }
      }
      
      if (this.pointers.size < 2) this._pinch = null;
    }, { passive: false });

    c.addEventListener('touchcancel', () => {
      this.pointers.clear();
      this._pinch = null;
      this._pointerState.isDown = false;
    });

    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _endPointer(x, y, id) {
    this._pointerState.isDown = false;
    
    if (this._pointerState.isPanning) return;

    const dt = performance.now() - this._pointerState.startTime;
    const dx = Math.abs(x - this._pointerState.startX);
    const dy = Math.abs(y - this._pointerState.startY);
    
    if (dt < CONFIG.TAP_MAX_TIME_MS && dx < 10 && dy < 10) {
      const now = performance.now();
      const isDoubleTap = (now - this._lastTap.time < 300) && 
                          (Math.abs(x - this._lastTap.x) < 30) && 
                          (Math.abs(y - this._lastTap.y) < 30);

      const world = this.camera.screenToWorld(x, y);

      if (isDoubleTap) {
        // Сбрасываем, чтобы тройной тап не считался двумя даблами
        this._lastTap.time = 0; 
        EventBus.emit('input:doubleTap', { x: world.x, y: world.y });
      } else {
        this._lastTap = { time: now, x: x, y: y };
        EventBus.emit('input:tap', { x: world.x, y: world.y });
      }
    }
  }

  _pinchState() {
    const pts = [...this.pointers.values()].slice(0, 2);
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return { dist: Math.hypot(dx, dy), cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
  }
          }
