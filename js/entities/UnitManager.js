// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { Pathfinder } from '../core/Pathfinder.js';

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnit = null;
    
    // Создаем Pathfinder (по умолчанию для карты 100м, клетка 5м)
    this.pathfinder = new Pathfinder(100, 5); 

    // Подписываемся на клики по карте
    EventBus.on('input:tap', this.handleTap.bind(this));
  }

  setWorldSize(size) {
    // При смене карты пересоздаем сетку A*
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
    let clickedUnit = null;
    
    // Ищем юнита, по которому попали (идем с конца, чтобы брать верхних)
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const dist = Math.hypot(u.x - x, u.y - y);
      
      // Используем hitRadius (2 метра), чтобы удобно попадать пальцем
      if (dist <= u.hitRadius) {
        clickedUnit = u;
        break;
      }
    }

    if (clickedUnit) {
      // Если попали по юниту — выделяем его
      this.selectUnit(clickedUnit);
    } else if (this.selectedUnit) {
      // Если попали по земле и есть выделенный — ищем путь и даем приказ
      const path = this.pathfinder.findPath(
        this.selectedUnit.x, this.selectedUnit.y, 
        x, y
      );
      this.selectedUnit.setPath(path);
    }
  }

  selectUnit(unit) {
    // Снимаем выделение со старого
    if (this.selectedUnit) {
      this.selectedUnit.isSelected = false;
    }
    
    // Назначаем нового
    this.selectedUnit = unit;
    
    if (this.selectedUnit) {
      this.selectedUnit.isSelected = true;
    }
    
    // Оповещаем систему (пригодится для UI)
    EventBus.emit('unit:selected', this.selectedUnit);
  }
}
