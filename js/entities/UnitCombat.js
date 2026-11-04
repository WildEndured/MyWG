import { Bullet } from './Bullet.js';
import { Grenade } from './Grenade.js';
import { Explosion } from './Explosion.js';
import { EXPLOSIVES } from '../data/weapons.js';
import { VISION_CONFIG } from '../data/vision.js';
import { Physics } from '../core/Physics.js';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { AudioManager } from '../core/AudioManager.js';
import { CONFIG } from '../data/config.js';

export function applyCombatMixin(UnitProto) {
  UnitProto.throwGrenade = function(targetX, targetY, world) {
    if (this.grenades <= 0 || this.isDead || this.medical.isApplying) return false;
    const grenadeConfig = EXPLOSIVES.grenade_rgd5;
    const dist = Math.hypot(targetX - this.x, targetY - this.y);
    if (dist > grenadeConfig.throwRange) return false;

    this.grenades--;
    const grenade = new Grenade(this.x, this.y, targetX, targetY, this, grenadeConfig);

    if (world && world.unitManager) world.unitManager.grenades.push(grenade);
    return true;
  };

  UnitProto._visibilityCheck = function(other, obstacles) {
    const dx = other.x - this.x, dy = other.y - this.y, dist = Math.hypot(dx, dy);

    let heightBonus = 0;
    if (this.pathfinder && this.pathfinder.heightMap) {
      const myH = this.pathfinder.getHeight(this.x, this.y);
      const otherH = this.pathfinder.getHeight(other.x, other.y);
      if (myH > otherH) heightBonus = (myH - otherH) * 10;
    }

    const effectiveRange = this.detectRange + heightBonus;

    if (dist > effectiveRange) return { visible: false, dist, angle: 0, central: false };

    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = angleToTarget - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const absAngle = Math.abs(angleDiff),
          centralHalf = (VISION_CONFIG.centralAngle * Math.PI / 180) / 2,
          fovHalf = this.fovAngle / 2;

    if (absAngle > fovHalf) return { visible: false, dist, angle: absAngle, central: false };

    let rangeLimit = effectiveRange;
    if (absAngle > centralHalf) rangeLimit = VISION_CONFIG.peripheralRange + heightBonus;
    if (dist > rangeLimit) return { visible: false, dist, angle: absAngle, central: false };

    const eye1 = this.stance === 'prone' ? 0.5 : 1.6;
    const eye2 = other.stance === 'prone' ? 0.5 : 1.6;
    if (!Physics.hasLineOfSight(this.x, this.y, other.x, other.y, obstacles, this.pathfinder, eye1, eye2)) {
      return { visible: false, dist, angle: absAngle, central: absAngle <= centralHalf };
    }

    if (other.stance === 'crouch' && dist > 30) return { visible: false, dist, angle: absAngle, central: false };
    return { visible: true, dist, angle: absAngle, central: absAngle <= centralHalf };
  };

  UnitProto._updatePerception = function(dt, allUnits, obstacles, now) {
    for (const [target, mem] of this.perception) {
      if (target.isDead) { this.perception.delete(target); continue; }
      mem.seen = Math.max(0, mem.seen - CONFIG.PERCEPTION.LOSE_PER_SEC * dt);
      if (mem.seen <= 0 && now - mem.lastSeen > CONFIG.PERCEPTION.MEMORY_SEC) this.perception.delete(target);
    }
    if (now - this._lastScanTime < this._scanInterval) return;
    this._lastScanTime = now;

    for (const other of allUnits) {
      if (other === this || other.faction === this.faction || other.isDead) continue;
      const vis = this._visibilityCheck(other, obstacles);
      if (!vis.visible) continue;
      const fillRate = vis.central ? 1 / CONFIG.PERCEPTION.CENTRAL_FILL_SEC : 1 / CONFIG.PERCEPTION.PERIPHERAL_FILL_SEC;
      const mem = this.perception.get(other) || { seen: 0, lastX: other.x, lastY: other.y, lastSeen: now, angle: 0 };
      const distMult = 1 + (1 - Math.min(1, vis.dist / Math.max(1, this.detectRange))) * 1.0;
      mem.seen = Math.min(1, mem.seen + fillRate * this._scanInterval * distMult);
      mem.lastX = other.x; mem.lastY = other.y; mem.lastSeen = now; mem.angle = vis.angle;
      this.perception.set(other, mem);
      if (this.brain) {
        this.brain.memory.lastEnemyPos = { x: other.x, y: other.y };
        this.brain.memory.lastEnemyTime = now;
      }
    }
  };

  UnitProto._pickEngageTarget = function() {
    let best = null, bestScore = -Infinity;
    for (const [target, mem] of this.perception) {
      if (target.isDead) continue;
      if (mem.seen < CONFIG.PERCEPTION.ENGAGE_THRESHOLD) continue;

      const dist = Math.hypot(target.x - this.x, target.y - this.y);
      if (dist > this.weapon.effectiveRange) continue;

      let score = 100 - dist;
      if (target.roleId === 'machine_gunner') score += 50;
      if (target.roleId === 'grenadier') score += 40;
      if (target.roleId === 'squad_leader') score += 60;
      if (target.isVehicle) score += 100;
      if (target.target === this) score += 30;
      if (target.isMoving) score += 10;
      if (target.hp < target.maxHp * 0.3) score += 20;
      if (target.stance === 'prone') score -= 20;
      if (mem.central) score += 20;

      if (score > bestScore) { bestScore = score; best = target; }
    }
    return best;
  };

  UnitProto.canSee = function(target, obstacles) {
    const vis = this._visibilityCheck(target, obstacles);
    if (!vis.visible) return false;
    const mem = this.perception.get(target);
    return mem ? mem.seen >= CONFIG.PERCEPTION.ENGAGE_THRESHOLD : false;
  };

  UnitProto._updateCombat = function(dt, allUnits, currentTime, worldState) {
    this.target = this._pickEngageTarget();
    if (!this.target) return;

    // Граната в укрытие
    if (this.grenades > 0 && this.target) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      const hasLOS = Physics.hasLineOfSight(this.x, this.y, this.target.x, this.target.y, this.pathfinder?.obstacles, this.pathfinder);
      if (!hasLOS && dist < 25 && dist > 5) {
        if (Math.random() < 0.1) {
          this.throwGrenade(this.target.x, this.target.y, worldState);
          return;
        }
      }
    }

    if (this.weapon.ammo <= 0 && this.weapon.reserveMagazines <= 0 && this.grenades > 0) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (dist < 30) this.throwGrenade(this.target.x, this.target.y, worldState);
      return;
    }

    if (this.weapon.ammo <= 0 && this.weapon.reserveMagazines <= 0) return;
    if (this.isSurrendered) return;

    const mem = this.perception.get(this.target);
    const targetDist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
    const stale = mem && (currentTime - mem.lastSeen) > 2.0;

    this.targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.weapon.updateFireMode(targetDist);

    if (stale || this.medical.isApplying || this.shockTimer > 0) return;
    if (this.isPressed && this.stance !== 'prone' && this.stance !== 'crouch') return;
    if (this.stanceTransition && CONFIG.STANCE.FIRE_BLOCKED) return;
    if (this.weapon.isJammed || this.weapon.isMisfired) return;

    if (this.weapon.canFire(currentTime)) {
      const b = this._shoot(currentTime);
      if (b) this.pendingBullets.push(b);
    }
  };

  UnitProto._shoot = function(currentTime) {
    if (!this.isArmed || this.isUnconscious) return null;
    if (!this.weapon.fire(currentTime)) return null;

    const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
    let spread = this.weapon.spreadBase * (dist / 100);

    if (this.isLimping) spread *= 2.0;
    const speedRatio = Math.min(1, Math.hypot(this.vx, this.vy) / Math.max(0.1, this.speeds.stand));
    spread *= (1 + speedRatio * 3);

    if (this.stamina < 20) spread *= 1.5;
    if (this.blood < 70) spread *= 1.2;
    if (this.blood < 40) spread *= 1.5;
    if (this.target.isMoving) spread *= 1.5;
    if (this.target.stance === 'prone') spread *= 1.2;
    else if (this.target.stance === 'crouch') spread *= 1.1;

    spread *= this.weapon.getRecoilSpreadMultiplier();
    spread *= (1 + this.suppression * 1.5);

    const aimBonus = Math.min(this.aimTime / Math.max(0.1, this.maxAimTime), 1.0);
    spread *= (1.0 - aimBonus * 0.7);
    spread = Math.max(0.01, Math.min(spread, 20));
    const hitChance = Math.max(0.1, 1 - (spread / 10));

    // FIX: camera через window.__camera, чтобы не падало
    const cam = (typeof window !== 'undefined') ? window.__camera : null;
    AudioManager.playGunshot(this.x, this.y, cam, this.weapon.loudness);

    EventBus.emit(EVENTS.UNIT_SHOOT, { x1: this.x, y1: this.y, x2: this.target.x, y2: this.target.y, isMuzzleFlash: true });
    EventBus.emit(EVENTS.WORLD_NOISE, { x: this.x, y: this.y, loudness: this.weapon.loudness, source: this, isGunshot: true });
    this.tinnitus = 1.0;

    let tx = this.target.x, ty = this.target.y;
    if (Math.random() >= hitChance) {
      const ang = Math.atan2(ty - this.y, tx - this.x) + (Math.random() - 0.5) * 0.6;
      const missDist = dist + (Math.random() - 0.5) * 60;
      tx = this.x + Math.cos(ang) * missDist;
      ty = this.y + Math.sin(ang) * missDist;
    }

    // FIX: РПГ — это взрыв, а не пуля
    if (this.weapon.isExplosive) {
      const cfg = EXPLOSIVES.grenade_rpg;
      const expl = new Explosion(tx, ty, cfg.blastRadius, cfg.baseDamage, cfg.fragmentation, this);
      this.pendingExplosions.push(expl);
      return null;
    }

    const isTracer = (this.weapon.shotsFired % CONFIG.BALLISTICS.TRACER_EVERY_N) === 0;
    return new Bullet(
      this.x, this.y, tx, ty,
      this.weapon.bulletSpeed, this.weapon.baseDamage,
      this.weapon.damageFalloff, this.weapon.maxFalloffDist,
      this.weapon.penetration, this,
      {
        drag: this.weapon.drag,
        fragmentation: this.weapon.fragmentation,
        impulse: this.weapon.impulse,
        isTracer,
        woundingMult: this.weapon.woundingMult,
        overpenetration: this.weapon.overpenetration,
        startZ: (this.pathfinder?.getHeight(this.x, this.y) || 0) + (this.stance === 'prone' ? 0.5 : 1.6)
      }
    );
  };
}
