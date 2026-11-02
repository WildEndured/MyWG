// js/entities/Unit.js

export class Unit {
  constructor(x, y, faction = 'player', type = 'infantry') {
    this.x = x;
    this.y = y;
    
    this.faction = faction; 
    this.type = type; 
    
    this.baseRadius = 0.5; 
    this.hitRadius = 2.0; 
    
    this.stance = 'stand'; 
    this.speed = 0;
    this._updateSpeed();
    
    this.maxHp = 100;
    this.hp = this.maxHp;
    
    // --- СИСТЕМА ВЫНОСЛИВОСТИ ---
    this.maxStamina = 100;          // Общая выносливость (макс запас)
    this.stamina = 100;             // Текущая стамина
    this.speedEndurance = 1.0;      // Скоростная выносливость (чем выше, тем быстрее тратится)
    this.recoveryRate = 10;         // Восстановление стамины в секунду (стоя на месте)
    
    this.staminaCooldown = 0;       // Задержка перед началом восстановления после бега
    
    this.isSelected = false;
    
    this.path = [];        
    this.pathIndex = 0;    
    this.isMoving = false;
    
    this.angle = 0;        
    this.targetAngle = 0;
    
    this.pathfinder = null; 
    this.needsRepath = false;
    this.lastTarget = null;
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
    
    // Если пытаемся бежать, но нет сил — не даем
    if (newStance === 'run' && this.stamina < 10) return;

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
    this.needsRepath = false;
  }

  update(dt, allUnits) {
    // 1. Обновление логики пути
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

          if (this.stance === 'prone' || this._isPositionFree(nextX, nextY)) {
            this.x = nextX;
            this.y = nextY;
          } else {
            // Скольжение вдоль стены
            let slid = false;
            if (this._isPositionFree(nextX, this.y)) {
              this.x = nextX;
              slid = true;
            } else if (this._isPositionFree(this.x, nextY)) {
              this.y = nextY;
              slid = true;
            }

            if (!slid) {
              this.isMoving = false;
              this.path = [];
              this.needsRepath = true; 
            }
          }
        }
      }
    }

    // 2. Логика выносливости
    this._updateStamina(dt);

    // 3. Поворот
    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * Math.min(10 * dt, 1);

    // 4. Расталкивание
    if (allUnits && this.stance !== 'prone') {
      this._separate(allUnits, dt);
    }
  }

  _updateStamina(dt) {
    // Расход стамины в зависимости от позы и движения
    if (this.isMoving) {
      let drain = 0;
      if (this.stance === 'run') drain = 8 * this.speedEndurance;       // Бег тратит много
      else if (this.stance === 'stand') drain = 0.5 * this.speedEndurance; // Шаг тратит чуть-чуть
      else if (this.stance === 'crouch') drain = 0.2 * this.speedEndurance;
      else if (this.stance === 'prone') drain = 0.05 * this.speedEndurance;
      
      this.stamina -= drain * dt;
      this.staminaCooldown = 2.0; // 2 секунды после остановки/смены позы не восстанавливаемся
    } else {
      // Восстановление, если стоим
      if (this.staminaCooldown > 0) {
        this.staminaCooldown -= dt;
      } else {
        // Стоя восстанавливаемся быстрее, чем лежа
        let recoveryMultiplier = 1.0;
        if (this.stance === 'stand') recoveryMultiplier = 1.0;
        else if (this.stance === 'crouch') recoveryMultiplier = 1.2;
        else if (this.stance === 'prone') recoveryMultiplier = 1.5;
        
        this.stamina += this.recoveryRate * recoveryMultiplier * dt;
      }
    }

    // Ограничения
    this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina));

    // Принудительный переход в шаг, если бежим и стамина кончилась
    if (this.stance === 'run' && this.stamina <= 0) {
      this.setStance('stand');
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
    const color = this.faction === 'player' ? '#4285F4' : '#EA4335';
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.angle);
    
    if (this.stance === 'prone') {
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
      const drawRadius = Math.max(3, this.baseRadius * camera.zoom);
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      
      if (drawRadius > 5 && this.stance !== 'crouch') {
        ctx.beginPath();
        ctx.arc(drawRadius * 0.6, 0, drawRadius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
    
    ctx.restore();

    // Выделение
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

    // --- ОТРИСОВКА HP И СТАМИНЫ ---
    const isDamaged = this.hp < this.maxHp;
    const isTired = this.stamina < this.maxStamina;
    
    if (isDamaged || isTired) {
      const barW = Math.max(20, this.baseRadius * camera.zoom * 2);
      const barH = 3;
      const barX = screenPos.x - barW / 2;
      
      let currentY = screenPos.y - (this.baseRadius * camera.zoom) - 12;

      // HP бар
      if (isDamaged) {
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, currentY, barW, barH);
        ctx.fillStyle = this.hp > 50 ? '#0F9D58' : '#EA4335';
        ctx.fillRect(barX, currentY, barW * (this.hp / this.maxHp), barH);
        currentY -= (barH + 2); // Сдвигаем вверх для следующего бара
      }

      // Бар стамины
      if (isTired) {
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, currentY, barW, barH);
        // Цвет: желтый если норма, красный если на нуле
        ctx.fillStyle = this.stamina > 20 ? '#F4B400' : '#EA4335';
        ctx.fillRect(barX, currentY, barW * (this.stamina / this.maxStamina), barH);
      }
    }
  }
}
