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
  TAP_DOUBLE_MS: 300,
  PINCH_SENS: 0.8,

  // FIX: cap dt для всех систем (защита от tunneling)
  MAX_DT: 0.05,

  PHYSICS: {
    MIN_UNIT_DIST: 1.0,
    COLLISION_STEPS: 24, // FIX: было 10 — слишком мало для длинных LOS
    PATHFINDER_PADDING: 0.3,
  },

  FORMATION: {
    SPACING: 2.5,
  },

  // FIX: единые единицы для звука
  AUDIO: {
    HEARING_BASE: 200,     // метров при 0 дБ потерь
    FALLOFF_DB_PER_DOUBLE: 6,
  },

  DEBUG: {
    ENABLED_BY_DEFAULT: false,
  },

  // FIX: версия данных для сейвов/миграций
  DATA_VERSION: 1,
};

// FIX: clamp с защитой a > b
export function clamp(v, a, b) {
  if (a > b) { const t = a; a = b; b = t; }
  if (!Number.isFinite(v)) return a;
  return v < a ? a : v > b ? b : v;
}

// FIX: cap dt
export function capDt(dt, max = CONFIG.MAX_DT) {
  if (!Number.isFinite(dt) || dt < 0) return 0;
  return Math.min(dt, max);
}
