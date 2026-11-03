import { EventBus, EVENTS } from '../core/EventBus.js';
import { Physics } from '../core/Physics.js';
import { CONFIG } from '../data/config.js';

export class Explosion {
  constructor(x, y, radius, baseDamage, fragmentation, owner) {
    this.x = x; this.y = y; this.radius = radius;
    this.baseDamage = baseDamage; this.fragmentation = fragmentation;
    this.owner = owner;
    this.isDead = false;
    this.life = 0.0;
    this.maxLife = 0.3; // Время визуального эффекта
    this.hasDetonated = false;
  }

  update(dt, units, obstacles) {
    this.life += dt;
    if (this.life >= this.maxLife) this.isDead = true;

    if (this.hasDetonated) return;
    this.hasDetonated = true;

    // 1. Урон и осколки
    for (const unit of units) {
      if (unit.isDead) continue;
      const dist = Math.hypot(unit.x - this.x, unit.y - this.y);
      if (dist > this.radius) continue;

      // Проверка на препятствия (стены гасят взрыв)
      if (!Physics.hasLineOfSight(this.x, this.y, unit.x, unit.y, obstacles)) continue;

      const distFactor = 1 - (dist / this.radius); // 1.0 в центре, 0.0 на краю
      const dmg = this.baseDamage * distFactor;
      
      // Осколки (фрагментация)
      if (Math.random() < this.fragmentation) {
        unit.applyFragmentation(dmg * 0.5);
      }

      // Основной урон
      unit.takeDamage(dmg, 'torso', 6, null);
      
      // Шок и подавление
      unit.shock += distFactor * 0.5;
      unit.applySuppression(distFactor * 0.8);
      
      // Отбрасывание
      if (dist > 0.1) {
        const angle = Math.atan2(unit.y - this.y, unit.x - this.x);
        const pushForce = distFactor * 10;
        unit.vx += Math.cos(angle) * pushForce;
        unit.vy += Math.sin(angle) * pushForce;
      }
    }

    // 2. Разрушение стен
    if (obstacles) {
      for (const obs of obstacles) {
        const dist = Math.hypot(obs.x + obs.w/2 - this.x, obs.y + obs.h/2 - this.y);
        if (dist > this.radius) continue;
        const distFactor = 1 - (dist / this.radius);
        obs.hp -= this.baseDamage * distFactor * 2;
        if (obs.hp <= 0) {
          // Удаляем стену (если есть pathfinder)
          EventBus.emit(EVENTS.BULLET_IMPACT, { x: obs.x, y: obs.y, type: 'wall_break' });
        }
      }
    }

    // 3. Звук взрыва
    EventBus.emit(EVENTS.WORLD_NOISE, { 
      x: this.x, y: this.y, 
      loudness: 1200, 
      source: this.owner, 
      isExplosion: true 
    });
    
    EventBus.emit(EVENTS.EXPLOSION, { x: this.x, y: this.y, radius: this.radius });
  }
}
