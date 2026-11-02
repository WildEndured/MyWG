// js/data/config.js
export const MAP_PRESETS = {
  100:  { size: 100 },
  500:  { size: 500 },
  1000: { size: 1000 },
  2000: { size: 2000 },
};

export const CONFIG = {
  PX_PER_METER_BASE: 8,
  MIN_PX_PER_METER: 1.0,
  MAX_PX_PER_METER: 80,

  GRID_MINOR: 1,
  GRID_MAJOR: 10,

  COLORS: {
    bg:        '#121418',
    mapFill:   '#2a313a',
    gridMinor: 'rgba(255,255,255,0.05)', 
    gridMajor: 'rgba(255,255,255,0.15)',
    border:    'rgba(120,200,255,1)',
  },

  TAP_MAX_MOVE_PX: 10,
  TAP_MAX_TIME_MS: 300,
  PINCH_SENS: 0.8,

  // НОВОЕ: Физика и формации
  PHYSICS: {
    MIN_UNIT_DIST: 1.0,       // Минимальная дистанция между юнитами
    PUSH_SPEED: 5.0,          // Скорость расталкивания
    COLLISION_STEPS: 10,      // Кол-во шагов для проверки линии видимости
    PATHFINDER_PADDING: 0.3,  // Отступ для A*
  },
  
  FORMATION: {
    SPACING: 2.5,             // Расстояние между юнитами в строю
  }
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
