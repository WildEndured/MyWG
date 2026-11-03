// js/entities/Weapon.js
import { CALIBERS } from '../data/calibers.js';

export class Weapon {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    
    const caliberData = CALIBERS[config.caliber];
    this.caliber = caliberData.name;
    this.baseDamage = caliberData.baseDamage;
    this.bulletSpeed = caliberData.bulletSpeed;
    this.damageFalloff = caliberData.damageFalloff;
    this.maxFalloffDist = caliberData.maxFalloffDist;
    this.penetration = caliberData.penetration;
    this.noiseLevel = caliberData.noiseLevel * config.noiseMultiplier;
    
    this.rpm = config.rpm;
    this.fireInterval = 60 / this.rpm;
    this.effectiveRange = config.effectiveRange;
    this.magazineCapacity = config.magazineCapacity;
    this.fireModes = config.fireModes;
    this.spreadBase = config.spreadBase;
    this.reloadTime = config.reloadTime;
    
    this.ammo = this.magazineCapacity;
    this.currentMode = this.fireModes.includes('auto') ? 'auto' : 'single';
    
    this.lastShotTime = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    
    this.misfireChance = 0.01; 
    this.isMisfired = false;   
    
    this.heat = 0;           
    this.maxHeat = 100;
    this.heatPerShot = 1.5;  
    this.coolingRate = 10;   
    this.isJammed = false;   
  }

  canFire(currentTime) {
    if (this.isReloading || this.isMisfired || this.isJammed) return false;
    if (this.ammo <= 0) return false;
    if (currentTime - this.lastShotTime < this.fireInterval) return false;
    return true;
  }

  fire(currentTime) {
    if (!this.canFire(currentTime)) return false;
    
    // Проверка на осечку
    if (Math.random() < this.misfireChance) {
      this.isMisfired = true;
      return false; 
    }
    
    this.lastShotTime = currentTime;
    this.ammo--;
    
    this.heat += this.heatPerShot;
    if (this.heat >= this.maxHeat) {
      this.heat = this.maxHeat;
      this.isJammed = true; 
    }
    
    if (this.ammo === 0) {
      this.startReload();
    }
    return true;
  }

  startReload() {
    if (this.isReloading) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
  }

  update(dt) {
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.ammo = this.magazineCapacity;
        this.isMisfired = false; 
      }
    }
    
    if (this.heat > 0) {
      this.heat -= this.coolingRate * dt;
      if (this.heat < 0) this.heat = 0;
    }
    
    if (this.isJammed && this.heat < 50) {
      this.isJammed = false;
    }
  }

  updateFireMode(distanceToTarget) {
    if (this.fireModes.length === 1) {
      this.currentMode = this.fireModes[0];
      return;
    }

    if (this.ammo <= 10) {
      this.currentMode = 'single';
    } else if (distanceToTarget > 300) {
      this.currentMode = 'single';
    } else {
      this.currentMode = 'auto';
    }
  }
}
