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
  }

  setDpr(dpr) { this.dpr = dpr; }

  get vw() { return this.canvas.clientWidth || 1; }
  get vh() { return this.canvas.clientHeight || 1; }

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
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || !Number.isFinite(this.zoom)) {
      this.x = worldW / 2; this.y = worldH / 2; this.zoom = 2;
      return;
    }

    const halfW = (this.vw / 2) / this.zoom;
    const halfH = (this.vh / 2) / this.zoom;

    if (worldW * this.zoom < this.vw) this.x = worldW / 2;
    else this.x = Math.max(halfW, Math.min(worldW - halfW, this.x));

    if (worldH * this.zoom < this.vh) this.y = worldH / 2;
    else this.y = Math.max(halfH, Math.min(worldH - halfH, this.y));
  }

  zoomAt(sx, sy, factor) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  fit(worldW, worldH) {
    if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return;
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
}
