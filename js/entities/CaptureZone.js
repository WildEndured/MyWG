import { EventBus, EVENTS } from '../core/EventBus.js';

export class CaptureZone {
  constructor(x, y, radius, mode, mapSize) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.mode = mode;
    this.mapSize = mapSize || 100;

    this.owner = mode === 'attack' ? 'enemy' : 'player';
    this.captureProgress = 0;
    this.maxCaptureProgress = 100;
    this.captureRate = 20;

    this._updateAccum = 0;
    this._updateInterval = 0.2; // 5 Гц
    this._playerCount = 0;
    this._enemyCount = 0;
  }

  update(dt, units) {
    this._updateAccum += dt;
    if (this._updateAccum < this._updateInterval) return;
    const step = this._updateAccum;
    this._updateAccum = 0;

    let playerCount = 0;
    let enemyCount = 0;

    for (const unit of units) {
      if (unit.isDead) continue;
      const dist = Math.hypot(unit.x - this.x, unit.y - this.y);
      if (dist <= this.radius) {
        if (unit.faction === 'player') playerCount++;
        else if (unit.faction === 'enemy') enemyCount++;
      }
    }

    this._playerCount = playerCount;
    this._enemyCount = enemyCount;

    // Спор — никто не захватывает
    if (playerCount > 0 && enemyCount > 0) return;

    let capturingFaction = null;
    if (playerCount > 0) capturingFaction = 'player';
    if (enemyCount > 0) capturingFaction = 'enemy';

    if (capturingFaction) {
      if (capturingFaction !== this.owner) {
        this.captureProgress += this.captureRate * step * (playerCount + enemyCount);
        if (this.captureProgress >= this.maxCaptureProgress) {
          this.owner = capturingFaction;
          this.captureProgress = 0;
          EventBus.emit(EVENTS.ZONE_CAPTURED, { owner: this.owner, zone: this });
        }
      } else {
        if (this.captureProgress > 0) {
          this.captureProgress = Math.max(0, this.captureProgress - this.captureRate * step);
        }
      }
    } else {
      if (this.captureProgress > 0) {
        this.captureProgress = Math.max(0, this.captureProgress - (this.captureRate * 0.5) * step);
      }
    }
  }
}
