// js/world/map.js
import { CONFIG } from '../data/config.js';

export class GameMap {
  constructor(camera) {
    this.camera = camera;
    this.size = 100;
  }

  setSize(meters) { this.size = meters; }

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

    if (CONFIG.GRID_MINOR * cam.zoom >= 6) {
      this._drawGrid(ctx, x0, y0, x1, y1, CONFIG.GRID_MINOR, c.gridMinor);
    }
    if (CONFIG.GRID_MAJOR * cam.zoom >= 6) {
      this._drawGrid(ctx, x0, y0, x1, y1, CONFIG.GRID_MAJOR, c.gridMajor);
    }

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Карта: ${this.size}x${this.size} м`, tl.x + 10, tl.y + 20);
  }

  _drawGrid(ctx, x0, y0, x1, y1, step, color) {
    const cam = this.camera;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const startX = Math.floor(x0 / step) * step;
    for (let x = startX; x <= x1; x += step) {
      const px = Math.round(cam.worldToScreen(x, 0).x) + 0.5;
      ctx.moveTo(px, cam.worldToScreen(0, y0).y);
      ctx.lineTo(px, cam.worldToScreen(0, y1).y);
    }

    const startY = Math.floor(y0 / step) * step;
    for (let y = startY; y <= y1; y += step) {
      const py = Math.round(cam.worldToScreen(0, y).y) + 0.5;
      ctx.moveTo(cam.worldToScreen(x0, 0).x, py);
      ctx.lineTo(cam.worldToScreen(x1, 0).x, py);
    }
    ctx.stroke();
  }
}
