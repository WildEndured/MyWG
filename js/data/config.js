// Размеры карты в МЕТРАХ. Сетка — 1 клетка = 1 метр.
export const MAP_PRESETS = {
  100:  { size: 100,  label: '100×100'  },
  500:  { size: 500,  label: '500×500'  },
  1000: { size: 1000, label: '1000×1000' },
};

export const CONFIG = {
  // Сколько пикселей экрана занимает 1 метр при zoom = 1
  PX_PER_METER_BASE: 8,

  // Пределы зума (в пикселях на метр)
  MIN_PX_PER_METER: 0.5,
  MAX_PX_PER_METER: 60,

  // Шаг сетки для отрисовки (в метрах): 1 — мелкая, 10 — крупная
  GRID_MINOR: 1,
  GRID_MAJOR: 10,

  // Цвета
  COLORS: {
    bg:        '#1a1d21',
    gridMinor: 'rgba(255,255,255,0.04)',
    gridMajor: 'rgba(255,255,255,0.10)',
    border:    'rgba(120,200,255,0.6)',
  },

  // Инпут
  TAP_MAX_MOVE_PX: 10,     // сдвиг пальца/мыши, при котором это ещё «тап»
  TAP_MAX_TIME_MS: 300,    // макс. длительность тапа
  PINCH_SENS: 1.0,
};
