// js/data/units.js

export const BASE_HUMAN = {
  maxHp: 100,
  baseRadius: 0.5,
  hitRadius: 2.0,
  maxStamina: 100,
  
  // Скорости человека БЕЗ оружия (м/с)
  nakedSpeeds: {
    run: 5.0,     
    stand: 1.6,   
    crouch: 0.9,  
    prone: 0.4    
  },
  
  baseRecoveryRate: 12,
};

export const ROLES = {
  infantry: {
    id: 'infantry',
    name: 'Пехотинец (Стрелок)',
    defaultWeapon: 'ak74',
    // Теперь здесь ТОЛЬКО оружие. Вес берем из WEAPONS.
  },

  machinegunner: {
    id: 'machinegunner',
    name: 'Пулеметчик',
    defaultWeapon: 'pkm',
  }
};
