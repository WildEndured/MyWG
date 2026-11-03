export const MATERIALS = {
  wood: {
    name: 'Дерево',
    hardness: 2,
    destructionType: 'shatter', // Разлетается на щепки
    thicknessData: [
      { thickness: 0.05, requiredBr: 1 },
      { thickness: 0.20, requiredBr: 3 },
      { thickness: 0.50, requiredBr: 5 },
      { thickness: Infinity, requiredBr: 6 },
    ]
  },
  aluminum: {
    name: 'Алюминий',
    hardness: 4,
    destructionType: 'crumble',
    thicknessData: [
      { thickness: 0.01, requiredBr: 2 },
      { thickness: 0.05, requiredBr: 4 },
      { thickness: 0.10, requiredBr: 6 },
      { thickness: Infinity, requiredBr: 6 },
    ]
  },
  steel: {
    name: 'Сталь',
    hardness: 8,
    destructionType: 'deform', // Только рикошет, не разрушается
    thicknessData: [
      { thickness: 0.003, requiredBr: 3 },
      { thickness: 0.010, requiredBr: 5 },
      { thickness: 0.020, requiredBr: 6 },
      { thickness: Infinity, requiredBr: 6 },
    ]
  },
  sandbags: {
    name: 'Мешки с песком',
    hardness: 9,
    destructionType: 'collapse', // Осыпается (высота уменьшается)
    height: 1.5, // Высота в метрах
    thicknessData: [
      { thickness: 0.15, requiredBr: 3 },
      { thickness: 0.30, requiredBr: 5 },
      { thickness: 0.60, requiredBr: 6 },
      { thickness: Infinity, requiredBr: 6 },
    ]
  },
  brick: {
    name: 'Кирпич',
    hardness: 6,
    destructionType: 'chip', // Выбивается по кирпичу (дыры)
    thicknessData: [
      { thickness: 0.12, requiredBr: 3 },
      { thickness: 0.25, requiredBr: 5 },
      { thickness: 0.50, requiredBr: 6 },
      { thickness: Infinity, requiredBr: 6 },
    ]
  },
  concrete: {
    name: 'Бетон',
    hardness: 10,
    destructionType: 'crumble',
    thicknessData: [
      { thickness: 0.10, requiredBr: 4 },
      { thickness: 0.20, requiredBr: 6 },
      { thickness: Infinity, requiredBr: 6 },
    ]
  }
};

export function getRequiredBr(materialId, thickness) {
  const mat = MATERIALS[materialId] || MATERIALS.concrete;
  for (const d of mat.thicknessData) {
    if (thickness <= d.thickness) return d.requiredBr;
  }
  return 6;
}
