import { EventBus } from '../core/EventBus.js';
import { Physics } from '../core/Physics.js';
import { Explosion } from './Explosion.js';
import { CONFIG } from '../data/config.js';

export class Grenade {
  constructor(x, y, targetX, targetY, owner, config) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.owner = owner;
    this.config = config; // из EXPLOSIVES
    
    this.isDead = false;
    this.hasExploded = false;
    this.fuseTimer = config.fuseTime;
    
    // Физика полета: задаем скорость так, чтобы граната упала примерно в цель
    const dx = targetX - x, dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    const timeToTarget = Math.min(1.5, dist / 20); // 1.5 сек максимум
    
    // Упрощенная баллистика: vx, vy + гравитация
    this.vx = dx / timeToTarget;
    this.vy = (dy / timeToTarget) - 0.5 * 9.81 * timeToTarget; // Компенсация гравитации
    
    // Ограничение дальности
    if (dist > config.throwRange) {
      const scale = config.throwRange / dist;
      this.vx *= scale;
      this.vy *= scale;
    }

    this.prevX = x; this.prevY = y;
    this.radius = 0.1; // Размер гранаты (для коллизий)
    this.hasLanded = false;
  }

  update(dt, units, obstacles, pathfinder) {
    if (this.isDead) return;

    // Таймер взрыва
    this.fuseTimer -= dt;
    if (this.fuseTimer <= 0 && !this.hasExploded) {
      this._explode(units, obstacles, pathfinder);
      return;
    }

    // Если уже взорвалась — просто ждем смерти (визуал)
    if (this.hasExploded) return;

    // Физика полета (если еще не приземлилась)
    if (!this.hasLanded) {
      this.vy += 9.81 * dt; // Гравитация
      const nextX = this.x + this.vx * dt;
      const nextY = this.y + this.vy * dt;

      // Проверка столкновения со стенами
      if (obstacles) {
        for (const obs of obstacles) {
          for (const seg of obs.segments) {
            if (seg.state === 'rubble') continue;
            if (nextX >= seg.x && nextX <= seg.x + seg.w && nextY >= seg.y && nextY <= seg.y + seg.h) {
              // Отскок от стены (упрощенно — останавливаемся)
              this.vx *= -0.3;
              this.vy *= -0.3;
              break;
            }
          }
        }
      }

      // Проверка на землю (нижняя граница карты)
      const mapBottom = pathfinder?.worldSize || 1000;
      if (nextY >= mapBottom - 0.2) {
        this.y = mapBottom - 0.2;
        this.hasLanded = true;
        this.vx = 0; this.vy = 0;
      } else {
        this.x = nextX;
        this.y = nextY;
      }

      this.prevX = this.x;
      this.prevY = this.y;
    }
  }

  _explode(units, obstacles, pathfinder) {
    this.hasExploded = true;
    this.isDead = true; // Сразу удаляем после взрыва

    const ex = new Explosion(
      this.x, this.y, 
      this.config.blastRadius, 
      this.config.baseDamage, 
      this.config.fragmentation, 
      this.owner
    );
    // Взрыв обрабатывается мгновенно
    ex.update(0.016, units, obstacles, pathfinder);
    
    EventBus.emit('explosion:created', { explosion: ex });
  }
}
