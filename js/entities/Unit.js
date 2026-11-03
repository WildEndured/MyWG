import { Weapon } from './Weapon.js';
import { WEAPONS } from '../data/weapons.js';
import { ROLES, BASE_HUMAN } from '../data/units.js';
import { BODY_PARTS, calcTotalHp, calcMaxTotalHp } from '../data/health.js';
import { ARMOR_CONFIGS, ARMOR_CLASSES, findArmorForHit } from '../data/armor.js';
import { VISION_CONFIG, AUDIO_CONFIG } from '../data/vision.js';
import { Physics } from '../core/Physics.js';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';
import { CONFIG } from '../data/config.js';

export class Unit {
  constructor(x, y, faction = 'player', roleId = 'infantry') {
    this.x = x; this.y = y;
    this.faction = faction;

    this.baseRadius = BASE_HUMAN.baseRadius;
    this.hitRadius = BASE_HUMAN.hitRadius;
    this.isDead = false;
    this.isUnconscious = false;

    this.bodyParts = {};
    for (const [partId, partData] of Object.entries(BODY_PARTS)) {
      this.bodyParts[partId] = {
        hp: partData.maxHp,
        maxHp: partData.maxHp,
        fatal: !!partData.fatal,
        bleedRate: partData.bleedRate || 0,
        hitbox: partData.hitbox ? { ...partData.hitbox } : null,
        stanceScale: partData.stanceScale ? { ...partData.stanceScale } : { stand: 1, crouch: 1, prone: 1 },
        subParts: partData.subParts
          ? partData.subParts.map(s => ({ ...s, maxHp: s.hp }))
          : null,
      };
    }

    this.maxHp = calcMaxTotalHp(this.bodyParts);
    this.hp = this.maxHp;

    this.maxBlood = 100;
    this.blood = 100;
    this.bleedingRate = 0;

    this.maxStamina = BASE_HUMAN.maxStamina;
    this.stamina = this.maxStamina;
    this.baseRecoveryRate = BASE_HUMAN.baseRecoveryRate;
    this.staminaCooldown = 0;

    const role = ROLES[roleId] || ROLES['infantry'];
    this.roleId = role.id;
    this.name = role.name;

    const weaponConfig = WEAPONS[role.defaultWeapon];
    this.weapon = new Weapon(weaponConfig);
    this.maxAimTime = this.weapon.maxAimTime;

    this.armor = {};
    let armorWeight = 0;
    for (const armorId of BASE_HUMAN.defaultArmor) {
      const config = ARMOR_CONFIGS[armorId];
      if (!config) continue;
      const armorClass = ARMOR_CLASSES[config.class];
      armorWeight += config.weight;
      const piece = {
        name: config.name,
        level: armorClass.level,
        durability: config.durability,
        maxDurability: config.maxDurability ?? config.durability,
        durabilityLossMult: config.durabilityLossMult || 1.0,
        coveredSubParts: config.coveredSubParts || [],
      };
      for (const zone of config.covers) {
        if (!this.armor[zone] || this.armor[zone].level < piece.level) {
          this.armor[zone] = piece;
        }
      }
    }

    this.totalWeight = this.weapon.weightLoaded + armorWeight;
    this.staminaPenalty = Math.max(1.0, this.totalWeight / 10.0);
    this.speeds = this._calculateSpeeds(BASE_HUMAN.nakedSpeeds, this.totalWeight);

    this.stance = 'stand';
    this.speed = this.speeds[this.stance];

    this.fovAngle = VISION_CONFIG.fovAngle * (Math.PI / 180);
    this.detectRange = VISION_CONFIG.detectRange;
    this.identifyRange = VISION_CONFIG.identifyRange;

    this.tinnitus = 0;
    this.hearingMultiplier = 1.0;
    this.lastNoiseTime = 0;

    this.isArmed = true;
    this.isLimping = false;
    this.aimTime = 0;

    this.target = null;
    this.isSelected = false;
    this.path = [];
    this.pathIndex = 0;
    this.isMoving = false;

    this.angle = 0;
    this.targetAngle = 0;

    this.pathfinder = null;
    this.needsRepath = false;
    this.lastTarget = null;
    this.lastHeardNoise = null;
    this.pendingBullets = [];

    // FIX: подавление (Волна 1)
    this.suppression = 0;   // 0..1
    this.pressedTimer = 0;  // сколько секунд «прижат»
  }

  getTotalHp() { return calcTotalHp(this.bodyParts); }
  getMaxTotalHp() { return calcMaxTotalHp(this.bodyParts); }

  // FIX: подавление (Волна 1)
  applySuppression(amount) {
    if (this.isDead) return;
    this.suppression = Math.min(1, this.suppression + amount);
    if (this.suppression >= CONFIG.SUPPRESSION.THRESHOLD_PANIC && this.stance !== 'prone') {
      // В панике падает
      this.setStance('prone');
    }
  }

  get isPressed() {
    return this.suppression >= CONFIG.SUPPRESSION.THRESHOLD_PRESSED;
  }

  // FIX: фрагментация (Волна 1)
  applyFragmentation(amount) {
    if (this.isDead) return;
    // Распределяем по 2 случайным подчастям торса
    const torso = this.bodyParts.torso;
    if (!torso?.subParts) return;
    for (let i = 0; i < 2; i++) {
      const sub = torso.subParts[Math.floor(Math.random() * torso.subParts.length)];
      sub.hp -= amount;
      if (sub.hp <= 0) { sub.hp = 0; if (sub.fatal) { this._die(); return; } }
    }
    this.hp = this.getTotalHp();
    if (this.hp <= 0) this._die();
  }

  // FIX: хитбоксы (Волна 1) — raycast по хитбоксам всех частей тела
  // Возвращает { partId, subPartId, t } или null
  raycastHit(x1, y1, x2, y2) {
    let best = null;
    let bestT = Infinity;

    for (const [partId, part] of Object.entries(this.bodyParts)) {
      if (!part.hitbox || part.hp <= 0) continue;

      const scale = part.stanceScale[this.stance] ?? 1;
      // локальные координаты -> мир (поворот на angle)
      const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
      const lx = part.hitbox.dx;
      const ly = part.hitbox.dy;
      const cx = this.x + lx * cos - ly * sin;
      const cy = this.y + lx * sin + ly * cos;
      const r = part.hitbox.r * scale;

      const t = this._rayCircle(x1, y1, x2, y2, cx, cy, r);
      if (t !== null && t < bestT) {
        bestT = t;
        // Выбираем подчасть по весам, но только если она ещё жива
        let subPartId = null;
        if (part.subParts) {
          const alive = part.subParts.filter(s => s.hp > 0);
          if (alive.length) {
            const totalW = alive.reduce((s, p) => s + p.weight, 0);
            let rnd = Math.random() * totalW;
            for (const s of alive) {
              rnd -= s.weight;
              if (rnd <= 0) { subPartId = s.id; break; }
            }
          }
        }
        best = { partId, subPartId, t: bestT };
      }
    }
    return best;
  }

  _rayCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-12) return (fx * fx + fy * fy) <= r * r ? 0 : null;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a);
    const t2 = (-b + disc) / (2 * a);
    if (t1 >= 0 && t1 <= 1) return t1;
    if (t2 >= 0 && t2 <= 1) return t2;
    return null;
  }

  takeDamage(amount, hitZone = 'torso', penetrationLevel = 0, forcedSubPartId = null) {
    if (this.isDead) return;
    let finalDamage = amount;

    const part = this.bodyParts[hitZone];
    if (!part) return;

    let chosenSub = null;
    if (forcedSubPartId && part.subParts) {
      chosenSub = part.subParts.find(s => s.id === forcedSubPartId) || null;
    }

    const armorPiece = findArmorForHit(this.armor, hitZone, chosenSub?.id);

    if (armorPiece && armorPiece.durability > 0) {
      const lossMult = armorPiece.durabilityLossMult || 1.0;
      if (penetrationLevel > armorPiece.level) {
        armorPiece.durability = Math.max(0, armorPiece.durability - amount * 0.5 * lossMult);
      } else if (penetrationLevel === armorPiece.level) {
        finalDamage = amount * 0.7;
        armorPiece.durability = Math.max(0, armorPiece.durability - amount * 0.8 * lossMult);
      } else {
        finalDamage = amount * 0.1;
        armorPiece.durability = Math.max(0, armorPiece.durability - amount * 0.1 * lossMult);
        this.stamina = Math.max(0, this.stamina - amount * 0.5);
      }
    }

    let localBleed = part.bleedRate || 0;

    if (chosenSub) {
      chosenSub.hp -= finalDamage;
      if (chosenSub.bleedRate > localBleed) localBleed = chosenSub.bleedRate;
      if (chosenSub.hp <= 0) {
        chosenSub.hp = 0;
        if (chosenSub.fatal) { this._die(); return; }
      }
    } else {
      part.hp -= finalDamage;
    }

    if (part.hp <= 0) {
      part.hp = 0;
      if (part.fatal) { this._die(); return; }
    }

    if (finalDamage > 5 && localBleed > 0) {
      this.bleedingRate = Math.max(this.bleedingRate, localBleed);
    }

    if (hitZone === 'leftLeg' || hitZone === 'rightLeg') this.isLimping = true;
    if (hitZone === 'leftArm' || hitZone === 'rightArm') {
      this.isArmed = false;
      this.weapon.isReloading = false;
    }

    this.hp = this.getTotalHp();
    if (this.hp <= 0) this._die();
  }

  _die() {
    if (this.isDead) return;
    this.isDead = true;
    this.isMoving = false;
    this.path = [];
    this.isSelected = false;
    this.stance = 'prone';
    this.target = null;
    this.weapon.isReloading = false;
    this.pendingBullets.length = 0;
    EventBus.emit(EVENTS.UNIT_DEATH, this);
  }

  _calculateSpeeds(baseSpeeds, weight) {
    const referenceWeight = 10.0;
    const penaltyPerKg = 0.03;
    let mult = 1.0;
    if (weight > referenceWeight) mult = Math.max(0.5, 1.0 - (weight - referenceWeight) * penaltyPerKg);
    return {
      run: baseSpeeds.run * mult,
      stand: baseSpeeds.stand * mult,
      crouch: baseSpeeds.crouch * mult,
      prone: baseSpeeds.prone * mult,
    };
  }

  setStance(newStance) {
    if (this.isDead || this.stance === newStance) return;
    if (newStance === 'run' && (this.stamina < 10 || this.isLimping || this.isUnconscious)) return;
    // FIX: подавление мешает встать
    if (newStance === 'stand' && this.isPressed) return;
    this.stance = newStance;
    this.speed = this.speeds[this.stance];
  }

  setPath(path) {
    if (!path || path.length === 0) { this.isMoving = false; this.path = []; return; }
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = true;
    this.needsRepath = false;
  }

  canSee(target, obstacles) {
    const dx = target.x - this.x, dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.detectRange) return false;

    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = angleToTarget - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const absAngle = Math.abs(angleDiff);

    const centralHalf = (VISION_CONFIG.centralAngle * Math.PI / 180) / 2;
    if (absAngle <= centralHalf) return Physics.hasLineOfSight(this.x, this.y, target.x, target.y, obstacles);
    if (absAngle <= this.fovAngle / 2) {
      if (dist > VISION_CONFIG.peripheralRange) return false;
      return Physics.hasLineOfSight(this.x, this.y, target.x, target.y, obstacles);
    }
    return false;
  }

  update(dt, allUnits, currentTime) {
    if (this.isDead) return null;

    // FIX: спад подавления (Волна 1)
    if (this.suppression > 0) {
      this.suppression = Math.max(0, this.suppression - CONFIG.SUPPRESSION.DECAY_PER_SEC * dt);
    }

    if (this.bleedingRate > 0 && this.blood > 0) {
      this.blood = Math.max(0, this.blood - this.bleedingRate * dt);
      if (this.blood <= 0) { this._die(); return null; }
      if (this.blood < 15 && !this.isUnconscious) {
        this.isUnconscious = true;
        this.stance = 'prone';
        this.isMoving = false;
        this.path = [];
        EventBus.emit(EVENTS.UNIT_UNCONSCIOUS, this);
      } else if (this.blood >= 15 && this.isUnconscious) {
        this.isUnconscious = false;
      }
    }

    if (this.isUnconscious) { this.weapon.update(dt); return null; }

    if (this.tinnitus > 0) this.tinnitus = Math.max(0, this.tinnitus - dt);

    let hearingMult = 1.0;
    const headPart = this.bodyParts.head;
    if (headPart?.subParts) {
      const l = headPart.subParts.find(p => p.id === 'leftEar');
      const r = headPart.subParts.find(p => p.id === 'rightEar');
      if (l && l.hp <= 0) hearingMult -= 0.3;
      if (r && r.hp <= 0) hearingMult -= 0.3;
    }
    if (this.armor['head']) hearingMult -= 0.2;
    if (this.tinnitus > 0) hearingMult -= 0.5;
    this.hearingMultiplier = Math.max(0, hearingMult);

    this._updateCombat(dt, allUnits, currentTime);
    this.weapon.update(dt);

    if (this.isMoving) this.aimTime = 0;
    else if (this.target) this.aimTime += dt;
    else this.aimTime = 0;

    if (!this.target && this.isMoving && this.path.length > 0) {
      if (this.pathIndex >= this.path.length) { this.isMoving = false; this.path = []; }
      else {
        const t = this.path[this.pathIndex];
        const dx = t.x - this.x, dy = t.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.5) {
          this.pathIndex++;
          if (this.pathIndex >= this.path.length) { this.isMoving = false; this.path = []; }
        } else {
          this.targetAngle = Math.atan2(dy, dx);
          let sp = this.speed;
          if (this.isLimping) sp *= 0.5;
          // FIX: подавление замедляет
          if (this.isPressed) sp *= 0.6;
          const stepLen = sp * dt;
          const nx = this.x + (dx / dist) * stepLen;
          const ny = this.y + (dy / dist) * stepLen;
          const obs = this.pathfinder ? this.pathfinder.obstacles : null;

          if (Physics.isPositionFree(nx, ny, this.baseRadius, obs)) { this.x = nx; this.y = ny; }
          else {
            let slid = false;
            if (Physics.isPositionFree(nx, this.y, this.baseRadius, obs)) { this.x = nx; slid = true; }
            else if (Physics.isPositionFree(this.x, ny, this.baseRadius, obs)) { this.y = ny; slid = true; }
            if (!slid) { this.isMoving = false; this.path = []; this.needsRepath = true; }
          }
        }
      }
    }

    if (this.isMoving) {
      const base = AUDIO_CONFIG.stepLoudness[this.stance] || 60;
      const loudness = base + this.totalWeight * AUDIO_CONFIG.weightLoudnessPerKg;
      if (currentTime - this.lastNoiseTime > 1.0) {
        this.lastNoiseTime = currentTime;
        EventBus.emit(EVENTS.WORLD_NOISE, { x: this.x, y: this.y, loudness, source: this });
      }
    }

    this._updateStamina(dt);

    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * Math.min(10 * dt, 1);
    if (this.angle > Math.PI) this.angle -= Math.PI * 2;
    if (this.angle < -Math.PI) this.angle += Math.PI * 2;

    const bullets = this.pendingBullets;
    this.pendingBullets = [];
    return bullets.length ? bullets : null;
  }

  _updateCombat(dt, allUnits, currentTime) {
    let closestEnemy = null;
    let minDist = this.weapon.effectiveRange;

    for (const other of allUnits) {
      if (other.faction === this.faction || other.isDead) continue;
      const dist = Math.hypot(other.x - this.x, other.y - this.y);
      if (dist < minDist) {
        const obs = this.pathfinder ? this.pathfinder.obstacles : null;
        if (this.canSee(other, obs)) { minDist = dist; closestEnemy = other; }
      }
    }

    this.target = closestEnemy;
    if (!this.target) return;

    this.targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.weapon.updateFireMode(minDist);

    // FIX: подавление блокирует стрельбу стоя (Волна 1)
    if (this.isPressed && this.stance !== 'prone' && this.stance !== 'crouch') return;

    if (this.weapon.canFire(currentTime)) {
      const b = this._shoot(currentTime);
      if (b) this.pendingBullets.push(b);
    }
  }

  _shoot(currentTime) {
    if (!this.isArmed || this.isUnconscious) return null;
    if (!this.weapon.fire(currentTime)) return null;

    const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
    let spread = this.weapon.spreadBase * (dist / 100);

    if (this.isLimping) spread *= 2.0;
    if (this.isMoving) spread *= 3.0;
    if (this.stamina < 20) spread *= 1.5;
    if (this.blood < 70) spread *= 1.2;
    if (this.blood < 40) spread *= 1.5;
    if (this.target.isMoving) spread *= 1.5;
    if (this.target.stance === 'prone') spread *= 1.2;
    else if (this.target.stance === 'crouch') spread *= 1.1;

    // FIX: отдача (Волна 1)
    spread *= this.weapon.getRecoilSpreadMultiplier();
    // FIX: подавление (Волна 1)
    spread *= (1 + this.suppression * 1.5);

    const aimBonus = Math.min(this.aimTime / this.maxAimTime, 1.0);
    spread *= (1.0 - aimBonus * 0.7);
    spread = Math.max(0.01, Math.min(spread, 20));

    const hitChance = Math.max(0.1, 1 - (spread / 10));

    EventBus.emit(EVENTS.UNIT_SHOOT, {
      x1: this.x, y1: this.y, x2: this.target.x, y2: this.target.y, isMuzzleFlash: true,
    });

    EventBus.emit(EVENTS.WORLD_NOISE, {
      x: this.x, y: this.y,
      loudness: this.weapon.loudness,
      source: this, isGunshot: true,
    });

    this.tinnitus = 1.0;

    let tx = this.target.x, ty = this.target.y;
    if (Math.random() >= hitChance) {
      const ang = Math.atan2(ty - this.y, tx - this.x) + (Math.random() - 0.5) * 0.6;
      const missDist = dist + (Math.random() - 0.5) * 60;
      tx = this.x + Math.cos(ang) * missDist;
      ty = this.y + Math.sin(ang) * missDist;
    }

    // FIX: трассер каждый N-й патрон (Волна 1)
    const isTracer = (this.weapon.shotsFired % CONFIG.BALLISTICS.TRACER_EVERY_N) === 0;

    return new Bullet(
      this.x, this.y, tx, ty,
      this.weapon.bulletSpeed, this.weapon.baseDamage,
      this.weapon.damageFalloff, this.weapon.maxFalloffDist,
      this.weapon.penetration, this,
      {
        drag: this.weapon.drag,
        fragmentation: this.weapon.fragmentation,
        isTracer,
      }
    );
  }

  _updateStamina(dt) {
    if (this.isMoving) {
      let drain = 0;
      if (this.stance === 'run') drain = 8;
      else if (this.stance === 'stand') drain = 0.5;
      else if (this.stance === 'crouch') drain = 0.2;
      else if (this.stance === 'prone') drain = 0.05;
      drain *= this.staminaPenalty;
      this.stamina = Math.max(0, this.stamina - drain * dt);
      this.staminaCooldown = 2.0;
    } else {
      if (this.staminaCooldown > 0) this.staminaCooldown -= dt;
      else {
        let mult = 1.0;
        if (this.blood < 70) mult = 0.7;
        if (this.blood < 40) mult = 0.4;
        if (this.blood < 15) mult = 0.1;
        let base = this.baseRecoveryRate;
        if (this.stance === 'crouch') base *= 1.2;
        else if (this.stance === 'prone') base *= 1.5;
        this.stamina += (base * mult) / this.staminaPenalty * dt;
      }
    }
    this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina));
    if (this.stance === 'run' && this.stamina <= 0) this.setStance('stand');
  }

  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    const color = this.isDead ? '#444' : (this.faction === 'player' ? '#4285F4' : '#EA4335');

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.angle);

    if (this.stance === 'prone' || this.isUnconscious) {
      const w = 0.8 * camera.zoom, h = 1.6 * camera.zoom;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3, w / 2), Math.max(2, h / 2), 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
    } else {
      const r = Math.max(3, this.baseRadius * camera.zoom);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      if (r > 5 && this.stance !== 'crouch') {
        ctx.beginPath();
        ctx.arc(r * 0.6, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
    ctx.restore();

    // FIX: индикатор подавления (Волна 1)
    if (this.suppression > 0.1 && !this.isDead) {
      const p = screenPos;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20, 8, 0, Math.PI * 2 * this.suppression);
      ctx.strokeStyle = this.suppression >= CONFIG.SUPPRESSION.THRESHOLD_PRESSED ? '#FF5500' : '#FFAA00';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (this.isSelected && !this.isDead) {
      ctx.beginPath();
      const ringR = (this.stance === 'prone' || this.isUnconscious)
        ? (1.6 * camera.zoom) / 2 : Math.max(3, this.baseRadius * camera.zoom);
      ctx.arc(screenPos.x, screenPos.y, ringR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#F4B400';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (this.isMoving && this.path.length > 0) {
        ctx.beginPath();
        const start = camera.worldToScreen(this.x, this.y);
        ctx.moveTo(start.x, start.y);
        for (let i = this.pathIndex; i < this.path.length; i++) {
          const p = camera.worldToScreen(this.path[i].x, this.path[i].y);
          ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(244, 180, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (!this.isDead) {
      const isDamaged = this.hp < this.maxHp;
      const isTired = this.stamina < this.maxStamina;
      const isReloading = this.weapon.isReloading;
      const isOverheated = this.weapon.heat > 10;

      if (isDamaged || isTired || isReloading || this.bleedingRate > 0 || isOverheated) {
        const barW = Math.max(20, this.baseRadius * camera.zoom * 2);
        const barH = 3;
        const barX = screenPos.x - barW / 2;
        let y = screenPos.y - (this.baseRadius * camera.zoom) - 12;

        if (isDamaged) {
          ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH);
          ctx.fillStyle = this.hp > this.maxHp * 0.5 ? '#0F9D58' : '#EA4335';
          ctx.fillRect(barX, y, barW * (this.hp / this.maxHp), barH);
          y -= barH + 2;
        }
        if (isTired) {
          ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH);
          ctx.fillStyle = this.stamina > 20 ? '#F4B400' : '#EA4335';
          ctx.fillRect(barX, y, barW * (this.stamina / this.maxStamina), barH);
          y -= barH + 2;
        }
        if (isReloading) {
          ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH);
          ctx.fillStyle = '#5096ff';
          const progress = 1 - Math.max(0, Math.min(1, this.weapon.reloadTimer / this.weapon.reloadTime));
          ctx.fillRect(barX, y, barW * progress, barH);
          y -= barH + 2;
        }
        if (isOverheated) {
          ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH);
          ctx.fillStyle = this.weapon.isJammed ? '#FF0000' : '#FF8C00';
          ctx.fillRect(barX, y, barW * (this.weapon.heat / this.weapon.maxHeat), barH);
        }
        if (this.bleedingRate > 0) {
          ctx.fillStyle = '#EA4335';
          const pulse = Math.sin(performance.now() / 200) * 0.5 + 0.5;
          ctx.globalAlpha = 0.5 + pulse * 0.5;
          ctx.beginPath();
          ctx.arc(screenPos.x, screenPos.y - 25, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }
    }
  }
  }
