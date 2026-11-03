import { CONFIG } from '../data/config.js';

export class Brain {
  constructor(unit) {
    this.unit = unit;
    this.isAutonomous = true;
    this.playerOverrideTimer = 0;
    this.decisionTimer = Math.random() * 0.5;
    this.currentGoal = 'idle';
    
    this.memory = { 
      lastEnemyPos: null, 
      lastEnemyTime: 0, 
      patrolTarget: null,
      dangerZones: [],
      coverPoints: [],
      lastHeardNoise: null
    };
  }

  setPlayerOrder(path, target) {
    this.playerOverrideTimer = 10.0;
    this.unit.setPath(path);
    this.unit.lastTarget = target;
    this.currentGoal = 'move';
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
    
    this._cleanupMemory(world.time);
    this._think(world);
  }

  _cleanupMemory(now) {
    this.memory.dangerZones = this.memory.dangerZones.filter(z => now - z.time < 30);
    this.memory.coverPoints = this.memory.coverPoints.filter(z => now - z.time < 30);
  }

  _think(world) {
    const unit = this.unit;

    // 0. КРИТИЧЕСКОЕ: Нет патронов (ни в оружии, ни в запасе)
    if (unit.weapon.ammo === 0 && unit.weapon.reserveMagazines === 0) {
      if (this.currentGoal !== 'no_ammo') {
        this.currentGoal = 'no_ammo';
        const threatX = unit.target ? unit.target.x : unit.x + Math.cos(unit.angle) * 30;
        const threatY = unit.target ? unit.target.y : unit.y + Math.sin(unit.angle) * 30;
        const cover = this._findBestCover(world, threatX, threatY);
        if (cover) {
          const path = world.pathfinder.findPath(unit.x, unit.y, cover.x, cover.y);
          if (path && path.length > 0) unit.setPath(path);
        }
        unit.setStance('prone');
      }
      return;
    }

    // 1. Лечение
    if (unit.bleedingRate > 0 && (unit.medical.bandage > 0 || unit.medical.tourniquet > 0)) {
      if (this.currentGoal !== 'heal') {
        this.currentGoal = 'heal';
        unit._wantsToMove = false; unit.setPath([]);
        if (unit.target && Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y) < 20) {
          const cover = this._findBestCover(world, unit.target.x, unit.target.y);
          if (cover) {
            const path = world.pathfinder.findPath(unit.x, unit.y, cover.x, cover.y);
            if (path && path.length > 0) unit.setPath(path);
          }
        }
        if (unit.medical.bandage > 0) unit.applyBandage('torso', true);
        else if (unit.medical.tourniquet > 0) unit.applyTourniquet('leftLeg', true);
      }
      return;
    }

    // 2. Отступление при низком HP
    if (unit.hp < unit.maxHp * 0.3 && unit.target && this.currentGoal !== 'retreat') {
      const distToEnemy = Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y);
      if (distToEnemy > 5) {
        this.currentGoal = 'retreat';
        const cover = this._findBestCover(world, unit.target.x, unit.target.y);
        if (cover) {
          const path = world.pathfinder.findPath(unit.x, unit.y, cover.x, cover.y);
          if (path && path.length > 0) unit.setPath(path);
          unit.setStance('run');
        }
        return;
      }
    }

    // 3. Укрытие при подавлении
    if (unit.suppression > 0.4) {
      if (this.currentGoal !== 'cover') {
        this.currentGoal = 'cover';
        const threatX = unit.target ? unit.target.x : unit.x + Math.cos(unit.angle) * 30;
        const threatY = unit.target ? unit.target.y : unit.y + Math.sin(unit.angle) * 30;
        const cover = this._findBestCover(world, threatX, threatY);
        if (cover) {
          const path = world.pathfinder.findPath(unit.x, unit.y, cover.x, cover.y);
          if (path && path.length > 0) unit.setPath(path);
        }
        unit.setStance('prone');
      }
      return;
    }

    // 4. Бой
    if (unit.target) {
      if (this.currentGoal !== 'engage') {
        this.currentGoal = 'engage';
        unit._wantsToMove = false; unit.setPath([]); unit.setStance('stand');
      }
      if (unit.weapon.ammo < unit.weapon.magazineCapacity * 0.5 && unit.weapon.isReloading) unit.setStance('crouch');
      return;
    }

    // 5. Реакция на шум
    if (unit.lastHeardNoise) {
      const timeSinceNoise = (performance.now() / 1000) - unit.lastHeardNoise.time / 1000;
      if (timeSinceNoise < 5 && this.currentGoal !== 'investigate') {
        this.currentGoal = 'investigate';
        const path = world.pathfinder.findPath(unit.x, unit.y, unit.lastHeardNoise.x, unit.lastHeardNoise.y);
        if (path && path.length > 0) unit.setPath(path);
        unit.setStance('crouch');
        unit.lastHeardNoise = null;
        return;
      }
    }

    // 6. Зона контроля
    if (world.zone && world.zone.owner !== unit.faction) {
      const distToZone = Math.hypot(world.zone.x - unit.x, world.zone.y - unit.y);
      if (distToZone < 80 && distToZone > world.zone.radius - 2) {
        if (this.currentGoal !== 'capture_zone') {
          this.currentGoal = 'capture_zone';
          const path = world.pathfinder.findPath(unit.x, unit.y, world.zone.x, world.zone.y);
          if (path && path.length > 0) unit.setPath(path);
          unit.setStance('crouch');
        }
        return;
      }
    }

    // 7. Охота по памяти
    if (this.memory.lastEnemyPos && (world.time - this.memory.lastEnemyTime) < 8.0) {
      if (this.currentGoal !== 'hunt') {
        this.currentGoal = 'hunt';
        const path = world.pathfinder.findPath(unit.x, unit.y, this.memory.lastEnemyPos.x, this.memory.lastEnemyPos.y);
        if (path && path.length > 0) unit.setPath(path);
        unit.setStance('stand');
      }
      return;
    }

    // 8. Патруль (избегая опасных зон)
    if (this.currentGoal !== 'patrol' || (!unit.isMoving && !unit._wantsToMove)) {
      this.currentGoal = 'patrol';
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 20;
      let tx = Math.max(5, Math.min(world.mapSize - 5, unit.x + Math.cos(angle) * dist));
      let ty = Math.max(5, Math.min(world.mapSize - 5, unit.y + Math.sin(angle) * dist));
      
      for (const zone of this.memory.dangerZones) {
        if (Math.hypot(tx - zone.x, ty - zone.y) < 15) { tx = unit.x; ty = unit.y; break; }
      }
      
      const path = world.pathfinder.findPath(unit.x, unit.y, tx, ty);
      if (path && path.length > 0) { unit.setPath(path); unit.setStance('crouch'); }
    }
  }

  _findBestCover(world, threatX, threatY) {
    const unit = this.unit;
    let bestCover = null, bestScore = -Infinity;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      for (let dist = 5; dist <= 15; dist += 5) {
        const cx = unit.x + Math.cos(angle) * dist;
        const cy = unit.y + Math.sin(angle) * dist;
        if (cx < 2 || cx > world.mapSize - 2 || cy < 2 || cy > world.mapSize - 2) continue;
        if (!world.pathfinder || !world.pathfinder.grid) continue;
        const g = world.pathfinder.worldToGrid(cx, cy);
        if (world.pathfinder.grid[g.y * world.pathfinder.cols + g.x] === 1) continue;
        const enemySeesUs = world.pathfinder.hasLineOfSight(threatX, threatY, cx, cy);
        const weSeeEnemy = world.pathfinder.hasLineOfSight(cx, cy, threatX, threatY);
        let score = 0;
        if (!enemySeesUs) score += 100;
        if (weSeeEnemy) score += 50;
        score -= dist;
        for (const zone of this.memory.dangerZones) if (Math.hypot(cx - zone.x, cy - zone.y) < 10) score -= 80;
        if (score > bestScore) { bestScore = score; bestCover = { x: cx, y: cy }; }
      }
    }
    return bestCover;
  }
}
