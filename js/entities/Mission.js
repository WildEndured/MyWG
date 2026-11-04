import { EventBus, EVENTS } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { CaptureZone } from './CaptureZone.js';
import { MISSIONS } from '../data/missions.js';

export class Mission {
  constructor(configId) {
    this.config = MISSIONS[configId];
    if (!this.config) throw new Error(`Mission ${configId} not found`);
    
    this.id = this.config.id;
    this.name = this.config.name;
    this.type = this.config.type;
    this.timeElapsed = 0;
    this.status = 'active'; // 'active', 'victory', 'defeat'
    
    this.objectives = this.config.objectives.map(obj => ({
      ...obj,
      progress: 0,
      completed: false
    }));
    
    this.zones = [];
    this.triggeredEvents = new Set();
  }

  // Загрузка миссии в мир
  load(unitManager, map, camera) {
    const cfg = this.config;
    
    // 1. Установить размер карты
    map.setSize(cfg.mapSize);
    unitManager.setWorldSize(cfg.mapSize);
    
    // 2. Погода
    if (cfg.weather) {
      const CONFIG = window.__CONFIG;
      if (CONFIG && CONFIG.ENVIRONMENT) {
        CONFIG.ENVIRONMENT.WIND_SPEED = cfg.weather.windSpeed || 0;
        CONFIG.ENVIRONMENT.WIND_ANGLE = cfg.weather.windAngle || 0;
        CONFIG.ENVIRONMENT.TEMPERATURE = cfg.weather.temperature || 20;
      }
    }
    
    // 3. Очистить старое
    unitManager.units = [];
    unitManager.selectedUnits = [];
    unitManager.squads = [];
    unitManager.bullets = [];
    unitManager.tracers = [];
    unitManager.tracerTrails = [];
    unitManager.explosions = [];
    unitManager.grenades = [];
    unitManager.fragments = [];
    unitManager.debris = [];
    unitManager.dust = [];
    unitManager.decals = [];
    
    // 4. Создать зоны
    this.zones = [];
    for (const zoneConfig of cfg.zones) {
      const zone = new CaptureZone(
        zoneConfig.x, zoneConfig.y, zoneConfig.radius,
        this.type === 'defense' ? 'player' : 'enemy'
      );
      this.zones.push(zone);
    }
    unitManager.captureZone = this.zones[0]; // Основная зона
    
    // 5. Спавн отрядов
    this._spawnSquad(unitManager, cfg.playerSquad, 'player', cfg.mapSize);
    this._spawnSquad(unitManager, cfg.enemySquad, 'enemy', cfg.mapSize);
    
    // 6. Опредактировать препятствия (для моста)
    this._setupObstacles(unitManager, cfg);
    
    // 7. Камера
    if (camera) {
      camera.fit(cfg.mapSize, cfg.mapSize);
    }
  }

  _spawnSquad(unitManager, squadConfig, faction, mapSize) {
    const roles = [
      'squad_leader', 'machine_gunner', 'grenadier', 'grenadier_help',
      'senior_rifleman', 'rifleman', 'rifleman', 'rifleman',
      'driver', 'gunner'
    ];
    
    const units = [];
    roles.forEach((roleId, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const dx = squadConfig.spawnX + (col - 2) * 2.0;
      const dy = squadConfig.spawnY + row * 2.0;
      
      const p = unitManager.getSafeSpawnPoint(dx, dy);
      const unit = new Unit(
        Math.max(0, Math.min(mapSize, p.x)),
        Math.max(0, Math.min(mapSize, p.y)),
        faction, roleId
      );
      unitManager.addUnit(unit);
      units.push(unit);
    });
    
    unitManager.createSquad(units, faction);
  }

  _setupObstacles(unitManager, cfg) {
    unitManager.pathfinder.clearObstacles();
    const center = cfg.mapSize / 2;
    
    if (this.id === 'capture_bridge') {
      // Мост: две стены по краям от зоны
      unitManager.pathfinder.addObstacle(center - 20, center - 15, 1, 10, 'concrete');
      unitManager.pathfinder.addObstacle(center - 20, center + 5, 1, 10, 'concrete');
      unitManager.pathfinder.addObstacle(center + 19, center - 15, 1, 10, 'concrete');
      unitManager.pathfinder.addObstacle(center + 19, center + 5, 1, 10, 'concrete');
      
      // Мешки с песком у моста
      unitManager.pathfinder.addObstacle(center - 5, center - 8, 3, 1, 'sandbags');
      unitManager.pathfinder.addObstacle(center + 2, center + 7, 3, 1, 'sandbags');
    } else if (this.id === 'defend_village') {
      // Деревня: несколько зданий
      unitManager.pathfinder.addObstacle(center - 30, center - 10, 5, 5, 'brick');
      unitManager.pathfinder.addObstacle(center - 30, center + 5, 5, 5, 'brick');
      unitManager.pathfinder.addObstacle(center - 15, center - 15, 6, 4, 'wood');
    }
  }

  update(dt, world) {
    if (this.status !== 'active') return;
    this.timeElapsed += dt;

    // Проверка целей
    for (const obj of this.objectives) {
      if (obj.completed) continue;
      
      if (obj.type === 'capture_zone' || obj.type === 'hold_zone') {
        const zone = this.zones[obj.zoneId];
        if (!zone) continue;
        
        // Для capture: зона должна быть у игрока
        // Для hold: зона уже у игрока, нужно удержать
        const playerHolds = zone.owner === 'player';
        
        if (playerHolds) {
          obj.progress += dt;
          if (obj.progress >= obj.time) {
            obj.completed = true;
            this._checkVictory();
          }
        } else {
          obj.progress = Math.max(0, obj.progress - dt * 0.5); // Медленно откатывается
        }
      }
    }

    // Триггеры
    if (this.config.triggers) {
      for (let i = 0; i < this.config.triggers.length; i++) {
        const trigger = this.config.triggers[i];
        if (this.triggeredEvents.has(i)) continue;
        
        if (this.timeElapsed >= trigger.time) {
          this.triggeredEvents.add(i);
          this._executeTrigger(trigger, world);
        }
      }
    }

    // Проверка поражения
    this._checkDefeat(world);
    
    // Таймаут
    if (this.config.timeLimit && this.timeElapsed >= this.config.timeLimit) {
      if (this.status === 'active') {
        this.status = 'defeat';
        EventBus.emit('mission:defeat', { mission: this, reason: 'time' });
      }
    }
  }

  _executeTrigger(trigger, world) {
    if (trigger.type === 'reinforcement') {
      const unitManager = world.unitManager;
      if (!unitManager) return;
      
      const mapSize = this.config.mapSize;
      const units = [];
      
      for (const roleId of trigger.roles) {
        const p = unitManager.getSafeSpawnPoint(
          trigger.spawnX + (Math.random() - 0.5) * 5,
          trigger.spawnY + (Math.random() - 0.5) * 5
        );
        const unit = new Unit(
          Math.max(0, Math.min(mapSize, p.x)),
          Math.max(0, Math.min(mapSize, p.y)),
          trigger.faction, roleId
        );
        unitManager.addUnit(unit);
        units.push(unit);
      }
      
      if (units.length > 0) {
        unitManager.createSquad(units, trigger.faction);
      }
      
      EventBus.emit('mission:reinforcement', { faction: trigger.faction, count: units.length });
    }
  }

  _checkVictory() {
    if (this.objectives.every(o => o.completed)) {
      this.status = 'victory';
      EventBus.emit('mission:victory', { mission: this });
    }
  }

  _checkDefeat(world) {
    const playerUnits = world.units ? world.units.filter(u => u.faction === 'player' && !u.isDead) : [];
    if (playerUnits.length === 0 && this.status === 'active') {
      this.status = 'defeat';
      EventBus.emit('mission:defeat', { mission: this, reason: 'units_dead' });
    }
  }

  // Для UI: получить описание цели
  getObjectiveText() {
    for (const obj of this.objectives) {
      if (!obj.completed) {
        const progress = Math.floor(obj.progress);
        const total = Math.floor(obj.time);
        return `${obj.description}: ${progress}/${total} сек`;
      }
    }
    return 'Все цели выполнены';
  }

  getTimeRemaining() {
    if (!this.config.timeLimit) return null;
    return Math.max(0, this.config.timeLimit - this.timeElapsed);
  }
}
