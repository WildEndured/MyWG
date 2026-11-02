// js/core/Physics.js
import { CONFIG } from '../data/config.js';

export class Physics {
  // Проверка, свободна ли точка (круг не пересекается с прямоугольниками)
  static isPositionFree(x, y, radius, obstacles) {
    if (!obstacles) return true;

    for (const obs of obstacles) {
      const closestX = Math.max(obs.x, Math.min(x, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(y, obs.y + obs.h));
      const dx = x - closestX;
      const dy = y - closestY;
      
      if (dx * dx + dy * dy < radius * radius) {
        return false; 
      }
    }
    return true;
  }

  // Проверка линии видимости (нет ли стен между A и B)
  static hasLineOfSight(x1, y1, x2, y2, obstacles) {
    if (!obstacles) return true;
    
    const steps = CONFIG.PHYSICS.COLLISION_STEPS;
    for (const obs of obstacles) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        
        if (px >= obs.x && px <= obs.x + obs.w && py >= obs.y && py <= obs.y + obs.h) {
          return false;
        }
      }
    }
    return true;
  }

  // Расталкивание двух юнитов
  static resolveUnitCollision(u1, u2, obstacles) {
    const minDist = CONFIG.PHYSICS.MIN_UNIT_DIST;
    const dx = u2.x - u1.x;
    const dy = u2.y - u1.y;
    
    if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) return;
    
    const distSq = dx * dx + dy * dy;
    if (distSq < minDist * minDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = (minDist - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      
      const newU1X = u1.x - nx * overlap;
      const newU1Y = u1.y - ny * overlap;
      const newU2X = u2.x + nx * overlap;
      const newU2Y = u2.y + ny * overlap;

      if (this.isPositionFree(newU1X, newU1Y, u1.baseRadius, obstacles)) {
        u1.x = newU1X;
        u1.y = newU1Y;
      }
      if (this.isPositionFree(newU2X, newU2Y, u2.baseRadius, obstacles)) {
        u2.x = newU2X;
        u2.y = newU2Y;
      }
    }
  }
}
