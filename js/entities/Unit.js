import { Weapon } from './Weapon.js';
import { WEAPONS, EXPLOSIVES } from '../data/weapons.js';
import { ROLES, BASE_HUMAN } from '../data/units.js';
import { BODY_PARTS, calcTotalHp, calcMaxTotalHp } from '../data/health.js';
import { ARMOR_CONFIGS, ARMOR_CLASSES } from '../data/armor.js';
import { VISION_CONFIG, AUDIO_CONFIG } from '../data/vision.js';
import { Physics } from '../core/Physics.js';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG } from '../data/config.js';
import { Brain } from '../core/Brain.js';
import { Grenade } from './Grenade.js';

// Импорт миксинов (методы добавятся в прототип)
import { applyHealthMixin } from './UnitHealth.js';
import { applyCombatMixin } from './UnitCombat.js';

export class Unit {
  constructor(x, y, faction = 'player', roleId = 'rifleman') {
    this.x = Number.isFinite(x) ? x : 50; 
    this.y = Number.isFinite(y) ? y : 50; 
    this.faction = faction;
    this.vx = 0; this.vy = 0; this.maxSpeed = 0;
    this.baseRadius = BASE_HUMAN.baseRadius; this.hitRadius = BASE_HUMAN.hitRadius;
    this.isDead = false; this.isUnconscious = false;

    // Ссылка на отряд
    this.squad = null;

    this.bodyParts = {};
    for (const [partId, partData] of Object.entries(BODY_PARTS)) {
      this.bodyParts[partId] = { 
        hp: partData.maxHp, maxHp: partData.maxHp, fatal: !!partData.fatal, bleedRate: partData.bleedRate || 0,
        hitbox: partData.hitbox ? { ...partData.hitbox } : null, 
        stanceScale: partData.stanceScale ? { ...partData.stanceScale } : { stand: 1, crouch: 1, prone: 1 },
        subParts: partData.subParts ? partData.subParts.map(s => ({ ...s, maxHp: s.hp })) : null 
      };
    }
    this.maxHp = calcMaxTotalHp(this.bodyParts); this.hp = this.maxHp;

    this.maxBlood = 100; this.blood = 100; this.bleedingRate = 0;
    this.shock = 0; this.shockTimer = 0;
    this.pain = 0;
    this.isSurrendered = false;

    this.medical = { bandage: 2, tourniquet: 1, isApplying: false, applyTimer: 0, applyTarget: null };
    this.grenades = 2; 

    this.maxStamina = BASE_HUMAN.maxStamina; this.stamina = this.maxStamina;
    this.baseRecoveryRate = BASE_HUMAN.baseRecoveryRate; this.staminaCooldown = 0;

    // РОЛЬ И ИЕРАРХИЯ
    const role = ROLES[roleId] || ROLES['rifleman']; 
    this.roleId = role.id; 
    this.name = role.name;
    this.rank = role.rank || 1;

    const weaponConfig = WEAPONS[role.defaultWeapon]; 
    this.weapon = new Weapon(weaponConfig); 
    this.maxAimTime = this.weapon.maxAimTime;
    this.activeWeaponId = role.defaultWeapon;

    // Запасное оружие (для гранатометчика)
    this.secondaryWeaponConfig = role.secondaryWeapon ? WEAPONS[role.secondaryWeapon] : null;

    this.armor = {}; let armorWeight = 0;
    for (const armorId of BASE_HUMAN.defaultArmor) {
      const config = ARMOR_CONFIGS[armorId]; if (!config) continue;
      const armorClass = ARMOR_CLASSES[config.class]; if (!armorClass) continue;
      armorWeight += config.weight || 0;
      const piece = { 
        name: config.name, level: armorClass.level, baseLevel: armorClass.level, 
        durability: config.durability, maxDurability: config.maxDurability ?? config.durability,
        durabilityLossMult: config.durabilityLossMult || 1.0, coveredSubParts: config.coveredSubParts || [], 
        zones: config.zones || null, armorMaterial: config.armorMaterial || 'steel',
        ricochetAngle: config.ricochetAngle || 45
      };
      for (const zone of config.covers) { 
        if (!this.armor[zone] || this.armor[zone].level < piece.level) this.armor[zone] = piece; 
      }
    }

    const medWeight = this.medical.bandage * CONFIG.MEDICAL.BANDAGE_WEIGHT + this.medical.tourniquet * CONFIG.MEDICAL.TOURNIQUET_WEIGHT;
    const ammoWeight = this.weapon.getTotalAmmoWeight();
    const grenadeWeight = this.grenades * 0.3;
    let weaponWeight = this.weapon.weightLoaded;
    if (this.secondaryWeaponConfig) weaponWeight += this.secondaryWeaponConfig.weightEmpty;
    
    this.totalWeight = weaponWeight + armorWeight + medWeight + ammoWeight + grenadeWeight;
    
    this.staminaPenalty = Math.max(1.0, this.totalWeight / 10.0);
    this.speeds = this._calculateSpeeds(BASE_HUMAN.nakedSpeeds, this.totalWeight);
    this.accel = CONFIG.MOVEMENT.ACCEL_BASE / this.staminaPenalty; this.decel = CONFIG.MOVEMENT.DECEL_BASE / this.staminaPenalty;

    this.stance = 'stand'; this.speed = this.speeds[this.stance]; this.maxSpeed = this.speed; this.stanceTransition = null;
    this.fovAngle = VISION_CONFIG.fovAngle * (Math.PI / 180); this.detectRange = VISION_CONFIG.detectRange; this.identifyRange = VISION_CONFIG.identifyRange;
    this.tinnitus = 0; this.hearingMultiplier = 1.0; this.lastNoiseTime = 0;
    this.isArmed = true; this.isLimping = false; this.aimTime = 0;
    this.target = null; this.isSelected = false; this.path = []; this.pathIndex = 0; this.isMoving = false; this._wantsToMove = false;
    this.angle = 0; this.targetAngle = 0;
    this.pathfinder = null; this.needsRepath = false; this.lastTarget = null; this.lastHeardNoise = null; this.pendingBullets = []; this.pendingExplosions = [];
    this.suppression = 0; this.lastSuppressionTime = 0; this.standLockTimer = 0;
    this.perception = new Map(); this._lastScanTime = 0; this._scanInterval = CONFIG.PERCEPTION.SCAN_INTERVAL;

    this.brain = new Brain(this);
  }

  getTotalHp() { return calcTotalHp(this.bodyParts); }
  getMaxTotalHp() { return calcMaxTotalHp(this.bodyParts); }

  _calculateSpeeds(baseSpeeds, weight) {
    const referenceWeight = 10.0; const penaltyPerKg = 0.03; 
    let mult = 1.0;
    if (weight > referenceWeight) mult = Math.max(0.5, 1.0 - (weight - referenceWeight) * penaltyPerKg);
    return { 
      run: (baseSpeeds.run || 5) * mult, 
      stand: (baseSpeeds.stand || 1.6) * mult, 
      crouch: (baseSpeeds.crouch || 0.9) * mult, 
      prone: (baseSpeeds.prone || 0.4) * mult 
    };
  }

  _startStanceTransition(to) { 
    const from = this.stance; if (from === to) return; 
    const key = `${from}->${to}`; 
    let duration = CONFIG.STANCE.TRANSITIONS[key] ?? 0.5;
    if (this.totalWeight > 10) duration *= (1 + (this.totalWeight - 10) * CONFIG.STANCE.WEIGHT_PENALTY);
    if (this.isLimping) duration *= CONFIG.STANCE.INJURY_MULT;
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

  // Переключение оружия
  switchWeapon() {
    if (!this.secondaryWeaponConfig) return false;
    
    if (this.activeWeaponId === 'rpg7') {
      this.weapon = new Weapon(this.secondaryWeaponConfig);
      this.activeWeaponId = 'ak74';
    } else {
      this.weapon = new Weapon(WEAPONS['rpg7']);
      this.activeWeaponId = 'rpg7';
    }
    this.maxAimTime = this.weapon.maxAimTime;
    return true;
  }

  update(dt, allUnits, currentTime, worldState) {
    if (this.isDead) return null;
    
    if (this.suppression > 0) { 
      const timeSince = (performance.now() / 1000) - this.lastSuppressionTime; 
      if (timeSince > CONFIG.SUPPRESSION.CLEAR_TIME) {
        this.suppression = Math.max(0, this.suppression - CONFIG.SUPPRESSION.DECAY_PER_SEC * dt); 
      }
    }
    if (this.standLockTimer > 0) this.standLockTimer -= dt;
    this._updateStanceTransition(dt);
    this._updateHealthAndMedical(dt, currentTime); // Миксин

    if (this.isUnconscious) { 
      this.weapon.update(dt); 
      this._integrateVelocity(dt); 
      return null; 
    }
    if (this.tinnitus > 0) this.tinnitus = Math.max(0, this.tinnitus - dt);

    this.pain = Math.max(0, this.pain - 0.05 * dt);
    if (this.pain > 0.5 && currentTime - this.lastNoiseTime > 3.0) {
      this.lastNoiseTime = currentTime;
      EventBus.emit(EVENTS.WORLD_NOISE, { x: this.x, y: this.y, loudness: CONFIG.MEDICAL.PAIN_NOISE_RADIUS, source: this, isPain: true });
    }

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
    this._updatePerception(dt, allUnits, obs, currentTime); // Миксин
    if (this.brain && worldState) this.brain.update(dt, worldState);
    this._updateCombat(dt, allUnits, currentTime, worldState); // Миксин
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

    if (this.shock > 0) this.shock = Math.max(0, this.shock - CONFIG.MEDICAL.SHOCK_DECAY * dt);
    if (this.shockTimer > 0) { 
      this.shockTimer -= dt; 
      if (this.shockTimer <= 0) this._startStanceTransition('stand'); 
    }

    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; 
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * Math.min(10 * dt, 1); 
    if (this.angle > Math.PI) this.angle -= Math.PI * 2; 
    if (this.angle < -Math.PI) this.angle += Math.PI * 2;

    const bullets = this.pendingBullets; this.pendingBullets = []; 
    const explosions = this.pendingExplosions; this.pendingExplosions = [];
    return { bullets: bullets.length ? bullets : null, explosions: explosions.length ? explosions : null };
  }

  _updateMovement(dt) {
    let targetSpeedX = 0, targetSpeedY = 0, wantMove = false;
    if (this._wantsToMove && !this.medical.isApplying) {
      if (this.path.length === 0) { 
        if (this.lastTarget) this.needsRepath = true; 
        else this._wantsToMove = false; 
      }
      else if (this.pathIndex >= this.path.length) { 
        this.isMoving = false; this._wantsToMove = false; this.path = []; 
      }
      else {
        const p = this.path[this.pathIndex]; 
        const dx = p.x - this.x, dy = p.y - this.y, dist = Math.hypot(dx, dy);
        if (dist < 0.3) { 
          this.pathIndex++; 
          if (this.pathIndex >= this.path.length) { 
            this.isMoving = false; this._wantsToMove = false; this.path = []; 
          } 
        }
        else {
          this.targetAngle = Math.atan2(dy, dx);
          let maxSp = this.speeds[this.stance]; 
          if (this.isLimping) maxSp *= 0.5; 
          if (this.isPressed) maxSp *= CONFIG.SUPPRESSION.PRESSED_MOVE_MULT; 
          if (this.stanceTransition) maxSp *= 0.3;
          const safeDist = Math.max(0.001, dist); 
          targetSpeedX = (dx / safeDist) * maxSp; 
          targetSpeedY = (dy / safeDist) * maxSp; 
          wantMove = true;
        }
      }
    }
    this.isMoving = wantMove;
    const ax = targetSpeedX - this.vx, ay = targetSpeedY - this.vy;
    const accel = wantMove ? this.accel : this.decel, maxDelta = accel * dt, deltaLen = Math.hypot(ax, ay);
    if (deltaLen > 0.0001) { 
      const k = Math.min(1, maxDelta / deltaLen); 
      this.vx += ax * k; 
      this.vy += ay * k; 
    }
    if (!Number.isFinite(this.vx)) this.vx = 0; 
    if (!Number.isFinite(this.vy)) this.vy = 0;
    this._integrateVelocity(dt);
  }

  _integrateVelocity(dt) {
    const sp = Math.hypot(this.vx, this.vy); 
    if (sp < CONFIG.MOVEMENT.STOP_EPS) { this.vx = 0; this.vy = 0; return; }
    
    // Ограничение максимальной скорости (защита от вылета за карту)
    const maxSpeed = 20;
    if (sp > maxSpeed) {
      this.vx = (this.vx / sp) * maxSpeed;
      this.vy = (this.vy / sp) * maxSpeed;
    }

    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) { this.vx = 0; this.vy = 0; return; }
    
    const obs = this.pathfinder ? this.pathfinder.obstacles : null;
    if (Physics.isPositionFree(nx, ny, this.baseRadius * 0.8, obs)) { 
      this.x = nx; this.y = ny; 
    }
    else {
      let slid = false;
      if (Physics.isPositionFree(nx, this.y, this.baseRadius * 0.8, obs)) { 
        this.x = nx; slid = true; this.vy *= 0.3; 
      }
      else if (Physics.isPositionFree(this.x, ny, this.baseRadius * 0.8, obs)) { 
        this.y = ny; slid = true; this.vx *= 0.3; 
      }
      if (!slid) { 
        this.vx = (Math.random() - 0.5) * 2; 
        this.vy = (Math.random() - 0.5) * 2; 
        this.needsRepath = true; 
      }
    }
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
    }
    else { 
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

// Применяем миксины к прототипу
applyHealthMixin(Unit.prototype);
applyCombatMixin(Unit.prototype);
