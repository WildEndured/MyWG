// js/core/Camera.js
import { CONFIG, clamp } from '../data/config.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = CONFIG.PX_PER_METER_BASE;
    this.viewW = 0; this.viewH = 0; this.dpr = 1;
    this.worldW = 100; this.worldH = 100;
  }

  setViewport(w, h, dpr) {
    this.viewW = w; this.viewH = h; this.dpr = dpr;
    this._clamp();
  }

  setWorld(w, h) {
    this.worldW = w; this.worldH = h;
    this._clamp();
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.viewW / 2,
      y: (wy - this.y) * this.zoom + this.viewH / 2,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.x,
      y: (sy - this.viewH / 2) / this.zoom + this.y,
    };
  }

  panByScreen(dxPx, dyPx) {
    this.x -= dxPx / this.zoom;
    this.y -= dyPx / this.zoom;
    this._clamp();
  }

  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, CONFIG.MIN_PX_PER_METER, CONFIG.MAX_PX_PER_METER);
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this._clamp();
  }

  fit() {
    const zx = this.viewW / this.worldW;
    const zy = this.viewH / this.worldH;
    this.zoom = clamp(Math.min(zx, zy), CONFIG.MIN_PX_PER_METER, CONFIG.MAX_PX_PER_METER);
    this.x = this.worldW / 2;
    this.y = this.worldH / 2;
  }

  _clamp() {
    const halfW = this.viewW / (2 * this.zoom);
    const halfH = this.viewH / (2 * this.zoom);

    if (halfW * 2 >= this.worldW) this.x = this.worldW / 2;
    else this.x = clamp(this.x, halfW, this.worldW - halfW);

    if (halfH * 2 >= this.worldH) this.y = this.worldH / 2;
    else this.y = clamp(this.y, halfH, this.worldH - halfH);
  }
}
