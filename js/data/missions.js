export const MISSIONS = {
  capture_bridge: {
    id: 'capture_bridge',
    name: 'Захват моста',
    type: 'capture',
    description: 'Захватите мост и удержите его 60 секунд до подхода подкреплений.',
    // Используем проценты от размера карты
    mapSize: null, // Будет установлено извне (пресет)
    timeLimit: 300,
    zones: [
      { xRel: 0.5, yRel: 0.5, radiusRel: 0.1, name: 'Мост', requiredHoldTime: 60 }
    ],
    playerSquad: { spawnXRel: 0.2, spawnYRel: 0.5 },
    enemySquad: { spawnXRel: 0.8, spawnYRel: 0.5 },
    weather: { windSpeed: 3, temperature: 15, windAngle: 45 },
    objectives: [
      { id: 'capture', type: 'capture_zone', zoneId: 0, time: 60, description: 'Захватить мост' }
    ],
    triggers: [
      { time: 180, type: 'reinforcement', faction: 'enemy', spawnXRel: 0.9, spawnYRel: 0.5, roles: ['rifleman', 'rifleman', 'machine_gunner', 'squad_leader', 'rifleman'] }
    ]
  },
  defend_village: {
    id: 'defend_village',
    name: 'Оборона деревни',
    type: 'defense',
    description: 'Удерживайте деревню 4 минуты до эвакуации.',
    mapSize: null,
    timeLimit: 240,
    zones: [
      { xRel: 0.3, yRel: 0.5, radiusRel: 0.12, name: 'Деревня', requiredHoldTime: 240 }
    ],
    playerSquad: { spawnXRel: 0.3, spawnYRel: 0.5 },
    enemySquad: { spawnXRel: 0.9, spawnYRel: 0.5 },
    weather: { windSpeed: 5, temperature: 10, windAngle: 90 },
    objectives: [
      { id: 'hold', type: 'hold_zone', zoneId: 0, time: 240, description: 'Удержать деревню' }
    ],
    triggers: [
      { time: 120, type: 'reinforcement', faction: 'enemy', spawnXRel: 0.95, spawnYRel: 0.5, roles: ['machine_gunner', 'rifleman', 'grenadier', 'rifleman', 'rifleman'] }
    ]
  }
};
