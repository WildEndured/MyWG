// js/data/materials.js

export const MATERIALS = {
  // 1. Дерево (сосна, доски)
  wood: {
    name: 'Дерево',
    // Насколько легко пробить: чем выше, тем проще (1 - легко, 10 - сложно)
    hardness: 2, 
    // Какая толщина (в метрах) блокирует пулю определенного класса
    thicknessData: [
      { thickness: 0.05, requiredBr: 1 }, // 5 см (доска) — пробивает пистолет
      { thickness: 0.20, requiredBr: 3 }, // 20 см (бревно) — пробивает АК-74
      { thickness: 0.50, requiredBr: 5 }  // 50 см (толстое дерево) — пробивает только ПКМ
    ]
  },

  // 2. Алюминий (обшивка техники)
  aluminum: {
    name: 'Алюминий',
    hardness: 4,
    thicknessData: [
      { thickness: 0.01, requiredBr: 2 }, // 1 см — ПП
      { thickness: 0.05, requiredBr: 4 }, // 5 см — винтовки
      { thickness: 0.10, requiredBr: 6 }  // 10 см — только крупный калибр
    ]
  },

  // 3. Сталь (броня БТР, листы)
  steel: {
    name: 'Сталь',
    hardness: 8,
    thicknessData: [
      { thickness: 0.003, requiredBr: 3 }, // 3 мм — АК-74 (Бр3)
      { thickness: 0.010, requiredBr: 5 }, // 1 см — ПКМ
      { thickness: 0.020, requiredBr: 6 }  // 2 см — только бронебойные
    ]
  },

  // 4. Мешки с песком
  sandbags: {
    name: 'Мешки с песком',
    hardness: 9, // Очень хорошо гасит энергию
    thicknessData: [
      { thickness: 0.15, requiredBr: 3 }, // 15 см — гасит АК-74
      { thickness: 0.30, requiredBr: 5 }, // 30 см — гасит ПКМ
      { thickness: 0.60, requiredBr: 6 }  // 60 см — не пробивает никто
    ]
  },

  // 5. Кирпичная кладка
  brick: {
    name: 'Кирпич',
    hardness: 6,
    thicknessData: [
      { thickness: 0.12, requiredBr: 3 }, // 1 кирпич — АК-74
      { thickness: 0.25, requiredBr: 5 }, // 2 кирпича — ПКМ
      { thickness: 0.50, requiredBr: 6 }
    ]
  },

  // 6. Бетон
  concrete: {
    name: 'Бетон',
    hardness: 10,
    thicknessData: [
      { thickness: 0.10, requiredBr: 4 },
      { thickness: 0.20, requiredBr: 6 }
    ]
  }
};
