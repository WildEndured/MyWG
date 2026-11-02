// js/core/Camera.js
import { CONFIG } from '../data/config.js';

export class Camera {
  constructor(canvas, { x = 500, y = 500, zoom = 2 } = {}) {
    this.canvas = canvas;
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = CONFIG.MIN_PX_PER_METER;
    this.maxZoom = CONFIG.MAX_PX_PER_METER;
  }

  // Геттеры для размеров экрана
  get vw() { return this.canvas.clientWidth; }
  get vh() { return this.canvas.clientHeight; }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.vw / 2) / this.zoom + this.x,
      y: (sy - this.vh / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.vw / 2,
      y: (wy - this.y) * this.zoom + this.vh / 2,
    };
  }

  clampTo(worldW, worldH) {
    const halfW = (this.vw / 2) / this.zoom;
    const halfH = (this.vh / 2) / this.zoom;
    
    if (worldW * this.zoom < this.vw) this.x = worldW / 2;
    else this.x = Math.max(halfW, Math.min(worldW - halfW, this.x));
    
    if (worldH * this.zoom < this.vh) this.y = worldH / 2;
    else this.y = Math.max(halfH, Math.min(worldH - halfH, this.y));
  }

  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  fit(worldW, worldH) {
    const zx = this.vw / worldW;
    const zy = this.vh / worldH;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(zx, zy)));
    this.x = worldW / 2;
    this.y = worldH / 2;
  }
}
