import { CONFIG } from '../data/config.js';

export class Camera {
  constructor(canvas, { x = 500, y = 500, zoom = 2, dpr = 1 } = {}) {
    this.canvas = canvas;
    this._x = x;
    this._y = y;
    this._zoom = zoom;
    this.dpr = dpr;
    this.minZoom = CONFIG.MIN_PX_PER_METER;
    this.maxZoom = CONFIG.MAX_PX_PER_METER;
    this.pathfinder = null;
    this.worldSize = 100; // Текущий размер мира
  }

  // Геттеры/сеттеры с защитой от NaN
  get x() { return this._x; }
  set x(v) { this._x = Number.isFinite(v) ? v : this._x; }
  get y() { return this._y; }
  set y(v) { this._y = Number.isFinite(v) ? v : this._y; }
  get zoom() { 
    if (!Number.isFinite(this._zoom)) return 2;
    return Math.max(this.minZoom, Math.min(this.maxZoom, this._zoom)); 
  }
  set zoom(v) { 
    if (Number.isFinite(v)) this._zoom = Math.max(this.minZoom, Math.min(this.maxZoom, v)); 
  }

  setDpr(dpr) { if (Number.isFinite(dpr) && dpr > 0) this.dpr = dpr; }

  get vw() { 
    const w = this.canvas.clientWidth;
    return w > 0 ? w : (window.innerWidth || 800);
  }
  get vh() { 
    const h = this.canvas.clientHeight;
    return h > 0 ? h : (window.innerHeight || 600);
  }

  screenToWorld(sx, sy) {
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return { x: 0, y: 0 };
    return {
      x: (sx - this.vw / 2) / this.zoom + this._x,
      y: (sy - this.vh / 2) / this.zoom + this._y,
    };
  }

  worldToScreen(wx, wy) {
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return { x: -9999, y: -9999 };
    return {
      x: (wx - this._x) * this.zoom + this.vw / 2,
      y: (wy - this._y) * this.zoom + this.vh / 2,
    };
  }

  clampTo(worldW, worldH) {
    if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return;
    
    // Запоминаем текущий размер мира
    this.worldSize = worldW;

    // Принудительная проверка на NaN
    if (!Number.isFinite(this._x)) this._x = worldW / 2;
    if (!Number.isFinite(this._y)) this._y = worldH / 2;
    if (!Number.isFinite(this._zoom)) this._zoom = 2;

    const z = this.zoom; // Уже с clamp
    const halfViewW = (this.vw / 2) / z;
    const halfViewH = (this.vh / 2) / z;

    // Если видимая область больше мира — центрируем
    if (halfViewW * 2 >= worldW) {
      this._x = worldW / 2;
    } else {
      if (this._x < halfViewW) this._x = halfViewW;
      if (this._x > worldW - halfViewW) this._x = worldW - halfViewW;
    }

    if (halfViewH * 2 >= worldH) {
      this._y = worldH / 2;
    } else {
      if (this._y < halfViewH) this._y = halfViewH;
      if (this._y > worldH - halfViewH) this._y = worldH - halfViewH;
    }
  }

  zoomAt(sx, sy, factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
    const before = this.screenToWorld(sx, sy);
    this.zoom = this.zoom * factor;
    const after = this.screenToWorld(sx, sy);
    this._x += before.x - after.x;
    this._y += before.y - after.y;
  }

  fit(worldW, worldH) {
    if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return;
    this.worldSize = worldW;
    const zx = this.vw / worldW;
    const zy = this.vh / worldH;
    this.zoom = Math.min(zx, zy);
    this._x = worldW / 2;
    this._y = worldH / 2;
  }

  isPointVisible(wx, wy, marginPx = 50) {
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return false;
    const screen = this.worldToScreen(wx, wy);
    return screen.x >= -marginPx && screen.x <= this.vw + marginPx &&
           screen.y >= -marginPx && screen.y <= this.vh + marginPx;
  }

  // Вызывается каждый кадр ПЕРЕД отрисовкой
  validate() {
    if (!Number.isFinite(this._zoom)) this._zoom = 2;
    if (!Number.isFinite(this._x)) this._x = this.worldSize / 2;
    if (!Number.isFinite(this._y)) this._y = this.worldSize / 2;
    
    // Принудительный clamp
    this.clampTo(this.worldSize, this.worldSize);
  }
}
