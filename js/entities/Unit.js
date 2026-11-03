// js/entities/Unit.js
import { Weapon } from './Weapon.js';
import { WEAPONS } from '../data/weapons.js';
import { ROLES, BASE_HUMAN } from '../data/units.js';
import { BODY_PARTS } from '../data/health.js';
import { Physics } from '../core/Physics.js';
import { EventBus } from '../core/EventBus.js';
import { Bullet } from './Bullet.js';

export class Unit {
  constructor(x, y, faction = 'player', roleId = 'infantry') {
    this.x = x;
    this.y = y;
    this.faction = faction; 
    
    this.baseRadius = BASE_HUMAN.baseRadius; 
    this.hitRadius = BASE_HUMAN.hitRadius; 
    this.isDead = false;
    
    // --- ЗОНАЛЬНОЕ ЗДОРОВЬЕ ---
    this.bodyParts = {};
    for (const [partId, partData] of Object.entries(BODY_PARTS)) {
      this.bodyParts[partId] = {
        hp: partData.maxHp,
        maxHp: partData.maxHp,
        fatal: partData.fatal,
        subParts: partData.subParts ? JSON.parse(JSON.stringify(partData.subParts)) : null
      };
    }
    
    this.maxHp = this.getMaxTotalHp();
    this.hp = this.getTotalHp();

    // --- СТАМИНА ---
    this.maxStamina = BASE_HUMAN.maxStamina;
    this.stamina = this.maxStamina;
    this.baseRecoveryRate = BASE_HUMAN.baseRecoveryRate;
    this.staminaCooldown = 0;
    
    // --- РОЛЬ И ОРУЖИЕ ---
    const role = ROLES[roleId] || ROLES['infantry'];
    this.roleId = role.id;
    this.name = role.name;
    
    const weaponConfig = WEAPONS[role.defaultWeapon];
    this.weapon = new Weapon(weaponConfig);
    
    this.totalWeight = this.weapon.weightLoaded;
    this.staminaPenalty = Math.max(1.0, this.totalWeight / 4.0); 
    
    this.speeds = this._calculateSpeeds(BASE_HUMAN.nakedSpeeds, this.totalWeight);
    
    this.stance = 'stand'; 
    this.speed = this.speeds[this.stance];
    
    // --- БОЕВЫЕ СОСТОЯНИЯ ---
    this.isArmed = true; 
    this.isLimping = false;
    
    // --- ПРИЦЕЛИВАНИЕ ---
    this.aimTime = 0; 
    this.maxAimTime = 2.0; 
    
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
  }

  getTotalHp() {
    let total = 0;
    for (const part of Object.values(this.bodyParts)) total += part.hp;
    return total;
  }

  getMaxTotalHp() {
    let total = 0;
    for (const part of Object.values(this.bodyParts)) total += part.maxHp;
    return total;
  }

  takeDamage(amount, hitZone = 'torso') {
    if (this.isDead) return;

    let finalZone = hitZone;
    let isSubPartHit = false;

    const part = this.bodyParts[hitZone];
    if (!part) return;

    if (part.subParts && part.subParts.length > 0) {
      const r = Math.random() * 100;
      let acc = 0;
      for (const sub of part.subParts) {
        acc += sub.weight;
        if (r <= acc) {
          finalZone = sub.id;
          isSubPartHit = true;
          sub.hp -= amount;
          
          if (sub.hp <= 0) {
            sub.hp = 0;
            if (sub.fatal || sub.id === 'brain' || sub.id === 'heart' || sub.id === 'spine' || sub.id === 'liver') {
              this._die();
              return;
            }
          }
          break;
        }
      }
    }

    if (!isSubPartHit) {
      part.hp -= amount;
    }
    
    if (part.hp <= 0) {
      part.hp = 0;
      if (part.fatal) {
        this._die();
        return;
      }
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
    EventBus.emit('unit:death', this);
  }

  _calculateSpeeds(baseSpeeds, weight) {
    const referenceWeight = 3.6; 
    const penaltyPerKg = 0.04; 
    
    let speedMultiplier = 1.0;
    if (weight > referenceWeight) {
      speedMultiplier = Math.max(0.5, 1.0 - (weight - referenceWeight) * penaltyPerKg);
    }

    return {
      run: baseSpeeds.run * speedMultiplier,
      stand: baseSpeeds.stand * speedMultiplier,
      crouch: baseSpeeds.crouch * speedMultiplier,
      prone: baseSpeeds.prone
    };
  }

  setStance(newStance) {
    if (this.stance === newStance) return;
    if (newStance === 'run' && (this.stamina < 10 || this.isLimping)) return;
    this.stance = newStance;
    this.speed = this.speeds[this.stance];
  }

  setPath(path) {
    if (!path || path.length === 0) {
      this.isMoving = false;
      this.path = [];
      return;
    }
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = true;
    this.needsRepath = false;
  }

  update(dt, allUnits, currentTime) {
    if (this.isDead) return null;

    const bullet = this._updateCombat(dt, allUnits, currentTime);
    this.weapon.update(dt);

    // Логика прицеливания
    if (this.isMoving) {
      this.aimTime = 0; 
    } else if (this.target) {
      this.aimTime += dt;
    } else {
      this.aimTime = 0;
    }

    if (!this.target && !this.weapon.isReloading && this.isMoving && this.path.length > 0) {
      if (this.pathIndex >= this.path.length) {
        this.isMoving = false;
        this.path = [];
      } else {
        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 0.5) {
          this.pathIndex++;
          if (this.pathIndex >= this.path.length) {
            this.isMoving = false;
            this.path = [];
          }
        } else {
          this.targetAngle = Math.atan2(dy, dx);
          
          let currentSpeed = this.speed;
          if (this.isLimping) currentSpeed *= 0.5;

          const moveStep = currentSpeed * dt;
          const nextX = this.x + (dx / dist) * moveStep;
          const nextY = this.y + (dy / dist) * moveStep;

          const obs = this.pathfinder ? this.pathfinder.obstacles : null;

          if (this.stance === 'prone' || Physics.isPositionFree(nextX, nextY, this.baseRadius, obs)) {
            this.x = nextX;
            this.y = nextY;
          } else {
            let slid = false;
            if (Physics.isPositionFree(nextX, this.y, this.baseRadius, obs)) {
              this.x = nextX;
              slid = true;
            } else if (Physics.isPositionFree(this.x, nextY, this.baseRadius, obs)) {
              this.y = nextY;
              slid = true;
            }

            if (!slid) {
              this.isMoving = false;
              this.path = [];
              this.needsRepath = true; 
            }
          }
        }
      }
    }

    this._updateStamina(dt);

    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * Math.min(10 * dt, 1);

    return bullet;
  }

  _updateCombat(dt, allUnits, currentTime) {
    let closestEnemy = null;
    let minDist = this.weapon.effectiveRange;

    for (const other of allUnits) {
      if (other.faction === this.faction || other.isDead) continue;
      const dist = Math.hypot(other.x - this.x, other.y - this.y);
      
      if (dist < minDist) {
        const obs = this.pathfinder ? this.pathfinder.obstacles : null;
        if (Physics.hasLineOfSight(this.x, this.y, other.x, other.y, obs)) {
          minDist = dist;
          closestEnemy = other;
        }
      }
    }

    this.target = closestEnemy;

    if (this.target) {
      this.targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      this.weapon.updateFireMode(minDist);

      if (this.weapon.canFire(currentTime)) {
        if (this.weapon.currentMode === 'single' || (this.weapon.currentMode === 'auto' && Math.random() < 0.7)) {
          return this._shoot(currentTime);
        }
      }
    }
    return null;
  }

  _shoot(currentTime) {
    if (!this.isArmed) return null;

    if (this.weapon.fire(currentTime)) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      
      let spread = this.weapon.spreadBase * (dist / 100); 

      if (this.isLimping) spread *= 2.0;
      if (this.isMoving) spread *= 3.0;
      if (this.stamina < 20) spread *= 1.5;
      if (this.target.isMoving) spread *= 1.5;
      if (this.target.stance === 'prone') spread *= 1.2;
      else if (this.target.stance === 'crouch') spread *= 1.1;

      const aimBonus = Math.min(this.aimTime / this.maxAimTime, 1.0); 
      spread *= (1.0 - aimBonus * 0.7); 

      const hitChance = Math.max(0.1, 1 - (spread / 10));

      EventBus.emit('unit:shoot', {
        x1: this.x, y1: this.y,
        x2: this.target.x, y2: this.target.y
      });

      let targetX = this.target.x;
      let targetY = this.target.y;

      if (Math.random() >= hitChance) {
        const missAngle = Math.atan2(targetY - this.y, targetX - this.x);
        const missDist = dist + (Math.random() - 0.5) * 50;
        
        targetX = this.x + Math.cos(missAngle) * missDist;
        targetY = this.y + Math.sin(missAngle) * missDist;
      }

      return new Bullet(
        this.x, this.y, 
        targetX, targetY, 
        this.weapon.bulletSpeed, 
        this.weapon.damage, 
        this
      );
    }
    return null;
  }

  _updateStamina(dt) {
    if (this.isMoving) {
      let drain = 0;
      if (this.stance === 'run') drain = 8;
      else if (this.stance === 'stand') drain = 0.5;
      else if (this.stance === 'crouch') drain = 0.2;
      else if (this.stance === 'prone') drain = 0.05;
      
      drain *= this.staminaPenalty;
      
      this.stamina -= drain * dt;
      this.staminaCooldown = 2.0; 
    } else {
      if (this.staminaCooldown > 0) {
        this.staminaCooldown -= dt;
      } else {
        let recoveryMultiplier = 1.0;
        if (this.stance === 'stand') recoveryMultiplier = 1.0;
        else if (this.stance === 'crouch') recoveryMultiplier = 1.2;
        else if (this.stance === 'prone') recoveryMultiplier = 1.5;
        
        const recovery = (this.baseRecoveryRate * recoveryMultiplier) / this.staminaPenalty;
        this.stamina += recovery * dt;
      }
    }

    this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina));
    if (this.stance === 'run' && this.stamina <= 0) {
      this.setStance('stand');
    }
  }

  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    const color = this.isDead ? '#444' : (this.faction === 'player' ? '#4285F4' : '#EA4335');
    
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(this.angle);
    
    if (this.stance === 'prone') {
      const w = 0.8 * camera.zoom;
      const h = 1.6 * camera.zoom;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3, h/2), Math.max(2, w/2), 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
    } else {
      const drawRadius = Math.max(3, this.baseRadius * camera.zoom);
      ctx.beginPath();
      ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      
      if (drawRadius > 5 && this.stance !== 'crouch') {
        ctx.beginPath();
        ctx.arc(drawRadius * 0.6, 0, drawRadius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
    
    ctx.restore();

    if (this.isSelected && !this.isDead) {
      ctx.beginPath();
      const ringRadius = this.stance === 'prone' ? (1.6 * camera.zoom) / 2 : Math.max(3, this.baseRadius * camera.zoom);
      ctx.arc(screenPos.x, screenPos.y, ringRadius + 4, 0, Math.PI * 2);
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
      
      if (isDamaged || isTired || isReloading) {
        const barW = Math.max(20, this.baseRadius * camera.zoom * 2);
        const barH = 3;
        const barX = screenPos.x - barW / 2;
        
        let currentY = screenPos.y - (this.baseRadius * camera.zoom) - 12;

        if (isDamaged) {
          ctx.fillStyle = '#333';
          ctx.fillRect(barX, currentY, barW, barH);
          ctx.fillStyle = this.hp > 50 ? '#0F9D58' : '#EA4335';
          ctx.fillRect(barX, currentY, barW * (this.hp / this.maxHp), barH);
          currentY -= (barH + 2);
        }

        if (isTired) {
          ctx.fillStyle = '#333';
          ctx.fillRect(barX, currentY, barW, barH);
          ctx.fillStyle = this.stamina > 20 ? '#F4B400' : '#EA4335';
          ctx.fillRect(barX, currentY, barW * (this.stamina / this.maxStamina), barH);
          currentY -= (barH + 2);
        }

        if (isReloading) {
          ctx.fillStyle = '#333';
          ctx.fillRect(barX, currentY, barW, barH);
          ctx.fillStyle = '#5096ff';
          const reloadProgress = 1 - (this.weapon.reloadTimer / this.weapon.reloadTime);
          ctx.fillRect(barX, currentY, barW * reloadProgress, barH);
        }
      }
    }
  }
          }
