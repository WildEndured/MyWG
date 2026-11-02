// js/entities/Unit.js

export class Unit {
  constructor(x, y, faction = 'player', type = 'infantry') {
    this.x = x;
    this.y = y;
    
    this.faction = faction; 
    this.type = type; 
    
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
    
    this.pathfinder = null; 
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

  update(dt, allUnits) {
    if (this.isMoving && this.path.length > 0) {
      if (this.pathIndex >= this.path.length) {
        this.isMoving = false;
        this.path = [];
      } else {
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
        } else {
          this.angle = Math.atan2(dy, dx);
          const moveStep = this.speed * dt;
          
          const nextX = this.x + (dx / dist) * moveStep;
          const nextY = this.y + (dy / dist) * moveStep;

          // Проверяем физическую коллизию (круг против прямоугольников)
          if (this._isPositionFree(nextX, nextY)) {
            if (moveStep >= dist) {
              this.x = target.x;
              this.y = target.y;
              this.pathIndex++;
            } else {
              this.x = nextX;
              this.y = nextY;
            }
          } else {
            // Если впереди стена, пробуем скользить вдоль неё (упрощенно - просто стоп)
            this.isMoving = false;
            this.path = [];
          }
        }
      }
    }

    // Расталкивание от юнитов
    if (allUnits) {
      this._separate(allUnits, dt);
    }
  }

  // ТОЧНАЯ ФИЗИЧЕСКАЯ ПРОВЕРКА
  _isPositionFree(x, y) {
    if (!this.pathfinder || !this.pathfinder.obstacles) return true;

    for (const obs of this.pathfinder.obstacles) {
      // Проверяем, пересекается ли круг (x, y, radius) с прямоугольником obs
      const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.h));
      
      const dx = x - closestX;
      const dy = y - closestY;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < this.radius * this.radius) {
        return false; // Пересекаемся со стеной
      }
    }
    return true;
  }

  _separate(allUnits, dt) {
    let pushX = 0;
    let pushY = 0;
    const minDist = this.radius * 2; 

    for (const other of allUnits) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < minDist && dist > 0.01) {
        const force = (minDist - dist) / minDist; 
        pushX += (dx / dist) * force;
        pushY += (dy / dist) * force;
      }
    }

    if (pushX !== 0 || pushY !== 0) {
      const pushSpeed = 5;
      const nx = this.x + pushX * pushSpeed * dt;
      const ny = this.y + pushY * pushSpeed * dt;
      // Проверяем, что расталкивание не вытолкнет в стену
      if (this._isPositionFree(nx, ny)) {
        this.x = nx;
        this.y = ny;
      }
    }
  }

  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    const screenRadius = this.radius * camera.zoom;
    const drawRadius = Math.max(3, screenRadius);
    const color = this.faction === 'player' ? '#4285F4' : '#EA4335';
    
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, drawRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    if (drawRadius > 5) {
      const dirX = screenPos.x + Math.cos(this.angle) * drawRadius * 0.6;
      const dirY = screenPos.y + Math.sin(this.angle) * drawRadius * 0.6;
      ctx.beginPath();
      ctx.arc(dirX, dirY, drawRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

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
