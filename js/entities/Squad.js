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
    this.formation = 'line';
    this.updateTimer = 0;
    this.updateInterval = 0.5;
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
      this._issueOrders(world);
    }
  }

  _issueOrders(world) {
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
  }

  report(unit, type, data) {
    if (!this.leader || this.leader.isDead) return;
    
    if (type === 'enemy_spotted') {
      this.blackboard.set(data.enemy, { x: data.x, y: data.y, time: data.time });
    }
  }

  getOrderFor(unit) {
    if (this.order === 'retreat') return { type: 'retreat' };
    if (this.order === 'hold') return { type: 'hold' };
    if (this.order === 'focus_fire' && this.focusTarget) return { type: 'focus_fire', target: this.focusTarget };
    
    if (unit.flankTarget && this.order === 'advance') {
      return { type: 'flank', targetX: unit.flankTarget.x, targetY: unit.flankTarget.y };
    }
    
    return null;
  }
}
