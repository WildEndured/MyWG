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
    
    this.speed = speed; // м/с (например, 900)
    this.damage = damage;
    this.owner = owner; // Кто выстрелил (чтобы не убить своих)
    
    this.isDead = false;
    this.life = 0;
    this.maxLife = 3.0; // Пуля исчезает через 3 секунды
  }

  update(dt, allUnits, obstacles) {
    if (this.isDead) return;

    this.life += dt;
    if (this.life > this.maxLife) {
      this.isDead = true;
      return;
    }

    // Двигаем пулю
    const step = this.speed * dt;
    const nextX = this.x + this.dirX * step;
    const nextY = this.y + this.dirY * step;

    // 1. Проверка на попадание в стену
    if (obstacles) {
      for (const obs of obstacles) {
        if (nextX >= obs.x && nextX <= obs.x + obs.w && nextY >= obs.y && nextY <= obs.y + obs.h) {
          this.isDead = true;
          EventBus.emit('bullet:impact', { x: nextX, y: nextY, type: 'wall' });
          return;
        }
      }
    }

    // 2. Проверка на попадание в юнита
    for (const unit of allUnits) {
      if (unit.isDead || unit.faction === this.owner.faction) continue;

      // Проверяем расстояние от пули до центра юнита
      const distToUnit = Math.hypot(unit.x - nextX, unit.y - nextY);
      if (distToUnit <= unit.baseRadius) {
        // Попали!
        this.isDead = true;
        
        // Определяем зону попадания
        const hitZone = this.owner._getRandomHitZone();
        unit.takeDamage(this.damage, hitZone);
        
        EventBus.emit('bullet:impact', { x: nextX, y: nextY, type: 'blood' });
        return;
      }
    }

    this.x = nextX;
    this.y = nextY;
  }

  draw(ctx, camera) {
    if (this.isDead) return;
    
    // Рисуем короткую линию (трассер) от предыдущей позиции до текущей
    const p1 = camera.worldToScreen(this.x, this.y);
    const p2 = camera.worldToScreen(this.x - this.dirX * 2, this.y - this.dirY * 2); // Хвост в 2 метра

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = '#FFFF00'; // Желтый
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
