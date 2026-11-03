// js/entities/Bullet.js
import { EventBus } from '../core/EventBus.js';

export class Bullet {
  constructor(x, y, targetX, targetY, speed, baseDamage, damageFalloff, maxFalloffDist, penetration, owner) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    
    this.flightDistance = dist; 
    
    this.dirX = dist > 0 ? dx / dist : 0;
    this.dirY = dist > 0 ? dy / dist : 0;
    
    this.speed = speed; 
    this.baseDamage = baseDamage;
    this.damageFalloff = damageFalloff;
    this.maxFalloffDist = maxFalloffDist;
    this.penetration = penetration;
    
    this.owner = owner; 
    this.isDead = false;
    this.life = 0;
    this.maxLife = 3.0; 
  }

  update(dt, allUnits, obstacles) {
    if (this.isDead) return;

    this.life += dt;
    if (this.life > this.maxLife) {
      this.isDead = true;
      return;
    }

    const step = this.speed * dt;
    const nextX = this.x + this.dirX * step;
    const nextY = this.y + this.dirY * step;

    // ПРОВЕРКА СТЕН С ПРОБИТИЕМ
    if (obstacles) {
      for (const obs of obstacles) {
        if (nextX >= obs.x && nextX <= obs.x + obs.w && nextY >= obs.y && nextY <= obs.y + obs.h) {
          
          const wallThickness = Math.min(obs.w, obs.h); // Упрощение: берем меньшую сторону
          let requiredBr = 6; // Максимальный класс (непробиваемое)
          
          if (obs.matData && obs.matData.thicknessData) {
            for (const data of obs.matData.thicknessData) {
              if (wallThickness <= data.thickness) {
                requiredBr = data.requiredBr;
                break;
              }
            }
          }

          if (this.penetration >= requiredBr) {
            // Пробили стену! Летим дальше, но с потерей урона (30%)
            this.baseDamage *= 0.7; 
            EventBus.emit('bullet:impact', { x: nextX, y: nextY, type: 'wall' });
            // Не убиваем пулю, она продолжает полет
          } else {
            // Не пробили — пуля застревает
            this.isDead = true;
            EventBus.emit('bullet:impact', { x: nextX, y: nextY, type: 'wall' });
            return;
          }
        }
      }
    }

    // Проверка юнитов
    for (const unit of allUnits) {
      if (!unit || unit.isDead) continue;
      if (this.owner && unit.faction === this.owner.faction) continue;

      const hit = this._lineIntersectsCircle(
        this.x, this.y, nextX, nextY, 
        unit.x, unit.y, unit.baseRadius
      );

      if (hit) {
        this.isDead = true;
        
        const r = Math.random() * 100;
        let hitZone = 'torso';
        if (r < 5) hitZone = 'head';
        else if (r < 10) hitZone = 'neck';
        else if (r < 50) hitZone = 'torso';
        else if (r < 60) hitZone = 'pelvis';
        else if (r < 70) hitZone = 'leftArm';
        else if (r < 80) hitZone = 'rightArm';
        else if (r < 90) hitZone = 'leftLeg';
        else hitZone = 'rightLeg';
        
        const finalDamage = this._calculateDamage();
        unit.takeDamage(finalDamage, hitZone, this.penetration);
        EventBus.emit('bullet:impact', { x: nextX, y: nextY, type: 'blood' });
        return;
      }
    }

    this.x = nextX;
    this.y = nextY;
  }

  _calculateDamage() {
    let dmg = this.baseDamage * (0.8 + Math.random() * 0.4);
    const penaltyPercent = Math.min(this.damageFalloff, (this.flightDistance / this.maxFalloffDist) * this.damageFalloff);
    dmg *= (1.0 - penaltyPercent);
    return Math.round(dmg);
  }

  _lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  draw(ctx, camera) {
    if (this.isDead) return;
    
    const p = camera.worldToScreen(this.x, this.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFF00'; 
    ctx.fill();
  }
}
