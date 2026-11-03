// js/data/health.js

export const BODY_PARTS = {
  head: {
    name: 'Голова', 
    maxHp: 25, 
    fatal: true,
    bleedRate: 0.5, // Легкое кровотечение от ранений лица/головы
    subParts: [
      { id: 'skull', name: 'Череп', hp: 25, weight: 45, bleedRate: 0 },
      { id: 'brain', name: 'Мозг', hp: 10, weight: 20, fatal: true, bleedRate: 0 },
      { id: 'jaw', name: 'Челюсть', hp: 20, weight: 15, bleedRate: 1.0 },
      { id: 'leftEye', name: 'Левый глаз', hp: 10, weight: 5, bleedRate: 0.5 },
      { id: 'rightEye', name: 'Правый глаз', hp: 10, weight: 5, bleedRate: 0.5 },
      { id: 'leftEar', name: 'Левое ухо', hp: 12, weight: 5, bleedRate: 0.5 },
      { id: 'rightEar', name: 'Правое ухо', hp: 12, weight: 5, bleedRate: 0.5 },
    ]
  },
  neck: { 
    name: 'Шея', 
    maxHp: 25, 
    fatal: true,
    bleedRate: 3.0 // Артериальное (сонная артерия)
  },
  torso: {
    name: 'Торс', 
    maxHp: 40, 
    fatal: false,
    bleedRate: 1.0,
    subParts: [
      { id: 'chest', name: 'Грудная клетка', hp: 30, weight: 30, bleedRate: 1.5 },
      { id: 'spine', name: 'Позвоночник', hp: 25, weight: 15, fatal: true, bleedRate: 1.0 },
      { id: 'stomach', name: 'Желудок', hp: 20, weight: 15, bleedRate: 1.0 },
      { id: 'liver', name: 'Печень', hp: 20, weight: 10, fatal: true, bleedRate: 3.0 }, // Артериальное
      { id: 'heart', name: 'Сердце', hp: 15, weight: 5, fatal: true, bleedRate: 0 }, // Мгновенная смерть
      { id: 'leftLung', name: 'Левое легкое', hp: 15, weight: 6.25, bleedRate: 1.5 },
      { id: 'rightLung', name: 'Правое легкое', hp: 15, weight: 6.25, bleedRate: 1.5 },
      { id: 'leftKidney', name: 'Левая почка', hp: 15, weight: 6.25, bleedRate: 1.0 },
      { id: 'rightKidney', name: 'Правая почка', hp: 15, weight: 6.25, bleedRate: 1.0 },
    ]
  },
  pelvis: { 
    name: 'Таз', 
    maxHp: 25, 
    fatal: false,
    bleedRate: 2.0 // Много крупных сосудов
  },
  leftArm: { 
    name: 'Левая рука', 
    maxHp: 30, 
    fatal: false,
    bleedRate: 0.5
  },
  rightArm: { 
    name: 'Правая рука', 
    maxHp: 30, 
    fatal: false,
    bleedRate: 0.5
  },
  leftLeg: { 
    name: 'Левая нога', 
    maxHp: 30, 
    fatal: false,
    bleedRate: 0.5 // Венозное (если не задета бедренная артерия)
  },
  rightLeg: { 
    name: 'Правая нога', 
    maxHp: 30, 
    fatal: false,
    bleedRate: 0.5
  }
};
