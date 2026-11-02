// js/entities/Weapon.js

export class Weapon {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.caliber = config.caliber;
    this.rpm = config.rpm;
    this.fireInterval = 60 / this.rpm;
    this.bulletSpeed = config.bulletSpeed;
    this.effectiveRange = config.effectiveRange;
    this.maxRange = config.maxRange;
    this.magazineCapacity = config.magazineCapacity;
    this.damage = config.damage;
    this.fireModes = config.fireModes;
    this.spreadBase = config.spreadBase;
    this.reloadTime = config.reloadTime;
    
    this.ammo = this.magazineCapacity;
    this.currentMode = this.fireModes.includes('auto') ? 'auto' : 'single';
    
    this.lastShotTime = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
  }

  canFire(currentTime) {
    if (this.isReloading || this.ammo <= 0) return false;
    if (currentTime - this.lastShotTime < this.fireInterval) return false;
    return true;
  }

  fire(currentTime) {
    if (!this.canFire(currentTime)) return false;
    
    this.lastShotTime = currentTime;
    this.ammo--;
    
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
      }
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
