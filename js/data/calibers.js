export const CALIBERS = {
  '5.45x39': {
    id: '5.45x39', name: '5.45×39 мм',
    baseDamage: 25, bulletSpeed: 900, damageFalloff: 0.3, maxFalloffDist: 1000,
    penetration: 3, loudness: 400, drag: 0.00030,
    fragmentation: 0.35, woundingMult: 1.2, overpenetration: 0.2,
    stability: 0.7, mass: 0.0034,
  },
  '7.62x54R': {
    id: '7.62x54R', name: '7.62×54 мм R',
    baseDamage: 40, bulletSpeed: 825, damageFalloff: 0.2, maxFalloffDist: 1500,
    penetration: 5, loudness: 800, drag: 0.00022,
    fragmentation: 0.2, woundingMult: 0.8, overpenetration: 0.6,
    stability: 0.9, mass: 0.0096,
  },
  // НОВОЕ: Ракета для РПГ-7
  'rocket': {
    id: 'rocket', name: 'Ракета РПГ',
    baseDamage: 200, bulletSpeed: 300, damageFalloff: 0, maxFalloffDist: 500,
    penetration: 6, loudness: 1200, drag: 0.0001,
    fragmentation: 0.3, woundingMult: 1.0, overpenetration: 0,
    stability: 1.0, mass: 2.5,
    isExplosive: true, // Флаг для логики взрыва
  }
};
