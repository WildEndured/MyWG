import { CONFIG } from '../data/config.js';
import { ROLES } from '../data/units.js';

export class Brain {
  constructor(unit) {
    this.unit = unit;
    this.isAutonomous = true;
    this.playerOverrideTimer = 0;
    this.decisionTimer = Math.random() * 0.5;
    this.currentGoal = 'idle';
    this.memory = { lastEnemyPos: null, lastEnemyTime: 0, dangerZones: [] };
  }

  setPlayerOrder(path, target) {
    this.playerOverrideTimer = 10.0;
    this.unit.setPath(path); this.unit.lastTarget = target; this.currentGoal = 'move';
  }

  registerDamage(fromX, fromY) {
    this.memory.dangerZones.push({ x: fromX, y: fromY, time: performance.now() / 1000 });
    if (this.memory.dangerZones.length > 5) this.memory.dangerZones.shift();
  }

  update(dt, world) {
    if (this.unit.isDead) return;
    if (this.playerOverrideTimer > 0) { this.playerOverrideTimer -= dt; return; }
    if (!this.isAutonomous) return;
    
    this.decisionTimer -= dt;
    if (this.decisionTimer > 0) return;
    this.decisionTimer = 0.4 + Math.random() * 0.3;
    
    if (Math.random() < CONFIG.AI.MISTAKE_CHANCE) {
      this._doMistake(world);
      return;
    }

    this._think(world);
  }

  _doMistake(world) {
    this.currentGoal = 'mistake';
    if (Math.random() > 0.5) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 15;
      const tx = Math.max(5, Math.min(world.mapSize - 5, this.unit.x + Math.cos(angle) * dist));
      const ty = Math.max(5, Math.min(world.mapSize - 5, this.unit.y + Math.sin(angle) * dist));
      const path = world.pathfinder.findPath(this.unit.x, this.unit.y, tx, ty);
      if (path && path.length > 0) this.unit.setPath(path);
    } else {
      this.unit.setStance('prone');
    }
  }

  _think(world) {
    const unit = this.unit;

    // Проверка на сдачу в плен
    if (unit.hp < unit.maxHp * CONFIG.AI.SURRENDER_HP_THRESHOLD && unit.suppression > CONFIG.AI.SURRENDER_SUPPRESSION && !unit.isSurrendered) {
      unit.isSurrendered = true;
      unit.isArmed = false;
      unit.setStance('prone');
      unit.setPath([]);
      return;
    }
    if (unit.isSurrendered) return;

    // Переключение оружия (если нет патронов)
    if (unit.weapon.ammo === 0 && unit.weapon.reserveMagazines === 0 && unit.secondaryWeaponConfig && unit.activeWeaponId === 'rpg7') {
      unit.switchWeapon();
    }

    // Нет патронов вообще
    if (unit.weapon.ammo === 0 && unit.weapon.reserveMagazines === 0) {
      if (this.currentGoal !== 'no_ammo') {
        this.currentGoal = 'no_ammo';
        this._seekCover(world);
      }
      return;
    }

    // Лечение
    if (unit.bleedingRate > 0 && (unit.medical.bandage > 0 || unit.medical.tourniquet > 0)) {
      if (this.currentGoal !== 'heal') {
        this.currentGoal = 'heal';
        unit._wantsToMove = false; unit.setPath([]);
        if (unit.medical.bandage > 0) unit.applyBandage('torso', true);
        else if (unit.medical.tourniquet > 0) unit.applyTourniquet('leftLeg', true);
      }
      return;
    }

    // Отступление при низком HP
    if (unit.hp < unit.maxHp * 0.3 && unit.target && this.currentGoal !== 'retreat') {
      const distToEnemy = Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y);
      if (distToEnemy > 5) {
        this.currentGoal = 'retreat';
        this._seekCover(world);
        return;
      }
    }

    // Укрытие при подавлении
    if (unit.suppression > 0.4) {
      if (this.currentGoal !== 'cover') {
        this.currentGoal = 'cover';
        this._seekCover(world);
        unit.setStance('prone');
      }
      return;
    }

    // Бой
    if (unit.target) {
      if (this.currentGoal !== 'engage') {
        this.currentGoal = 'engage';
        unit._wantsToMove = false; unit.setPath([]); unit.setStance('stand');
      }
      // Микротактика: приседание на перезарядке
      if (unit.weapon.ammo < unit.weapon.magazineCapacity * 0.5 && unit.weapon.isReloading) unit.setStance('crouch');
      return;
    }

    // РОЛЕВОЕ ПОВЕДЕНИЕ (когда нет цели)
    
    // Пулеметчик держит позицию
    if (unit.roleId === 'machine_gunner') {
      if (this.currentGoal !== 'hold') {
        this.currentGoal = 'hold';
        unit._wantsToMove = false; unit.setPath([]); unit.setStance('prone');
      }
      return;
    }

    // Гранатометчик ищет технику
    if (unit.roleId === 'grenadier') {
      if (this._tryGrenadierBehavior(world)) return;
    }

    // Помощник следует за гранатометчиком
    if (unit.roleId === 'grenadier_help') {
      if (this._tryFollowGrenadier(world)) return;
    }

    // Шум
    if (unit.lastHeardNoise) {
      const timeSinceNoise = (performance.now() / 1000) - unit.lastHeardNoise.time / 1000;
      if (timeSinceNoise < 5 && this.currentGoal !== 'investigate') {
        this.currentGoal = 'investigate';
        const path = world.pathfinder.findPath(unit.x, unit.y, unit.lastHeardNoise.x, unit.lastHeardNoise.y);
        if (path && path.length > 0) unit.setPath(path); unit.setStance('crouch'); unit.lastHeardNoise = null; return;
      }
    }

    // Зона контроля
    if (world.zone && world.zone.owner !== unit.faction) {
      const distToZone = Math.hypot(world.zone.x - unit.x, world.zone.y - unit.y);
      if (distToZone < 80 && distToZone > world.zone.radius - 2) {
        if (this.currentGoal !== 'capture_zone') { this.currentGoal = 'capture_zone'; const path = world.pathfinder.findPath(unit.x, unit.y, world.zone.x, world.zone.y); if (path && path.length > 0) unit.setPath(path); unit.setStance('crouch'); }
        return;
      }
    }

    // Охота
    if (this.memory.lastEnemyPos && (world.time - this.memory.lastEnemyTime) < 8.0) {
      if (this.currentGoal !== 'hunt') { this.currentGoal = 'hunt'; const path = world.pathfinder.findPath(unit.x, unit.y, this.memory.lastEnemyPos.x, this.memory.lastEnemyPos.y); if (path && path.length > 0) unit.setPath(path); unit.setStance('stand'); }
      return;
    }

    // Патруль
    if (this.currentGoal !== 'patrol' || (!unit.isMoving && !unit._wantsToMove)) {
      this.currentGoal = 'patrol';
      const angle = Math.random() * Math.PI * 2; const dist = 10 + Math.random() * 20;
      let tx = Math.max(5, Math.min(world.mapSize - 5, unit.x + Math.cos(angle) * dist));
      let ty = Math.max(5, Math.min(world.mapSize - 5, unit.y + Math.sin(angle) * dist));
      for (const zone of this.memory.dangerZones) { if (Math.hypot(tx - zone.x, ty - zone.y) < 15) { tx = unit.x; ty = unit.y; break; } }
      const path = world.pathfinder.findPath(unit.x, unit.y, tx, ty);
      if (path && path.length > 0) { unit.setPath(path); unit.setStance('crouch'); }
    }
  }

  _seekCover(world) {
    const unit = this.unit;
    const threatX = unit.target ? unit.target.x : unit.x + Math.cos(unit.angle) * 30;
    const threatY = unit.target ? unit.target.y : unit.y + Math.sin(unit.angle) * 30;
    
    const enemyVisible = unit.perception.has(unit.target) && unit.perception.get(unit.target).seen > 0.5;
    const effThreatX = enemyVisible ? threatX : unit.x + Math.cos(unit.angle) * 20;
    const effThreatY = enemyVisible ? threatY : unit.y + Math.sin(unit.angle) * 20;

    let bestCover = null, bestScore = -Infinity;

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      for (let dist = 5; dist <= 15; dist += 5) {
        const cx = unit.x + Math.cos(angle) * dist;
        const cy = unit.y + Math.sin(angle) * dist;
        if (cx < 2 || cx > world.mapSize - 2 || cy < 2 || cy > world.mapSize - 2) continue;
        if (!world.pathfinder || !world.pathfinder.grid) continue;
        const g = world.pathfinder.worldToGrid(cx, cy);
        if (world.pathfinder.grid[g.y * world.pathfinder.cols + g.x] === 1) continue;
        
        const enemySeesUs = world.pathfinder.hasLineOfSight(effThreatX, effThreatY, cx, cy);
        const weSeeEnemy = world.pathfinder.hasLineOfSight(cx, cy, effThreatX, effThreatY);
        
        let score = 0;
        if (!enemySeesUs) score += 100;
        if (weSeeEnemy) score += 50;
        score -= dist;
        for (const zone of this.memory.dangerZones) if (Math.hypot(cx - zone.x, cy - zone.y) < 10) score -= 80;
        if (score > bestScore) { bestScore = score; bestCover = { x: cx, y: cy }; }
      }
    }
    
    if (bestCover) {
      const path = world.pathfinder.findPath(unit.x, unit.y, bestCover.x, bestCover.y);
      if (path && path.length > 0) unit.setPath(path);
    }
  }

  _tryGrenadierBehavior(world) {
    const unit = this.unit;
    // Ищем крупные цели (техника)
    let vehicleTarget = null;
    for (const other of world.units) {
      if (other.faction === unit.faction || other.isDead) continue;
      if (other.isVehicle) { vehicleTarget = other; break; }
    }
    
    if (vehicleTarget) {
      unit.target = vehicleTarget;
      unit.targetAngle = Math.atan2(vehicleTarget.y - unit.y, vehicleTarget.x - unit.x);
      return true;
    }
    return false;
  }

  _tryFollowGrenadier(world) {
    const unit = this.unit;
    let grenadier = null;
    for (const other of world.units) {
      if (other.faction === unit.faction && other.roleId === 'grenadier' && !other.isDead) {
        grenadier = other; break;
      }
    }
    if (grenadier) {
      const dist = Math.hypot(grenadier.x - unit.x, grenadier.y - unit.y);
      if (dist > 5 && this.currentGoal !== 'follow') {
        this.currentGoal = 'follow';
        const path = world.pathfinder.findPath(unit.x, unit.y, grenadier.x, grenadier.y);
        if (path && path.length > 0) unit.setPath(path);
        unit.setStance('crouch');
        return true;
      }
    }
    return false;
  }
}
