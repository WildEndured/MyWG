import { CONFIG } from '../data/config.js';
import { EventBus, EVENTS } from './EventBus.js';

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.worldSize = 100;
    
    this._isDown = false;
    this._isPanning = false;
    this._startX = 0;
    this._startY = 0;
    this._lastX = 0;
    this._lastY = 0;
    this._startTime = 0;
    this._lastTap = { time: 0, x: 0, y: 0 };
    
    this._bind();
  }

  setWorldSize(size) { this.worldSize = size; }
  
  destroy() {
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
  }

  _bind() {
    const c = this.canvas;
    
    // ЛКМ
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this._isDown = true;
      this._isPanning = false;
      this._startX = e.clientX;
      this._startY = e.clientY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._startTime = performance.now();
    };
    c.addEventListener('mousedown', this._onMouseDown);
    
    // Панорамирование
    this._onMouseMove = (e) => {
      if (!this._isDown) return;
      
      const dx = e.clientX - this._startX;
      const dy = e.clientY - this._startY;
      const dist = Math.hypot(dx, dy);
      
      if (!this._isPanning && dist > CONFIG.TAP_MAX_MOVE_PX) {
        this._isPanning = true;
      }
      
      if (this._isPanning) {
        this.camera.x -= (e.clientX - this._lastX) / this.camera.zoom;
        this.camera.y -= (e.clientY - this._lastY) / this.camera.zoom;
        this.camera.clampTo(this.worldSize, this.worldSize);
      }
      
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    window.addEventListener('mousemove', this._onMouseMove);
    
    // Отпускание мыши — тап
    this._onMouseUp = (e) => {
      if (e.button !== 0 || !this._isDown) return;
      
      const wasPanning = this._isPanning;
      this._isDown = false;
      this._isPanning = false;
      
      if (wasPanning) return;
      
      const dt = performance.now() - this._startTime;
      if (dt > CONFIG.TAP_MAX_TIME_MS) return;
      
      const world = this.camera.screenToWorld(e.clientX, e.clientY);
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
      if (world.x < 0 || world.y < 0 || world.x > this.worldSize || world.y > this.worldSize) return;
      
      const now = performance.now();
      const isDouble = (now - this._lastTap.time < CONFIG.TAP_DOUBLE_MS) &&
        Math.abs(e.clientX - this._lastTap.x) < 30 &&
        Math.abs(e.clientY - this._lastTap.y) < 30;
      
      if (isDouble) {
        this._lastTap.time = 0;
        EventBus.emit(EVENTS.INPUT_DOUBLE_TAP, { x: world.x, y: world.y });
      } else {
        this._lastTap = { time: now, x: e.clientX, y: e.clientY };
        EventBus.emit(EVENTS.INPUT_TAP, { x: world.x, y: world.y });
      }
    };
    window.addEventListener('mouseup', this._onMouseUp);
    
    // Зум
    this._onWheel = (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      this.camera.zoomAt(e.clientX, e.clientY, factor);
      this.camera.clampTo(this.worldSize, this.worldSize);
    };
    c.addEventListener('wheel', this._onWheel, { passive: false });
    
    // ТАЧ
    this._onTouchStart = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      this._isDown = true;
      this._isPanning = false;
      this._startX = t.clientX;
      this._startY = t.clientY;
      this._lastX = t.clientX;
      this._lastY = t.clientY;
      this._startTime = performance.now();
    };
    c.addEventListener('touchstart', this._onTouchStart, { passive: false });
    
    this._onTouchMove = (e) => {
      e.preventDefault();
      if (!this._isDown) return;
      const t = e.touches[0];
      if (!t) return;
      
      const dx = t.clientX - this._startX;
      const dy = t.clientY - this._startY;
      const dist = Math.hypot(dx, dy);
      
      if (!this._isPanning && dist > CONFIG.TAP_MAX_MOVE_PX) {
        this._isPanning = true;
      }
      
      if (this._isPanning) {
        this.camera.x -= (t.clientX - this._lastX) / this.camera.zoom;
        this.camera.y -= (t.clientY - this._lastY) / this.camera.zoom;
        this.camera.clampTo(this.worldSize, this.worldSize);
      }
      
      this._lastX = t.clientX;
      this._lastY = t.clientY;
    };
    c.addEventListener('touchmove', this._onTouchMove, { passive: false });
    
    this._onTouchEnd = (e) => {
      e.preventDefault();
      if (!this._isDown) return;
      
      const wasPanning = this._isPanning;
      this._isDown = false;
      this._isPanning = false;
      
      if (wasPanning) return;
      
      const t = e.changedTouches[0];
      if (!t) return;
      
      const world = this.camera.screenToWorld(t.clientX, t.clientY);
      if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
      if (world.x < 0 || world.y < 0 || world.x > this.worldSize || world.y > this.worldSize) return;
      
      const now = performance.now();
      const isDouble = (now - this._lastTap.time < CONFIG.TAP_DOUBLE_MS) &&
        Math.abs(t.clientX - this._lastTap.x) < 30 &&
        Math.abs(t.clientY - this._lastTap.y) < 30;
      
      if (isDouble) {
        this._lastTap.time = 0;
        EventBus.emit(EVENTS.INPUT_DOUBLE_TAP, { x: world.x, y: world.y });
      } else {
        this._lastTap = { time: now, x: t.clientX, y: t.clientY };
        EventBus.emit(EVENTS.INPUT_TAP, { x: world.x, y: world.y });
      }
    };
    c.addEventListener('touchend', this._onTouchEnd, { passive: false });
    
    this._onContextMenu = (e) => e.preventDefault();
    c.addEventListener('contextmenu', this._onContextMenu);
  }
}
