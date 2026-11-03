class DebugClass {
  constructor() {
    this.isEnabled = false;
    this.fps = 0;
    this.frameTime = 0;
    this.frames = 0;
    this.fpsAccum = 0;

    this._onKeyDown = (e) => {
      if (e.key === '`' || e.key === 'F1') {
        this.isEnabled = !this.isEnabled;
        EventBus?.emit?.('debug:toggled', this.isEnabled);
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  setEnabled(v) {
    this.isEnabled = !!v;
    EventBus?.emit?.('debug:toggled', this.isEnabled);
  }

  update(realDt) {
    if (!this.isEnabled) { this.frames = 0; this.fpsAccum = 0; return; }
    this.frames++;
    this.fpsAccum += realDt;
    this.frameTime = realDt * 1000;
    if (this.fpsAccum >= 1.0) {
      this.fps = Math.round(this.frames / this.fpsAccum);
      this.frames = 0;
      this.fpsAccum = 0;
    }
  }

  draw(ctx, camera, unitManager, map, pathfinder) {
    if (!this.isEnabled) return;

    // FIX: используем camera.vw/vh (CSS-пиксели) — единый источник
    const vw = camera.vw;
    const vh = camera.vh;

    if (pathfinder) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      const cellSize = pathfinder.cellSize;

      const wTL = camera.screenToWorld(0, 0);
      const wBR = camera.screenToWorld(vw, vh);

      const startX = Math.max(0, Math.floor(wTL.x / cellSize));
      const endX = Math.min(pathfinder.cols, Math.ceil(wBR.x / cellSize));
      const startY = Math.max(0, Math.floor(wTL.y / cellSize));
      const endY = Math.min(pathfinder.rows, Math.ceil(wBR.y / cellSize));

      for (let gy = startY; gy < endY; gy++) {
        for (let gx = startX; gx < endX; gx++) {
          if (pathfinder.grid[gy * pathfinder.cols + gx] === 1) {
            const p = camera.worldToScreen(gx * cellSize, gy * cellSize);
            const size = cellSize * camera.zoom;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(p.x, p.y, size, size);
          }
        }
      }
    }

    if (unitManager) {
      for (const unit of unitManager.units) {
        if (unit.isDead) continue;
        const p = camera.worldToScreen(unit.x, unit.y);

        ctx.beginPath();
        ctx.arc(p.x, p.y, unit.baseRadius * camera.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, unit.hitRadius * camera.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.stroke();

        if (unit.isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, unit.weapon.effectiveRange * camera.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(80, 150, 255, 0.2)';
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#0f0';
          ctx.font = '10px monospace';
          ctx.fillText(`HP: ${Math.round(unit.hp)}/${unit.maxHp}`, p.x + 10, p.y - 10);
          ctx.fillText(`Stam: ${Math.round(unit.stamina)}`, p.x + 10, p.y + 5);
          ctx.fillText(`W: ${(unit.totalWeight || 0).toFixed(1)}kg`, p.x + 10, p.y + 20);
        }
      }
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 10, 220, 96);
    ctx.strokeStyle = '#0f0';
    ctx.strokeRect(10, 10, 220, 96);

    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${this.fps}`, 20, 30);
    ctx.fillText(`Frame: ${this.frameTime.toFixed(2)}ms`, 20, 50);
    ctx.fillText(`Units: ${unitManager?.units?.length ?? 0}`, 20, 70);
    ctx.fillText(`Bullets: ${unitManager?.bullets?.length ?? 0}`, 20, 90);
    ctx.fillText(`Time scale: ${(window.__TimeManager?.timeScale ?? 1).toFixed(1)}`, 20, 110);
  }
}

import { EventBus } from './EventBus.js';
export const Debug = new DebugClass();
