export const BASE_HUMAN = {
  baseRadius: 0.5,
  hitRadius: 2.0,
  maxStamina: 100,
  nakedSpeeds: { run: 5.0, stand: 1.6, crouch: 0.9, prone: 0.4 },
  baseRecoveryRate: 12,
  defaultArmor: ['helmet_6b46', 'vest_6b45']
};

export const ROLES = {
  squad_leader: {
    id: 'squad_leader', name: 'Командир отделения', 
    defaultWeapon: 'ak74_gp25', 
    rank: 5, 
    isLeader: true
  },
  machine_gunner: {
    id: 'machine_gunner', name: 'Пулеметчик', 
    defaultWeapon: 'pkm', 
    rank: 3
  },
  grenadier: {
    id: 'grenadier', name: 'Гранатометчик', 
    defaultWeapon: 'rpg7', 
    secondaryWeapon: 'ak74', // Запасное оружие (если РПГ разряжен)
    rank: 3
  },
  grenadier_help: {
    id: 'grenadier_help', name: 'Помощник гранатометчика', 
    defaultWeapon: 'ak74', 
    rank: 2,
    followTarget: 'grenadier' // Следует за гранатометчиком
  },
  senior_rifleman: {
    id: 'senior_rifleman', name: 'Старший стрелок', 
    defaultWeapon: 'ak74_gp25', 
    rank: 4
  },
  rifleman: {
    id: 'rifleman', name: 'Стрелок', 
    defaultWeapon: 'ak74', 
    rank: 1
  },
  driver: {
    id: 'driver', name: 'Механик-водитель', 
    defaultWeapon: 'aks74u', 
    rank: 2
  },
  gunner: {
    id: 'gunner', name: 'Наводчик-оператор', 
    defaultWeapon: 'aks74u', 
    rank: 3
  }
};

// Хелпер для получения роли по умолчанию
export function getRole(roleId) { return ROLES[roleId] || ROLES['rifleman']; }
