export const WEAPONS = {
  ak74: {
    id: 'ak74', name: 'АК-74', caliber: '5.45x39', 
    weightEmpty: 3.3, weightLoaded: 3.6, rpm: 650, effectiveRange: 440, magazineCapacity: 30,
    fireModes: ['single', 'auto'], spreadBase: 0.3, reloadTime: 2.5, noiseMultiplier: 1.0,
    misfireChance: 0.01, heatPerShot: 1.5, maxHeat: 100, coolingRate: 10, recoilPerShot: 0.8, recoilSpreadMult: 0.12, recoilRecovery: 3.5, maxAimTime: 1.5, reserveMagazines: 5,
  },
  pkm: {
    id: 'pkm', name: 'ПКМ', caliber: '7.62x54R', 
    weightEmpty: 9.0, weightLoaded: 12.5, rpm: 650, effectiveRange: 1000, magazineCapacity: 100,
    fireModes: ['auto'], spreadBase: 0.5, reloadTime: 6.0, noiseMultiplier: 1.2,
    misfireChance: 0.02, heatPerShot: 1.5, maxHeat: 100, coolingRate: 10, recoilPerShot: 1.6, recoilSpreadMult: 0.16, recoilRecovery: 3.0, maxAimTime: 3.0, reserveMagazines: 2,
  },
  // НОВОЕ: АКС-74У (короткий, для экипажа)
  aks74u: {
    id: 'aks74u', name: 'АКС-74У', caliber: '5.45x39', 
    weightEmpty: 2.5, weightLoaded: 2.7, rpm: 700, effectiveRange: 250, magazineCapacity: 30,
    fireModes: ['single', 'auto'], spreadBase: 0.6, reloadTime: 2.0, noiseMultiplier: 0.9,
    misfireChance: 0.01, heatPerShot: 1.8, maxHeat: 100, coolingRate: 10, recoilPerShot: 0.9, recoilSpreadMult: 0.15, recoilRecovery: 3.5, maxAimTime: 1.2, reserveMagazines: 3,
  },
  // НОВОЕ: АК-74 с подствольником ГП-25
  ak74_gp25: {
    id: 'ak74_gp25', name: 'АК-74 + ГП-25', caliber: '5.45x39', 
    weightEmpty: 4.5, weightLoaded: 4.8, rpm: 650, effectiveRange: 440, magazineCapacity: 30,
    fireModes: ['single', 'auto'], spreadBase: 0.3, reloadTime: 2.5, noiseMultiplier: 1.0,
    misfireChance: 0.01, heatPerShot: 1.5, maxHeat: 100, coolingRate: 10, recoilPerShot: 0.8, recoilSpreadMult: 0.12, recoilRecovery: 3.5, maxAimTime: 1.5, reserveMagazines: 5,
    hasGrenadeLauncher: true, // Флаг для UI/логики
  },
  // НОВОЕ: РПГ-7 (гранатомет)
  rpg7: {
    id: 'rpg7', name: 'РПГ-7', caliber: 'rocket', 
    weightEmpty: 6.0, weightLoaded: 7.5, rpm: 4, effectiveRange: 300, magazineCapacity: 1,
    fireModes: ['single'], spreadBase: 0.5, reloadTime: 15.0, noiseMultiplier: 2.0,
    misfireChance: 0.0, heatPerShot: 0, maxHeat: 100, coolingRate: 10, recoilPerShot: 0, recoilSpreadMult: 0, recoilRecovery: 1.0, maxAimTime: 2.5, reserveMagazines: 3,
    isExplosive: true, explosiveConfig: 'grenade_rpg',
  }
};

export const EXPLOSIVES = {
  grenade_rgd5: {
    id: 'grenade_rgd5', name: 'РГД-5', weight: 0.3, throwRange: 30, fuseTime: 4.0, blastRadius: 10.0, baseDamage: 100, fragmentation: 0.8, loudness: 600,
  },
  grenade_rpg: {
    id: 'grenade_rpg', name: 'РПГ-7 (ракета)', type: 'rocket', weight: 2.5, throwRange: 100, fuseTime: 0.0, blastRadius: 5.0, baseDamage: 200, fragmentation: 0.3, loudness: 1200, penetration: 6,
  }
};

export function validateWeapons(calibers) {
  const errors = [];
  for (const [id, w] of Object.entries(WEAPONS)) {
    if (w.id !== id) errors.push(`weapon id mismatch: ${id} != ${w.id}`);
    if (w.caliber !== 'rocket' && !calibers[w.caliber]) errors.push(`weapon ${id}: unknown caliber ${w.caliber}`);
  }
  return errors;
}
