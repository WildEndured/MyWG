// js/data/calibers.js

export const CALIBERS = {
  '5.45x39': {
    id: '5.45x39',
    name: '5.45×39 мм',
    baseDamage: 25,          // Базовый урон
    bulletSpeed: 900,        // Начальная скорость (м/с)
    damageFalloff: 0.3,      // Насколько сильно падает урон на дистанции (до 30%)
    maxFalloffDist: 1000,    // Дистанция, на которой падение максимально (м)
  },
  '7.62x54R': {
    id: '7.62x54R',
    name: '7.62×54 мм R',
    baseDamage: 40,
    bulletSpeed: 825,
    damageFalloff: 0.2,      // Тяжелая пуля лучше держит энергию
    maxFalloffDist: 1500,
  },
  '9x19': { // Задел на будущее (пистолеты-пулеметы)
    id: '9x19',
    name: '9×19 мм Парабеллум',
    baseDamage: 15,
    bulletSpeed: 350,
    damageFalloff: 0.5,      // Пистолетная пуля быстро теряет энергию
    maxFalloffDist: 200,
  }
};
