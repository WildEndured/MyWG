import { EventBus, EVENTS } from '../core/EventBus.js';
import { getRequiredBr } from '../data/materials.js';
import { CONFIG } from '../data/config.js';

export class Bullet {
  constructor(x, y, targetX, targetY, speed, baseDamage, damageFalloff, maxFalloffDist, penetration, owner, opts = {}) {
    this.x = x; this.y = y; this.prevX = x; this.prevY = y;
    this.traveled = 0;
    const dx = targetX - x, dy = targetY - y, dist = Math.hypot(dx, dy);
    const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : 0;
    this.speed = speed; this.vx = nx * speed; this.vy = ny * speed; this.initialSpeed = speed;
    this.baseDamage = baseDamage; this.damageFalloff = damageFalloff; this.maxFalloffDist = maxFalloffDist;
    this.penetration = penetration; this.drag = opts.drag ?? CONFIG.BALLISTICS.DRAG_COEFF;
    this.fragmentation = opts.fragmentation ?? 0; this.impulse = opts.impulse ?? 0; // Импульс
    this.isTracer = !!opts.isTracer; this.owner = owner; this.isDead = false;
    this.life = 0; this.maxLife = 3.0; this.hasRicocheted = false;
  }

  update(dt, allUnits, obstacles, pathfinder) {
    if (this.isDead) return;
    dt = Math.min(dt, CONFIG.BALLISTICS.MAX_UPDATE_DT);
    this.life += dt;
    if (this.life > this.maxLife) { this.isDead = true; return; }

    this.vy += CONFIG.BALLISTICS.GRAVITY * dt;
    const dragFactor = Math.exp(-this.drag * dt);
    this.vx *= dragFactor; this.vy *= dragFactor;
    const nextX = this.x + this.vx * dt, nextY = this.y + this.vy * dt;

    // СТЕНЫ И РАЗРУШЕНИЕ
    if (obstacles) {
      for (const obs of obstacles) {
        if (nextX < obs.x || nextX > obs.x + obs.w || nextY < obs.y || nextY > obs.y + obs.h) continue;
        const wallThickness = this._thicknessAlong(obs);
        const requiredBr = getRequiredBr(obs.materialId, wallThickness);

        // Урон стене
        obs.hp -= this.baseDamage * (this.penetration / requiredBr);
        if (obs.hp <= 0) {
          pathfinder.removeObstacle(obs);
          EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'wall_break' });
        }

        if (this.penetration >= requiredBr) {
          this.baseDamage *= 0.7; this.penetration -= requiredBr * 0.5;
          this.vx *= 0.6; this.vy *= 0.6;
          EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'wall' });
          break;
        } else {
          if (!this.hasRicocheted && (obs.materialId === 'steel' || obs.materialId === 'concrete')) {
            if (this._incidenceAngle(obs) < 20) {
              this._reflectFromBox(obs); this.hasRicocheted = true;
              this.baseDamage *= 0.5; this.vx *= 0.7; this.vy *= 0.7;
              EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'ricochet' });
              break;
            }
          }
          this.isDead = true;
          EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'wall' });
          return;
        }
      }
    }

    // ЮНИТЫ
    for (const unit of allUnits) {
      if (!unit || unit.isDead) continue;
      if (this.owner && unit.faction === this.owner.faction) continue;
      const hit = unit.raycastHit ? unit.raycastHit(this.x, this.y, nextX, nextY) : null;
      if (hit) {
        this.isDead = true;
        const finalDamage = this._calculateDamage();
        
        // Импульс сбивает с ног / отталкивает
        if (this.impulse > 0) {
          const speed = Math.hypot(this.vx, this.vy);
          unit.vx += (this.vx / speed) * this.impulse;
          unit.vy += (this.vy / speed) * this.impulse;
        }

        unit.takeDamage(finalDamage, hit.partId, this.penetration, hit.subPartId);
        EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'blood', amount: finalDamage, unit, hitZone: hit.partId });

        if (this.fragmentation > 0 && Math.random() < this.fragmentation) {
          unit.applyFragmentation(finalDamage * 0.4);
        }
        return;
      }
    }

    this.traveled += Math.hypot(this.vx, this.vy) * dt;
    this.prevX = this.x; this.prevY = this.y; this.x = nextX; this.y = nextY;
  }

  _incidenceAngle(obs) {
    const cx = this.prevX, cy = this.prevY;
    const dl = Math.abs(cx - obs.x), dr = Math.abs(cx - (obs.x + obs.w));
    const dt = Math.abs(cy - obs.y), db = Math.abs(cy - (obs.y + obs.h));
    const m = Math.min(dl, dr, dt, db);
    const speed = Math.hypot(this.vx, this.vy) || 1;
    let nx = 0, ny = 0;
    if (m === dl) nx = -1; else if (m === dr) nx = 1; else if (m === dt) ny = -1; else ny = 1;
    const dot = (this.vx / speed) * nx + (this.vy / speed) * ny;
    return Math.acos(Math.max(-1, Math.min(1, -dot))) * 180 / Math.PI;
  }

  _thicknessAlong(obs) {
    let tmin = 0, tmax = Infinity;
    const dirs = [[this.vx, obs.x, obs.x + obs.w, this.x], [this.vy, obs.y, obs.y + obs.h, this.y]];
    for (const [d, min, max, start] of dirs) {
      if (Math.abs(d) < 1e-9) { if (start < min || start > max) return 0; }
      else { let t1 = (min - start) / d; let t2 = (max - start) / d; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
    }
    return Math.max(0, tmax - tmin);
  }

  _reflectFromBox(obs) {
    const cx = this.prevX, cy = this.prevY;
    const dl = Math.abs(cx - obs.x), dr = Math.abs(cx - (obs.x + obs.w));
    const dt = Math.abs(cy - obs.y), db = Math.abs(cy - (obs.y + obs.h));
    const m = Math.min(dl, dr, dt, db);
    if (m === dl || m === dr) this.vx = -this.vx; else this.vy = -this.vy;
    this.vx += (Math.random() - 0.5) * 0.1 * Math.hypot(this.vx, this.vy);
    this.vy += (Math.random() - 0.5) * 0.1 * Math.hypot(this.vx, this.vy);
  }

  _calculateDamage() {
    let dmg = this.baseDamage * (0.8 + Math.random() * 0.4);
    const speedRatio = Math.hypot(this.vx, this.vy) / this.initialSpeed;
    const t = Math.min(1, this.traveled / this.maxFalloffDist);
    dmg *= (1.0 - t * this.damageFalloff) * (0.7 + 0.3 * speedRatio);
    return Math.max(0, Math.round(dmg));
  }
}
