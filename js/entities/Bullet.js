import { EventBus, EVENTS } from '../core/EventBus.js';
import { getRequiredBr } from '../data/materials.js';

export class Bullet {
  constructor(x, y, targetX, targetY, speed, baseDamage, damageFalloff, maxFalloffDist, penetration, owner) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.traveled = 0; // FIX: считаем пройденный путь, а не начальную дистанцию

    const dx = targetX - x, dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    this.dirX = dist > 0 ? dx / dist : 0;
    this.dirY = dist > 0 ? dy / dist : 0;

    this.speed = speed;
    this.baseDamage = baseDamage;
    this.damageFalloff = damageFalloff;
    this.maxFalloffDist = maxFalloffDist;
    this.penetration = penetration;
    this.owner = owner;
    this.isDead = false;
    this.life = 0;
    this.maxLife = 3.0;
    this.hasRicocheted = false;
  }

  update(dt, allUnits, obstacles) {
    if (this.isDead) return;

    // FIX: cap dt — против tunneling
    dt = Math.min(dt, 0.033);

    this.life += dt;
    if (this.life > this.maxLife) { this.isDead = true; return; }

    const step = this.speed * dt;
    const nextX = this.x + this.dirX * step;
    const nextY = this.y + this.dirY * step;

    // FIX: прерываем цикл после рикошета/пробития, чтобы не обрабатывать ту же стену дважды
    if (obstacles) {
      for (const obs of obstacles) {
        if (nextX < obs.x || nextX > obs.x + obs.w || nextY < obs.y || nextY > obs.y + obs.h) continue;

        // FIX: толщина по направлению движения, а не min(w,h)
        const wallThickness = this._thicknessAlong(obs);
        const requiredBr = getRequiredBr(obs.materialId, wallThickness);

        if (this.penetration >= requiredBr) {
          this.baseDamage *= 0.7;
          EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'wall' });
          break; // пуля прошла сквозь стену — обрабатываем только один удар за шаг
        } else {
          if (!this.hasRicocheted && (obs.materialId === 'steel' || obs.materialId === 'concrete')) {
            // FIX: отражение по нормали грани, а не разворот на 180°
            this._reflectFromBox(obs);
            this.hasRicocheted = true;
            this.baseDamage *= 0.5;
            EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'ricochet' });
            break;
          } else {
            this.isDead = true;
            EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'wall' });
            return;
          }
        }
      }
    }

    // FIX: проверка юнитов — тоже только первое попадание
    for (const unit of allUnits) {
      if (!unit || unit.isDead) continue;
      if (this.owner && unit.faction === this.owner.faction) continue;

      if (this._lineIntersectsCircle(this.x, this.y, nextX, nextY, unit.x, unit.y, unit.baseRadius)) {
        this.isDead = true;
        const hitZone = this._rollHitZone();
        const finalDamage = this._calculateDamage();
        unit.takeDamage(finalDamage, hitZone, this.penetration);
        EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'blood' });
        return;
      }
    }

    this.traveled += step;
    this.x = nextX;
    this.y = nextY;
  }

  _thicknessAlong(obs) {
    // Приблизительно: длина отрезка внутри AABB вдоль направления
    let tmin = 0, tmax = Infinity;
    const dirs = [[this.dirX, obs.x, obs.x + obs.w], [this.dirY, obs.y, obs.y + obs.h]];
    for (const [d, min, max] of dirs) {
      if (Math.abs(d) < 1e-9) {
        if (this.x < min || this.x > max) return 0;
      } else {
        let t1 = (min - this.x) / d;
        let t2 = (max - this.x) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      }
    }
    return Math.max(0, (tmax - tmin));
  }

  _reflectFromBox(obs) {
    // Определяем, в какую грань попали, по проникновению
    const cx = this.x, cy = this.y;
    const dl = Math.abs(cx - obs.x);
    const dr = Math.abs(cx - (obs.x + obs.w));
    const dt = Math.abs(cy - obs.y);
    const db = Math.abs(cy - (obs.y + obs.h));
    const m = Math.min(dl, dr, dt, db);
    if (m === dl || m === dr) this.dirX = -this.dirX;
    else this.dirY = -this.dirY;
    // Лёгкий разброс
    this.dirX += (Math.random() - 0.5) * 0.1;
    this.dirY += (Math.random() - 0.5) * 0.1;
    const len = Math.hypot(this.dirX, this.dirY) || 1;
    this.dirX /= len; this.dirY /= len;
  }

  _rollHitZone() {
    const r = Math.random() * 100;
    if (r < 5) return 'head';
    if (r < 10) return 'neck';
    if (r < 50) return 'torso';
    if (r < 60) return 'pelvis';
    if (r < 70) return 'leftArm';
    if (r < 80) return 'rightArm';
    if (r < 90) return 'leftLeg';
    return 'rightLeg';
  }

  _calculateDamage() {
    let dmg = this.baseDamage * (0.8 + Math.random() * 0.4);
    // FIX: penalty зависит от пройденного пути, не от начальной дистанции
    const t = Math.min(1, this.traveled / this.maxFalloffDist);
    dmg *= (1.0 - t * this.damageFalloff);
    return Math.max(0, Math.round(dmg));
  }

  _lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-12) return (fx * fx + fy * fy) <= r * r; // FIX: защита от a=0
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a);
    const t2 = (-b + disc) / (2 * a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  draw(ctx, camera) {
    if (this.isDead) return;
    const p = camera.worldToScreen(this.x, this.y);
    const r = Math.max(1.5, 2 * (camera.zoom / 8));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.hasRicocheted ? '#FF00FF' : '#FFFF00';
    ctx.fill();
  }
}
