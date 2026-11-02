// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js';

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnits = [];
    this.pathfinder = new Pathfinder(100, 5);
    this.camera = null; 
    this._isSearchingPath = false;

    EventBus.on('input:tap', this.handleTap.bind(this));
    EventBus.on('input:doubleTap', this.handleDoubleTap.bind(this));
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
    for (const unit of this.units) {
      unit.update(dt, this.units); 
    }
    this._resolveCollisions();
  }

  _resolveCollisions() {
    const minDist = 1.0; 
    
    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        const u1 = this.units[i];
        const u2 = this.units[j];
        
        const dx = u2.x - u1.x;
        const dy = u2.y - u1.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < minDist && dist > 0.01) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          
          const newU1X = u1.x - nx * overlap;
          const newU1Y = u1.y - ny * overlap;
          const newU2X = u2.x + nx * overlap;
          const newU2Y = u2.y + ny * overlap;

          // Используем физическую проверку
          if (u1._isPositionFree(newU1X, newU1Y)) {
            u1.x = newU1X;
            u1.y = newU1Y;
          }
          if (u2._isPositionFree(newU2X, newU2Y)) {
            u2.x = newU2X;
            u2.y = newU2Y;
          }
        }
      }
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
    
    // ВАЖНО: Стены сделаны тоньше (2 метра), чтобы наглядно видеть,
    // что юниты (радиус 0.5) могут проходить в проходы шириной 5 метров.
    // В сетке A* стены все равно занимают клетки 5х5, но физически они тонкие.
    
    const wallW = 2; // Тонкая стена (2 метра)
    const wallH = mapSize * 0.4;
    const wallX = c - wallW / 2;
    const wallY = c - wallH / 2;
    
    // Верхняя часть
    this.pathfinder.addObstacle(wallX, wallY, wallW, wallH * 0.4);
    // Нижняя часть (оставляем проход 5 метров посередине)
    this.pathfinder.addObstacle(wallX, wallY + wallH * 0.6, wallW, wallH * 0.4);
    
    // Горизонтальная стена
    const hWallW = mapSize * 0.3;
    const hWallH = 2; 
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
      this.selectUnits([]); 
    }
  }

  handleDoubleTap({ x, y }) {
    if (this._isSearchingPath) return;

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

    if (!clickedUnit) return; 

    const selected = [];
    const type = clickedUnit.type; 
    const faction = clickedUnit.faction;

    for (const u of this.units) {
      if (u.faction !== faction || u.type !== type) continue;
      if (this.camera.isPointVisible(u.x, u.y)) {
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
