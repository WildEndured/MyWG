import { CONFIG } from '../data/config.js';

export class Physics {
  static isPositionFree(x, y, radius, obstacles) {
    if (!obstacles) return true;
    for (const obs of obstacles) {
      for (const seg of obs.segments) {
        if (seg.state === 'rubble') continue;
        const closestX = Math.max(seg.x, Math.min(x, seg.x + seg.w));
        const closestY = Math.max(seg.y, Math.min(y, seg.y + seg.h));
        const dx = x - closestX, dy = y - closestY;
        if (dx * dx + dy * dy < radius * radius) return false;
      }
    }
    return true;
  }

  // ОБНОВЛЕНО: Проверка LOS с учётом рельефа
  static hasLineOfSight(x1, y1, x2, y2, obstacles, pathfinder = null, eyeHeight1 = 1.6, eyeHeight2 = 1.6) {
    // 1. Проверка стен
    if (obstacles && obstacles.length > 0) {
      const steps = Math.max(CONFIG.PHYSICS.COLLISION_STEPS, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.25));
      for (const obs of obstacles) {
        for (const seg of obs.segments) {
          if (seg.state === 'rubble') continue;
          if (obs.matData.destructionType === 'collapse' && obs.height < 1.2) continue;
          
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            if (px >= seg.x && px <= seg.x + seg.w && py >= seg.y && py <= seg.y + seg.h) return false;
          }
        }
      }
    }

    // 2. Проверка рельефа (холмы)
    if (pathfinder && pathfinder.heightMap) {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(10, Math.ceil(dist / 1.0));
      
      // Высота глаз (уровень глаз)
      const z1 = pathfinder.getHeight(x1, y1) + eyeHeight1;
      const z2 = pathfinder.getHeight(x2, y2) + eyeHeight2;
      
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        
        const terrainZ = pathfinder.getHeight(px, py);
        const rayZ = z1 + (z2 - z1) * t; // Интерполяция высоты луча
        
        if (terrainZ > rayZ) return false; // Холм блокирует
      }
    }
    
    return true;
  }

  static resolveUnitCollision(u1, u2, obstacles) {
    if (u1.isDead || u2.isDead) return;
    const minDist = u1.baseRadius + u2.baseRadius;
    const dx = u2.x - u1.x, dy = u2.y - u1.y;
    if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) return;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) return;

    if (distSq < 1e-6) {
      const ang = Math.random() * Math.PI * 2;
      const nx = Math.cos(ang), ny = Math.sin(ang);
      const push = minDist * 0.5;
      if (this.isPositionFree(u1.x - nx * push, u1.y - ny * push, u1.baseRadius, obstacles)) { u1.x -= nx * push; u1.y -= ny * push; }
      if (this.isPositionFree(u2.x + nx * push, u2.y + ny * push, u2.baseRadius, obstacles)) { u2.x += nx * push; u2.y += ny * push; }
      return;
    }

    const dist = Math.sqrt(distSq);
    const overlap = (minDist - dist) / 2;
    const nx = dx / dist, ny = dy / dist;
    const newU1X = u1.x - nx * overlap, newU1Y = u1.y - ny * overlap;
    const newU2X = u2.x + nx * overlap, newU2Y = u2.y + ny * overlap;

    if (this.isPositionFree(newU1X, newU1Y, u1.baseRadius, obstacles)) { u1.x = newU1X; u1.y = newU1Y; }
    if (this.isPositionFree(newU2X, newU2Y, u2.baseRadius, obstacles)) { u2.x = newU2X; u2.y = newU2Y; }
  }
}
