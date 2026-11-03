import { EventBus, EVENTS } from '../core/EventBus.js';
import { getRequiredBr } from '../data/materials.js';
import { CONFIG } from '../data/config.js';

export class Bullet {
  constructor(x, y, targetX, targetY, speed, baseDamage, damageFalloff, maxFalloffDist, penetration, owner, opts = {}) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.traveled = 0;

    // FIX: скорость как вектор + гравитация (Волна 1)
    const dx = targetX - x, dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    this.speed = speed;
    this.vx = nx * speed;
    this.vy = ny * speed;
    this.initialSpeed = speed;

    this.baseDamage = baseDamage;
    this.damageFalloff = damageFalloff;
    this.maxFalloffDist = maxFalloffDist;
    this.penetration = penetration;
    this.drag = opts.drag ?? CONFIG.BALLISTICS.DRAG_COEFF;
    this.fragmentation = opts.fragmentation ?? 0;
    this.isTracer = !!opts.isTracer;

    this.owner = owner;
    this.isDead = false;
    this.life = 0;
    this.maxLife = 3.0;
    this.hasRicocheted = false;

    // Для отрисовки трассера
    this.prevX = x;
    this.prevY = y;
  }

  update(dt, allUnits, obstacles) {
    if (this.isDead) return;

    // FIX: cap dt (Волна 1) — против tunneling
    dt = Math.min(dt, CONFIG.BALLISTICS.MAX_UPDATE_DT);

    this.life += dt;
    if (this.life > this.maxLife) { this.isDead = true; return; }

    // FIX: гравитация + сопротивление воздуха
    this.vy += CONFIG.BALLISTICS.GRAVITY * dt;
    const dragFactor = Math.exp(-this.drag * dt);
    this.vx *= dragFactor;
    this.vy *= dragFactor;

    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // Проверка стен
    if (obstacles) {
      for (const obs of obstacles) {
        if (nextX < obs.x || nextX > obs.x + obs.w || nextY < obs.y || nextY > obs.y + obs.h) continue;

        const wallThickness = this._thicknessAlong(obs);
        const requiredBr = getRequiredBr(obs.materialId, wallThickness);

        if (this.penetration >= requiredBr) {
          // FIX: потеря энергии и пробития
          this.baseDamage *= 0.7;
          this.penetration -= requiredBr * 0.5;
          this.vx *= 0.6;
          this.vy *= 0.6;
          EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'wall' });
          break;
        } else {
          if (!this.hasRicocheted && (obs.materialId === 'steel' || obs.materialId === 'concrete')) {
            // FIX: рикошет только при малом угле падения
            const incidence = this._incidenceAngle(obs);
            if (incidence < 20) {
              this._reflectFromBox(obs);
              this.hasRicocheted = true;
              this.baseDamage *= 0.5;
              this.vx *= 0.7;
              this.vy *= 0.7;
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

    // FIX: проверка юнитов — по хитбоксам (Волна 1)
    for (const unit of allUnits) {
      if (!unit || unit.isDead) continue;
      if (this.owner && unit.faction === this.owner.faction) continue;

      const hit = unit.raycastHit ? unit.raycastHit(this.x, this.y, nextX, nextY) : null;
      if (hit) {
        this.isDead = true;
        const finalDamage = this._calculateDamage();
        const hitZone = hit.partId;
        const subPartId = hit.subPartId;
        unit.takeDamage(finalDamage, hitZone, this.penetration, subPartId);

        // FIX: кровь-декаль (Волна 1)
        EventBus.emit(EVENTS.BULLET_IMPACT, {
          x: nextX, y: nextY, type: 'blood',
          amount: finalDamage, unit, hitZone,
        });

        // FIX: фрагментация (Волна 1)
        if (this.fragmentation > 0 && Math.random() < this.fragmentation) {
          unit.applyFragmentation(finalDamage * 0.4);
        }

        // Подавление от попадания в юнита (соседи шарахаются)
        unit.applySuppression?.(1.0);

        return;
      }
    }

    // Подавление от пролёта рядом (Волна 1)
    this._applySuppression(allUnits);

    this.traveled += Math.hypot(this.vx, this.vy) * dt;
    this.prevX = this.x;
    this.prevY = this.y;
    this.x = nextX;
    this.y = nextY;
  }

  _applySuppression(allUnits) {
    const R = CONFIG.SUPPRESSION.RADIUS;
    const per = CONFIG.SUPPRESSION.PER_BULLET;
    for (const unit of allUnits) {
      if (!unit || unit.isDead) continue;
      if (this.owner && unit.faction === this.owner.faction) continue;
      const d = Math.hypot(unit.x - this.x, unit.y - this.y);
      if (d < R) {
        const f = 1 - d / R;
        unit.applySuppression?.(per * f);
      }
    }
  }

  _incidenceAngle(obs) {
    // Угол между направлением движения и нормалью к ближайшей грани
    const cx = this.prevX, cy = this.prevY;
    const dl = Math.abs(cx - obs.x);
    const dr = Math.abs(cx - (obs.x + obs.w));
    const dt = Math.abs(cy - obs.y);
    const db = Math.abs(cy - (obs.y + obs.h));
    const m = Math.min(dl, dr, dt, db);

    const speed = Math.hypot(this.vx, this.vy) || 1;
    let nx = 0, ny = 0;
    if (m === dl) nx = -1;
    else if (m === dr) nx = 1;
    else if (m === dt) ny = -1;
    else ny = 1;

    // угол между направлением пули и нормалью (0° = строго в стену)
    const dot = (this.vx / speed) * nx + (this.vy / speed) * ny;
    return Math.acos(Math.max(-1, Math.min(1, -dot))) * 180 / Math.PI;
  }

  _thicknessAlong(obs) {
    let tmin = 0, tmax = Infinity;
    const dirs = [[this.vx, obs.x, obs.x + obs.w, this.x], [this.vy, obs.y, obs.y + obs.h, this.y]];
    for (const [d, min, max, start] of dirs) {
      if (Math.abs(d) < 1e-9) {
        if (start < min || start > max) return 0;
      } else {
        let t1 = (min - start) / d;
        let t2 = (max - start) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      }
    }
    return Math.max(0, tmax - tmin);
  }

  _reflectFromBox(obs) {
    const cx = this.prevX, cy = this.prevY;
    const dl = Math.abs(cx - obs.x);
    const dr = Math.abs(cx - (obs.x + obs.w));
    const dt = Math.abs(cy - obs.y);
    const db = Math.abs(cy - (obs.y + obs.h));
    const m = Math.min(dl, dr, dt, db);
    if (m === dl || m === dr) this.vx = -this.vx;
    else this.vy = -this.vy;
    this.vx += (Math.random() - 0.5) * 0.1 * Math.hypot(this.vx, this.vy);
    this.vy += (Math.random() - 0.5) * 0.1 * Math.hypot(this.vx, this.vy);
  }

  _calculateDamage() {
    let dmg = this.baseDamage * (0.8 + Math.random() * 0.4);
    // FIX: falloff по пройденному пути + падение скорости
    const speedRatio = Math.hypot(this.vx, this.vy) / this.initialSpeed;
    const t = Math.min(1, this.traveled / this.maxFalloffDist);
    dmg *= (1.0 - t * this.damageFalloff) * (0.7 + 0.3 * speedRatio);
    return Math.max(0, Math.round(dmg));
  }

  draw(ctx, camera) {
    if (this.isDead) return;

    if (this.isTracer) {
      // FIX: трассер — линия от prev к текущей (Волна 1)
      const p1 = camera.worldToScreen(this.prevX, this.prevY);
      const p2 = camera.worldToScreen(this.x, this.y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = this.hasRicocheted ? '#FF00FF' : 'rgba(255, 220, 80, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const p = camera.worldToScreen(this.x, this.y);
    const r = Math.max(1.2, 1.6 * (camera.zoom / 8));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.hasRicocheted ? '#FF00FF' : (this.isTracer ? '#FFD34D' : '#FFFF88');
    ctx.fill();
  }
}
