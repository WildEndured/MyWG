import { CONFIG } from '../data/config.js';

export class Brain {
  constructor(unit) {
    this.unit = unit;
    this.isAutonomous = true;
    this.playerOverrideTimer = 0;
    this.decisionTimer = Math.random() * 0.5;
    this.currentGoal = 'idle';
    this.memory = { lastEnemyPos: null, lastEnemyTime: 0 };
  }

  setPlayerOrder(path, target) {
    this.playerOverrideTimer = 10.0;
    this.unit.setPath(path);
    this.unit.lastTarget = target;
    this.currentGoal = 'move';
  }

  update(dt, world) {
    if (this.unit.isDead) return;
    
    // Если игрок дал приказ — слушаемся только его
    if (this.playerOverrideTimer > 0) {
      this.playerOverrideTimer -= dt;
      return;
    }
    
    if (!this.isAutonomous) return;
    
    this.decisionTimer -= dt;
    if (this.decisionTimer > 0) return;
    this.decisionTimer = 0.5; // Думаем раз в полсекунды
    
    this._think(world);
  }

  _think(world) {
    const unit = this.unit;

    // 1. Лечение (Критический приоритет)
    if (unit.bleedingRate > 0 && (unit.medical.bandage > 0 || unit.medical.tourniquet > 0)) {
      if (this.currentGoal !== 'heal') {
        this.currentGoal = 'heal';
        unit._wantsToMove = false; unit.setPath([]);
        if (unit.medical.bandage > 0) unit.applyBandage('torso', true);
        else if (unit.medical.tourniquet > 0) unit.applyTourniquet('leftLeg', true);
      }
      return;
    }

    // 2. Укрытие (если сильно подавлен)
    if (unit.suppression > 0.5 && unit.stance !== 'prone') {
      if (this.currentGoal !== 'cover') { this.currentGoal = 'cover'; unit.setStance('prone'); }
      return;
    }

    // 3. Бой (если видим врага)
    if (unit.target) {
      if (this.currentGoal !== 'engage') { 
        this.currentGoal = 'engage'; 
        unit.setPath([]); 
        unit._wantsToMove = false; 
        unit.setStance('stand'); 
      }
      return;
    }

    // 4. ЗОНА КОНТРОЛЯ (Если зона не наша, и мы близко)
    if (world.zone && world.zone.owner !== unit.faction) {
      const distToZone = Math.hypot(world.zone.x - unit.x, world.zone.y - unit.y);
      // Если мы в 60 метрах от зоны — идём захватывать
      if (distToZone < 60 && distToZone > world.zone.radius - 2) {
        if (this.currentGoal !== 'capture_zone') {
          this.currentGoal = 'capture_zone';
          const path = world.pathfinder.findPath(unit.x, unit.y, world.zone.x, world.zone.y);
          if (path && path.length > 0) unit.setPath(path);
          unit.setStance('crouch');
        }
        return;
      }
    }

    // 5. Память о враге (Если недавно видели)
    if (this.memory.lastEnemyPos && (world.time - this.memory.lastEnemyTime) < 8.0) {
      if (this.currentGoal !== 'hunt') {
        this.currentGoal = 'hunt';
        const path = world.pathfinder.findPath(unit.x, unit.y, this.memory.lastEnemyPos.x, this.memory.lastEnemyPos.y);
        if (path && path.length > 0) unit.setPath(path);
        unit.setStance('stand');
      }
      return;
    }

    // 6. Патруль (Свободное время)
    if (this.currentGoal !== 'patrol' || (!unit.isMoving && !unit._wantsToMove)) {
      this.currentGoal = 'patrol';
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 20;
      const tx = Math.max(5, Math.min(world.mapSize - 5, unit.x + Math.cos(angle) * dist));
      const ty = Math.max(5, Math.min(world.mapSize - 5, unit.y + Math.sin(angle) * dist));
      const path = world.pathfinder.findPath(unit.x, unit.y, tx, ty);
      if (path && path.length > 0) { unit.setPath(path); unit.setStance('crouch'); }
    }
  }
}
