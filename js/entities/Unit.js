// js/entities/Unit.js
export class Unit {
  constructor(x, y, faction = 'player') {
    this.x = x;
    this.y = y;
    
    this.faction = faction;
    this.radius = 1.5;
    this.speed = 15; // Чуть замедлили для красоты
    this.maxHp = 100;
    this.hp = this.maxHp;
    
    this.isSelected = false;
    
    // Движение по пути
    this.path = [];        // Массив точек {x, y}
    this.pathIndex = 0;    // Текущая точка, к которой едем
    this.isMoving = false;
    
    this.angle = 0;        // Угол поворота для отрисовки
  }

  setPath(path) {
    if (!path || path.length === 0) return;
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = true;
  }

  update(dt) {
    if (!this.isMoving || this.path.length === 0) return;

    const target = this.path[this.pathIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Если достигли текущей точки пути
    if (dist < 1.0) { // Порог 1 метр
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        // Дошли до конца
        this.isMoving = false;
        this.path = [];
      }
      return;
    }

    // Вычисляем угол (для отрисовки направления)
    this.angle = Math.atan2(dy, dx);

    // Двигаемся
    const moveStep = this.speed * dt;
    if (moveStep >= dist) {
      this.x = target.x;
      this.y = target.y;
    } else {
      this.x += (dx / dist) * moveStep;
      this.y += (dy / dist) * moveStep;
    }
  }

  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    const screenRadius = this.radius * camera.zoom;

    // ... (Отрисовка круга, выделения и HP остаются как были) ...
    const color = this.faction === 'player' ? '#4285F4' : '#EA4335';
    
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Отрисовка направления (маленькая точка впереди)
    if (screenRadius > 4) {
      const dirX = screenPos.x + Math.cos(this.angle) * screenRadius * 0.6;
      const dirY = screenPos.y + Math.sin(this.angle) * screenRadius * 0.6;
      ctx.beginPath();
      ctx.arc(dirX, dirY, screenRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    if (this.isSelected) {
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, screenRadius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#F4B400';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Если выделен и есть путь — рисуем линию пути (отладочная инфа)
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
  }
}
