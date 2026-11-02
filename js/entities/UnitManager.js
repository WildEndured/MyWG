// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js'; // ИМПОРТ

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnit = null;
    
    // Создаем Pathfinder (изначально для 100м карты)
    this.pathfinder = new Pathfinder(100, 5); 

    EventBus.on('input:tap', this.handleTap.bind(this));
  }

  setWorldSize(size) {
    // При смене карты пересоздаем сетку
    this.pathfinder.setWorldSize(size);
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
    // ... (отрисовка как раньше)
    for (const unit of this.units) {
      unit.draw(ctx, camera);
    }
  }

  handleTap({ x, y }) {
    let clickedUnit = null;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const dist = Math.hypot(u.x - x, u.y - y);
      if (dist <= u.radius + 1.0) {
        clickedUnit = u;
        break;
      }
    }

    if (clickedUnit) {
      this.selectUnit(clickedUnit);
    } else if (this.selectedUnit) {
      // ИЩЕМ ПУТЬ вместо прямой линии
      const path = this.pathfinder.findPath(
        this.selectedUnit.x, this.selectedUnit.y, 
        x, y
      );
      this.selectedUnit.setPath(path);
    }
  }

  selectUnit(unit) {
    // ... (без изменений)
    if (this.selectedUnit) this.selectedUnit.isSelected = false;
    this.selectedUnit = unit;
    if (this.selectedUnit) this.selectedUnit.isSelected = true;
    EventBus.emit('unit:selected', this.selectedUnit);
  }
}
