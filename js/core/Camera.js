// js/core/Camera.js
import { CONFIG } from '../data/config.js';

export class Camera {
  constructor({ x = 500, y = 500, zoom = 2, minZoom = 0.4, maxZoom = 8 } = {}) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    // Берем лимиты из конфига, если они не переданы явно
    this.minZoom = minZoom ?? CONFIG.MIN_PX_PER_METER;
    this.maxZoom = maxZoom ?? CONFIG.MAX_PX_PER_METER;
  }

  screenToWorld(sx, sy, vw, vh) {
    return {
      x: (sx - vw / 2) / this.zoom + this.x,
      y: (sy - vh / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx, wy, vw, vh) {
    return {
      x: (wx - this.x) * this.zoom + vw / 2,
      y: (wy - this.y) * this.zoom + vh / 2,
    };
  }

  clampTo(worldW, worldH, vw, vh) {
    const halfW = (vw / 2) / this.zoom;
    const halfH = (vh / 2) / this.zoom;
    
    if (worldW * this.zoom < vw) this.x = worldW / 2;
    else this.x = Math.max(halfW, Math.min(worldW - halfW, this.x));
    
    if (worldH * this.zoom < vh) this.y = worldH / 2;
    else this.y = Math.max(halfH, Math.min(worldH - halfH, this.y));
  }

  zoomAt(sx, sy, factor, vw, vh) {
    const before = this.screenToWorld(sx, sy, vw, vh);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy, vw, vh);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  // Новый метод: вписать карту целиком
  fit(worldW, worldH, vw, vh) {
    const zx = vw / worldW;
    const zy = vh / worldH;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(zx, zy)));
    this.x = worldW / 2;
    this.y = worldH / 2;
  }
}
