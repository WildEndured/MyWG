import { CALIBERS } from '../data/calibers.js';

export class Weapon {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;

    const caliberData = CALIBERS[config.caliber];
    if (!caliberData) {
      throw new Error(`[Weapon] Unknown caliber "${config.caliber}" for weapon "${config.id}"`);
    }
    this.caliberId = config.caliber;
    this.caliber = caliberData.name;
    this.baseDamage = caliberData.baseDamage;
    this.bulletSpeed = caliberData.bulletSpeed;
    this.damageFalloff = caliberData.damageFalloff;
    this.maxFalloffDist = caliberData.maxFalloffDist;
    this.penetration = caliberData.penetration;
    this.drag = caliberData.drag ?? 0.00025;
    this.fragmentation = caliberData.fragmentation ?? 0;
    this.loudness = caliberData.loudness * (config.noiseMultiplier || 1);

    this.rpm = config.rpm;
    this.fireInterval = 60 / this.rpm;
    this.effectiveRange = config.effectiveRange;
    this.magazineCapacity = config.magazineCapacity;
    this.fireModes = config.fireModes;
    this.spreadBase = config.spreadBase;
    this.reloadTime = config.reloadTime;
    this.maxAimTime = config.maxAimTime ?? 2.0;

    // FIX: отдача (Волна 1)
    this.recoilPerShot = config.recoilPerShot ?? 1.0;
    this.recoilSpreadMult = config.recoilSpreadMult ?? 0.12;
    this.recoilRecovery = config.recoilRecovery ?? 3.5;
    this.recoil = 0;             // 0..∞, копится, спадает

    this.misfireChance = config.misfireChance ?? 0.01;
    this.heatPerShot = config.heatPerShot ?? 1.5;
    this.maxHeat = config.maxHeat ?? 100;
    this.coolingRate = config.coolingRate ?? 10;

    this.ammo = this.magazineCapacity;
    this.reserveAmmo = this.magazineCapacity * 6;
    this.currentMode = this.fireModes.includes('auto') ? 'auto' : 'single';

    this.lastShotTime = -Infinity;
    this.isReloading = false;
    this.reloadTimer = 0;

    this.isMisfired = false;
    this.heat = 0;
    this.isJammed = false;

    // FIX: счётчик выстрелов для трассеров
    this.shotsFired = 0;
  }

  canFire(currentTime) {
    if (this.isReloading || this.isMisfired || this.isJammed) return false;
    if (this.ammo <= 0) return false;
    return (currentTime - this.lastShotTime) >= this.fireInterval;
  }

  fire(currentTime) {
    if (!this.canFire(currentTime)) return false;

    if (Math.random() < this.misfireChance) {
      this.isMisfired = true;
      return false;
    }

    this.lastShotTime = currentTime;
    this.ammo--;
    this.shotsFired++;
    this.heat = Math.min(this.maxHeat, this.heat + this.heatPerShot);
    if (this.heat >= this.maxHeat) this.isJammed = true;

    // FIX: отдача копится
    this.recoil += this.recoilPerShot;

    if (this.ammo === 0) this.startReload();
    return true;
  }

  clearMalfunction() {
    if (this.isJammed) { this.isJammed = false; this.heat = this.maxHeat * 0.4; return true; }
    if (this.isMisfired) { this.isMisfired = false; return true; }
    return false;
  }

  startReload() {
    if (this.isReloading) return;
    if (this.reserveAmmo <= 0 && this.ammo > 0) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
  }

  update(dt) {
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = this.magazineCapacity - this.ammo;
        const take = Math.min(need, this.reserveAmmo);
        this.ammo += take;
        this.reserveAmmo -= take;
        this.isReloading = false;
        this.isMisfired = false;
      }
    }
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - this.coolingRate * dt);
    }
    if (this.isJammed && this.heat < 50) this.isJammed = false;

    // FIX: спад отдачи
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - this.recoilRecovery * dt);
    }
  }

  updateFireMode(distanceToTarget) {
    if (this.fireModes.length === 1) { this.currentMode = this.fireModes[0]; return; }
    if (this.ammo <= 10 || distanceToTarget > 300) this.currentMode = 'single';
    else this.currentMode = 'auto';
  }

  // FIX: множитель разброса от отдачи
  getRecoilSpreadMultiplier() {
    return 1.0 + this.recoil * this.recoilSpreadMult;
  }
}
