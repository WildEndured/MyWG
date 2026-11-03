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

  MAX_DT: 0.05,

  PHYSICS: {
    MIN_UNIT_DIST: 1.0,
    COLLISION_STEPS: 24,
    PATHFINDER_PADDING: 0.3,
  },

  FORMATION: {
    SPACING: 2.5,
  },

  AUDIO: {
    HEARING_BASE: 200,
    FALLOFF_DB_PER_DOUBLE: 6,
  },

  // FIX: баллистика
  BALLISTICS: {
    GRAVITY: 9.81,               // м/с²
    DRAG_COEFF: 0.00025,         // коэффициент сопротивления (1/м)
    MAX_UPDATE_DT: 0.02,         // cap внутри Bullet.update
    TRACER_EVERY_N: 5,           // каждый N-й патрон — трассер
  },

  // FIX: подавление
  SUPPRESSION: {
    RADIUS: 3.5,                 // м — радиус «свиста» пули
    PER_BULLET: 0.08,            // прирост за пролетевшую рядом пулю
    DECAY_PER_SEC: 0.35,         // спад в секунду
    THRESHOLD_PRESSED: 0.4,      // при каком уровне нельзя стрелять стоя
    THRESHOLD_PANIC: 0.8,        // при каком — падает
  },

  // FIX: отдача
  RECOIL: {
    RECOVERY_PER_SEC: 3.5,       // спад отдачи в секунду
  },

  DEBUG: { ENABLED_BY_DEFAULT: false },
  DATA_VERSION: 1,
};

export function clamp(v, a, b) {
  if (a > b) { const t = a; a = b; b = t; }
  if (!Number.isFinite(v)) return a;
  return v < a ? a : v > b ? b : v;
}

export function capDt(dt, max = CONFIG.MAX_DT) {
  if (!Number.isFinite(dt) || dt < 0) return 0;
  return Math.min(dt, max);
}
