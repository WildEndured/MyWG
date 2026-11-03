// js/entities/Unit.js
import { Weapon } from './Weapon.js';
import { WEAPONS } from '../data/weapons.js';
import { ROLES, BASE_HUMAN } from '../data/units.js';
import { Physics } from '../core/Physics.js';
import { EventBus } from '../core/EventBus.js';

export class Unit {
  constructor(x, y, faction = 'player', roleId = 'infantry') {
    this.x = x;
    this.y = y;
    this.faction = faction; 
    
    // 1. База
    this.baseRadius = BASE_HUMAN.baseRadius; 
    this.hitRadius = BASE_HUMAN.hitRadius; 
    this.maxHp = BASE_HUMAN.maxHp;
    this.hp = this.maxHp;
    this.isDead = false;
    
    this.maxStamina = BASE_HUMAN.maxStamina;
    this.stamina = this.maxStamina;
    this.baseRecoveryRate = BASE_HUMAN.baseRecoveryRate;
    this.staminaCooldown = 0;
    
    // 2. Роль и Оружие
    const role = ROLES[roleId] || ROLES['infantry'];
    this.roleId = role.id;
    this.name = role.name;
    
    const weaponConfig = WEAPONS[role.defaultWeapon];
    this.weapon = new Weapon(weaponConfig);
    
    // 3. Считаем общий вес (ТОЛЬКО вес снаряженного оружия)
    this.totalWeight = this.weapon.weightLoaded;
    
    // Штраф к стамине зависит от веса оружия (чем тяжелее, тем быстрее устает)
    this.staminaPenalty = Math.max(1.0, this.totalWeight / 4.0); 
    
    // 4. Вычисляем итоговые скорости на основе веса оружия
    this.speeds = this._calculateSpeeds(BASE_HUMAN.nakedSpeeds, this.totalWeight);
    
    this.stance = 'stand'; 
    this.speed = this.speeds[this.stance];
    
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

  // ФОРМУЛА ПАДЕНИЯ СКОРОСТИ ОТ ВЕСА ОРУЖИЯ
  _calculateSpeeds(baseSpeeds, weight) {
    // 3.6 кг (АК-74) — эталон, скорость 100%
    // Каждые +1 кг сверх 3.6 снижают скорость на 4%
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

  // ... (остальные методы setStance, setPath, update, draw остаются БЕЗ ИЗМЕНЕНИЙ)
  
  _updateStamina(dt) {
    if (this.isMoving) {
      let drain = 0;
      if (this.stance === 'run') drain = 8;
      else if (this.stance === 'stand') drain = 0.5;
      else if (this.stance === 'crouch') drain = 0.2;
      else if (this.stance === 'prone') drain = 0.05;
      
      drain *= this.staminaPenalty; // Штраф от веса
      
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
}
