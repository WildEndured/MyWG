import { CONFIG } from '../data/config.js';

export class GameMap {
  constructor(camera) {
    this.camera = camera;
    this.size = 100;
    this.cellSize = CONFIG.GRID_MINOR;
    this.majorStep = CONFIG.GRID_MAJOR;
  }

  setSize(meters) {
    if (!Number.isFinite(meters) || meters <= 0) return;
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

    const pathfinder = cam.pathfinder;
    if (pathfinder && pathfinder.heightMap) {
      this._drawHeights(ctx, pathfinder);
    }

    const wTL = cam.screenToWorld(0, 0);
    const wBR = cam.screenToWorld(cam.vw, cam.vh);
    const x0 = Math.max(0, wTL.x), y0 = Math.max(0, wTL.y);
    const x1 = Math.min(this.size, wBR.x), y1 = Math.min(this.size, wBR.y);

    if (x1 > x0 && y1 > y0) {
      if (this.cellSize * cam.zoom >= 15) {
        this._drawGrid(ctx, x0, y0, x1, y1, this.cellSize, c.gridMinor);
      }
      if (this.majorStep * cam.zoom >= 10) {
        this._drawGrid(ctx, x0, y0, x1, y1, this.majorStep, c.gridMajor);
      }
    }

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  _drawHeights(ctx, pathfinder) {
    const cam = this.camera;
    const cellSize = pathfinder.cellSize;
    const wTL = cam.screenToWorld(0, 0);
    const wBR = cam.screenToWorld(cam.vw, cam.vh);
    
    const startX = Math.max(0, Math.floor(wTL.x / cellSize));
    const endX = Math.min(pathfinder.cols, Math.ceil(wBR.x / cellSize));
    const startY = Math.max(0, Math.floor(wTL.y / cellSize));
    const endY = Math.min(pathfinder.rows, Math.ceil(wBR.y / cellSize));

    // 1. Цвет высот
    for (let gy = startY; gy < endY; gy++) {
      for (let gx = startX; gx < endX; gx++) {
        const h = pathfinder.heightMap[gy * pathfinder.cols + gx];
        if (h === 0) continue;

        const p = cam.worldToScreen(gx * cellSize, gy * cellSize);
        const size = cellSize * cam.zoom;

        let color;
        if (h > 0) {
          const intensity = Math.min(1, h / 3);
          color = `rgba(${80 + intensity * 60}, ${150 + intensity * 50}, ${80 + intensity * 30}, ${0.3 + intensity * 0.3})`;
        } else {
          const intensity = Math.min(1, Math.abs(h) / 2);
          color = `rgba(${150 - intensity * 50}, ${100 - intensity * 40}, ${50 - intensity * 20}, ${0.3 + intensity * 0.4})`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(p.x, p.y, size + 1, size + 1);
      }
    }

    // 2. Тени
    for (let gy = startY; gy < endY; gy++) {
      for (let gx = startX; gx < endX; gx++) {
        const h = pathfinder.heightMap[gy * pathfinder.cols + gx];
        if (h <= 0) continue;
        const southH = (gy + 1 < pathfinder.rows) ? pathfinder.heightMap[(gy + 1) * pathfinder.cols + gx] : 0;
        if (southH < h) {
          const p = cam.worldToScreen(gx * cellSize, (gy + 1) * cellSize);
          const size = cellSize * cam.zoom;
          const shadowAlpha = Math.min(0.4, (h - southH) * 0.15);
          ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
          ctx.fillRect(p.x, p.y, size + 1, size * 0.6);
        }
      }
    }

    // 3. Этажи (многоуровневые здания)
    if (pathfinder.floorMap) {
      for (let gy = startY; gy < endY; gy++) {
        for (let gx = startX; gx < endX; gx++) {
          const floor = pathfinder.floorMap[gy * pathfinder.cols + gx];
          if (floor === 0) continue;
          
          const p = cam.worldToScreen(gx * cellSize, gy * cellSize);
          const size = cellSize * cam.zoom;
          
          const alpha = Math.min(0.3, floor * 0.15);
          ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
          ctx.fillRect(p.x, p.y, size + 1, size + 1);
          
          ctx.strokeStyle = `rgba(200, 200, 255, ${alpha * 2})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x, p.y, size, size);
        }
      }
    }

    // 4. Изолинии
    if (cam.zoom > 2) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let gy = startY; gy < endY; gy++) {
        for (let gx = startX; gx < endX; gx++) {
          const h = pathfinder.heightMap[gy * pathfinder.cols + gx];
          if (h === 0) continue;
          const hRight = (gx + 1 < pathfinder.cols) ? pathfinder.heightMap[gy * pathfinder.cols + gx + 1] : 0;
          const hDown = (gy + 1 < pathfinder.rows) ? pathfinder.heightMap[(gy + 1) * pathfinder.cols + gx] : 0;

          if (Math.abs(h - hRight) > 0.1) {
            const p1 = cam.worldToScreen((gx + 1) * cellSize, gy * cellSize);
            const p2 = cam.worldToScreen((gx + 1) * cellSize, (gy + 1) * cellSize);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          }
          if (Math.abs(h - hDown) > 0.1) {
            const p1 = cam.worldToScreen(gx * cellSize, (gy + 1) * cellSize);
            const p2 = cam.worldToScreen((gx + 1) * cellSize, (gy + 1) * cellSize);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          }
        }
      }
      ctx.stroke();
    }
  }

  _drawGrid(ctx, x0, y0, x1, y1, step, color) {
    if (!(step > 0)) return;
    const cam = this.camera;

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
      ctx.moveTo(px, y0s); ctx.lineTo(px, y1s);
    }
    const startY = Math.floor(y0 / step) * step;
    for (let y = startY; y <= y1 + 1e-6; y += step) {
      const py = Math.round(cam.worldToScreen(0, y).y) + 0.5;
      ctx.moveTo(x0s, py); ctx.lineTo(x1s, py);
    }
    ctx.stroke();
  }
}
