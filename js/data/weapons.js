export const WEAPONS = {
  ak74: {
    id: 'ak74', name: 'АК-74', caliber: '5.45x39', 
    weightEmpty: 3.3, weightLoaded: 3.6,
    rpm: 650, effectiveRange: 440, magazineCapacity: 30,
    fireModes: ['single', 'auto'], spreadBase: 0.3, reloadTime: 2.5, noiseMultiplier: 1.0,
    misfireChance: 0.01, heatPerShot: 1.5, maxHeat: 100, coolingRate: 10, recoilPerShot: 0.8, recoilSpreadMult: 0.12, recoilRecovery: 3.5, maxAimTime: 1.5,
    reserveMagazines: 5, // НОВОЕ: 5 запасных магазинов (итого 180 патронов)
  },
  pkm: {
    id: 'pkm', name: 'ПКМ', caliber: '7.62x54R', 
    weightEmpty: 9.0, weightLoaded: 12.5,
    rpm: 650, effectiveRange: 1000, magazineCapacity: 100,
    fireModes: ['auto'], spreadBase: 0.5, reloadTime: 6.0, noiseMultiplier: 1.2,
    misfireChance: 0.02, heatPerShot: 1.5, maxHeat: 100, coolingRate: 10, recoilPerShot: 1.6, recoilSpreadMult: 0.16, recoilRecovery: 3.0, maxAimTime: 3.0,
    reserveMagazines: 2, // НОВОЕ: 2 запасных короба (итого 300 патронов)
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
