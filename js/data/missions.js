export const MISSIONS = {
  capture_bridge: {
    id: 'capture_bridge',
    name: 'Захват моста',
    type: 'capture',
    description: 'Захватите мост и удержите его 60 секунд до подхода подкреплений.',
    mapSize: 100,
    timeLimit: 300, // 5 минут
    zones: [
      { x: 50, y: 50, radius: 10, name: 'Мост', requiredHoldTime: 60 }
    ],
    playerSquad: { spawnX: 20, spawnY: 50 },
    enemySquad: { spawnX: 80, spawnY: 50 },
    weather: { windSpeed: 3, temperature: 15, windAngle: 45 },
    objectives: [
      { id: 'capture', type: 'capture_zone', zoneId: 0, time: 60, description: 'Захватить мост' }
    ],
    triggers: [
      { time: 180, type: 'reinforcement', faction: 'enemy', spawnX: 90, spawnY: 50, roles: ['rifleman', 'rifleman', 'machine_gunner', 'squad_leader', 'rifleman'] }
    ]
  },
  defend_village: {
    id: 'defend_village',
    name: 'Оборона деревни',
    type: 'defense',
    description: 'Удерживайте деревню 4 минуты до эвакуации.',
    mapSize: 100,
    timeLimit: 240,
    zones: [
      { x: 30, y: 50, radius: 12, name: 'Деревня', requiredHoldTime: 240 }
    ],
    playerSquad: { spawnX: 30, spawnY: 50 },
    enemySquad: { spawnX: 90, spawnY: 50 },
    weather: { windSpeed: 5, temperature: 10, windAngle: 90 },
    objectives: [
      { id: 'hold', type: 'hold_zone', zoneId: 0, time: 240, description: 'Удержать деревню' }
    ],
    triggers: [
      { time: 120, type: 'reinforcement', faction: 'enemy', spawnX: 95, spawnY: 50, roles: ['machine_gunner', 'rifleman', 'grenadier', 'rifleman', 'rifleman'] }
    ]
  }
};
