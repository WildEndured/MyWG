import { CONFIG } from '../data/config.js';

export class Camera {
  constructor(canvas, { x = 500, y = 500, zoom = 2, dpr = 1 } = {}) {
    this.canvas = canvas;
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.dpr = dpr;
    this.minZoom = CONFIG.MIN_PX_PER_METER;
    this.maxZoom = CONFIG.MAX_PX_PER_METER;
    this.pathfinder = null;
    this.worldSize = 100;
  }

  setDpr(dpr) { 
    if (Number.isFinite(dpr) && dpr > 0) this.dpr = dpr; 
  }

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
      x: (sx - this.vw / 2) / this.zoom + this.x,
      y: (sy - this.vh / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx, wy) {
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return { x: -9999, y: -9999 };
    return {
      x: (wx - this.x) * this.zoom + this.vw / 2,
      y: (wy - this.y) * this.zoom + this.vh / 2,
    };
  }

  clampTo(worldW, worldH) {
    if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return;
    if (this.vw <= 0 || this.vh <= 0) return;

    this.worldSize = worldW;

    // Жёсткая проверка на NaN/Infinity
    if (!Number.isFinite(this.zoom)) this.zoom = 2;
    if (!Number.isFinite(this.x)) this.x = worldW / 2;
    if (!Number.isFinite(this.y)) this.y = worldH / 2;

    // Ограничение зума
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

    const worldViewW = this.vw / this.zoom;
    const worldViewH = this.vh / this.zoom;

    // Если карта меньше экрана — центрируем
    if (worldViewW >= worldW) {
      this.x = worldW / 2;
    } else {
      const halfW = worldViewW / 2;
      this.x = Math.max(halfW, Math.min(worldW - halfW, this.x));
    }

    if (worldViewH >= worldH) {
      this.y = worldH / 2;
    } else {
      const halfH = worldViewH / 2;
      this.y = Math.max(halfH, Math.min(worldH - halfH, this.y));
    }
  }

  zoomAt(sx, sy, factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
    
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  fit(worldW, worldH) {
    if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return;
    this.worldSize = worldW;
    
    const zx = this.vw / worldW;
    const zy = this.vh / worldH;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(zx, zy)));
    this.x = worldW / 2;
    this.y = worldH / 2;
  }

  isPointVisible(wx, wy, marginPx = 50) {
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return false;
    const screen = this.worldToScreen(wx, wy);
    return screen.x >= -marginPx && screen.x <= this.vw + marginPx &&
           screen.y >= -marginPx && screen.y <= this.vh + marginPx;
  }

  validate() {
    if (!Number.isFinite(this.zoom)) this.zoom = 2;
    if (!Number.isFinite(this.x)) this.x = this.worldSize / 2;
    if (!Number.isFinite(this.y)) this.y = this.worldSize / 2;
    this.clampTo(this.worldSize, this.worldSize);
  }
}
