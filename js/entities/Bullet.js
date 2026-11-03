// js/entities/Bullet.js
import { Physics } from '../core/Physics.js';
import { EventBus } from '../core/EventBus.js';

export class Bullet {
  constructor(x, y, targetX, targetY, speed, damage, owner) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    
    this.dirX = dist > 0 ? dx / dist : 0;
    this.dirY = dist > 0 ? dy / dist : 0;
    
    this.speed = speed; 
    this.damage = damage;
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

    // Стены
    if (obstacles) {
      for (const obs of obstacles) {
        if (nextX >= obs.x && nextX <= obs.x + obs.w && nextY >= obs.y && nextY <= obs.y + obs.h) {
          this.isDead = true;
          return;
        }
      }
    }

    // Юниты
    for (const unit of allUnits) {
      if (unit.isDead || unit.faction === this.owner.faction) continue;

      const distToUnit = Math.hypot(unit.x - nextX, unit.y - nextY);
      if (distToUnit <= unit.baseRadius) {
        this.isDead = true;
        
        // ВЫБОР ЗОНЫ ПРЯМО ЗДЕСЬ, ЧТОБЫ НЕ ВЫЗЫВАТЬ МЕТОД ИЗ UNIT
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
        
        unit.takeDamage(this.damage, hitZone);
        return;
      }
    }

    this.x = nextX;
    this.y = nextY;
  }

  draw(ctx, camera) {
    if (this.isDead) return;
    
    const p1 = camera.worldToScreen(this.x, this.y);
    const p2 = camera.worldToScreen(this.x - this.dirX * 2, this.y - this.dirY * 2);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = '#FFFF00'; 
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
