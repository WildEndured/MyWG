import { CONFIG } from '../data/config.js';

export class Brain {
  constructor(unit) {
    this.unit = unit;
    this.isAutonomous = true;
    this.playerOverrideTimer = 0;
    this.decisionTimer = Math.random() * 0.5;
    this.currentGoal = 'idle';
    
    // Память
    this.memory = { 
      lastEnemyPos: null, 
      lastEnemyTime: 0, 
      patrolTarget: null,
      dangerZones: [], // { x, y, time } — куда не ходить
      coverPoints: [], // { x, y, time } — хорошие укрытия
      lastHeardNoise: null
    };
    
    // Для микротактики
    this.shotsFiredInBurst = 0;
    this.lastBurstTime = 0;
    this.flankDirection = Math.random() > 0.5 ? 1 : -1;
  }

  setPlayerOrder(path, target) {
    this.playerOverrideTimer = 10.0;
    this.unit.setPath(path);
    this.unit.lastTarget = target;
    this.currentGoal = 'move';
  }

  // Регистрация урона (вызывается из Unit.takeDamage)
  registerDamage(fromX, fromY) {
    this.memory.dangerZones.push({ x: fromX, y: fromY, time: performance.now() / 1000 });
    // Ограничиваем память
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
    // Удаляем старые опасные зоны (старше 30 сек)
    this.memory.dangerZones = this.memory.dangerZones.filter(z => now - z.time < 30);
    this.memory.coverPoints = this.memory.coverPoints.filter(z => now - z.time < 30);
  }

  _think(world) {
    const unit = this.unit;

    // 1. КРИТИЧЕСКОЕ: Лечение
    if (unit.bleedingRate > 0 && (unit.medical.bandage > 0 || unit.medical.tourniquet > 0)) {
      if (this.currentGoal !== 'heal') {
        this.currentGoal = 'heal';
        unit._wantsToMove = false; unit.setPath([]);
        // Отходим в укрытие перед лечением, если рядом враг
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

    // 2. ОТСТУПЛЕНИЕ (Микротактика: если hp < 30%, отходим)
    if (unit.hp < unit.maxHp * 0.3 && unit.target && this.currentGoal !== 'retreat') {
      const distToEnemy = Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y);
      if (distToEnemy > 5) { // Не отступаем в упор
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

    // 3. УКРЫТИЕ (Оценка позиции)
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

    // 4. БОЙ
    if (unit.target) {
      if (this.currentGoal !== 'engage') {
        this.currentGoal = 'engage';
        unit._wantsToMove = false;
        unit.setPath([]);
        unit.setStance('stand');
      }
      // Микротактика: смена позиции после очереди
      if (unit.weapon.ammo < unit.weapon.magazineCapacity * 0.5 && unit.weapon.isReloading) {
        unit.setStance('crouch'); // Присесть на перезарядке
      }
      return;
    }

    // 5. ПАМЯТЬ О ШУМЕ (Реакция на звук)
    if (unit.lastHeardNoise) {
      const timeSinceNoise = (performance.now() / 1000) - unit.lastHeardNoise.time / 1000;
      if (timeSinceNoise < 5 && this.currentGoal !== 'investigate') {
        this.currentGoal = 'investigate';
        const path = world.pathfinder.findPath(unit.x, unit.y, unit.lastHeardNoise.x, unit.lastHeardNoise.y);
        if (path && path.length > 0) unit.setPath(path);
        unit.setStance('crouch');
        unit.lastHeardNoise = null; // Обработали
        return;
      }
    }

    // 6. ЗОНА КОНТРОЛЯ (Проактивность)
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

    // 7. ПАМЯТЬ О ВРАГЕ (Охота)
    if (this.memory.lastEnemyPos && (world.time - this.memory.lastEnemyTime) < 8.0) {
      if (this.currentGoal !== 'hunt') {
        this.currentGoal = 'hunt';
        const path = world.pathfinder.findPath(unit.x, unit.y, this.memory.lastEnemyPos.x, this.memory.lastEnemyPos.y);
        if (path && path.length > 0) unit.setPath(path);
        unit.setStance('stand');
      }
      return;
    }

    // 8. ПАТРУЛЬ (Избегаем опасных зон)
    if (this.currentGoal !== 'patrol' || (!unit.isMoving && !unit._wantsToMove)) {
      this.currentGoal = 'patrol';
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 20;
      let tx = Math.max(5, Math.min(world.mapSize - 5, unit.x + Math.cos(angle) * dist));
      let ty = Math.max(5, Math.min(world.mapSize - 5, unit.y + Math.sin(angle) * dist));
      
      // Избегаем опасных зон
      for (const zone of this.memory.dangerZones) {
        if (Math.hypot(tx - zone.x, ty - zone.y) < 15) {
          tx = unit.x; ty = unit.y; // Стоим на месте, если идти некуда безопасно
          break;
        }
      }
      
      const path = world.pathfinder.findPath(unit.x, unit.y, tx, ty);
      if (path && path.length > 0) { unit.setPath(path); unit.setStance('crouch'); }
    }
  }

  // Оценка укрытий (Cover Scoring)
  _findBestCover(world, threatX, threatY) {
    const unit = this.unit;
    let bestCover = null;
    let bestScore = -Infinity;

    // Проверяем 8 направлений на расстоянии 5-15 метров
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      for (let dist = 5; dist <= 15; dist += 5) {
        const cx = unit.x + Math.cos(angle) * dist;
        const cy = unit.y + Math.sin(angle) * dist;
        
        // Проверка границ карты
        if (cx < 2 || cx > world.mapSize - 2 || cy < 2 || cy > world.mapSize - 2) continue;
        
        // Проверка, что там нет стены
        if (!world.pathfinder || !world.pathfinder.grid) continue;
        const g = world.pathfinder.worldToGrid(cx, cy);
        if (world.pathfinder.grid[g.y * world.pathfinder.cols + g.x] === 1) continue;

        // Скоринг: не видим врага (но враг видит нас) ИЛИ мы видим врага, но он не видит нас
        const enemySeesUs = world.pathfinder.hasLineOfSight(threatX, threatY, cx, cy);
        const weSeeEnemy = world.pathfinder.hasLineOfSight(cx, cy, threatX, threatY);
        
        let score = 0;
        if (!enemySeesUs) score += 100; // Идеально: мы невидимы
        if (weSeeEnemy) score += 50; // Мы можем стрелять
        score -= dist; // Чем ближе, тем лучше
        
        // Избегаем опасных зон
        for (const zone of this.memory.dangerZones) {
          if (Math.hypot(cx - zone.x, cy - zone.y) < 10) score -= 80;
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestCover = { x: cx, y: cy };
        }
      }
    }
    
    return bestCover;
  }
}
