// js/data/units.js

export const UNIT_TYPES = {
  infantry: {
    id: 'infantry',
    name: 'Пехотинец',
    maxHp: 100,
    baseRadius: 0.5,
    hitRadius: 2.0,
    defaultWeapon: 'ak74',
    
    // Скорости по позам (м/с)
    speeds: {
      run: 4.5,
      stand: 1.4,
      crouch: 0.8,
      prone: 0.4
    },
    
    // Выносливость
    maxStamina: 100,
    speedEndurance: 1.0,
    recoveryRate: 10
  },

  // Задел на будущее (тяжелый пехотинец)
  heavy: {
    id: 'heavy',
    name: 'Пулеметчик',
    maxHp: 120,
    baseRadius: 0.6,
    hitRadius: 2.2,
    defaultWeapon: 'pkm',
    speeds: {
      run: 3.5,
      stand: 1.1,
      crouch: 0.6,
      prone: 0.3
    },
    maxStamina: 150,
    speedEndurance: 1.2,
    recoveryRate: 8
  }
};
