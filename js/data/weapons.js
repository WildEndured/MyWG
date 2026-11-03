// js/data/weapons.js
export const WEAPONS = {
  ak74: {
    id: 'ak74',
    name: 'АК-74',
    caliber: '5.45×39',
    weightEmpty: 3.3,
    weightLoaded: 3.6,
    rpm: 650,
    bulletSpeed: 900,
    effectiveRange: 440,
    maxRange: 3150,
    magazineCapacity: 30,
    damage: 25,
    fireModes: ['single', 'auto'],
    spreadBase: 0.3,
    reloadTime: 2.5
  },
  pkm: {
    id: 'pkm',
    name: 'ПКМ',
    caliber: '7.62×54R',
    weightEmpty: 9.0,
    weightLoaded: 12.5,
    rpm: 650,
    bulletSpeed: 825,
    effectiveRange: 1000,
    maxRange: 3800,
    magazineCapacity: 100,
    damage: 40,
    fireModes: ['auto'],
    spreadBase: 0.5,
    reloadTime: 6.0
  }
};
