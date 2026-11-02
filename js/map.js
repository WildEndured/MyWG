import { CONFIG } from './config.js';

export class GameMap {
  constructor(camera) {
    this.camera = camera;
    this.size = 100; // метров
  }

  setSize(meters) { this.size = meters; }

  draw(ctx) {
    const cam = this.camera;
    const c = CONFIG.COLORS;

    // Фон
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);

    // Границы карты в экранных координатах
    const tl = cam.worldToScreen(0, 0);
    const br = cam.worldToScreen(this.size, this.size);

    // Заливка карты
    ctx.fillStyle = '#20262d';
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Сетка — только видимая область мира
    const wTL = cam.screenToWorld(0, 0);
    const wBR = cam.screenToWorld(cam.viewW, cam.viewH);
    const x0 = Math.max(0, wTL.x);
    const y0 = Math.max(0, wTL.y);
    const x1 = Math.min(this.size, wBR.x);
    const y1 = Math.min(this.size, wBR.y);

    // Мелкая сетка — рисуем только если шаг ≥ 6 px
    const minorPx = CONFIG.GRID_MINOR * cam.zoom;
    if (minorPx >= 6) {
      this._drawGrid(ctx, x0, y0, x1, y1, CONFIG.GRID_MINOR, c.gridMinor);
    }
    // Крупная сетка
    const majorPx = CONFIG.GRID_MAJOR * cam.zoom;
    if (majorPx >= 6) {
      this._drawGrid(ctx, x0, y0, x1, y1, CONFIG.GRID_MAJOR, c.gridMajor);
    }

    // Рамка карты
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Подпись размера
    ctx.fillStyle = 'rgba(232,234,237,0.7)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${this.size} × ${this.size} м`, tl.x + 8, tl.y - 6);
  }

  _drawGrid(ctx, x0, y0, x1, y1, step, color) {
    const cam = this.camera;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const startX = Math.floor(x0 / step) * step;
    for (let x = startX; x <= x1; x += step) {
      const s = cam.worldToScreen(x, 0);
      // +0.5 для чётких линий
      const px = Math.round(s.x) + 0.5;
      ctx.moveTo(px, cam.worldToScreen(0, y0).y);
      ctx.lineTo(px, cam.worldToScreen(0, y1).y);
    }

    const startY = Math.floor(y0 / step) * step;
    for (let y = startY; y <= y1; y += step) {
      const s = cam.worldToScreen(0, y);
      const py = Math.round(s.y) + 0.5;
      ctx.moveTo(cam.worldToScreen(x0, 0).x, py);
      ctx.lineTo(cam.worldToScreen(x1, 0).x, py);
    }

    ctx.stroke();
  }
}
