import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG } from '../data/config.js';
import { Physics } from '../core/Physics.js';

export class Fragment {
  constructor(x, y, vx, vy, baseDamage, owner) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.baseDamage = baseDamage;
    this.owner = owner;
    this.isDead = false;
    this.life = 0;
    this.maxLife = CONFIG.FRAGMENTS.LIFETIME;
    this.size = 0.05; // 5 см
  }

  update(dt, allUnits, obstacles) {
    if (this.isDead) return;

    this.life += dt;
    if (this.life >= this.maxLife) { this.isDead = true; return; }

    // Гравитация (осколки тоже падают)
    this.vy += 4.0 * dt; // Меньше, чем пуля (легкий осколок)

    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // Попадание в юнита
    for (const unit of allUnits) {
      if (!unit || unit.isDead) continue;
      if (this.owner && unit.faction === this.owner.faction) continue;
      const dist = Math.hypot(unit.x - nextX, unit.y - nextY);
      if (dist < unit.baseRadius + this.size) {
        unit.takeDamage(this.baseDamage, 'torso', 2, null, 0);
        unit.applySuppression(0.1);
        this.isDead = true;
        return;
      }
    }

    // Попадание в стену
    if (obstacles) {
      for (const obs of obstacles) {
        for (const seg of obs.segments) {
          if (seg.state === 'rubble') continue;
          if (nextX >= seg.x && nextX <= seg.x + seg.w && nextY >= seg.y && nextY <= seg.y + seg.h) {
            this.isDead = true;
            return;
          }
        }
      }
    }

    this.x = nextX;
    this.y = nextY;
  }
}
