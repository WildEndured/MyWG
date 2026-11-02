// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js';

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnit = null;
    this.pathfinder = new Pathfinder(100, 5);
    this._isSearchingPath = false;

    // Подписываемся на клики
    EventBus.on('input:tap', this.handleTap.bind(this));
  }

  setWorldSize(size) {
    this.pathfinder.setWorldSize(size);
    this._spawnTestObstacles(size);
  }

  // Создаем тестовые стены для проверки A*
  _spawnTestObstacles(mapSize) {
    this.pathfinder.clearObstacles();
    const c = mapSize / 2;
    
    // Вертикальная стена по центру с проходом
    const wallW = 5; // Ширина стены в метрах
    const wallH = mapSize * 0.4;
    const wallX = c - wallW / 2;
    const wallY = c - wallH / 2;
    
    // Верхняя часть стены
    this.pathfinder.addObstacle(wallX, wallY, wallW, wallH * 0.4);
    // Нижняя часть стены (оставляем проход посередине)
    this.pathfinder.addObstacle(wallX, wallY + wallH * 0.6, wallW, wallH * 0.4);
    
    // Еще одна стена для интереса
    const hWallW = mapSize * 0.3;
    const hWallH = 5;
    this.pathfinder.addObstacle(c + 20, c - 20, hWallW, hWallH);
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
    // Сначала рисуем стены (под юнитами)
    this._drawObstacles(ctx, camera);
    
    // Потом юнитов
    for (const unit of this.units) {
      unit.draw(ctx, camera);
    }
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
      const dist = Math.hypot(u.x - x, u.y - y);
      if (dist <= u.hitRadius) {
        clickedUnit = u;
        break;
      }
    }

    if (clickedUnit) {
      this.selectUnit(clickedUnit);
      return;
    }

    if (this.selectedUnit) {
      this._isSearchingPath = true;
      const path = this.pathfinder.findPath(
        this.selectedUnit.x, this.selectedUnit.y, 
        x, y
      );
      this.selectedUnit.setPath(path);
      this._isSearchingPath = false;
    }
  }

  selectUnit(unit) {
    if (this.selectedUnit) {
      this.selectedUnit.isSelected = false;
    }
    this.selectedUnit = unit;
    if (this.selectedUnit) {
      this.selectedUnit.isSelected = true;
    }
    EventBus.emit('unit:selected', this.selectedUnit);
  }
}
