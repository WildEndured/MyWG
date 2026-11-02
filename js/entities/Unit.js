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
    
    // Ссылка на поисковик пути для проверки стен (устанавливается из менеджера)
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
    // 1. Физика: расталкивание от других юнитов
    if (allUnits) {
      this._separateFromOthers(dt, allUnits);
    }

    // 2. Движение по пути
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
    
    // Куда мы шагнем
    const nextX = this.x + (dx / dist) * moveStep;
    const nextY = this.y + (dy / dist) * moveStep;

    // 3. ЗАЩИТА ОТ СТЕН: проверяем, свободна ли следующая точка
    if (this._isWalkable(nextX, nextY)) {
      if (moveStep >= dist) {
        this.x = target.x;
        this.y = target.y;
        this.pathIndex++;
      } else {
        this.x = nextX;
        this.y = nextY;
      }
    } else {
      // Если впереди стена — останавливаемся (путь прикажет перестроить менеджер)
      this.isMoving = false;
    }
  }

  _isWalkable(x, y) {
    if (!this.pathfinder) return true;
    const grid = this.pathfinder.worldToGrid(x, y);
    return this.pathfinder.grid[grid.y * this.pathfinder.cols + grid.x] === 0;
  }

  // Локальное расталкивание (чтобы юниты не стояли в одной точке)
  _separateFromOthers(dt, allUnits) {
    let pushX = 0;
    let pushY = 0;
    const minDist = this.radius * 2; // Диаметр юнита

    for (const other of allUnits) {
      if (other === this) continue;
      
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dist = Math.hypot(dx, dy);
      
      // Если дистанция слишком маленькая (пересекаются)
      if (dist < minDist && dist > 0.01) {
        const force = (minDist - dist) / minDist; 
        pushX += (dx / dist) * force;
        pushY += (dy / dist) * force;
      }
    }

    // Применяем расталкивание (с небольшим коэффициентом, чтобы не дергались)
    const pushSpeed = 5; // Скорость расталкивания
    if (pushX !== 0 || pushY !== 0) {
      this.x += pushX * pushSpeed * dt;
      this.y += pushY * pushSpeed * dt;
    }
  }

  draw(ctx, camera) {
    // ... (отрисовка остается БЕЗ ИЗМЕНЕНИЙ из прошлого файла)
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
