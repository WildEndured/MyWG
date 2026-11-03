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

    this.vx = 0; this.vy = 0;
    this.maxSpeed = 0;

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

    this.accel = CONFIG.MOVEMENT.ACCEL_BASE / this.staminaPenalty;
    this.decel = CONFIG.MOVEMENT.DECEL_BASE / this.staminaPenalty;

    this.stance = 'stand';
    this.speed = this.speeds[this.stance];
    this.maxSpeed = this.speed;
    this.stanceTransition = null;

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
    this._wantsToMove = false;

    this.angle = 0;
    this.targetAngle = 0;

    this.pathfinder = null;
    this.needsRepath = false;
    this.lastTarget = null;
    this.lastHeardNoise = null;
    this.pendingBullets = [];

    this.suppression = 0;
    this.lastSuppressionTime = 0;
    this.standLockTimer = 0;

    this.perception = new Map();
    this._lastScanTime = 0;
    this._scanInterval = CONFIG.PERCEPTION.SCAN_INTERVAL;
  }

  getTotalHp() { return calcTotalHp(this.bodyParts); }
  getMaxTotalHp() { return calcMaxTotalHp(this.bodyParts); }

  applySuppression(amount) {
    if (this.isDead) return;
    this.suppression = Math.min(1, this.suppression + amount);
    this.lastSuppressionTime = performance.now() / 1000;

    if (this.stanceTransition) return;
    if (this.suppression >= CONFIG.SUPPRESSION.AUTO_PRONE && this.stance !== 'prone') {
      this._startStanceTransition('prone');
      this.standLockTimer = CONFIG.SUPPRESSION.STAND_LOCK_TIME;
    } else if (this.suppression >= CONFIG.SUPPRESSION.AUTO_CROUCH && this.stance === 'stand') {
      this._startStanceTransition('crouch');
    }
  }

  get isPressed() {
    return this.suppression >= CONFIG.SUPPRESSION.THRESHOLD_PRESSED;
  }

  applyFragmentation(amount) {
    if (this.isDead) return;
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

  raycastHit(x1, y1, x2, y2) {
    let best = null;
    let bestT = Infinity;
    for (const [partId, part] of Object.entries(this.bodyParts)) {
      if (!part.hitbox || part.hp <= 0) continue;
      const scale = part.stanceScale[this.stance] ?? 1;
      const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
      const lx = part.hitbox.dx;
      const ly = part.hitbox.dy;
      const cx = this.x + lx * cos - ly * sin;
      const cy = this.y + lx * sin + ly * cos;
      const r = part.hitbox.r * scale;
      const t = this._rayCircle(x1, y1, x2, y2, cx, cy, r);
      if (t !== null && t < bestT) {
        bestT = t;
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

    if (CONFIG.STANCE.ABORT_ON_DAMAGE && this.stanceTransition) {
      this.stanceTransition = null;
    }

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
    this._wantsToMove = false;
    this.path = [];
    this.isSelected = false;
    this.stance = 'prone';
    this.stanceTransition = null;
    this.target = null;
    this.weapon.isReloading = false;
    this.pendingBullets.length = 0;
    this.vx = 0; this.vy = 0;
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

  _startStanceTransition(to) {
    const from = this.stance;
    if (from === to) return;
    const key = `${from}->${to}`;
    const duration = CONFIG.STANCE.TRANSITIONS[key] ?? 0.5;
    this.stanceTransition = { from, to, timer: duration, total: duration };
  }

  setStance(newStance) {
    if (this.isDead || this.stance === newStance) return;
    if (this.stanceTransition) return;
    if (newStance === 'run' && (this.stamina < 10 || this.isLimping || this.isUnconscious)) return;
    if (newStance === 'stand' && (this.isPressed || this.standLockTimer > 0)) return;
    this._startStanceTransition(newStance);
  }

  _updateStanceTransition(dt) {
    if (!this.stanceTransition) return;
    const t = this.stanceTransition;
    t.timer -= dt;
    if (t.timer <= 0) {
      this.stance = t.to;
      this.speed = this.speeds[this.stance];
      this.maxSpeed = this.speed;
      this.stanceTransition = null;
    }
  }

  get stanceTransitionProgress() {
    if (!this.stanceTransition) return 1;
    const t = this.stanceTransition;
    return 1 - Math.max(0, t.timer / t.total);
  }

  setPath(path) {
    if (!path || path.length === 0) {
      this.isMoving = false; this._wantsToMove = false; this.path = [];
      return;
    }
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = true;
    this._wantsToMove = true;
    this.needsRepath = false;
  }

  _visibilityCheck(other, obstacles) {
    const dx = other.x - this.x, dy = other.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.detectRange) return { visible: false, dist, angle: 0, central: false };

    const angleToTarget = Math.atan2(dy, dx);
    let angleDiff = angleToTarget - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const absAngle = Math.abs(angleDiff);

    const centralHalf = (VISION_CONFIG.centralAngle * Math.PI / 180) / 2;
    const fovHalf = this.fovAngle / 2;

    if (absAngle > fovHalf) return { visible: false, dist, angle: absAngle, central: false };

    let rangeLimit = this.detectRange;
    if (absAngle > centralHalf) rangeLimit = VISION_CONFIG.peripheralRange;
    if (dist > rangeLimit) return { visible: false, dist, angle: absAngle, central: false };

    if (!Physics.hasLineOfSight(this.x, this.y, other.x, other.y, obstacles)) {
      return { visible: false, dist, angle: absAngle, central: absAngle <= centralHalf };
    }
    return { visible: true, dist, angle: absAngle, central: absAngle <= centralHalf };
  }

  _updatePerception(dt, allUnits, obstacles, now) {
    for (const [target, mem] of this.perception) {
      if (target.isDead) { this.perception.delete(target); continue; }
      mem.seen = Math.max(0, mem.seen - CONFIG.PERCEPTION.LOSE_PER_SEC * dt);
      if (mem.seen <= 0 && now - mem.lastSeen > CONFIG.PERCEPTION.MEMORY_SEC) {
        this.perception.delete(target);
      }
    }

    if (now - this._lastScanTime < this._scanInterval) return;
    this._lastScanTime = now;

    for (const other of allUnits) {
      if (other === this || other.faction === this.faction || other.isDead) continue;

      const vis = this._visibilityCheck(other, obstacles);
      if (!vis.visible) continue;

      const fillRate = vis.central
        ? 1 / CONFIG.PERCEPTION.CENTRAL_FILL_SEC
        : 1 / CONFIG.PERCEPTION.PERIPHERAL_FILL_SEC;

      const mem = this.perception.get(other) || { seen: 0, lastX: other.x, lastY: other.y, lastSeen: now, angle: 0 };
      const distMult = 1 + (1 - Math.min(1, vis.dist / Math.max(1, this.detectRange))) * 1.0;
      mem.seen = Math.min(1, mem.seen + fillRate * this._scanInterval * distMult);
      mem.lastX = other.x;
      mem.lastY = other.y;
      mem.lastSeen = now;
      mem.angle = vis.angle;
      this.perception.set(other, mem);
    }
  }

  _pickEngageTarget() {
    let best = null;
    let bestSeen = CONFIG.PERCEPTION.ENGAGE_THRESHOLD;
    for (const [target, mem] of this.perception) {
      if (target.isDead) continue;
      if (mem.seen > bestSeen) {
        const dist = Math.hypot(target.x - this.x, target.y - this.y);
        if (dist <= this.weapon.effectiveRange) {
          bestSeen = mem.seen;
          best = target;
        }
      }
    }
    return best;
  }

  canSee(target, obstacles) {
    const vis = this._visibilityCheck(target, obstacles);
    if (!vis.visible) return false;
    const mem = this.perception.get(target);
    return mem ? mem.seen >= CONFIG.PERCEPTION.ENGAGE_THRESHOLD : false;
  }

  update(dt, allUnits, currentTime) {
    if (this.isDead) return null;

    if (this.suppression > 0) {
      const timeSince = (performance.now() / 1000) - this.lastSuppressionTime;
      if (timeSince > CONFIG.SUPPRESSION.CLEAR_TIME) {
        this.suppression = Math.max(0, this.suppression - CONFIG.SUPPRESSION.DECAY_PER_SEC * dt);
      }
    }
    if (this.standLockTimer > 0) this.standLockTimer -= dt;

    this._updateStanceTransition(dt);

    if (this.bleedingRate > 0 && this.blood > 0) {
      this.blood = Math.max(0, this.blood - this.bleedingRate * dt);
      if (this.blood <= 0) { this._die(); return null; }
      if (this.blood < 15 && !this.isUnconscious) {
        this.isUnconscious = true;
        this.stance = 'prone';
        this.stanceTransition = null;
        this.isMoving = false; this._wantsToMove = false;
        this.path = [];
        EventBus.emit(EVENTS.UNIT_UNCONSCIOUS, this);
      } else if (this.blood >= 15 && this.isUnconscious) {
        this.isUnconscious = false;
      }
    }

    if (this.isUnconscious) {
      this.weapon.update(dt);
      this._integrateVelocity(dt);
      return null;
    }

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

    const obs = this.pathfinder ? this.pathfinder.obstacles : null;
    this._updatePerception(dt, allUnits, obs, currentTime);

    this._updateCombat(dt, allUnits, currentTime);
    this.weapon.update(dt);

    if (this.isMoving || this._wantsToMove) this.aimTime = 0;
    else if (this.target) this.aimTime += dt;
    else this.aimTime = 0;

    this._updateMovement(dt);

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

  _updateMovement(dt) {
    let targetSpeedX = 0, targetSpeedY = 0;
    let wantMove = false;

    if (this._wantsToMove) {
      if (this.path.length === 0) {
        if (this.lastTarget) this.needsRepath = true;
        else this._wantsToMove = false;
      } else if (this.pathIndex >= this.path.length) {
        this.isMoving = false;
        this._wantsToMove = false;
        this.path = [];
      } else {
        const p = this.path[this.pathIndex];
        const dx = p.x - this.x, dy = p.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.5) {
          this.pathIndex++;
          if (this.pathIndex >= this.path.length) {
            this.isMoving = false; this._wantsToMove = false; this.path = [];
          }
        } else {
          this.targetAngle = Math.atan2(dy, dx);
          let maxSp = this.speeds[this.stance];
          if (this.isLimping) maxSp *= 0.5;
          if (this.isPressed) maxSp *= CONFIG.SUPPRESSION.PRESSED_MOVE_MULT;
          if (this.stanceTransition) maxSp *= 0.3;
          
          // ЗАЩИТА: делим только если dist > 0
          const safeDist = Math.max(0.001, dist);
          targetSpeedX = (dx / safeDist) * maxSp;
          targetSpeedY = (dy / safeDist) * maxSp;
          wantMove = true;
        }
      }
    }

    this.isMoving = wantMove;

    const ax = targetSpeedX - this.vx;
    const ay = targetSpeedY - this.vy;
    const accel = wantMove ? this.accel : this.decel;
    const maxDelta = accel * dt;
    const deltaLen = Math.hypot(ax, ay);
    if (deltaLen > 0.0001) {
      const k = Math.min(1, maxDelta / deltaLen);
      this.vx += ax * k;
      this.vy += ay * k;
    }

    // ЗАЩИТА: если скорость стала NaN — сбрасываем её
    if (!Number.isFinite(this.vx)) this.vx = 0;
    if (!Number.isFinite(this.vy)) this.vy = 0;

    this._integrateVelocity(dt);
  }

  _integrateVelocity(dt) {
    const sp = Math.hypot(this.vx, this.vy);
    if (sp < CONFIG.MOVEMENT.STOP_EPS) {
      this.vx = 0; this.vy = 0;
      return;
    }
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    
    // ЗАЩИТА: не двигаемся, если координаты сломались
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) {
      this.vx = 0; this.vy = 0;
      return;
    }

    const obs = this.pathfinder ? this.pathfinder.obstacles : null;

    if (Physics.isPositionFree(nx, ny, this.baseRadius, obs)) {
      this.x = nx; this.y = ny;
    } else {
      let slid = false;
      if (Physics.isPositionFree(nx, this.y, this.baseRadius, obs)) { this.x = nx; slid = true; this.vy *= 0.3; }
      else if (Physics.isPositionFree(this.x, ny, this.baseRadius, obs)) { this.y = ny; slid = true; this.vx *= 0.3; }
      if (!slid) {
        this.vx = 0; this.vy = 0;
        this.isMoving = false;
        this.needsRepath = true;
      }
    }
  }

  _updateCombat(dt, allUnits, currentTime) {
    this.target = this._pickEngageTarget();
    if (!this.target) return;

    const mem = this.perception.get(this.target);
    const targetDist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
    const stale = mem && (currentTime - mem.lastSeen) > 2.0;

    this.targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.weapon.updateFireMode(targetDist);

    if (stale) return;
    if (this.isPressed && this.stance !== 'prone' && this.stance !== 'crouch') return;
    if (this.stanceTransition && CONFIG.STANCE.FIRE_BLOCKED) return;

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
    // ЗАЩИТА: max(0.1, speeds.stand) чтобы не было деления на 0
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

    EventBus.emit(EVENTS.UNIT_SHOOT, {
      x1: this.x, y1: this.y, x2: this.target.x, y2: this.target.y, isMuzzleFlash: true,
    });
    EventBus.emit(EVENTS.WORLD_NOISE, {
      x: this.x, y: this.y, loudness: this.weapon.loudness, source: this, isGunshot: true,
    });

    this.tinnitus = 1.0;

    let tx = this.target.x, ty = this.target.y;
    if (Math.random() >= hitChance) {
      const ang = Math.atan2(ty - this.y, tx - this.x) + (Math.random() - 0.5) * 0.6;
      const missDist = dist + (Math.random() - 0.5) * 60;
      tx = this.x + Math.cos(ang) * missDist;
      ty = this.y + Math.sin(ang) * missDist;
    }

    const isTracer = (this.weapon.shotsFired % CONFIG.BALLISTICS.TRACER_EVERY_N) === 0;

    return new Bullet(
      this.x, this.y, tx, ty,
      this.weapon.bulletSpeed, this.weapon.baseDamage,
      this.weapon.damageFalloff, this.weapon.maxFalloffDist,
      this.weapon.penetration, this,
      { drag: this.weapon.drag, fragmentation: this.weapon.fragmentation, isTracer }
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
}
