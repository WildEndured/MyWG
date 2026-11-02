// js/entities/Unit.js

export class Unit {
  constructor(x, y, faction = 'player', type = 'infantry') {
    this.x = x;
    this.y = y;
    
    this.faction = faction; 
    this.type = type; 
    
    // Базовые размеры
    this.baseRadius = 0.5; 
    this.hitRadius = 2.0; 
    
    // Позы и скорость
    this.stance = 'stand'; // 'stand', 'run', 'crouch', 'prone'
    this.speed = 0;
    this._updateSpeed();
    
    this.maxHp = 100;
    this.hp = this.maxHp;
    
    this.isSelected = false;
    
    this.path = [];        
    this.pathIndex = 0;    
    this.isMoving = false;
    
    this.angle = 0;        
    this.targetAngle = 0;
    
    this.pathfinder = null; 
  }

  _updateSpeed() {
    switch (this.stance) {
      case 'run': this.speed = 4.5; break;
      case 'stand': this.speed = 1.4; break;
      case 'crouch': this.speed = 0.8; break;
      case 'prone': this.speed = 0.4; break;
      default: this.speed = 1.4;
    }
  }

  setStance(newStance) {
    if (this.stance === newStance) return;
    this.stance = newStance;
    this._updateSpeed();
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
          this.targetAngle = Math.atan2(dy, dx);
          
          const moveStep = this.speed * dt;
          const nextX = this.x + (dx / dist) * moveStep;
          const nextY = this.y + (dy / dist) * moveStep;

          // Лежачие игнорируют стены (проходят сквозь них)
          if (this.stance === 'prone' || this._isPositionFree(nextX, nextY)) {
            this.x = nextX;
            this.y = nextY;
          } else {
            if (this._isPositionFree(nextX, this.y)) {
              this.x = nextX;
            } else if (this._isPositionFree(this.x, nextY)) {
              this.y = nextY;
            } else {
              this.isMoving = false;
              this.path = [];
            }
          }
        }
      }
    }

    // Плавный поворот
    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * Math.min(10 * dt, 1);

    // Расталкивание (только если не лежим)
    if (allUnits && this.stance !== 'prone') {
      this._separate(allUnits, dt);
    }
  }

  _isPositionFree(x, y) {
    if (!this.pathfinder || !this.pathfinder.obstacles) return true;

    for (const obs of this.pathfinder.obstacles) {
      const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.h));
      
      const dx = x - closestX;
      const dy = y - closestY;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < this.baseRadius * this.baseRadius) {
        return false; 
      }
    }
    return true;
  }

  _separate(allUnits, dt) {
    let pushX = 0;
    let pushY = 0;
    const minDist = this.baseRadius * 2; 

    for (const other of allUnits) {
      if (other === this || other.stance === 'prone') continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      
      if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue;

      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const force = (minDist - dist) / minDist; 
        pushX += (dx / dist) * force;
        pushY += (dy / dist) * force;
      }
    }

    if (pushX !== 0 || pushY !== 0) {
      const pushSpeed = 5;
      const nx = this.x + pushX * pushSpeed * dt;
      const ny = this.y + pushY * pushSpeed * dt;
      if (this._isPositionFree(nx, ny)) {
        this.x = nx;
        this.y = ny;
      }
    }
  }

  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    
    // Цвет фракции
    const color = this.faction === 'player' ? '#4285F4' : '#EA4335';
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.angle);
    
    // Отрисовка в зависимости от позы
    if (this.stance === 'prone') {
      // Лёжа — овал (ширина 0.8м, длина 1.6м)
      const w = 0.8 * camera.zoom;
      const h = 1.6 * camera.zoom;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3, h/2), Math.max(2, w/2), 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
    } else {
      // Стоя или на корточках — круг
      const drawRadius = Math.max(3, this.baseRadius * camera.zoom);
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      
      // Точка направления (только для стоячих и бегущих)
      if (drawRadius > 5 && this.stance !== 'crouch') {
        ctx.beginPath();
        ctx.arc(drawRadius * 0.6, 0, drawRadius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
    
    ctx.restore();

    // Выделение (желтое кольцо вокруг центра)
    if (this.isSelected) {
      ctx.beginPath();
      const ringRadius = this.stance === 'prone' ? (1.6 * camera.zoom) / 2 : Math.max(3, this.baseRadius * camera.zoom);
      ctx.arc(screenPos.x, screenPos.y, ringRadius + 4, 0, Math.PI * 2);
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
      const barW = Math.max(20, this.baseRadius * camera.zoom * 2);
      const barH = 4;
      const barX = screenPos.x - barW / 2;
      const barY = screenPos.y - (this.baseRadius * camera.zoom) - 12;
      
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      
      ctx.fillStyle = this.hp > 50 ? '#0F9D58' : '#EA4335';
      ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    }
  }
}
