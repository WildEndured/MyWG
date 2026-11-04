import { EventBus } from '../core/EventBus.js';
import { Explosion } from './Explosion.js';
import { Fragment } from './Fragment.js';
import { CONFIG } from '../data/config.js';

export class Rocket {
  constructor(x, y, targetX, targetY, owner, config) {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.startX = this.x;
    this.startY = this.y;
    this.owner = owner;
    this.config = config;

    // FIX: флаг для Renderer (устойчиво к минификации, в отличие от constructor.name)
    this.isRocket = true;
    this.isDead = false;
    this.hasExploded = false;

    // Направление
    const dx = (Number.isFinite(targetX) ? targetX : this.x) - this.x;
    const dy = (Number.isFinite(targetY) ? targetY : this.y) - this.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    this.dirX = dx / dist;
    this.dirY = dy / dist;
    this.totalDist = dist;
    this.traveled = 0;

    // Скорость / ускорение
    this.speed = config.initialSpeed || 80;
    this.accel = config.acceleration || 200;
    this.maxSpeed = config.maxSpeed || 250;
    this.life = 0;
    this.maxLife = config.maxLife || 5.0;
    this.radius = 0.15;

    // Высота старта (для визуала/будущей баллистики)
    this.startZ = (owner && owner.pathfinder && owner.pathfinder.getHeight)
      ? (owner.pathfinder.getHeight(this.x, this.y) || 0) + 1.6
      : 1.6;
  }

  update(dt, units, obstacles, pathfinder) {
    if (this.isDead) return;
    if (!Number.isFinite(dt) || dt <= 0) return;

    this.life += dt;
    if (this.life > this.maxLife) {
      this._explode(units, obstacles, pathfinder);
      return;
    }

    // Ускорение
    this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    const step = this.speed * dt;

    // Дробим шаг, чтобы не пролетать сквозь стены/юнитов
    const substeps = Math.max(1, Math.ceil(step / 1.0));
    const subStep = step / substeps;

    const mapSize = (pathfinder && pathfinder.worldSize) ? pathfinder.worldSize : 1000;

    for (let s = 0; s < substeps; s++) {
      const nextX = this.x + this.dirX * subStep;
      const nextY = this.y + this.dirY * subStep;

      // Границы карты
      if (nextX < 0 || nextX > mapSize || nextY < 0 || nextY > mapSize) {
        this.x = Math.max(0, Math.min(mapSize, nextX));
        this.y = Math.max(0, Math.min(mapSize, nextY));
        this._explode(units, obstacles, pathfinder);
        return;
      }

      // Стены
      if (obstacles) {
        let hitWall = false;
        for (const obs of obstacles) {
          if (hitWall) break;
          for (const seg of obs.segments) {
            if (seg.state === 'rubble') continue;
            if (nextX >= seg.x && nextX <= seg.x + seg.w &&
                nextY >= seg.y && nextY <= seg.y + seg.h) {
              this.x = nextX;
              this.y = nextY;
              hitWall = true;
              break;
            }
          }
        }
        if (hitWall) {
          this._explode(units, obstacles, pathfinder);
          return;
        }
      }

      // Юниты
      if (units) {
        for (const unit of units) {
          if (!unit || unit.isDead) continue;
          if (this.owner && unit.faction === this.owner.faction) continue;
          const r = (unit.baseRadius || 0.5) + this.radius;
          if (Math.hypot(unit.x - nextX, unit.y - nextY) < r) {
            this.x = nextX;
            this.y = nextY;
            this._explode(units, obstacles, pathfinder);
            return;
          }
        }
      }

      this.x = nextX;
      this.y = nextY;
      this.traveled += subStep;

      // Долетели до точки цели — взрыв
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

    const cfg = this.config || {};

    // 1. Взрыв
    const ex = new Explosion(
      this.x, this.y,
      cfg.blastRadius || 5.0,
      cfg.baseDamage || 200,
      cfg.fragmentation || 0.3,
      this.owner
    );
    ex.update(0, units, obstacles, pathfinder);
    EventBus.emit('explosion:created', { explosion: ex });

    // 2. Осколки (прямой импорт, без динамического import)
    const fragCount = (CONFIG.FRAGMENTS && CONFIG.FRAGMENTS.COUNT) || 12;
    const fragSpeed = (CONFIG.FRAGMENTS && CONFIG.FRAGMENTS.SPEED) || 40;
    const fragDamageMult = (CONFIG.FRAGMENTS && CONFIG.FRAGMENTS.DAMAGE_MULT) || 0.5;

    for (let i = 0; i < fragCount; i++) {
      const angle = (Math.PI * 2 * i) / fragCount + (Math.random() - 0.5) * 0.3;
      const speed = fragSpeed * (0.5 + Math.random() * 0.5);
      const fragDamage = (cfg.baseDamage || 200) * fragDamageMult * (0.5 + Math.random() * 0.5);
      const frag = new Fragment(
        this.x, this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        fragDamage,
        this.owner
      );
      EventBus.emit('fragment:created', { fragment: frag });
    }

    // 3. Шум (взрыв РПГ громче автомата)
    EventBus.emit('world:noise', {
      x: this.x, y: this.y,
      loudness: cfg.loudness || 1200,
      source: this.owner,
      isExplosion: true
    });
  }
}
