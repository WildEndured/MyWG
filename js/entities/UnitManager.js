import { EventBus, EVENTS } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js';
import { Physics } from '../core/Physics.js';
import { CONFIG } from '../data/config.js';

export class UnitManager {
  constructor() {
    this.units = []; this.selectedUnits = []; this.bullets = []; this.pathfinder = new Pathfinder(100, 1); this.camera = null;
    this._isSearchingPath = false; this.tracers = []; this.flashes = []; this.decals = []; this.currentTime = 0;
    this.playerFaction = 'player'; this.playerTeamId = 'team1'; this.gameMode = 'attack';

    this._unsubs = [
      EventBus.on(EVENTS.INPUT_TAP, this.handleTap.bind(this)), EventBus.on(EVENTS.INPUT_DOUBLE_TAP, this.handleDoubleTap.bind(this)),
      EventBus.on(EVENTS.UNIT_SHOOT, (data) => { this.tracers.push({ x1: data.x1, y1: data.y1, x2: data.x2, y2: data.y2, life: 0.05 }); if (data.isMuzzleFlash) this.flashes.push({ x: data.x1, y: data.y1, life: 0.05 }); }),
      EventBus.on(EVENTS.BULLET_IMPACT, (data) => { if (data.type === 'blood') this.decals.push({ x: data.x, y: data.y, r: 0.3 + Math.min(0.6, (data.amount || 10) / 100), alpha: 0.7, ttl: 12.0, age: 0 }); }),
    ];
  }

  destroy() { for (const unsub of this._unsubs) unsub(); this._unsubs = []; this.units = []; this.selectedUnits = []; this.bullets = []; this.tracers = []; this.flashes = []; this.decals = []; }
  setWorldSize(size) { this.pathfinder.setWorldSize(size); }
  addUnit(unit) { unit.pathfinder = this.pathfinder; this.units.push(unit); }
  removeUnit(unit) { const i = this.units.indexOf(unit); if (i >= 0) this.units.splice(i, 1); const j = this.selectedUnits.indexOf(unit); if (j >= 0) this.selectedUnits.splice(j, 1); }

  getSafeSpawnPoint(desiredX, desiredY) { const obs = this.pathfinder.obstacles; if (Physics.isPositionFree(desiredX, desiredY, 1.0, obs)) return { x: desiredX, y: desiredY }; return this.pathfinder.findNearestFreePoint(desiredX, desiredY); }

  _spawnTestObstacles(mapSize, enabled = true) {
    this.pathfinder.clearObstacles(); if (!enabled) return;
    const c = mapSize / 2;
    this.pathfinder.addObstacle(c - 10, c - 20, 1, 40, 'wood'); this.pathfinder.addObstacle(c + 10, c - 20, 1, 40, 'concrete'); this.pathfinder.addObstacle(c - 15, c - 5, 10, 2, 'sandbags');
  }

  isPlayerControllable(unit) { if (!unit || unit.isDead) return false; if (this.playerFaction === null) return false; return unit.faction === this.playerFaction; }

  update(dt) {
    this.currentTime += dt;
    for (const unit of this.units) {
      const bullets = unit.update(dt, this.units, this.currentTime);
      if (bullets) { if (Array.isArray(bullets)) this.bullets.push(...bullets); else this.bullets.push(bullets); }
      if (unit.needsRepath && !unit.isDead) {
        unit.needsRepath = false; const target = unit.lastTarget || (unit.target ? { x: unit.target.x, y: unit.target.y } : null);
        if (target) { const newPath = this.pathfinder.findPath(unit.x, unit.y, target.x, target.y); if (newPath && newPath.length > 0) unit.setPath(newPath); else { unit._wantsToMove = false; unit.isMoving = false; unit.lastTarget = null; } }
        else { unit._wantsToMove = false; unit.isMoving = false; }
      }
    }
    this._resolveCollisions();
    for (let i = this.units.length - 1; i >= 0; i--) if (this.units[i].isDead) this.removeUnit(this.units[i]);
    for (let i = this.bullets.length - 1; i >= 0; i--) { const b = this.bullets[i]; b.update(dt, this.units, this.pathfinder.obstacles, this.pathfinder); if (b.isDead) this.bullets.splice(i, 1); }
    for (let i = this.tracers.length - 1; i >= 0; i--) { this.tracers[i].life -= dt; if (this.tracers[i].life <= 0) this.tracers.splice(i, 1); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].life -= dt; if (this.flashes[i].life <= 0) this.flashes.splice(i, 1); }
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.age += dt; if (d.age >= d.ttl) this.decals.splice(i, 1); }
  }

  _resolveCollisions() { for (let i = 0; i < this.units.length; i++) { for (let j = i + 1; j < this.units.length; j++) { const u1 = this.units[i], u2 = this.units[j]; if (u1.isDead || u2.isDead) continue; Physics.resolveUnitCollision(u1, u2, this.pathfinder.obstacles); } } }

  handleTap({ x, y }) {
    if (this._isSearchingPath || this.playerFaction === null) return;
    let clicked = null;
    for (let i = this.units.length - 1; i >= 0; i--) { const u = this.units[i]; if (!this.isPlayerControllable(u)) continue; if (Math.hypot(u.x - x, u.y - y) <= u.hitRadius) { clicked = u; break; } }
    if (clicked) this.selectUnits([clicked]); else if (this.selectedUnits.length > 0) this._issueMoveOrder(x, y); else this.selectUnits([]);
  }

  handleDoubleTap({ x, y }) {
    if (this._isSearchingPath || this.playerFaction === null) return;
    let clicked = null;
    for (let i = this.units.length - 1; i >= 0; i--) { const u = this.units[i]; if (!this.isPlayerControllable(u)) continue; if (Math.hypot(u.x - x, u.y - y) <= u.hitRadius) { clicked = u; break; } }
    if (!clicked || !this.camera) return;
    const roleId = clicked.roleId, faction = clicked.faction, selected = [];
    for (const u of this.units) { if (u.faction !== faction || u.roleId !== roleId || u.isDead) continue; if (this.camera.isPointVisible(u.x, u.y)) selected.push(u); }
    this.selectUnits(selected);
  }

  _issueMoveOrder(tx, ty) {
    this._isSearchingPath = true;
    try {
      const freeTarget = this.pathfinder.findNearestFreePoint(tx, ty); const count = this.selectedUnits.length; const spacing = CONFIG.FORMATION.SPACING;
      const cols = Math.max(1, Math.ceil(Math.sqrt(count))); const rows = Math.max(1, Math.ceil(count / cols));
      this.selectedUnits.forEach((unit, index) => {
        if (unit.isDead) return;
        let ox = 0, oy = 0;
        if (count > 1) { const row = Math.floor(index / cols); const col = index % cols; ox = (col - (cols - 1) / 2) * spacing; oy = (row - (rows - 1) / 2) * spacing; }
        const target = this.pathfinder.findNearestFreePoint(freeTarget.x + ox, freeTarget.y + oy);
        const path = this.pathfinder.findPath(unit.x, unit.y, target.x, target.y);
        if (path && path.length > 0) { unit.lastTarget = target; unit.setPath(path); }
      });
    } finally { this._isSearchingPath = false; }
  }

  selectUnits(units) { const set = Array.isArray(units) ? units : []; for (const u of this.units) u.isSelected = false; this.selectedUnits = set.filter(u => this.isPlayerControllable(u) || this.playerFaction === null); for (const u of this.selectedUnits) u.isSelected = true; EventBus.emit(EVENTS.UNITS_SELECTED, this.selectedUnits); }
  setSelectedStance(stance) { for (const u of this.selectedUnits) { if (u.isDead) continue; u.setStance(stance); } }
}
