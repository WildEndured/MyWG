import { EventBus, EVENTS } from '../core/EventBus.js';

export class CaptureZone {
  constructor(x, y, radius, mode, mapSize) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.mode = mode; // 'attack' (враг владеет, игрок должен отбить) или 'defense' (игрок владеет, враг должен отбить)
    
    this.owner = mode === 'attack' ? 'enemy' : 'player'; // Кто сейчас контролирует
    this.captureProgress = 0; // 0..100
    this.maxCaptureProgress = 100;
    this.captureRate = 20; // % в секунду
    
    this.unitsInside = [];
  }

  update(dt, units) {
    this.unitsInside = [];
    let playerCount = 0;
    let enemyCount = 0;

    for (const unit of units) {
      if (unit.isDead) continue;
      const dist = Math.hypot(unit.x - this.x, unit.y - this.y);
      if (dist <= this.radius) {
        this.unitsInside.push(unit);
        if (unit.faction === 'player') playerCount++;
        else if (unit.faction === 'enemy') enemyCount++;
      }
    }

    // Если внутри обе фракции — спор (ничего не меняется)
    if (playerCount > 0 && enemyCount > 0) {
      return;
    }

    let capturingFaction = null;
    if (playerCount > 0) capturingFaction = 'player';
    if (enemyCount > 0) capturingFaction = 'enemy';

    if (capturingFaction) {
      if (capturingFaction !== this.owner) {
        // Захват
        this.captureProgress += this.captureRate * dt * (playerCount + enemyCount); // Чем больше людей, тем быстрее
        if (this.captureProgress >= this.maxCaptureProgress) {
          this.owner = capturingFaction;
          this.captureProgress = 0;
          EventBus.emit(EVENTS.ZONE_CAPTURED || 'zone:captured', { owner: this.owner, zone: this });
        }
      } else {
        // Удержание (если уже наш, но захват был начат кем-то) — откатываем прогресс
        if (this.captureProgress > 0) {
          this.captureProgress = Math.max(0, this.captureProgress - this.captureRate * dt);
        }
      }
    } else {
      // Пусто — прогресс медленно падает
      if (this.captureProgress > 0) {
        this.captureProgress = Math.max(0, this.captureProgress - (this.captureRate * 0.5) * dt);
      }
    }
  }
}
