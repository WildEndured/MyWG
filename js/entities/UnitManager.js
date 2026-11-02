// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js';

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnit = null;
    this.pathfinder = new Pathfinder(100, 5);
    this._isSearchingPath = false; // Защита от параллельных запросов

    EventBus.on('input:tap', this.handleTap.bind(this));
  }

  setWorldSize(size) {
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
    for (const unit of this.units) {
      unit.draw(ctx, camera);
    }
  }

  handleTap({ x, y }) {
    // ЗАЩИТА: не запускать новый поиск, пока идет предыдущий
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
      
      // Поиск пути (можно вынести в setTimeout, чтобы UI не блокировался)
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
