// js/entities/Unit.js

export class Unit {
  constructor(x, y, faction = 'player') {
    this.x = x;
    this.y = y;
    this.faction = faction;
    this.radius = 0.5;
    this.hitRadius = 2.0;
    this.speed = 15;
    this.maxHp = 100;
    this.hp = this.maxHp;
    
    this.isSelected = false;
    this.path = [];
    this.pathIndex = 0;
    this.isMoving = false;
    this.angle = 0;
  }

  // Проверка: находится ли юнит внутри прямоугольника
  isInsideRect(minX, minY, maxX, maxY) {
    return this.x >= minX && this.x <= maxX && this.y >= minY && this.y <= maxY;
  }

  setPath(path) {
    if (!path || path.length === 0) {
      this.isMoving = false;
      this.path = [];
      return;
    }
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = true;
  }

  update(dt) {
    if (!this.isMoving || this.path.length === 0) return;
    if (this.pathIndex >= this.path.length) {
      this.isMoving = false;
      this.path = [];
      return;
    }

    const target = this.path[this.pathIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.5) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.isMoving = false;
        this.path = [];
      }
      return;
    }

    this.angle = Math.atan2(dy, dx);
    const moveStep = this.speed * dt;
    
    if (moveStep >= dist) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;
    } else {
      this.x += (dx / dist) * moveStep;
      this.y += (dy / dist) * moveStep;
    }
  }

  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    const screenRadius = this.radius * camera.zoom;
    const drawRadius = Math.max(3, screenRadius);
    const color = this.faction === 'player' ? '#4285F4' : '#EA4335';
    
    // Тело
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, drawRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Направление
    if (drawRadius > 5) {
      const dirX = screenPos.x + Math.cos(this.angle) * drawRadius * 0.6;
      const dirY = screenPos.y + Math.sin(this.angle) * drawRadius * 0.6;
      ctx.beginPath();
      ctx.arc(dirX, dirY, drawRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    // Выделение
    if (this.isSelected) {
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, drawRadius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#F4B400';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      if (this.isMoving && this.path.length > 0) {
        ctx.beginPath();
        const start = camera.worldToScreen(this.x, this.y);
        ctx.moveTo(start.x, start.y);
        for (let i = this.pathIndex; i < this.path.length; i++) {
          const p = camera.worldToScreen(this.path[i].x, this.path[i].y);
          ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(244, 180, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // HP бар
    if (this.hp < this.maxHp) {
      const barW = Math.max(20, drawRadius * 2);
      const barH = 4;
      const barX = screenPos.x - barW / 2;
      const barY = screenPos.y - drawRadius - 8;
      
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      
      ctx.fillStyle = this.hp > 50 ? '#0F9D58' : '#EA4335';
      ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    }
  }
}
