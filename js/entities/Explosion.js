import { EventBus, EVENTS } from '../core/EventBus.js';
import { Physics } from '../core/Physics.js';

export class Explosion {
  constructor(x, y, radius, baseDamage, fragmentation, owner) {
    this.x = x; this.y = y; this.radius = radius;
    this.baseDamage = baseDamage; this.fragmentation = fragmentation;
    this.owner = owner;
    this.isDead = false;
    this.life = 0.0;
    this.maxLife = 0.3;
    this.hasDetonated = false;
  }

  update(dt, units, obstacles, pathfinder) {
    this.life += dt;
    if (this.life >= this.maxLife) this.isDead = true;
    if (this.hasDetonated) return;
    this.hasDetonated = true;

    // 1. Урон юнитам
    for (const unit of units) {
      if (unit.isDead) continue;
      const dist = Math.hypot(unit.x - this.x, unit.y - this.y);
      if (dist > this.radius) continue;
      if (!Physics.hasLineOfSight(this.x, this.y, unit.x, unit.y, obstacles)) continue;

      const distFactor = 1 - (dist / this.radius);
      const dmg = this.baseDamage * distFactor;
      
      if (Math.random() < this.fragmentation) unit.applyFragmentation(dmg * 0.5);
      unit.takeDamage(dmg, 'torso', 6, null);
      
      unit.shock += distFactor * 0.5;
      unit.applySuppression(distFactor * 0.8);
      
      if (dist > 0.1) {
        const angle = Math.atan2(unit.y - this.y, unit.x - this.x);
        const pushForce = distFactor * 10;
        unit.vx += Math.cos(angle) * pushForce;
        unit.vy += Math.sin(angle) * pushForce;
      }
    }

    // 2. Разрушение стен (по сегментам)
    if (obstacles && pathfinder) {
      for (const obs of obstacles) {
        for (const seg of obs.segments) {
          if (seg.state === 'rubble') continue;
          const dist = Math.hypot(seg.x + seg.w/2 - this.x, seg.y + seg.h/2 - this.y);
          if (dist > this.radius) continue;
          
          const distFactor = 1 - (dist / this.radius);
          pathfinder.damageSegment(obs, seg.x + seg.w/2, seg.y + seg.h/2, this.baseDamage * distFactor * 2);

          // Визуальные эффекты
          if (seg.state === 'rubble' || seg.state === 'breached') {
            EventBus.emit('debris:spawn', { x: seg.x + seg.w/2, y: seg.y + seg.h/2, count: 5, material: obs.materialId, owner: this.owner });
            EventBus.emit('dust:spawn', { x: seg.x + seg.w/2, y: seg.y + seg.h/2, radius: 4, duration: 4.0 });
          }
        }
      }
    }

    EventBus.emit(EVENTS.WORLD_NOISE, { x: this.x, y: this.y, loudness: 1200, source: this.owner, isExplosion: true });
    EventBus.emit(EVENTS.EXPLOSION, { x: this.x, y: this.y, radius: this.radius });
  }
}
