import { ROLES } from '../data/units.js';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG } from '../data/config.js';

export class Squad {
  constructor(units, faction) {
    this.units = units;
    this.faction = faction;
    this.id = Math.random().toString(36).substr(2, 6);
    
    // Лидер — командир отделения (наивысший rank)
    this.leader = this._findLeader();
    
    // Общая память отряда (что видели все)
    this.blackboard = new Map(); // Map<enemyUnit, { x, y, time }>
    
    // Мораль (0..1). Падает от потерь и смерти лидера.
    this.morale = 1.0;
    
    // Приказы отряда
    this.order = 'advance'; // 'advance', 'hold', 'retreat', 'flank', 'focus_fire'
    this.focusTarget = null; // Цель для фокуса огня
    
    // Формация
    this.formation = 'line'; // 'line', 'column', 'wedge'
    
    // Таймер обновления
    this.updateTimer = 0;
    this.updateInterval = 0.5; // Раз в 0.5 сек
  }

  _findLeader() {
    let best = null, bestRank = 0;
    for (const u of this.units) {
      if (u.isDead) continue;
      if (u.rank > bestRank) { bestRank = u.rank; best = u; }
    }
    return best;
  }

  update(dt, world) {
    this.updateTimer -= dt;
    if (this.updateTimer > 0) return;
    this.updateTimer = this.updateInterval;

    const alive = this.units.filter(u => !u.isDead);
    if (alive.length === 0) return;

    // 1. Обновить мораль (падает от потерь)
    const deadRatio = 1 - alive.length / this.units.length;
    this.morale = Math.max(0, 1.0 - deadRatio * 1.5);

    // 2. Проверить лидера
    if (!this.leader || this.leader.isDead) {
      const oldLeader = this.leader;
      this.leader = this._findLeader();
      if (oldLeader && this.leader) {
        this.morale = Math.max(0, this.morale - 0.3);
        EventBus.emit('squad:leader_changed', { squad: this, old: oldLeader, new: this.leader });
      }
    }

    // 3. Синхронизировать память (все делятся с отрядом)
    for (const unit of alive) {
      for (const [enemy, mem] of unit.perception) {
        if (mem.seen > 0.7) {
          this.blackboard.set(enemy, { x: mem.lastX, y: mem.lastY, time: world.time });
        }
      }
    }

    // 4. Очистить старые записи (старше 10 сек)
    for (const [enemy, mem] of this.blackboard) {
      if (enemy.isDead || world.time - mem.time > 10) this.blackboard.delete(enemy);
    }

    // 5. Мораль влияет на приказы
    if (this.morale < 0.3) this.order = 'retreat';
    else if (this.morale < 0.5 && this.order === 'advance') this.order = 'hold';

    // 6. Раздать приказы (если лидер жив)
    if (this.leader && !this.leader.isDead) {
      this._issueOrders(world);
    }
  }

  _issueOrders(world) {
    // Командир анализирует blackboard и выбирает приоритетную цель
    let highestThreat = null, highestScore = 0;
    
    for (const [enemy, mem] of this.blackboard) {
      if (enemy.isDead) continue;
      const dist = Math.hypot(enemy.x - this.leader.x, enemy.y - this.leader.y);
      if (dist > 200) continue;
      
      let score = 100 - dist;
      if (enemy.roleId === 'machine_gunner') score += 50;
      if (enemy.roleId === 'grenadier') score += 40;
      if (enemy.isVehicle) score += 100;
      
      if (score > highestScore) { highestScore = score; highestThreat = enemy; }
    }
    
    this.focusTarget = highestThreat;
  }

  // Получить приказ для конкретного юнита
  getOrderFor(unit) {
    if (this.order === 'retreat') return { type: 'retreat' };
    if (this.order === 'hold') return { type: 'hold' };
    if (this.order === 'focus_fire' && this.focusTarget) return { type: 'focus_fire', target: this.focusTarget };
    return null;
  }
}
