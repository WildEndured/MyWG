// js/entities/Unit.js
import { Weapon } from './Weapon.js';
import { WEAPONS } from '../data/weapons.js';
import { UNIT_TYPES } from '../data/units.js';
import { Physics } from '../core/Physics.js';
import { EventBus } from '../core/EventBus.js';

export class Unit {
  constructor(x, y, faction = 'player', type = 'infantry') {
    this.x = x;
    this.y = y;
    
    this.faction = faction; 
    
    const config = UNIT_TYPES[type] || UNIT_TYPES['infantry'];
    this.type = config.id;
    this.name = config.name;
    
    this.baseRadius = config.baseRadius; 
    this.hitRadius = config.hitRadius; 
    
    this.maxHp = config.maxHp;
    this.hp = this.maxHp;
    this.isDead = false;
    
    this.maxStamina = config.maxStamina;
    this.stamina = this.maxStamina;
    this.speedEndurance = config.speedEndurance;
    this.recoveryRate = config.recoveryRate;
    this.staminaCooldown = 0;
    
    this.stance = 'stand'; 
    this.speeds = config.speeds;
    this.speed = this.speeds[this.stance];
    
    const weaponConfig = WEAPONS[config.defaultWeapon];
    this.weapon = new Weapon(weaponConfig);
    
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

  setStance(newStance) {
    if (this.stance === newStance) return;
    if (newStance === 'run' && this.stamina < 10) return;
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

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.isMoving = false;
      this.path = [];
      this.isSelected = false;
      this.stance = 'prone';
    }
  }

  update(dt, allUnits, currentTime) {
    if (this.isDead) return;

    this._updateCombat(dt, allUnits, currentTime);
    this.weapon.update(dt);

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
          
          const moveStep = this.speed * dt;
          const nextX = this.x + (dx / dist) * moveStep;
          const nextY = this.y + (dy / dist) * moveStep;

          // Используем Physics для проверки
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
          this._shoot(currentTime);
        }
      }
    }
  }

  _shoot(currentTime) {
    if (this.weapon.fire(currentTime)) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      const spread = this.weapon.spreadBase * (dist / 100); 
      const hitChance = Math.max(0.3, 1 - spread / 10); 

      // Отправляем событие выстрела
      EventBus.emit('unit:shoot', {
        x1: this.x, y1: this.y,
        x2: this.target.x, y2: this.target.y
      });
      
      if (Math.random() < hitChance) {
        this.target.takeDamage(this.weapon.damage);
      }
    }
  }

  _updateStamina(dt) {
    if (this.isMoving) {
      let drain = 0;
      if (this.stance === 'run') drain = 8 * this.speedEndurance;
      else if (this.stance === 'stand') drain = 0.5 * this.speedEndurance;
      else if (this.stance === 'crouch') drain = 0.2 * this.speedEndurance;
      else if (this.stance === 'prone') drain = 0.05 * this.speedEndurance;
      
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
        
        this.stamina += this.recoveryRate * recoveryMultiplier * dt;
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
