import { CONFIG } from '../data/config.js';

export class GameMap {
  constructor(camera) {
    this.camera = camera;
    this.size = 100;
    this.cellSize = CONFIG.GRID_MINOR;   // FIX: из конфига
    this.majorStep = CONFIG.GRID_MAJOR;  // FIX: из конфига
  }

  setSize(meters) {
    if (!Number.isFinite(meters) || meters <= 0) return; // FIX: валидация
    this.size = meters;
  }

  draw(ctx) {
    const cam = this.camera;
    const c = CONFIG.COLORS;

    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, cam.vw, cam.vh);

    const tl = cam.worldToScreen(0, 0);
    const br = cam.worldToScreen(this.size, this.size);

    ctx.fillStyle = c.mapFill;
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    const wTL = cam.screenToWorld(0, 0);
    const wBR = cam.screenToWorld(cam.vw, cam.vh);
    const x0 = Math.max(0, wTL.x), y0 = Math.max(0, wTL.y);
    const x1 = Math.min(this.size, wBR.x), y1 = Math.min(this.size, wBR.y);

    if (x1 <= x0 || y1 <= y0) {
      // Карта вне экрана — только рамка
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      return;
    }

    if (this.cellSize * cam.zoom >= 15) {
      this._drawGrid(ctx, x0, y0, x1, y1, this.cellSize, c.gridMinor);
    }
    if (this.majorStep * cam.zoom >= 10) {
      this._drawGrid(ctx, x0, y0, x1, y1, this.majorStep, c.gridMajor);
    }

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  _drawGrid(ctx, x0, y0, x1, y1, step, color) {
    if (!(step > 0)) return; // FIX: защита от step=0
    const cam = this.camera;

    // FIX: экранные координаты границ считаем один раз
    const y0s = cam.worldToScreen(0, y0).y;
    const y1s = cam.worldToScreen(0, y1).y;
    const x0s = cam.worldToScreen(x0, 0).x;
    const x1s = cam.worldToScreen(x1, 0).x;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const startX = Math.floor(x0 / step) * step;
    for (let x = startX; x <= x1 + 1e-6; x += step) {
      const px = Math.round(cam.worldToScreen(x, 0).x) + 0.5;
      ctx.moveTo(px, y0s);
      ctx.lineTo(px, y1s);
    }
    const startY = Math.floor(y0 / step) * step;
    for (let y = startY; y <= y1 + 1e-6; y += step) {
      const py = Math.round(cam.worldToScreen(0, y).y) + 0.5;
      ctx.moveTo(x0s, py);
      ctx.lineTo(x1s, py);
    }
    ctx.stroke();
  }
}
