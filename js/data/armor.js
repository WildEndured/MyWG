// js/data/armor.js
export const ARMOR_MATERIALS = {
  none: { name: 'Без брони', level: 0 },
  soft: { name: 'Мягкая броня (кевлар)', level: 1 },
  ceramic: { name: 'Керамика (ГОСТ 3)', level: 3 },
  steel: { name: 'Сталь (ГОСТ 4)', level: 4 },
};

export const ARMOR_CONFIGS = {
  helmet_6b46: {
    id: 'helmet_6b46',
    name: 'Шлем 6Б46',
    material: 'ceramic',
    weight: 1.15,
    covers: ['head', 'skull', 'leftEar', 'rightEar'],
    durability: 50,
  },
  vest_6b45: {
    id: 'vest_6b45',
    name: 'Бронежилет 6Б45',
    material: 'ceramic',
    weight: 8.0,
    covers: [
      'neck', 
      'torso', 'chest', 'spine', 'stomach', 'liver', 
      'leftLung', 'rightLung', 'leftKidney', 'rightKidney',
      'heart'
    ],
    durability: 100,
  }
};
