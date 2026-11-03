// js/data/weapons.js

export const WEAPONS = {
  ak74: {
    id: 'ak74',
    name: 'АК-74',
    caliber: '5.45x39',      // <-- ССЫЛКА НА КАЛИБР
    weightEmpty: 3.3,
    weightLoaded: 3.6,
    rpm: 650,
    effectiveRange: 440,
    magazineCapacity: 30,
    fireModes: ['single', 'auto'],
    spreadBase: 0.3,         // Точность самого оружия
    reloadTime: 2.5
  },
  pkm: {
    id: 'pkm',
    name: 'ПКМ',
    caliber: '7.62x54R',     // <-- ССЫЛКА НА КАЛИБР
    weightEmpty: 9.0,
    weightLoaded: 12.5,
    rpm: 650,
    effectiveRange: 1000,
    magazineCapacity: 100,
    fireModes: ['auto'],
    spreadBase: 0.5,
    reloadTime: 6.0
  }
};
