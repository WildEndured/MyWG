// js/data/weapons.js
export const WEAPONS = {
  ak74: {
    id: 'ak74',
    name: 'АК-74',
    caliber: '5.45x39',
    weightEmpty: 3.3,
    weightLoaded: 3.6,
    rpm: 650,
    effectiveRange: 440,
    magazineCapacity: 30,
    fireModes: ['single', 'auto'],
    spreadBase: 0.3,
    reloadTime: 2.5,
    noiseMultiplier: 1.0 // Стандартный ствол
  },
  pkm: {
    id: 'pkm',
    name: 'ПКМ',
    caliber: '7.62x54R',
    weightEmpty: 9.0,
    weightLoaded: 12.5,
    rpm: 650,
    effectiveRange: 1000,
    magazineCapacity: 100,
    fireModes: ['auto'],
    spreadBase: 0.5,
    reloadTime: 6.0,
    noiseMultiplier: 1.2 // Длинный ствол + мощный патрон (громче)
  }
};
