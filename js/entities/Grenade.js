import { EventBus } from '../core/EventBus.js';
import { Physics } from '../core/Physics.js';
import { Explosion } from './Explosion.js';
import { Fragment } from './Fragment.js';
import { CONFIG } from '../data/config.js';

export class Grenade {
  constructor(x, y, targetX, targetY, owner, config) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.owner = owner;
    this.config = config;
    
    this.isDead = false;
    this.hasExploded = false;
    this.fuseTimer = config.fuseTime;
    
    const dx = targetX - x, dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    const timeToTarget = Math.min(1.5, dist / 20);
    
    this.vx = dx / timeToTarget;
    this.vy = (dy / timeToTarget) - 0.5 * 9.81 * timeToTarget;
    
    if (dist > config.throwRange) {
      const scale = config.throwRange / dist;
      this.vx *= scale;
      this.vy *= scale;
    }

    this.prevX = x; this.prevY = y;
    this.radius = 0.1;
    this.hasLanded = false;
  }

  update(dt, units, obstacles, pathfinder) {
    if (this.isDead) return;

    this.fuseTimer -= dt;
    if (this.fuseTimer <= 0 && !this.hasExploded) {
      this._explode(units, obstacles, pathfinder);
      return;
    }

    if (this.hasExploded) return;

    if (!this.hasLanded) {
      this.vy += 9.81 * dt;
      const nextX = this.x + this.vx * dt;
      const nextY = this.y + this.vy * dt;

      if (obstacles) {
        for (const obs of obstacles) {
          for (const seg of obs.segments) {
            if (seg.state === 'rubble') continue;
            if (nextX >= seg.x && nextX <= seg.x + seg.w && nextY >= seg.y && nextY <= seg.y + seg.h) {
              this.vx *= -0.3;
              this.vy *= -0.3;
              break;
            }
          }
        }
      }

      const mapBottom = pathfinder?.worldSize || 1000;
      if (nextY >= mapBottom - 0.2) {
        this.y = mapBottom - 0.2;
        this.hasLanded = true;
        this.vx = 0; this.vy = 0;
      } else {
        this.x = nextX;
        this.y = nextY;
      }

      this.prevX = this.x;
      this.prevY = this.y;
    }
  }

  _explode(units, obstacles, pathfinder) {
    this.hasExploded = true;
    this.isDead = true;

    const ex = new Explosion(
      this.x, this.y, 
      this.config.blastRadius, 
      this.config.baseDamage, 
      this.config.fragmentation, 
      this.owner
    );
    ex.update(0.016, units, obstacles, pathfinder);
    
    EventBus.emit('explosion:created', { explosion: ex });

    // НОВОЕ: Создаем осколки конусом
    const fragCount = CONFIG.FRAGMENTS.COUNT;
    for (let i = 0; i < fragCount; i++) {
      const angle = (Math.PI * 2 * i) / fragCount + (Math.random() - 0.5) * 0.3;
      const speed = CONFIG.FRAGMENTS.SPEED * (0.5 + Math.random() * 0.5);
      const fragDamage = this.config.baseDamage * CONFIG.FRAGMENTS.DAMAGE_MULT * (0.5 + Math.random() * 0.5);
      
      const frag = new Fragment(
        this.x, this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        fragDamage,
        this.owner
      );
      
      EventBus.emit('fragment:created', { fragment: frag });
    }
  }
}
