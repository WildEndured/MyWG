import { CONFIG } from '../data/config.js';
import { EventBus, EVENTS } from './EventBus.js';

export class Brain {
  constructor(unit) {
    this.unit = unit;
    this.isAutonomous = true; // Вкл/выкл автономию
    this.playerOverrideTimer = 0; // Сколько секунд игрок управляет юнитом
    this.decisionTimer = Math.random() * 0.5; // Разброс, чтобы все не думали одновременно
    this.currentGoal = 'idle'; // idle, move, engage, heal, patrol
    this.memory = {
      lastEnemyPos: null,
      lastEnemyTime: 0,
      patrolTarget: null,
    };
  }

  // Игрок отдал приказ — прерываем автономию на 10 секунд
  setPlayerOrder(path, target) {
    this.playerOverrideTimer = 10.0;
    this.unit.setPath(path);
    this.unit.lastTarget = target;
    this.currentGoal = 'move';
  }

  update(dt, world) {
    if (this.unit.isDead) return;

    // Если действует приказ игрока — ничего не делаем, юнит просто выполняет path
    if (this.playerOverrideTimer > 0) {
      this.playerOverrideTimer -= dt;
      return;
    }

    if (!this.isAutonomous) return;

    // Думаем раз в 0.5 секунды
    this.decisionTimer -= dt;
    if (this.decisionTimer > 0) return;
    this.decisionTimer = 0.5;

    this._think(world);
  }

  _think(world) {
    const unit = this.unit;

    // 1. КРИТИЧЕСКОЕ: Лечение
    if (unit.bleedingRate > 0 && (unit.medical.bandage > 0 || unit.medical.tourniquet > 0)) {
      if (this.currentGoal !== 'heal') {
        this.currentGoal = 'heal';
        // Останавливаемся и лечимся (если ещё не лечимся)
        unit._wantsToMove = false;
        unit.setPath([]);
        if (unit.medical.bandage > 0) unit.applyBandage('torso', true);
        else if (unit.medical.tourniquet > 0) unit.applyTourniquet('leftLeg', true);
      }
      return;
    }

    // 2. УГРОЗА: Укрытие (если подавлен)
    if (unit.suppression > 0.5 && unit.stance !== 'prone') {
      if (this.currentGoal !== 'cover') {
        this.currentGoal = 'cover';
        unit.setStance('prone'); // Ложимся
      }
      return;
    }

    // 3. БОЙ: Если видим врага
    if (unit.target) {
      if (this.currentGoal !== 'engage') {
        this.currentGoal = 'engage';
        unit.setPath([]);
        unit._wantsToMove = false;
        unit.setStance('stand');
      }
      return;
    }

    // 4. ПАМЯТЬ: Если недавно видели врага (меньше 8 секунд назад)
    if (this.memory.lastEnemyPos && (world.time - this.memory.lastEnemyTime) < 8.0) {
      if (this.currentGoal !== 'hunt') {
        this.currentGoal = 'hunt';
        const path = world.pathfinder.findPath(unit.x, unit.y, this.memory.lastEnemyPos.x, this.memory.lastEnemyPos.y);
        if (path && path.length > 0) unit.setPath(path);
        unit.setStance('stand');
      }
      return;
    }

    // 5. ПАТРУЛЬ: Если ничего не делаем — идём в случайную точку
    if (this.currentGoal !== 'patrol' || (!unit.isMoving && !unit._wantsToMove)) {
      this.currentGoal = 'patrol';
      // Выбираем случайную точку в радиусе 30 метров от текущей позиции
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 30;
      const tx = Math.max(5, Math.min(world.mapSize - 5, unit.x + Math.cos(angle) * dist));
      const ty = Math.max(5, Math.min(world.mapSize - 5, unit.y + Math.sin(angle) * dist));
      
      const path = world.pathfinder.findPath(unit.x, unit.y, tx, ty);
      if (path && path.length > 0) {
        unit.setPath(path);
        unit.setStance('crouch'); // Патрулируем пригнувшись
      }
    }
  }
}
