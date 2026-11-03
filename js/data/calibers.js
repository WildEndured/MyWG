export const CALIBERS = {
  '5.45x39': {
    id: '5.45x39',
    name: '5.45×39 мм',
    baseDamage: 25,
    bulletSpeed: 900,
    // FIX: damageFalloff = доля потери на maxFalloffDist (0..1)
    damageFalloff: 0.3,
    maxFalloffDist: 1000,
    penetration: 3,
    // FIX: единая шкала громкости — «базовая слышимость» в метрах
    loudness: 400,
  },
  '7.62x54R': {
    id: '7.62x54R',
    name: '7.62×54 мм R',
    baseDamage: 40,
    bulletSpeed: 825,
    damageFalloff: 0.2,
    maxFalloffDist: 1500,
    penetration: 5,
    loudness: 800,
  }
};
