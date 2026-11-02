import { CONFIG } from './config.js';

export class Camera {
  constructor() {
    this.x = 0;               // центр камеры в мировых координатах (метры)
    this.y = 0;
    this.zoom = CONFIG.PX_PER_METER_BASE; // пикселей на метр
    this.viewW = 0;           // размер вьюпорта в CSS-пикселях
    this.viewH = 0;
    this.dpr = 1;

    // границы мира (метры)
    this.worldW = 100;
    this.worldH = 100;
  }

  setViewport(cssW, cssH, dpr) {
    this.viewW = cssW;
    this.viewH = cssH;
    this.dpr = dpr;
    this._clamp();
  }

  setWorld(w, h) {
    this.worldW = w;
    this.worldH = h;
    this._clamp();
  }

  // --- Преобразования ---

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

  // --- Управление ---

  /** Сдвиг камеры на dx,dy в пикселях экрана */
  panByScreen(dxPx, dyPx) {
    this.x -= dxPx / this.zoom;
    this.y -= dyPx / this.zoom;
    this._clamp();
  }

  /** Зум вокруг точки экрана (sx, sy) */
  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(
      this.zoom * factor,
      CONFIG.MIN_PX_PER_METER,
      CONFIG.MAX_PX_PER_METER
    );
    const after = this.screenToWorld(sx, sy);
    // компенсируем смещение, чтобы точка под пальцем осталась на месте
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this._clamp();
  }

  /** Вписать всю карту в экран */
  fit() {
    const zx = this.viewW / this.worldW;
    const zy = this.viewH / this.worldH;
    this.zoom = clamp(
      Math.min(zx, zy),
      CONFIG.MIN_PX_PER_METER,
      CONFIG.MAX_PX_PER_METER
    );
    this.x = this.worldW / 2;
    this.y = this.worldH / 2;
  }

  /** Не даём камере улететь далеко за карту */
  _clamp() {
    const halfW = this.viewW / (2 * this.zoom);
    const halfH = this.viewH / (2 * this.zoom);

    // если карта меньше вьюпорта — центрируем
    if (halfW * 2 >= this.worldW) this.x = this.worldW / 2;
    else this.x = clamp(this.x, halfW, this.worldW - halfW);

    if (halfH * 2 >= this.worldH) this.y = this.worldH / 2;
    else this.y = clamp(this.y, halfH, this.worldH - halfH);
  }
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
