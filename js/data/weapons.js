export const WEAPONS = {
  ak74: {
    id: 'ak74', name: 'АК-74', caliber: '5.45x39', 
    weightEmpty: 3.3, weightLoaded: 3.6,
    rpm: 650, effectiveRange: 440, magazineCapacity: 30,
    fireModes: ['single', 'auto'], spreadBase: 0.3, reloadTime: 2.5, noiseMultiplier: 1.0,
    misfireChance: 0.01, heatPerShot: 1.5, maxHeat: 100, coolingRate: 10, recoilPerShot: 0.8, recoilSpreadMult: 0.12, recoilRecovery: 3.5, maxAimTime: 1.5,
    reserveMagazines: 5,
  },
  pkm: {
    id: 'pkm', name: 'ПКМ', caliber: '7.62x54R', 
    weightEmpty: 9.0, weightLoaded: 12.5,
    rpm: 650, effectiveRange: 1000, magazineCapacity: 100,
    fireModes: ['auto'], spreadBase: 0.5, reloadTime: 6.0, noiseMultiplier: 1.2,
    misfireChance: 0.02, heatPerShot: 1.5, maxHeat: 100, coolingRate: 10, recoilPerShot: 1.6, recoilSpreadMult: 0.16, recoilRecovery: 3.0, maxAimTime: 3.0,
    reserveMagazines: 2,
  }
};

// НОВОЕ: Взрывчатка
export const EXPLOSIVES = {
  grenade_rgd5: {
    id: 'grenade_rgd5',
    name: 'Граната РГД-5',
    type: 'frag',
    weight: 0.3,
    throwRange: 30,
    fuseTime: 4.0,
    blastRadius: 10.0,
    baseDamage: 100,
    fragmentation: 0.8,
    loudness: 600,
  },
  grenade_rpg: {
    id: 'grenade_rpg',
    name: 'РПГ-7',
    type: 'rocket',
    weight: 2.5,
    throwRange: 100,
    fuseTime: 0.0,
    blastRadius: 5.0,
    baseDamage: 200,
    fragmentation: 0.3,
    loudness: 1200,
    penetration: 6,
  }
};

export function validateWeapons(calibers) {
  const errors = [];
  for (const [id, w] of Object.entries(WEAPONS)) {
    if (w.id !== id) errors.push(`weapon id mismatch: ${id} != ${w.id}`);
    if (!calibers[w.caliber]) errors.push(`weapon ${id}: unknown caliber ${w.caliber}`);
  }
  return errors;
}
