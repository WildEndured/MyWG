// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
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
    this.currentTime = 0;

    EventBus.on('input:tap', this.handleTap.bind(this));
    EventBus.on('input:doubleTap', this.handleDoubleTap.bind(this));
    
    EventBus.on('unit:shoot', ({ x1, y1, x2, y2 }) => {
      this.tracers.push({ x1, y1, x2, y2, life: 0.05 });
    });
  }

  setWorldSize(size) {
    this.pathfinder.setWorldSize(size);
    this._spawnTestObstacles(size);
  }

  addUnit(unit) {
    unit.pathfinder = this.pathfinder; 
    this.units.push(unit);
  }

  update(dt) {
    this.currentTime += dt;

    for (const unit of this.units) {
      const bullet = unit.update(dt, this.units, this.currentTime); 
      if (bullet) {
        this.bullets.push(bullet);
      }
      
      if (unit.needsRepath && !unit.isDead) {
        unit.needsRepath = false;
        if (unit.lastTarget) {
          const newPath = this.pathfinder.findPath(unit.x, unit.y, unit.lastTarget.x, unit.lastTarget.y);
          unit.setPath(newPath);
        }
      }
    }
    
    this._resolveCollisions();

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, this.units, this.pathfinder.obstacles);
      if (b.isDead) {
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
  }

  _resolveCollisions() {
    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        const u1 = this.units[i];
        const u2 = this.units[j];
        
        if (u1.isDead || u2.isDead) continue;
        if (u1.stance === 'prone' || u2.stance === 'prone') continue;
        
        const obs = this.pathfinder ? this.pathfinder.obstacles : null;
        Physics.resolveUnitCollision(u1, u2, obs);
      }
    }
  }

  draw(ctx, camera) {
    this._drawObstacles(ctx, camera);
    
    const sortedUnits = [...this.units].sort((a, b) => a.y - b.y);
    for (const unit of sortedUnits) {
      unit.draw(ctx, camera);
    }

    for (const b of this.bullets) {
      b.draw(ctx, camera);
    }

    ctx.lineWidth = 1.5;
    for (const t of this.tracers) {
      const p1 = camera.worldToScreen(t.x1, t.y1);
      const p2 = camera.worldToScreen(t.x2, t.y2);
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(255, 255, 0, ${t.life * 20})`;
      ctx.stroke();
    }
  }

  _spawnTestObstacles(mapSize) {
    this.pathfinder.clearObstacles();
    const c = mapSize / 2;
    
    const wallW = 0.5; 
    const wallH = mapSize * 0.4;
    const wallX = c - wallW / 2;
    const wallY = c - wallH / 2;
    
    this.pathfinder.addObstacle(wallX, wallY, wallW, wallH * 0.3);
    this.pathfinder.addObstacle(wallX, wallY + wallH * 0.7, wallW, wallH * 0.3);
  }

  _drawObstacles(ctx, camera) {
    ctx.fillStyle = '#555';
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;

    for (const obs of this.pathfinder.obstacles) {
      const tl = camera.worldToScreen(obs.x, obs.y);
      const br = camera.worldToScreen(obs.x + obs.w, obs.y + obs.h);
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }
  }

  handleTap({ x, y }) {
    if (this._isSearchingPath) return;

    let clickedUnit = null;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.faction !== 'player' || u.isDead) continue;
      
      const dist = Math.hypot(u.x - x, u.y - y);
      if (dist <= u.hitRadius) {
        clickedUnit = u;
        break;
      }
    }

    if (clickedUnit) {
      this.selectUnits([clickedUnit]);
    } else if (this.selectedUnits.length > 0) {
      this._issueMoveOrder(x, y);
    } else {
      this.selectUnits([]); 
    }
  }

  handleDoubleTap({ x, y }) {
    if (this._isSearchingPath) return;

    let clickedUnit = null;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.faction !== 'player' || u.isDead) continue;
      
      const dist = Math.hypot(u.x - x, u.y - y);
      if (dist <= u.hitRadius) {
        clickedUnit = u;
        break;
      }
    }

    if (!clickedUnit) return; 

    const selected = [];
    const type = clickedUnit.type; 
    const faction = clickedUnit.faction;

    for (const u of this.units) {
      if (u.faction !== faction || u.type !== type || u.isDead) continue;
      if (this.camera.isPointVisible(u.x, u.y)) {
        selected.push(u);
      }
    }

    this.selectUnits(selected);
  }

  _issueMoveOrder(tx, ty) {
    this._isSearchingPath = true;
    
    const freeTarget = this.pathfinder.findNearestFreePoint(tx, ty);
    
    const count = this.selectedUnits.length;
    const spacing = CONFIG.FORMATION.SPACING;

    this.selectedUnits.forEach((unit, index) => {
      if (unit.isDead) return;

      let offsetX = 0;
      let offsetY = 0;

      if (count > 1) {
        const cols = Math.ceil(Math.sqrt(count));
        const row = Math.floor(index / cols);
        const col = index % cols;
        offsetX = (col - (cols - 1) / 2) * spacing;
        offsetY = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;
      }

      const individualTarget = this.pathfinder.findNearestFreePoint(
        freeTarget.x + offsetX, 
        freeTarget.y + offsetY
      );

      unit.lastTarget = individualTarget;
      
      const path = this.pathfinder.findPath(unit.x, unit.y, individualTarget.x, individualTarget.y);
      unit.setPath(path);
    });

    this._isSearchingPath = false;
  }

  selectUnits(units) {
    for (const u of this.units) {
      u.isSelected = false;
    }
    this.selectedUnits = units;
    for (const u of this.selectedUnits) {
      u.isSelected = true;
    }
    EventBus.emit('units:selected', this.selectedUnits);
  }

  setSelectedStance(stance) {
    for (const unit of this.selectedUnits) {
      if (unit.isDead) continue;
      if (stance === 'run' && unit.stamina < 10) {
        unit.setStance('stand');
      } else {
        unit.setStance(stance);
      }
    }
  }
}
