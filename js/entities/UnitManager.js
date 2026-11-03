import { EventBus, EVENTS } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js';
import { Physics } from '../core/Physics.js';
import { CONFIG } from '../data/config.js';

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnits = [];
    this.bullets = [];
    this.pathfinder = new Pathfinder(100, 1);
    this.camera = null;
    this._isSearchingPath = false;
    this.tracers = [];
    this.flashes = [];
    this.decals = [];
    this.currentTime = 0;

    this.playerFaction = 'player';
    this.playerTeamId = 'team1';
    this.gameMode = 'attack';

    this._unsubs = [
      EventBus.on(EVENTS.INPUT_TAP, this.handleTap.bind(this)),
      EventBus.on(EVENTS.INPUT_DOUBLE_TAP, this.handleDoubleTap.bind(this)),
      EventBus.on(EVENTS.UNIT_SHOOT, (data) => {
        this.tracers.push({ x1: data.x1, y1: data.y1, x2: data.x2, y2: data.y2, life: 0.05 });
        if (data.isMuzzleFlash) this.flashes.push({ x: data.x1, y: data.y1, life: 0.05 });
      }),
      EventBus.on(EVENTS.BULLET_IMPACT, (data) => {
        if (data.type === 'blood') {
          this.decals.push({
            x: data.x, y: data.y,
            r: 0.3 + Math.min(0.6, (data.amount || 10) / 100),
            alpha: 0.7, ttl: 12.0, age: 0,
          });
        }
      }),
    ];
  }

  destroy() {
    for (const unsub of this._unsubs) unsub();
    this._unsubs = [];
    this.units = [];
    this.selectedUnits = [];
    this.bullets = [];
    this.tracers = [];
    this.flashes = [];
    this.decals = [];
  }

  setWorldSize(size) { this.pathfinder.setWorldSize(size); }

  addUnit(unit) {
    unit.pathfinder = this.pathfinder;
    this.units.push(unit);
  }

  removeUnit(unit) {
    const i = this.units.indexOf(unit);
    if (i >= 0) this.units.splice(i, 1);
    const j = this.selectedUnits.indexOf(unit);
    if (j >= 0) this.selectedUnits.splice(j, 1);
  }

  getSafeSpawnPoint(desiredX, desiredY) {
    const obs = this.pathfinder.obstacles;
    if (Physics.isPositionFree(desiredX, desiredY, 1.0, obs)) return { x: desiredX, y: desiredY };
    return this.pathfinder.findNearestFreePoint(desiredX, desiredY);
  }

  isPlayerControllable(unit) {
    if (!unit || unit.isDead) return false;
    if (this.playerFaction === null) return false;
    return unit.faction === this.playerFaction;
  }

  update(dt) {
    this.currentTime += dt;

    for (const unit of this.units) {
      const bullets = unit.update(dt, this.units, this.currentTime);
      if (bullets) {
        if (Array.isArray(bullets)) this.bullets.push(...bullets);
        else this.bullets.push(bullets);
      }

      // FIX: репас — с fallback на текущую цель
      if (unit.needsRepath && !unit.isDead) {
        unit.needsRepath = false;
        const target = unit.lastTarget
          || (unit.target ? { x: unit.target.x, y: unit.target.y } : null);
        if (target) {
          const newPath = this.pathfinder.findPath(unit.x, unit.y, target.x, target.y);
          if (newPath && newPath.length > 0) {
            unit.setPath(newPath);
          } else {
            unit._wantsToMove = false;
            unit.isMoving = false;
          }
        } else {
          unit._wantsToMove = false;
          unit.isMoving = false;
        }
      }
    }

    this._resolveCollisions();

    for (let i = this.units.length - 1; i >= 0; i--) {
      if (this.units[i].isDead) this.removeUnit(this.units[i]);
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, this.units, this.pathfinder.obstacles);
      if (b.isDead) this.bullets.splice(i, 1);
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.age += dt;
      if (d.age >= d.ttl) this.decals.splice(i, 1);
    }
  }

  _resolveCollisions() {
    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        const u1 = this.units[i], u2 = this.units[j];
        if (u1.isDead || u2.isDead) continue;
        const obs = this.pathfinder ? this.pathfinder.obstacles : null;
        Physics.resolveUnitCollision(u1, u2, obs);
      }
    }
  }

  draw(ctx, camera) {
    this._drawDecals(ctx, camera);
    this._drawObstacles(ctx, camera);

    const sorted = [...this.units].sort((a, b) => a.y - b.y);
    for (const u of sorted) u.draw(ctx, camera);
    for (const b of this.bullets) b.draw(ctx, camera);

    ctx.lineWidth = 1.5;
    for (const t of this.tracers) {
      const p1 = camera.worldToScreen(t.x1, t.y1);
      const p2 = camera.worldToScreen(t.x2, t.y2);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(255, 255, 0, ${Math.max(0, t.life * 20)})`;
      ctx.stroke();
    }
    for (const f of this.flashes) {
      const p = camera.worldToScreen(f.x, f.y);
      const radius = (1.0 - f.life / 0.05) * 20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 0, ${Math.max(0, f.life / 0.05)})`;
      ctx.fill();
    }
  }

  _drawDecals(ctx, camera) {
    for (const d of this.decals) {
      const p = camera.worldToScreen(d.x, d.y);
      const r = d.r * camera.zoom;
      const fade = Math.min(1, Math.max(0, (d.ttl - d.age) / 3));
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120, 10, 10, ${d.alpha * fade})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x + r * 0.4, p.y + r * 0.2, Math.max(0.5, r * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(90, 5, 5, ${d.alpha * 0.6 * fade})`;
      ctx.fill();
    }
  }

  _spawnTestObstacles(mapSize, enabled = true) {
    this.pathfinder.clearObstacles();
    if (!enabled) return;
    const c = mapSize / 2;
    this.pathfinder.addObstacle(c - 10, c - 20, 1, 40, 'wood');
    this.pathfinder.addObstacle(c + 10, c - 20, 1, 40, 'concrete');
    this.pathfinder.addObstacle(c - 15, c - 5, 10, 2, 'sandbags');
  }

  _drawObstacles(ctx, camera) {
    ctx.lineWidth = 1;
    for (const obs of this.pathfinder.obstacles) {
      const tl = camera.worldToScreen(obs.x, obs.y);
      const br = camera.worldToScreen(obs.x + obs.w, obs.y + obs.h);
      const colorMap = { wood: '#8B5A2B', sandbags: '#C2B280', concrete: '#777', steel: '#889', brick: '#a55' };
      ctx.fillStyle = colorMap[obs.materialId] || '#555';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }
  }

  handleTap({ x, y }) {
    if (this._isSearchingPath) return;
    if (this.playerFaction === null) return;

    let clicked = null;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!this.isPlayerControllable(u)) continue;
      if (Math.hypot(u.x - x, u.y - y) <= u.hitRadius) { clicked = u; break; }
    }
    if (clicked) this.selectUnits([clicked]);
    else if (this.selectedUnits.length > 0) this._issueMoveOrder(x, y);
    else this.selectUnits([]);
  }

  handleDoubleTap({ x, y }) {
    if (this._isSearchingPath) return;
    if (this.playerFaction === null) return;

    let clicked = null;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!this.isPlayerControllable(u)) continue;
      if (Math.hypot(u.x - x, u.y - y) <= u.hitRadius) { clicked = u; break; }
    }
    if (!clicked) return;
    if (!this.camera) return;

    const roleId = clicked.roleId;
    const faction = clicked.faction;
    const selected = [];
    for (const u of this.units) {
      if (u.faction !== faction || u.roleId !== roleId || u.isDead) continue;
      if (this.camera.isPointVisible(u.x, u.y)) selected.push(u);
    }
    this.selectUnits(selected);
  }

  _issueMoveOrder(tx, ty) {
    this._isSearchingPath = true;
    try {
      const freeTarget = this.pathfinder.findNearestFreePoint(tx, ty);
      const count = this.selectedUnits.length;
      const spacing = CONFIG.FORMATION.SPACING;
      const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
      const rows = Math.max(1, Math.ceil(count / cols));
      this.selectedUnits.forEach((unit, index) => {
        if (unit.isDead) return;
        let ox = 0, oy = 0;
        if (count > 1) {
          const row = Math.floor(index / cols);
          const col = index % cols;
          ox = (col - (cols - 1) / 2) * spacing;
          oy = (row - (rows - 1) / 2) * spacing;
        }
        const target = this.pathfinder.findNearestFreePoint(freeTarget.x + ox, freeTarget.y + oy);
        unit.lastTarget = target;
        const path = this.pathfinder.findPath(unit.x, unit.y, target.x, target.y);
        unit.setPath(path);
      });
    } finally {
      this._isSearchingPath = false;
    }
  }

  selectUnits(units) {
    const set = Array.isArray(units) ? units : [];
    for (const u of this.units) u.isSelected = false;
    this.selectedUnits = set.filter(u => this.isPlayerControllable(u) || this.playerFaction === null);
    for (const u of this.selectedUnits) u.isSelected = true;
    EventBus.emit(EVENTS.UNITS_SELECTED, this.selectedUnits);
  }

  setSelectedStance(stance) {
    for (const u of this.selectedUnits) {
      if (u.isDead) continue;
      u.setStance(stance);
    }
  }
}
