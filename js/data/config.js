export const MAP_PRESETS = { 100: { size: 100 }, 500: { size: 500 }, 1000: { size: 1000 }, 2000: { size: 2000 } };

export const CONFIG = {
  PX_PER_METER_BASE: 8, MIN_PX_PER_METER: 1.0, MAX_PX_PER_METER: 80,
  GRID_MINOR: 1, GRID_MAJOR: 10,
  COLORS: { bg: '#121418', mapFill: '#2a313a', gridMinor: 'rgba(255,255,255,0.05)', gridMajor: 'rgba(255,255,255,0.15)', border: 'rgba(120,200,255,1)' },
  TAP_MAX_MOVE_PX: 10, TAP_MAX_TIME_MS: 300, TAP_DOUBLE_MS: 300, PINCH_SENS: 0.8, MAX_DT: 0.05,
  
  PHYSICS: { MIN_UNIT_DIST: 1.0, COLLISION_STEPS: 24, PATHFINDER_PADDING: 0.3 },
  FORMATION: { SPACING: 2.5 },
  AUDIO: { HEARING_BASE: 200, FALLOFF_DB_PER_DOUBLE: 6, SPEED_OF_SOUND: 343 },
  BALLISTICS: { GRAVITY: 9.81, DRAG_COEFF: 0.00025, MAX_UPDATE_DT: 0.02, TRACER_EVERY_N: 5 },
  
  SUPPRESSION: { RADIUS: 3.5, PER_BULLET: 0.08, DECAY_PER_SEC: 0.35, THRESHOLD_PRESSED: 0.4, THRESHOLD_PANIC: 0.8, AUTO_CROUCH: 0.5, AUTO_PRONE: 0.8, PRESSED_MOVE_MULT: 0.6, STAND_LOCK_TIME: 2.0, CLEAR_TIME: 3.0 },
  RECOIL: { RECOVERY_PER_SEC: 3.5 },
  MOVEMENT: { ACCEL_BASE: 12.0, DECEL_BASE: 18.0, RUN_ACCEL_MULT: 0.7, STOP_EPS: 0.15, AIM_MOVE_THRESHOLD: 0.5 },
  STANCE: { TRANSITIONS: { 'stand->crouch': 0.3, 'crouch->stand': 0.4, 'crouch->prone': 0.5, 'prone->crouch': 0.8, 'stand->prone': 1.2, 'prone->stand': 1.8 }, FIRE_BLOCKED: true, ABORT_ON_DAMAGE: true },
  PERCEPTION: { CENTRAL_FILL_SEC: 0.2, PERIPHERAL_FILL_SEC: 1.5, LOSE_PER_SEC: 0.3, ENGAGE_THRESHOLD: 0.7, MEMORY_SEC: 8.0, SCAN_INTERVAL: 0.5 },
  TACTICAL_PAUSE: { ENABLED: true, ALLOW_ORDERS: true, KEY: ' ' },

  // НОВОЕ: Шок и медицина
  MEDICAL: { 
    BANDAGE_WEIGHT: 0.1, TOURNIQUET_WEIGHT: 0.2, 
    BANDAGE_TIME: 5.0, TOURNIQUET_TIME: 15.0,
    SHOCK_THRESHOLD: 0.6, SHOCK_DECAY: 0.15 
  },
  
  DEBUG: { ENABLED_BY_DEFAULT: false }, DATA_VERSION: 1,
};

export function clamp(v, a, b) { if (a > b) { const t = a; a = b; b = t; } if (!Number.isFinite(v)) return a; return v < a ? a : v > b ? b : v; }
export function capDt(dt, max = CONFIG.MAX_DT) { if (!Number.isFinite(dt) || dt < 0) return 0; return Math.min(dt, max); }
