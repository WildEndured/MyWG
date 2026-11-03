export const ARMOR_CLASSES = { 
  BR1: { level: 1, name: 'Бр1' }, 
  BR2: { level: 2, name: 'Бр2' }, 
  BR3: { level: 3, name: 'Бр3' }, 
  BR4: { level: 4, name: 'Бр4' }, 
  BR5: { level: 5, name: 'Бр5' }, 
  BR6: { level: 6, name: 'Бр6' } 
};

export const ARMOR_CONFIGS = {
  helmet_6b46: {
    id: 'helmet_6b46',
    name: 'Шлем 6Б46',
    class: 'BR2',
    weight: 1.3,
    covers: ['head'],
    coveredSubParts: ['skull', 'leftEar', 'rightEar'],
    durability: 50,
    maxDurability: 50,
    durabilityLossMult: 1.0,
    armorMaterial: 'steel',
    ricochetAngle: 45, // Угол, при котором пуля рикошетит (в градусах)
  },
  vest_6b45: {
    id: 'vest_6b45',
    name: 'Бронежилет 6Б45 (с плитой)',
    class: 'BR4',
    weight: 10.5,
    covers: ['neck', 'torso'],
    coveredSubParts: ['chest', 'spine', 'stomach', 'liver', 'leftLung', 'rightLung', 'leftKidney', 'rightKidney', 'heart'],
    durability: 100,
    maxDurability: 100,
    durabilityLossMult: 2.5,
    armorMaterial: 'ceramic',
    ricochetAngle: 60, // Керамика рикошетит хуже (более хрупкая)
    // ЗОНАЛЬНАЯ БРОНЯ (плита трескается по зонам)
    zones: {
      'chest': { name: 'Центр плиты', levelBonus: 1, hp: 60, damageMult: 0.8 }, // Центр крепче
      'default': { name: 'Край плиты', levelBonus: 0, hp: 40, damageMult: 1.2 } // Край слабее
    }
  }
};

export function findArmorForHit(armorMap, hitZone, subPartId) {
  if (armorMap[hitZone]) return armorMap[hitZone];
  if (subPartId) {
    for (const piece of Object.values(armorMap)) {
      if (piece.coveredSubParts && piece.coveredSubParts.includes(subPartId)) return piece;
    }
  }
  return null;
}

export function validateArmorData() { 
  const errors = []; 
  for (const [id, cfg] of Object.entries(ARMOR_CONFIGS)) { 
    if (cfg.id !== id) errors.push(`armor id mismatch`); 
    if (!ARMOR_CLASSES[cfg.class]) errors.push(`unknown class ${cfg.class}`); 
  } 
  return errors; 
}
