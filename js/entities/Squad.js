import { ROLES } from '../data/units.js';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG } from '../data/config.js';

export class Squad {
  constructor(units, faction) {
    this.units = units;
    this.faction = faction;
    this.id = Math.random().toString(36).substr(2, 6);
    this.leader = this._findLeader();
    this.blackboard = new Map();
    this.morale = 1.0;
    this.order = 'advance';
    this.focusTarget = null;
    this.updateTimer = 0;
    this.updateInterval = 0.5;
    
    this.helpRequests = []; // Запросы о помощи
    this.weaponPickups = []; // Приказы на подбор оружия
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

    const deadRatio = 1 - alive.length / this.units.length;
    this.morale = Math.max(0, 1.0 - deadRatio * 1.5);

    if (!this.leader || this.leader.isDead) {
      const oldLeader = this.leader;
      this.leader = this._findLeader();
      if (oldLeader && this.leader) {
        this.morale = Math.max(0, this.morale - 0.3);
        EventBus.emit('squad:leader_changed', { squad: this, old: oldLeader, new: this.leader });
      }
    }

    // Синхронизация памяти
    for (const unit of alive) {
      for (const [enemy, mem] of unit.perception) {
        if (mem.seen > 0.7) {
          this.blackboard.set(enemy, { x: mem.lastX, y: mem.lastY, time: world.time });
        }
      }
    }

    for (const [enemy, mem] of this.blackboard) {
      if (enemy.isDead || world.time - mem.time > 10) this.blackboard.delete(enemy);
    }

    if (this.morale < 0.3) this.order = 'retreat';
    else if (this.morale < 0.5 && this.order === 'advance') this.order = 'hold';

    if (this.leader && !this.leader.isDead) {
      this._issueOrders(world, alive);
    }
  }

  _issueOrders(world, alive) {
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

    // Фланкирование
    if (this.order === 'advance' && this.focusTarget && this.morale > 0.7) {
      const flankers = this.units.filter(u => 
        (u.roleId === 'rifleman' || u.roleId === 'senior_rifleman') && !u.isDead
      ).slice(0, 2);

      for (const fl of flankers) {
        const angle = Math.atan2(this.focusTarget.y - this.leader.y, this.focusTarget.x - this.leader.x) + Math.PI / 2;
        const dist = 20 + Math.random() * 10;
        fl.flankTarget = { 
          x: this.focusTarget.x + Math.cos(angle) * dist,
          y: this.focusTarget.y + Math.sin(angle) * dist
        };
      }
    }

    // НОВОЕ: Прикрытие (пулеметчик подавляет, пока остальные двигаются)
    if (this.order === 'advance' && this.focusTarget) {
      const mg = this.units.find(u => u.roleId === 'machine_gunner' && !u.isDead);
      if (mg && mg.brain) {
        mg.brain.suppressingTarget = this.focusTarget;
      }
    }

    // НОВОЕ: Обработка запросов о помощи
    if (this.helpRequests.length > 0) {
      const request = this.helpRequests.shift();
      // Находим ближайшего здорового союзника
      let helper = null, minDist = Infinity;
      for (const u of alive) {
        if (u.hp < u.maxHp * 0.5 || u.roleId === 'machine_gunner') continue;
        const dist = Math.hypot(u.x - request.x, u.y - request.y);
        if (dist < minDist) { minDist = dist; helper = u; }
      }
      
      if (helper && helper.brain) {
        // Приказ помочь
        const path = world.pathfinder.findPath(helper.x, helper.y, request.x, request.y);
        if (path && path.length > 0) helper.setPath(path);
      }
    }

    // НОВОЕ: Замена роли (подбор оружия)
    for (const dead of this.units) {
      if (!dead.isDead) continue;
      if (dead.weapon && dead.weapon.ammo > 0 && dead.roleId === 'machine_gunner') {
        // Найти стрелка для замены
        const candidate = alive.find(u => u.roleId === 'rifleman' && !u.isDead);
        if (candidate && candidate.brain) {
          candidate.brain.currentGoal = 'pickup';
          const path = world.pathfinder.findPath(candidate.x, candidate.y, dead.x, dead.y);
          if (path && path.length > 0) candidate.setPath(path);
        }
      }
    }
  }

  report(unit, type, data) {
    if (!this.leader || this.leader.isDead) return;
    
    if (type === 'enemy_spotted') {
      this.blackboard.set(data.enemy, { x: data.x, y: data.y, time: data.time });
    } else if (type === 'need_help') {
      this.helpRequests.push({ x: data.x, y: data.y, unit: unit, time: performance.now() });
    }
  }

  getOrderFor(unit) {
    if (this.order === 'retreat') return { type: 'retreat' };
    if (this.order === 'hold') return { type: 'hold' };
    if (this.order === 'focus_fire' && this.focusTarget) return { type: 'focus_fire', target: this.focusTarget };
    
    if (unit.flankTarget && this.order === 'advance') {
      return { type: 'flank', targetX: unit.flankTarget.x, targetY: unit.flankTarget.y };
    }

    // Приказ прикрытия для пулеметчика
    if (unit.roleId === 'machine_gunner' && this.focusTarget) {
      return { type: 'suppress', target: this.focusTarget };
    }
    
    return null;
  }
}
