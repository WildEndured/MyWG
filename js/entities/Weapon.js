import { CALIBERS } from '../data/calibers.js';
import { CONFIG } from '../data/config.js';

export class Weapon {
  constructor(config) {
    this.id = config.id; this.name = config.name;
    const caliberData = CALIBERS[config.caliber];
    
    // Если калибр не найден — используем заглушку (чтобы не падало)
    if (!caliberData) {
      console.warn(`[Weapon] Unknown caliber "${config.caliber}" for "${config.id}", using default.`);
      this.caliberId = '5.45x39'; 
      this.caliber = '5.45×39 мм';
      this.baseDamage = 20; this.bulletSpeed = 800; this.damageFalloff = 0.3; this.maxFalloffDist = 1000;
      this.penetration = 3; this.drag = 0.0003; this.fragmentation = 0; this.impulse = 0;
      this.woundingMult = 1.0; this.overpenetration = 0; this.stability = 0.9; this.mass = 0.005;
      this.loudness = 400;
    } else {
      this.caliberId = config.caliber;
      this.caliber = caliberData.name;
      this.baseDamage = caliberData.baseDamage; this.bulletSpeed = caliberData.bulletSpeed;
      this.damageFalloff = caliberData.damageFalloff; this.maxFalloffDist = caliberData.maxFalloffDist;
      this.penetration = caliberData.penetration; this.drag = caliberData.drag ?? 0.00025;
      this.fragmentation = caliberData.fragmentation ?? 0; this.impulse = caliberData.impulse ?? 0;
      this.woundingMult = caliberData.woundingMult ?? 1.0; this.overpenetration = caliberData.overpenetration ?? 0;
      this.stability = caliberData.stability ?? 0.9;
      this.mass = caliberData.mass ?? 0.005;
      this.isExplosive = caliberData.isExplosive ?? false;
      this.loudness = caliberData.loudness * (config.noiseMultiplier || 1);
    }

    this.rpm = config.rpm; this.fireInterval = 60 / this.rpm;
    this.effectiveRange = config.effectiveRange; this.magazineCapacity = config.magazineCapacity;
    this.fireModes = config.fireModes; this.spreadBase = config.spreadBase; this.reloadTime = config.reloadTime; this.maxAimTime = config.maxAimTime ?? 2.0;
    this.recoilPerShot = config.recoilPerShot ?? 1.0; this.recoilSpreadMult = config.recoilSpreadMult ?? 0.12; this.recoilRecovery = config.recoilRecovery ?? 3.5; this.recoil = 0;
    this.misfireChance = config.misfireChance ?? 0.01; this.heatPerShot = config.heatPerShot ?? 1.5; this.maxHeat = config.maxHeat ?? 100; this.coolingRate = config.coolingRate ?? 10;

    this.ammo = this.magazineCapacity;
    this.reserveMagazines = config.reserveMagazines || 0;
    this.weightEmpty = config.weightEmpty;
    this.weightLoaded = config.weightLoaded;

    this.currentMode = this.fireModes.includes('auto') ? 'auto' : 'single';
    this.lastShotTime = -Infinity; this.isReloading = false; this.reloadTimer = 0;
    this.isMisfired = false; this.heat = 0; this.isJammed = false; this.shotsFired = 0;
  }

  getTotalAmmoWeight() {
    const totalRounds = this.ammo + (this.reserveMagazines * this.magazineCapacity);
    let weightPerRound = CONFIG.AMMO.WEIGHT_PER_ROUND_545;
    if (this.caliberId === '7.62x54R') weightPerRound = CONFIG.AMMO.WEIGHT_PER_ROUND_762;
    else if (this.caliberId === 'rocket') weightPerRound = 2.5;
    return totalRounds * weightPerRound;
  }

  getReserveRounds() {
    return this.reserveMagazines * this.magazineCapacity;
  }

  canFire(currentTime) {
    if (this.isReloading || this.isMisfired || this.isJammed) return false;
    if (this.ammo <= 0) return false;
    return (currentTime - this.lastShotTime) >= this.fireInterval;
  }

  fire(currentTime) {
    if (!this.canFire(currentTime)) return false;
    if (Math.random() < this.misfireChance) { this.isMisfired = true; return false; }
    
    this.lastShotTime = currentTime; this.ammo--; this.shotsFired++;
    this.heat = Math.min(this.maxHeat, this.heat + this.heatPerShot);
    if (this.heat >= this.maxHeat) this.isJammed = true;
    this.recoil += this.recoilPerShot;
    if (this.ammo === 0) this.startReload();
    return true;
  }

  startReload() {
    if (this.isReloading) return;
    if (this.reserveMagazines <= 0) return; 
    this.isReloading = true; 
    this.reloadTimer = this.reloadTime;
  }

  abortReload() {
    if (this.isReloading) {
      this.isReloading = false;
      this.reloadTimer = 0;
    }
  }

  clearMalfunction() {
    if (this.isJammed) { this.isJammed = false; this.heat = this.maxHeat * 0.4; return true; }
    if (this.isMisfired) { this.isMisfired = false; return true; }
    return false;
  }

  update(dt) {
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        if (this.reserveMagazines > 0) { this.reserveMagazines--; this.ammo = this.magazineCapacity; }
        this.isReloading = false; this.isMisfired = false;
      }
    }
    if (this.heat > 0) this.heat = Math.max(0, this.heat - this.coolingRate * dt);
    if (this.isJammed && this.heat < 50) this.isJammed = false;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - this.recoilRecovery * dt);
  }

  updateFireMode(distanceToTarget) {
    if (this.fireModes.length === 1) { this.currentMode = this.fireModes[0]; return; }
    if (this.ammo <= 10 || distanceToTarget > 300) this.currentMode = 'single'; else this.currentMode = 'auto';
  }

  getRecoilSpreadMultiplier() { return 1.0 + this.recoil * this.recoilSpreadMult; }
}
