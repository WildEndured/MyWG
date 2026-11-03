export const BASE_HUMAN = {
  maxHp: 100,
  baseRadius: 0.5,
  hitRadius: 2.0,
  maxStamina: 100,
  
  // Базовые скорости для бойца с АК-74 и стандартной броней (вес ~10 кг)
  nakedSpeeds: {
    run: 5.0,     
    stand: 1.6,   
    crouch: 0.9,  
    prone: 0.4    
  },
  
  baseRecoveryRate: 12,
  defaultArmor: ['helmet_6b46', 'vest_6b45']
};

export const ROLES = {
  infantry: { id: 'infantry', name: 'Пехотинец (Стрелок)', defaultWeapon: 'ak74' },
  machinegunner: { id: 'machinegunner', name: 'Пулеметчик', defaultWeapon: 'pkm' }
};
