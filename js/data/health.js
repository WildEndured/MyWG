// js/data/health.js
export const BODY_PARTS = {
  head: {
    name: 'Голова', maxHp: 25, fatal: true,
    subParts: [
      { id: 'skull', name: 'Череп', hp: 25, weight: 45 }, // Уменьшили вес, чтобы освободить место для ушей
      { id: 'brain', name: 'Мозг', hp: 10, weight: 20, fatal: true },
      { id: 'jaw', name: 'Челюсть', hp: 20, weight: 15 },
      { id: 'leftEye', name: 'Левый глаз', hp: 10, weight: 5 },
      { id: 'rightEye', name: 'Правый глаз', hp: 10, weight: 5 },
      { id: 'leftEar', name: 'Левое ухо', hp: 12, weight: 5 },
      { id: 'rightEar', name: 'Правое ухо', hp: 12, weight: 5 },
    ]
  },
  neck: { name: 'Шея', maxHp: 25, fatal: true },
  torso: {
    name: 'Торс', maxHp: 40, fatal: false,
    subParts: [
      { id: 'chest', name: 'Грудная клетка', hp: 30, weight: 30 },
      { id: 'spine', name: 'Позвоночник', hp: 25, weight: 15, fatal: true },
      { id: 'stomach', name: 'Желудок', hp: 20, weight: 15 },
      { id: 'liver', name: 'Печень', hp: 20, weight: 10, fatal: true },
      { id: 'heart', name: 'Сердце', hp: 15, weight: 5, fatal: true },
      { id: 'leftLung', name: 'Левое легкое', hp: 15, weight: 6.25 },
      { id: 'rightLung', name: 'Правое легкое', hp: 15, weight: 6.25 },
      { id: 'leftKidney', name: 'Левая почка', hp: 15, weight: 6.25 },
      { id: 'rightKidney', name: 'Правая почка', hp: 15, weight: 6.25 },
    ]
  },
  pelvis: { name: 'Таз', maxHp: 25, fatal: false },
  leftArm: { name: 'Левая рука', maxHp: 30, fatal: false },
  rightArm: { name: 'Правая рука', maxHp: 30, fatal: false },
  leftLeg: { name: 'Левая нога', maxHp: 30, fatal: false },
  rightLeg: { name: 'Правая нога', maxHp: 30, fatal: false }
};
