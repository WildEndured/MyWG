import { EventBus, EVENTS } from '../core/EventBus.js';
import { Explosion } from './Explosion.js';
import { CONFIG } from '../data/config.js';

export class Rocket {
  constructor(x, y, targetX, targetY, owner, config) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.owner = owner;
    this.config = config;

    const dx = targetX - x, dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 0.001;
    this.dirX = dx / dist;
    this.dirY = dy / dist;
    this.totalDist = dist;

    this.speed = config.initialSpeed || 80;
    this.accel = config.acceleration || 200;
    this.maxSpeed = config.maxSpeed || 250;
    this.isDead = false;
    this.hasExploded = false;
    this.life = 0;
    this.maxLife = config.maxLife || 5.0;
    this.radius = 0.15;
    this.startZ = (owner.pathfinder?.getHeight(x, y) || 0) + 1.6;
    this.traveled = 0;
  }

  update(dt, units, obstacles, pathfinder) {
    if (this.isDead) return;

    this.life += dt;
    if (this.life > this.maxLife) {
      this._explode(units, obstacles, pathfinder);
      return;
    }

    // Ускорение
    this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    const step = this.speed * dt;

    // Дробим шаг на подшаги (защита от туннелирования)
    const substeps = Math.max(1, Math.ceil(step / 1.0));
    const subStep = step / substeps;

    for (let s = 0; s < substeps; s++) {
      const nextX = this.x + this.dirX * subStep;
      const nextY = this.y + this.dirY * subStep;

      // Границы карты
      const mapSize = pathfinder?.worldSize || 1000;
      if (nextX < 0 || nextX > mapSize || nextY < 0 || nextY > mapSize) {
        this._explode(units, obstacles, pathfinder);
        return;
      }

      // Стены
      if (obstacles) {
        for (const obs of obstacles) {
          for (const seg of obs.segments) {
            if (seg.state === 'rubble') continue;
            if (nextX >= seg.x && nextX <= seg.x + seg.w && nextY >= seg.y && nextY <= seg.y + seg.h) {
              this._explode(units, obstacles, pathfinder);
              return;
            }
          }
        }
      }

      // Юниты
      for (const unit of units) {
        if (!unit || unit.isDead) continue;
        if (this.owner && unit.faction === this.owner.faction) continue;
        if (Math.hypot(unit.x - nextX, unit.y - nextY) < unit.baseRadius + this.radius) {
          this._explode(units, obstacles, pathfinder);
          return;
        }
      }

      this.x = nextX;
      this.y = nextY;
      this.traveled += subStep;

      // Если долетели до цели — взрыв
      if (this.traveled >= this.totalDist) {
        this._explode(units, obstacles, pathfinder);
        return;
      }
    }
  }

  _explode(units, obstacles, pathfinder) {
    if (this.hasExploded) return;
    this.hasExploded = true;
    this.isDead = true;

    const ex = new Explosion(
      this.x, this.y,
      this.config.blastRadius,
      this.config.baseDamage,
      this.config.fragmentation,
      this.owner
    );
    ex.update(0, units, obstacles, pathfinder);
    EventBus.emit('explosion:created', { explosion: ex });

    // Осколки
    const fragCount = CONFIG.FRAGMENTS.COUNT;
    for (let i = 0; i < fragCount; i++) {
      const angle = (Math.PI * 2 * i) / fragCount + (Math.random() - 0.5) * 0.3;
      const speed = CONFIG.FRAGMENTS.SPEED * (0.5 + Math.random() * 0.5);
      const fragDamage = this.config.baseDamage * CONFIG.FRAGMENTS.DAMAGE_MULT * (0.5 + Math.random() * 0.5);
      // Динамический импорт, чтобы не плодить циклы
      import('./Fragment.js').then(({ Fragment }) => {
        const frag = new Fragment(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed, fragDamage, this.owner);
        EventBus.emit('fragment:created', { fragment: frag });
      });
    }
  }
}
