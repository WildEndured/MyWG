import { findArmorForHit } from '../data/armor.js';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG } from '../data/config.js';

export function applyHealthMixin(UnitProto) {
  UnitProto.applyBandage = function(targetPart, isSelf) {
    if (this.medical.bandage <= 0 || this.isDead) return false;
    this.medical.bandage--;
    const duration = isSelf ? CONFIG.MEDICAL.BANDAGE_TIME * 1.5 : CONFIG.MEDICAL.BANDAGE_TIME;
    this.medical.isApplying = true; this.medical.applyTimer = duration; this.medical.applyType = 'bandage'; this.medical.applyPart = targetPart;
    return true;
  };

  UnitProto.applyTourniquet = function(targetPart, isSelf) {
    if (this.medical.tourniquet <= 0 || this.isDead) return false;
    this.medical.tourniquet--;
    const duration = isSelf ? CONFIG.MEDICAL.TOURNIQUET_TIME * 1.5 : CONFIG.MEDICAL.TOURNIQUET_TIME;
    this.medical.isApplying = true; this.medical.applyTimer = duration; this.medical.applyType = 'tourniquet'; this.medical.applyPart = targetPart;
    return true;
  };

  UnitProto.applySuppression = function(amount) {
    if (this.isDead) return;
    this.suppression = Math.min(1, this.suppression + amount); this.lastSuppressionTime = performance.now() / 1000;
    if (this.stanceTransition) return;
    if (this.suppression >= CONFIG.SUPPRESSION.AUTO_PRONE && this.stance !== 'prone') { this._startStanceTransition('prone'); this.standLockTimer = CONFIG.SUPPRESSION.STAND_LOCK_TIME; }
    else if (this.suppression >= CONFIG.SUPPRESSION.AUTO_CROUCH && this.stance === 'stand') this._startStanceTransition('crouch');
  };

  UnitProto.applyFragmentation = function(amount) {
    if (this.isDead) return;
    const torso = this.bodyParts.torso; if (!torso?.subParts) return;
    for (let i = 0; i < 2; i++) { const sub = torso.subParts[Math.floor(Math.random() * torso.subParts.length)]; sub.hp -= amount; if (sub.hp <= 0) { sub.hp = 0; if (sub.fatal) { this._die(); return; } } }
    this.hp = this.getTotalHp(); if (this.hp <= 0) this._die();
  };

  UnitProto._die = function() {
    if (this.isDead) return;
    this.isDead = true; this.isMoving = false; this._wantsToMove = false; this.path = []; this.isSelected = false;
    this.stance = 'prone'; this.stanceTransition = null; this.target = null; this.weapon.isReloading = false;
    this.pendingBullets.length = 0; this.vx = 0; this.vy = 0;
    EventBus.emit(EVENTS.UNIT_DEATH, this);
  };

  UnitProto._updateHealthAndMedical = function(dt, currentTime) {
    if (this.medical.isApplying) {
      this.medical.applyTimer -= dt;
      if (this.medical.applyTimer <= 0) {
        this.medical.isApplying = false;
        const part = this.bodyParts[this.medical.applyPart];
        if (part) {
          if (this.medical.applyType === 'bandage') { part.bleedRate = 0; this.bleedingRate = 0; }
          else if (this.medical.applyType === 'tourniquet') {
            this.bleedingRate = 0;
            if (this.medical.applyPart === 'leftLeg' || this.medical.applyPart === 'rightLeg') this.isLimping = true;
            if (this.medical.applyPart === 'leftArm' || this.medical.applyPart === 'rightArm') this.isArmed = false;
          }
        }
      }
    }

    if (this.bleedingRate > 0 && this.blood > 0) {
      const speedRatio = Math.min(1, Math.hypot(this.vx, this.vy) / Math.max(0.1, this.speeds.run));
      const lossMult = 1 + speedRatio;
      this.blood = Math.max(0, this.blood - this.bleedingRate * lossMult * dt);
      if (this.blood <= 0) { this._die(); return; }
      if (this.blood < 15 && !this.isUnconscious) { this.isUnconscious = true; this.stance = 'prone'; this.stanceTransition = null; this.isMoving = false; this._wantsToMove = false; this.path = []; EventBus.emit(EVENTS.UNIT_UNCONSCIOUS, this); }
      else if (this.blood >= 15 && this.isUnconscious) this.isUnconscious = false;
    }
  };

  UnitProto.raycastHit = function(x1, y1, x2, y2) {
    let best = null, bestT = Infinity;
    for (const [partId, part] of Object.entries(this.bodyParts)) {
      if (!part.hitbox || part.hp <= 0) continue;
      let scale = part.stanceScale[this.stance] ?? 1;
      if (this.stance === 'crouch') scale *= 0.7;
      
      const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
      const cx = this.x + part.hitbox.dx * cos - part.hitbox.dy * sin;
      const cy = this.y + part.hitbox.dx * sin + part.hitbox.dy * cos;
      const t = this._rayCircle(x1, y1, x2, y2, cx, cy, part.hitbox.r * scale);
      if (t !== null && t < bestT) {
        bestT = t; let subPartId = null;
        if (part.subParts) {
          const alive = part.subParts.filter(s => s.hp > 0);
          if (alive.length) { const totalW = alive.reduce((s, p) => s + p.weight, 0); let rnd = Math.random() * totalW; for (const s of alive) { rnd -= s.weight; if (rnd <= 0) { subPartId = s.id; break; } } }
        }
        best = { partId, subPartId, t: bestT };
      }
    }
    return best;
  };

  UnitProto._rayCircle = function(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy; if (a < 1e-12) return (fx * fx + fy * fy) <= r * r ? 0 : null;
    const b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c; if (disc < 0) return null; disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a), t2 = (-b + disc) / (2 * a);
    if (t1 >= 0 && t1 <= 1) return t1; if (t2 >= 0 && t2 <= 1) return t2; return null;
  };

  UnitProto.takeDamage = function(amount, hitZone = 'torso', penetrationLevel = 0, forcedSubPartId = null, incidenceAngle = 0) {
    if (this.isDead) return;
    if (CONFIG.STANCE.ABORT_ON_DAMAGE && this.stanceTransition) this.stanceTransition = null;
    if (this.weapon.isReloading) this.weapon.abortReload();

    let finalDamage = amount; const part = this.bodyParts[hitZone]; if (!part) return;

    if (this.brain && this.target) this.brain.registerDamage(this.target.x, this.target.y);

    let chosenSub = null;
    if (forcedSubPartId && part.subParts) chosenSub = part.subParts.find(s => s.id === forcedSubPartId) || null;

    const armorPiece = findArmorForHit(this.armor, hitZone, chosenSub?.id);

    if (armorPiece && armorPiece.durability > 0) {
      const lossMult = armorPiece.durabilityLossMult || 1.0;
      
      if (incidenceAngle > armorPiece.ricochetAngle) {
        EventBus.emit(EVENTS.BULLET_IMPACT, { x: this.x, y: this.y, type: 'ricochet' });
        return;
      }

      let zoneMult = 1.0, zoneLevelBonus = 0;
      if (armorPiece.zones) {
        const zone = armorPiece.zones[chosenSub?.id] || armorPiece.zones['default'];
        if (zone) { zoneMult = zone.damageMult || 1.0; zoneLevelBonus = zone.levelBonus || 0; }
      }

      const effectiveLevel = armorPiece.level + zoneLevelBonus;
      
      if (armorPiece.armorMaterial === 'ceramic') {
        if (armorPiece.durability < armorPiece.maxDurability * CONFIG.ARMOR.CERAMIC_CRACK_THRESHOLD && armorPiece.level > 0) armorPiece.level = Math.max(0, armorPiece.level - 1);
        if (armorPiece.durability < armorPiece.maxDurability * CONFIG.ARMOR.CERAMIC_BREAK_THRESHOLD) armorPiece.level = 0;
      }

      if (penetrationLevel > effectiveLevel) {
        armorPiece.durability = Math.max(0, armorPiece.durability - amount * 0.5 * lossMult);
        finalDamage = amount * zoneMult;
      } else if (penetrationLevel === effectiveLevel) {
        finalDamage = amount * 0.7 * zoneMult;
        armorPiece.durability = Math.max(0, armorPiece.durability - amount * 0.8 * lossMult);
      } else {
        finalDamage = amount * 0.1 * zoneMult;
        armorPiece.durability = Math.max(0, armorPiece.durability - amount * 0.1 * lossMult);
        this.stamina = Math.max(0, this.stamina - amount * 0.5);
        
        if (amount > 20 && Math.random() < CONFIG.ARMOR.BLUNT_TRAUMA_CHANCE) {
          this.shock += 0.3; this.stamina = Math.max(0, this.stamina - 20);
          if (hitZone === 'torso' && chosenSub?.id === 'chest') {
            const chestPart = this.bodyParts.torso.subParts.find(s => s.id === 'chest');
            if (chestPart) chestPart.hp -= 5;
          }
        }
      }
    }

    this.pain = Math.min(1, this.pain + finalDamage / 50);

    if (hitZone === 'torso' || hitZone === 'pelvis') this.shock += finalDamage / 100;
    if (this.shock >= CONFIG.MEDICAL.SHOCK_THRESHOLD) { this.shockTimer = 3.0; this.shock = 0; if (this.stance !== 'prone') this._startStanceTransition('prone'); }

    if ((hitZone === 'head' && chosenSub?.id === 'brain') || (hitZone === 'torso' && chosenSub?.id === 'heart')) { this._die(); return; }

    let localBleed = part.bleedRate || 0;
    if (chosenSub) {
      chosenSub.hp -= finalDamage; if (chosenSub.bleedRate > localBleed) localBleed = chosenSub.bleedRate;
      if (chosenSub.hp <= 0) { chosenSub.hp = 0; if (chosenSub.fatal) { this._die(); return; } }
    } else { part.hp -= finalDamage; }

    if (part.hp <= 0) { part.hp = 0; if (part.fatal) { this._die(); return; } }
    if (finalDamage > 5 && localBleed > 0) this.bleedingRate = Math.max(this.bleedingRate, localBleed);
    if (hitZone === 'leftLeg' || hitZone === 'rightLeg') this.isLimping = true;
    if (hitZone === 'leftArm' || hitZone === 'rightArm') { this.isArmed = false; this.weapon.isReloading = false; }

    this.hp = this.getTotalHp(); if (this.hp <= 0) this._die();
  };
}
