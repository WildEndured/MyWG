// js/data/armor.js

// КЛАССЫ ЗАЩИТЫ (Бр1 - Бр6)
export const ARMOR_CLASSES = {
  BR1: { level: 1, name: 'Бр1 (Пистолеты, осколки)' },
  BR2: { level: 2, name: 'Бр2 (Пистолеты-пулеметы)' },
  BR3: { level: 3, name: 'Бр3 (Автоматы 5.45, 5.56)' },
  BR4: { level: 4, name: 'Бр4 (Винтовки, усиленные автоматы)' },
  BR5: { level: 5, name: 'Бр5 (Крупный калибр, снайперские)' },
  BR6: { level: 6, name: 'Бр6 (Бронебойные винтовочные)' }
};

export const ARMOR_CONFIGS = {
  helmet_6b46: {
    id: 'helmet_6b46',
    name: 'Шлем 6Б46',
    class: 'BR2', 
    weight: 1.15,
    covers: ['head', 'skull', 'leftEar', 'rightEar'],
    durability: 50,
    durabilityLossMult: 1.0 // Стандартная потеря прочности
  },
  vest_6b45: {
    id: 'vest_6b45',
    name: 'Бронежилет 6Б45 (с плитой)',
    class: 'BR4', 
    weight: 8.0,
    covers: [
      'neck', 
      'torso', 'chest', 'spine', 'stomach', 'liver', 
      'leftLung', 'rightLung', 'leftKidney', 'rightKidney',
      'heart'
    ],
    durability: 100,
    durabilityLossMult: 2.5 // Керамическая плита трескается быстрее
  }
};
