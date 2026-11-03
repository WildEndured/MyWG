// js/world/FogOfWar.js

export class FogOfWar {
  constructor(camera) {
    this.camera = camera;
    this.cellSize = 5;
    this.grid = {};
  }

  update(dt, units) {
    for (const unit of units) {
      if (unit.isDead) continue;
      this._revealArea(unit);
    }
  }

  _revealArea(unit) {
    const r = unit.detectRange;
    const step = this.cellSize;
    
    const startX = Math.floor((unit.x - r) / step) * step;
    const endX = Math.ceil((unit.x + r) / step) * step;
    const startY = Math.floor((unit.y - r) / step) * step;
    const endY = Math.ceil((unit.y + r) / step) * step;
    
    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        const dist = Math.hypot(x - unit.x, y - unit.y);
        if (dist <= r) {
          const angleToPoint = Math.atan2(y - unit.y, x - unit.x);
          let angleDiff = angleToPoint - unit.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          
          if (Math.abs(angleDiff) <= unit.fovAngle / 2) {
            const key = `${Math.floor(x/step)},${Math.floor(y/step)}`;
            this.grid[key] = true;
          }
        }
      }
    }
  }

  draw(ctx, camera, units) {
    const vw = camera.vw;
    const vh = camera.vh;
    const step = this.cellSize;
    
    ctx.fillStyle = '#0a0c10';
    
    const wTL = camera.screenToWorld(0, 0);
    const wBR = camera.screenToWorld(vw, vh);
    
    const startX = Math.floor(wTL.x / step) * step;
    const endX = Math.ceil(wBR.x / step) * step;
    const startY = Math.floor(wTL.y / step) * step;
    const endY = Math.ceil(wBR.y / step) * step;
    
    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        const key = `${Math.floor(x/step)},${Math.floor(y/step)}`;
        if (!this.grid[key]) {
          const p = camera.worldToScreen(x, y);
          const size = step * camera.zoom;
          ctx.fillRect(p.x, p.y, size + 1, size + 1);
        }
      }
    }
    
    for (const unit of units) {
      if (unit.faction !== 'player' || unit.isDead) continue;
      
      const p = camera.worldToScreen(unit.x, unit.y);
      const r = unit.detectRange * camera.zoom;
      
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, r, unit.angle - unit.fovAngle/2, unit.angle + unit.fovAngle/2);
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.stroke();
    }
  }
}
