// js/data/units.js

// БАЗОВЫЕ характеристики ЛЮБОГО юнита (без снаряжения)
export const BASE_HUMAN = {
  maxHp: 100,
  baseRadius: 0.5,
  hitRadius: 2.0,
  maxStamina: 100,
  
  // Скорости ГОЛОГО человека (м/с)
  nakedSpeeds: {
    run: 5.0,     // Спортсмен-легкоатлет
    stand: 1.6,   // Обычный шаг
    crouch: 0.9,  // Гусиный шаг
    prone: 0.4    // Ползком
  },
  
  // Базовое восстановление стамины
  baseRecoveryRate: 12,
};

// РОЛИ (снаряжение, которое надевается на базу)
export const ROLES = {
  infantry: {
    id: 'infantry',
    name: 'Пехотинец (Стрелок)',
    defaultWeapon: 'ak74',
  },

  machinegunner: {
    id: 'machinegunner',
    name: 'Пулеметчик',
    defaultWeapon: 'pkm',
  }
};
