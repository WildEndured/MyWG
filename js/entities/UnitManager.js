// js/entities/UnitManager.js
import { EventBus } from '../core/EventBus.js';
import { Unit } from './Unit.js';

export class UnitManager {
  constructor() {
    this.units = [];
    this.selectedUnit = null;

    // Подписываемся на клики по карте
    EventBus.on('input:tap', this.handleTap.bind(this));
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
    // Сначала рисуем всех, потом (если нужно) поверх — выделение
    for (const unit of this.units) {
      unit.draw(ctx, camera);
    }
  }

  handleTap({ x, y }) {
    // 1. Проверяем, попали ли мы по какому-то юниту
    // Идем с конца, чтобы выбирать тех, кто нарисован сверху
    let clickedUnit = null;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const dist = Math.hypot(u.x - x, u.y - y);
      // Если клик в пределах радиуса юнита (чуть увеличенного)
      if (dist <= u.radius + 1.0) {
        clickedUnit = u;
        break;
      }
    }

    if (clickedUnit) {
      // Если кликнули по юниту — выделяем его
      this.selectUnit(clickedUnit);
    } else if (this.selectedUnit) {
      // Если кликнули по пустой земле и есть выделенный юнит — приказ идти
      this.selectedUnit.setTarget(x, y);
      
      // (Опционально) можно снять выделение после приказа
      // this.selectUnit(null); 
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
    
    // Оповещаем мир о смене выделения (пригодится для UI)
    EventBus.emit('unit:selected', this.selectedUnit);
  }
}
