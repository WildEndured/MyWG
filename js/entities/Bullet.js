import { EventBus, EVENTS } from '../core/EventBus.js';
import { getRequiredBr } from '../data/materials.js';
import { CONFIG } from '../data/config.js';

export class Bullet {
  constructor(x, y, targetX, targetY, speed, baseDamage, damageFalloff, maxFalloffDist, penetration, owner, opts = {}) {
    this.x = x; this.y = y; this.prevX = x; this.prevY = y; this.traveled = 0;
    const dx = targetX - x, dy = targetY - y, dist = Math.hypot(dx, dy);
    const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : 0;
    this.speed = speed; this.vx = nx * speed; this.vy = ny * speed; this.initialSpeed = speed;
    this.baseDamage = baseDamage; this.damageFalloff = damageFalloff; this.maxFalloffDist = maxFalloffDist;
    this.penetration = penetration; this.drag = opts.drag ?? CONFIG.BALLISTICS.DRAG_COEFF;
    this.fragmentation = opts.fragmentation ?? 0; this.impulse = opts.impulse ?? 0;
    this.woundingMult = opts.woundingMult ?? 1.0; this.overpenetration = opts.overpenetration ?? 0;
    this.stability = opts.stability ?? 0.9;
    this.mass = opts.mass ?? 0.005;
    this.startZ = opts.startZ ?? 1.2;
    this.isTracer = !!opts.isTracer; this.owner = owner; this.isDead = false;
    this.life = 0; this.maxLife = 3.0; this.hasRicocheted = false;
  }

  update(dt, allUnits, obstacles, pathfinder) {
    if (this.isDead) return;
    dt = Math.min(dt, CONFIG.BALLISTICS.MAX_UPDATE_DT);
    this.life += dt;
    if (this.life > this.maxLife) { this.isDead = true; return; }

    this.vy += CONFIG.BALLISTICS.GRAVITY * dt;

    const env = CONFIG.ENVIRONMENT;
    if (env.WIND_SPEED > 0) {
      const windRad = env.WIND_ANGLE * Math.PI / 180;
      const windVx = Math.cos(windRad) * env.WIND_SPEED;
      const windVy = Math.sin(windRad) * env.WIND_SPEED;
      this.vx += (windVx - this.vx * 0.01) * 0.02 * dt;
      this.vy += (windVy - this.vy * 0.01) * 0.02 * dt;
    }

    const tempK = 273.15 + env.TEMPERATURE;
    const densityRatio = (288.15 / tempK) * (1 - 0.0000226 * env.ALTITUDE);
    const airDensity = CONFIG.BALLISTICS.AIR_DENSITY_SEA_LEVEL * Math.max(0.1, densityRatio);
    const dragFactor = Math.exp(-this.drag * airDensity * dt);
    this.vx *= dragFactor; this.vy *= dragFactor;

    const latRad = env.LATITUDE * Math.PI / 180;
    const coriolisAccel = 2 * CONFIG.BALLISTICS.CORIOLIS_OMEGA * Math.sin(latRad);
    this.vx += coriolisAccel * this.vy * dt * 0.01;

    if (this.stability < 0.9) {
      const wobble = (1 - this.stability) * 0.5;
      this.vx += (Math.random() - 0.5) * wobble * dt * 10;
      this.vy += (Math.random() - 0.5) * wobble * dt * 10;
    }
    
    const mapBottom = pathfinder?.worldSize || 1000;
    if (this.vy > 0 && this.y > mapBottom - 1) {
      const floorMat = env.FLOOR_MATERIAL || 'dirt';
      let ricochetChance = 0.3;
      if (floorMat === 'water') ricochetChance = 0.8;
      else if (floorMat === 'concrete') ricochetChance = 0.4;
      
      if (Math.random() < ricochetChance) {
        this.y = mapBottom - 1;
        this.vy = -this.vy * 0.3;
        this.vx *= 0.8;
        EventBus.emit(EVENTS.BULLET_IMPACT, { x: this.x, y: this.y, type: 'ricochet' });
        return;
      } else {
        this.isDead = true;
        EventBus.emit(EVENTS.BULLET_IMPACT, { x: this.x, y: this.y, type: 'wall' });
        return;
      }
    }

    const nextX = this.x + this.vx * dt, nextY = this.y + this.vy * dt;

    if (pathfinder && pathfinder.heightMap) {
      const terrainZ = pathfinder.getHeight(nextX, nextY);
      const bulletZ = this.startZ - (this.traveled / this.maxFalloffDist) * 0.5;
      if (bulletZ < terrainZ) {
        this.isDead = true;
        EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'terrain' });
        return;
      }
    }

    if (obstacles) {
      for (const obs of obstacles) {
        for (const seg of obs.segments) {
          if (seg.state === 'rubble') continue;
          if (nextX < seg.x || nextX > seg.x + seg.w || nextY < seg.y || nextY > seg.y + seg.h) continue;
          
          const wallThickness = seg.w;
          const requiredBr = getRequiredBr(obs.materialId, wallThickness);

          // НОВОЕ: Деформация стали
          if (obs.materialId === 'steel' && this.baseDamage > 30) {
            pathfinder.damageSegment(obs, nextX, nextY, this.baseDamage * 0.5);
          } else {
            pathfinder.damageSegment(obs, nextX, nextY, this.baseDamage * (this.penetration / requiredBr));
          }
          
          if (obs.matData.destructionType === 'shatter' || obs.matData.destructionType === 'chip') {
             EventBus.emit('debris:spawn', { x: nextX, y: nextY, count: 3, material: obs.materialId, owner: this.owner });
          }
          if (seg.state === 'rubble' || seg.state === 'breached') {
             EventBus.emit('dust:spawn', { x: nextX, y: nextY, radius: 3, duration: 3.0 });
          }

          if (this.penetration >= requiredBr) {
            this.baseDamage *= 0.4;
            this.penetration = Math.max(0, this.penetration - requiredBr);
            this.vx *= 0.5; this.vy *= 0.5;
            EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'wall' });
            break;
          } else {
            if (!this.hasRicocheted && (obs.materialId === 'steel' || obs.materialId === 'concrete')) {
              if (this._incidenceAngle(seg) < 20) {
                this._reflectFromBox(seg); this.hasRicocheted = true;
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
    }

    for (const unit of allUnits) {
      if (!unit || unit.isDead) continue;
      if (this.owner && unit.faction === this.owner.faction) continue;
      const hit = unit.raycastHit ? unit.raycastHit(this.x, this.y, nextX, nextY) : null;
      if (hit) {
        const finalDamage = this._calculateDamage() * this.woundingMult;
        
        if (this.impulse > 0) {
          const speed = Math.hypot(this.vx, this.vy);
          unit.vx += (this.vx / speed) * this.impulse;
          unit.vy += (this.vy / speed) * this.impulse;
        }

        const incidenceAngle = Math.abs(Math.atan2(this.vy, this.vx) * 180 / Math.PI);
        unit.takeDamage(finalDamage, hit.partId, this.penetration, hit.subPartId, incidenceAngle);
        
        EventBus.emit(EVENTS.BULLET_IMPACT, { x: nextX, y: nextY, type: 'blood', amount: finalDamage, unit, hitZone: hit.partId });
        EventBus.emit(EVENTS.SHELL_EJECT, { x: this.x, y: this.y });

        if (this.overpenetration > 0 && Math.random() < this.overpenetration) {
          this.baseDamage *= 0.6; this.penetration = Math.max(0, this.penetration - 2); this.isDead = false;
        } else { this.isDead = true; }

        if (this.fragmentation > 0 && Math.random() < this.fragmentation) unit.applyFragmentation(finalDamage * 0.4);
        return;
      }
    }

    this.traveled += Math.hypot(this.vx, this.vy) * dt;
    this.prevX = this.x; this.prevY = this.y; this.x = nextX; this.y = nextY;
  }

  _calculateDamage() {
    let dmg = this.baseDamage * (0.8 + Math.random() * 0.4);
    const speedRatio = Math.hypot(this.vx, this.vy) / this.initialSpeed;
    const t = Math.min(1, this.traveled / this.maxFalloffDist);
    dmg *= (1.0 - t * this.damageFalloff) * (0.7 + 0.3 * speedRatio);
    return Math.max(0, Math.round(dmg));
  }
  
  _incidenceAngle(seg) {
    const cx = this.prevX, cy = this.prevY;
    const dl = Math.abs(cx - seg.x), dr = Math.abs(cx - (seg.x + seg.w));
    const dt = Math.abs(cy - seg.y), db = Math.abs(cy - (seg.y + seg.h));
    const m = Math.min(dl, dr, dt, db);
    const speed = Math.hypot(this.vx, this.vy) || 1;
    let nx = 0, ny = 0;
    if (m === dl) nx = -1; else if (m === dr) nx = 1; else if (m === dt) ny = -1; else ny = 1;
    const dot = (this.vx / speed) * nx + (this.vy / speed) * ny;
    return Math.acos(Math.max(-1, Math.min(1, -dot))) * 180 / Math.PI;
  }
  
  _reflectFromBox(seg) {
    const cx = this.prevX, cy = this.prevY;
    const dl = Math.abs(cx - seg.x), dr = Math.abs(cx - (seg.x + seg.w));
    const dt = Math.abs(cy - seg.y), db = Math.abs(cy - (seg.y + seg.h));
    const m = Math.min(dl, dr, dt, db);
    if (m === dl || m === dr) this.vx = -this.vx; else this.vy = -this.vy;
    this.vx += (Math.random() - 0.5) * 0.1 * Math.hypot(this.vx, this.vy);
    this.vy += (Math.random() - 0.5) * 0.1 * Math.hypot(this.vx, this.vy);
  }
}
