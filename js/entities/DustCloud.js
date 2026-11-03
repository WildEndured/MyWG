export class DustCloud {
  constructor(x, y, radius, duration) {
    this.x = x; this.y = y;
    this.radius = radius;
    this.life = 0;
    this.maxLife = duration;
    this.isDead = false;
  }

  update(dt) {
    if (this.isDead) return;
    this.life += dt;
    if (this.life >= this.maxLife) this.isDead = true;
  }

  // Проверка: блокирует ли облако линию видимости
  blocksLineOfSight(x1, y1, x2, y2) {
    // Упрощенная проверка: если облако на линии — блокирует
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(8, Math.ceil(dist / 1.0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      if (Math.hypot(px - this.x, py - this.y) < this.radius) return true;
    }
    return false;
  }
}
