// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js';

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnits = [];
    this.pathfinder = new Pathfinder(100, 5);
    this.camera = null; // Будет установлен из main.js
    this._isSearchingPath = false;

    EventBus.on('input:tap', this.handleTap.bind(this));
    EventBus.on('input:boxSelect', this.handleBoxSelect.bind(this));
  }

  setWorldSize(size) {
    this.pathfinder.setWorldSize(size);
    this._spawnTestObstacles(size);
  }

  addUnit(unit) {
    this.units.push(unit);
  }

  update(dt) {
    for (const unit of this.units) {
      unit.update(dt);
    }
  }

  draw(ctx, camera) {
    this._drawObstacles(ctx, camera);
    for (const unit of this.units) {
      unit.draw(ctx, camera);
    }
  }

  _spawnTestObstacles(mapSize) {
    this.pathfinder.clearObstacles();
    const c = mapSize / 2;
    const wallW = 5;
    const wallH = mapSize * 0.4;
    const wallX = c - wallW / 2;
    const wallY = c - wallH / 2;
    
    this.pathfinder.addObstacle(wallX, wallY, wallW, wallH * 0.4);
    this.pathfinder.addObstacle(wallX, wallY + wallH * 0.6, wallW, wallH * 0.4);
    
    const hWallW = mapSize * 0.3;
    const hWallH = 5;
    this.pathfinder.addObstacle(c + 20, c - 20, hWallW, hWallH);
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

    // 1. Проверяем, не тапнули ли по юниту игрока
    let clickedUnit = null;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.faction !== 'player') continue;
      
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
      this.selectUnits([]); // Снять выделение, если кликнули по пустоте
    }
  }

  handleBoxSelect({ startX, startY, endX, endY }) {
    if (!this.camera) return;

    // Переводим экранные координаты в мировые
    const w1 = this.camera.screenToWorld(
      Math.min(startX, endX), 
      Math.min(startY, endY)
    );
    const w2 = this.camera.screenToWorld(
      Math.max(startX, endX), 
      Math.max(startY, endY)
    );

    const selected = [];
    for (const u of this.units) {
      if (u.faction === 'player' && u.isInsideRect(w1.x, w1.y, w2.x, w2.y)) {
        selected.push(u);
      }
    }
    this.selectUnits(selected);
  }

  _issueMoveOrder(tx, ty) {
    this._isSearchingPath = true;
    
    const count = this.selectedUnits.length;
    const spacing = 2.5;

    this.selectedUnits.forEach((unit, index) => {
      let offsetX = 0;
      let offsetY = 0;

      if (count > 1) {
        const cols = Math.ceil(Math.sqrt(count));
        const row = Math.floor(index / cols);
        const col = index % cols;
        offsetX = (col - (cols - 1) / 2) * spacing;
        offsetY = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;
      }

      const finalX = tx + offsetX;
      const finalY = ty + offsetY;

      const path = this.pathfinder.findPath(unit.x, unit.y, finalX, finalY);
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
}
