import { CONFIG } from './config.js';

export class Input {
  constructor(canvas, camera, onTapWorld) {
    this.canvas = canvas;
    this.camera = camera;
    this.onTapWorld = onTapWorld; // (worldX, worldY) => void

    // Активные указатели (touch/pen/mouse)
    this.pointers = new Map(); // id -> {x, y}

    this._dragStart = null; // {x, y, t, id}
    this._pinch = null;     // {dist, cx, cy}

    this._bind();
  }

  _bind() {
    const c = this.canvas;

    // --- Мышь ---
    c.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.pointers.set('mouse', { x: e.clientX, y: e.clientY });
      this._dragStart = { x: e.clientX, y: e.clientY, t: performance.now(), id: 'mouse' };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.pointers.has('mouse')) return;
      const prev = this.pointers.get('mouse');
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set('mouse', { x: e.clientX, y: e.clientY });
      this.camera.panByScreen(dx, dy);
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.pointers.has('mouse')) return;
      this.pointers.delete('mouse');
      this._maybeTap(e.clientX, e.clientY, 'mouse');
    });

    // Колесо — зум вокруг курсора
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      this.camera.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    // --- Тач ---
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      if (this.pointers.size === 1) {
        const p = [...this.pointers.values()][0];
        this._dragStart = { x: p.x, y: p.y, t: performance.now(), id: [...this.pointers.keys()][0] };
        this._pinch = null;
      } else if (this.pointers.size === 2) {
        this._dragStart = null;
        this._pinch = this._pinchState();
      }
    }, { passive: false });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();

      if (this.pointers.size === 1) {
        const t = e.changedTouches[0];
        const prev = this.pointers.get(t.identifier);
        if (prev) {
          this.camera.panByScreen(t.clientX - prev.x, t.clientY - prev.y);
          this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      } else if (this.pointers.size >= 2) {
        for (const t of e.changedTouches) {
          this.pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
        const now = this._pinchState();
        if (this._pinch) {
          // Пан по центру пинча
          this.camera.panByScreen(now.cx - this._pinch.cx, now.cy - this._pinch.cy);
          // Зум по изменению расстояния
          if (this._pinch.dist > 0) {
            const factor = Math.pow(now.dist / this._pinch.dist, CONFIG.PINCH_SENS);
            this.camera.zoomAt(now.cx, now.cy, factor);
          }
        }
        this._pinch = now;
      }
    }, { passive: false });

    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        this.pointers.delete(t.identifier);
        this._maybeTap(t.clientX, t.clientY, t.identifier);
      }
      if (this.pointers.size < 2) this._pinch = null;
      if (this.pointers.size === 0) this._dragStart = null;
    }, { passive: false });

    c.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) this.pointers.delete(t.identifier);
      this._pinch = null;
      this._dragStart = null;
    });

    // Запрет контекстного меню (долгий тап на мобиле)
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pinchState() {
    const pts = [...this.pointers.values()].slice(0, 2);
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return {
      dist: Math.hypot(dx, dy),
      cx: (pts[0].x + pts[1].x) / 2,
      cy: (pts[0].y + pts[1].y) / 2,
    };
  }

  _maybeTap(x, y, id) {
    const ds = this._dragStart;
    if (!ds || ds.id !== id) return;
    const moved = Math.hypot(x - ds.x, y - ds.y);
    const dt = performance.now() - ds.t;
    if (moved <= CONFIG.TAP_MAX_MOVE_PX && dt <= CONFIG.TAP_MAX_TIME_MS) {
      const w = this.camera.screenToWorld(x, y);
      this.onTapWorld?.(w.x, w.y);
    }
    this._dragStart = null;
  }
}
