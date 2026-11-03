import { Physics } from '../core/Physics.js';

export class Debris {
  constructor(x, y, vx, vy, size, mass, owner, material) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = size;
    this.mass = mass;
    this.owner = owner;
    this.material = material;
    this.isDead = false;
    this.life = 0;
    this.maxLife = 30.0; // Лежит 30 секунд
    this.hasHit = false;
  }

  update(dt, units, obstacles) {
    if (this.isDead) return;
    
    // Если обломок уже упал — просто лежит (декаль)
    if (this.hasHit) {
      this.life += dt;
      if (this.life >= this.maxLife) this.isDead = true;
      return;
    }

    // Гравитация и полет
    this.vy += 9.81 * dt;
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // Проверка попадания в юнита
    for (const unit of units) {
      if (unit.isDead || unit === this.owner) continue;
      const dist = Math.hypot(unit.x - nextX, unit.y - nextY);
      if (dist < unit.baseRadius + this.size) {
        unit.takeDamage(this.mass * 15, 'torso', 0, null);
        unit.applySuppression(0.3);
        this.hasHit = true;
        return;
      }
    }

    // Проверка столкновения со стеной
    if (obstacles) {
      for (const obs of obstacles) {
        for (const seg of obs.segments) {
          if (seg.state === 'rubble') continue;
          if (nextX >= seg.x && nextX <= seg.x + seg.w && nextY >= seg.y && nextY <= seg.y + seg.h) {
            this.hasHit = true;
            return;
          }
        }
      }
    }

    // Проверка на землю (нижняя граница)
    if (this.y > 998) {
      this.hasHit = true;
      return;
    }

    this.x = nextX;
    this.y = nextY;
  }
}
