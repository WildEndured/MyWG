// js/data/weapons.js

export const WEAPONS = {
  ak74: {
    id: 'ak74',
    name: 'АК-74',
    caliber: '5.45×39',
    weightEmpty: 3.3,
    weightLoaded: 3.6,
    rpm: 650,                 // Темп стрельбы
    bulletSpeed: 900,         // Начальная скорость (м/с)
    effectiveRange: 440,      // Эффективная дальность (м)
    maxRange: 3150,           // Максимальная дальность (м)
    magazineCapacity: 30,     // Емкость магазина
    damage: 25,               // Урон (условный)
    fireModes: ['single', 'auto'],
    spreadBase: 0.3,          // Базовый разброс
    reloadTime: 2.5           // Время перезарядки (сек)
  },
  
  // Задел на будущее
  pkm: {
    id: 'pkm',
    name: 'ПКМ',
    caliber: '7.62×54R',
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
