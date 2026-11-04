import { CONFIG } from '../data/config.js';
import { EventBus, EVENTS } from './EventBus.js';

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.worldSize = 100;
    this.pointers = new Map();

    this._pointerState = {
      isDown: false, isPanning: false,
      startX: 0, startY: 0, lastX: 0, lastY: 0,
      startTime: 0, id: null,
    };
    this._lastTap = { time: 0, x: 0, y: 0 };
    this._pinch = null;

    this._bound = {};
    this._bind();
  }

  setWorldSize(size) { this.worldSize = size; }

  destroy() {
    const c = this.canvas;
    c.removeEventListener('mousedown', this._bound.mousedown);
    window.removeEventListener('mousemove', this._bound.mousemove);
    window.removeEventListener('mouseup', this._bound.mouseup);
    c.removeEventListener('wheel', this._bound.wheel);
    c.removeEventListener('touchstart', this._bound.touchstart);
    c.removeEventListener('touchmove', this._bound.touchmove);
    c.removeEventListener('touchend', this._bound.touchend);
    c.removeEventListener('touchcancel', this._bound.touchcancel);
    c.removeEventListener('contextmenu', this._bound.contextmenu);
  }

  _clampCamera() {
    this.camera.clampTo(this.worldSize, this.worldSize);
  }

  _bind() {
    const c = this.canvas;

    // МЫШЬ
    this._bound.mousedown = (e) => {
      if (e.button === 0) {
        this._pointerState = {
          isDown: true, isPanning: false,
          startX: e.clientX, startY: e.clientY,
          lastX: e.clientX, lastY: e.clientY,
          startTime: performance.now(), id: 'mouse',
        };
      } else if (e.button === 2) {
        this.pointers.set('mouse-right', { x: e.clientX, y: e.clientY });
      }
    };
    c.addEventListener('mousedown', this._bound.mousedown);

    this._bound.mousemove = (e) => {
      if (this.pointers.has('mouse-right')) {
        const prev = this.pointers.get('mouse-right');
        this.camera.x -= (e.clientX - prev.x) / this.camera.zoom;
        this.camera.y -= (e.clientY - prev.y) / this.camera.zoom;
        this._clampCamera();
        this.pointers.set('mouse-right', { x: e.clientX, y: e.clientY });
      }
      if (this._pointerState.isDown && this._pointerState.id === 'mouse') {
        const dx = e.clientX - this._pointerState.startX;
        const dy = e.clientY - this._pointerState.startY;
        if (!this._pointerState.isPanning && Math.hypot(dx, dy) > CONFIG.TAP_MAX_MOVE_PX) {
          this._pointerState.isPanning = true;
        }
        if (this._pointerState.isPanning) {
          this.camera.x -= (e.clientX - this._pointerState.lastX) / this.camera.zoom;
          this.camera.y -= (e.clientY - this._pointerState.lastY) / this.camera.zoom;
          this._clampCamera();
        }
        this._pointerState.lastX = e.clientX;
        this._pointerState.lastY = e.clientY;
      }
    };
    window.addEventListener('mousemove', this._bound.mousemove);

    this._bound.mouseup = (e) => {
      if (e.button === 2) this.pointers.delete('mouse-right');
      if (e.button === 0 && this._pointerState.isDown && this._pointerState.id === 'mouse') {
        this._endPointer(e.clientX, e.clientY);
      }
    };
    window.addEventListener('mouseup', this._bound.mouseup);

    this._bound.wheel = (e) => {
      e.preventDefault();
      this.camera.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
      this._clampCamera();
    };
    c.addEventListener('wheel', this._bound.wheel, { passive: false });

    // ТАЧ
    this._bound.touchstart = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        if (this.pointers.size === 1 && !this._pointerState.isDown) {
          this._pointerState = {
            isDown: true, isPanning: false,
            startX: t.clientX, startY: t.clientY,
            lastX: t.clientX, lastY: t.clientY,
            startTime: performance.now(), id: t.identifier,
          };
        }
      }
      if (this.pointers.size === 2) {
        this._pinch = this._pinchState();
        this._pointerState.isDown = false;
      }
    };
    c.addEventListener('touchstart', this._bound.touchstart, { passive: false });

    this._bound.touchmove = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const prev = this.pointers.get(t.identifier);
        if (!prev) continue;

        if (t.identifier === this._pointerState.id && this.pointers.size === 1) {
          const dx = Math.abs(t.clientX - this._pointerState.startX);
          const dy = Math.abs(t.clientY - this._pointerState.startY);
          if (dx > CONFIG.TAP_MAX_MOVE_PX || dy > CONFIG.TAP_MAX_MOVE_PX) {
            this._pointerState.isPanning = true;
            this.camera.x -= (t.clientX - prev.x) / this.camera.zoom;
            this.camera.y -= (t.clientY - prev.y) / this.camera.zoom;
            this._clampCamera();
          }
        }
        this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      if (this.pointers.size === 2) {
        const now = this._pinchState();
        if (this._pinch && now) {
          this.camera.x -= (now.cx - this._pinch.cx) / this.camera.zoom;
          this.camera.y -= (now.cy - this._pinch.cy) / this.camera.zoom;
          if (this._pinch.dist > 0) {
            const factor = Math.pow(now.dist / this._pinch.dist, CONFIG.PINCH_SENS);
            this.camera.zoomAt(now.cx, now.cy, factor);
          }
          this._clampCamera();
        }
        this._pinch = now;
      }
    };
    c.addEventListener('touchmove', this._bound.touchmove, { passive: false });

    this._bound.touchend = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        this.pointers.delete(t.identifier);
        if (t.identifier === this._pointerState.id) {
          this._endPointer(t.clientX, t.clientY);
        }
      }
      if (this.pointers.size < 2) this._pinch = null;
    };
    c.addEventListener('touchend', this._bound.touchend, { passive: false });

    this._bound.touchcancel = () => {
      this.pointers.clear();
      this._pinch = null;
      this._pointerState.isDown = false;
      this._pointerState.isPanning = false;
    };
    c.addEventListener('touchcancel', this._bound.touchcancel);

    this._bound.contextmenu = (e) => e.preventDefault();
    c.addEventListener('contextmenu', this._bound.contextmenu);
  }

  _endPointer(x, y) {
    const wasPanning = this._pointerState.isPanning;
    this._pointerState.isDown = false;
    if (wasPanning) return;

    const dt = performance.now() - this._pointerState.startTime;
    const dx = Math.abs(x - this._pointerState.startX);
    const dy = Math.abs(y - this._pointerState.startY);
    if (dt >= CONFIG.TAP_MAX_TIME_MS || dx >= CONFIG.TAP_MAX_MOVE_PX || dy >= CONFIG.TAP_MAX_MOVE_PX) return;

    const world = this.camera.screenToWorld(x, y);

    // ЗАЩИТА: тап за пределами карты — игнорируем
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
    if (world.x < 0 || world.y < 0 || world.x > this.worldSize || world.y > this.worldSize) return;

    const now = performance.now();
    const isDoubleTap = (now - this._lastTap.time < CONFIG.TAP_DOUBLE_MS) &&
      Math.abs(x - this._lastTap.x) < 30 &&
      Math.abs(y - this._lastTap.y) < 30;

    if (isDoubleTap) {
      this._lastTap.time = 0;
      EventBus.emit(EVENTS.INPUT_DOUBLE_TAP, { x: world.x, y: world.y });
    } else {
      this._lastTap = { time: now, x, y };
      EventBus.emit(EVENTS.INPUT_TAP, { x: world.x, y: world.y });
    }
  }

  _pinchState() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return null;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return { dist: Math.hypot(dx, dy), cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
  }
}
