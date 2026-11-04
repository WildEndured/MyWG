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
    this.status = 'active';
    
    this.objectives = this.config.objectives.map(obj => ({
      ...obj, progress: 0, completed: false
    }));
    
    this.zones = [];
    this.triggeredEvents = new Set();
  }

  load(unitManager, map, camera) {
    const cfg = this.config;
    map.setSize(cfg.mapSize);
    unitManager.setWorldSize(cfg.mapSize);
    
    if (cfg.weather) {
      const CONFIG = window.__CONFIG;
      if (CONFIG && CONFIG.ENVIRONMENT) {
        CONFIG.ENVIRONMENT.WIND_SPEED = cfg.weather.windSpeed || 0;
        CONFIG.ENVIRONMENT.WIND_ANGLE = cfg.weather.windAngle || 0;
        CONFIG.ENVIRONMENT.TEMPERATURE = cfg.weather.temperature || 20;
      }
    }
    
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
    
    this.zones = [];
    for (const zoneConfig of cfg.zones) {
      const zone = new CaptureZone(zoneConfig.x, zoneConfig.y, zoneConfig.radius, this.type === 'defense' ? 'player' : 'enemy');
      this.zones.push(zone);
    }
    unitManager.captureZone = this.zones[0];
    
    // НОВОЕ: Генерация рельефа под миссию
    this._setupObstaclesAndTerrain(unitManager, cfg);
    
    this._spawnSquad(unitManager, cfg.playerSquad, 'player', cfg.mapSize);
    this._spawnSquad(unitManager, cfg.enemySquad, 'enemy', cfg.mapSize);
    
    if (camera) camera.fit(cfg.mapSize, cfg.mapSize);
  }

  _setupObstaclesAndTerrain(unitManager, cfg) {
    unitManager.pathfinder.clearObstacles();
    const center = cfg.mapSize / 2;
    
    if (this.id === 'capture_bridge') {
      // МОСТ: река по центру (окопы), берега — стены
      // Река (глубокий окоп) шириной 10 м по центру
      for (let dy = -cfg.mapSize / 2; dy < cfg.mapSize / 2; dy += 1) {
        for (let dx = -5; dx < 5; dx++) {
          unitManager.pathfinder.setHeight(center + dx, center + dy, -2.0);
        }
      }
      
      // Берега (холмы) — по 5 м с каждой стороны реки
      for (let dy = -cfg.mapSize / 2; dy < cfg.mapSize / 2; dy += 1) {
        for (let dx = 5; dx < 12; dx++) {
          const h = 1.0 - (dx - 5) * 0.15;
          if (h > 0) {
            unitManager.pathfinder.setHeight(center + dx, center + dy, h);
            unitManager.pathfinder.setHeight(center - dx, center + dy, h);
          }
        }
      }
      
      // Мост (проходимая зона) — снимаем окоп в центре
      for (let dy = -3; dy < 3; dy++) {
        for (let dx = -5; dx < 5; dx++) {
          unitManager.pathfinder.setHeight(center + dx, center + dy, 0);
        }
      }
      
      // Стены (укрытия у моста)
      unitManager.pathfinder.addObstacle(center - 6, center - 8, 2, 4, 'sandbags');
      unitManager.pathfinder.addObstacle(center + 4, center - 8, 2, 4, 'sandbags');
      unitManager.pathfinder.addObstacle(center - 6, center + 4, 2, 4, 'sandbags');
      unitManager.pathfinder.addObstacle(center + 4, center + 4, 2, 4, 'sandbags');
    } else if (this.id === 'defend_village') {
      // ДЕРЕВНЯ: холм в центре, дома на склонах
      // Холм (радиус 20, высота 2)
      for (let dy = -20; dy < 20; dy += 1) {
        for (let dx = -20; dx < 20; dx += 1) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            unitManager.pathfinder.setHeight(center + dx, center + dy, (1 - dist / 20) * 2);
          }
        }
      }
      
      // Дома (стены) на холме
      unitManager.pathfinder.addObstacle(center - 10, center - 5, 4, 4, 'brick');
      unitManager.pathfinder.addObstacle(center + 6, center - 5, 4, 4, 'brick');
      unitManager.pathfinder.addObstacle(center - 2, center + 6, 6, 3, 'wood');
      
      // Окопы у подножия холма
      for (let dy = -25; dy < 25; dy += 1) {
        for (let dx = -25; dx < 25; dx += 1) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 20 && dist < 25) {
            unitManager.pathfinder.setHeight(center + dx, center + dy, -0.8);
          }
        }
      }
    }
  }

  _spawnSquad(unitManager, squadConfig, faction, mapSize) {
    const roles = ['squad_leader', 'machine_gunner', 'grenadier', 'grenadier_help', 'senior_rifleman', 'rifleman', 'rifleman', 'rifleman', 'driver', 'gunner'];
    const units = [];
    
    roles.forEach((roleId, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const dx = squadConfig.spawnX + (col - 2) * 2.5;
      const dy = squadConfig.spawnY + row * 2.5;
      
      const p = unitManager.getSafeSpawnPoint(dx, dy, 1.0, true);
      const unit = new Unit(Math.max(2, Math.min(mapSize - 2, p.x)), Math.max(2, Math.min(mapSize - 2, p.y)), faction, roleId);
      unitManager.addUnit(unit);
      units.push(unit);
    });
    
    unitManager.createSquad(units, faction);
  }

  update(dt, world) {
    if (this.status !== 'active') return;
    this.timeElapsed += dt;

    for (const obj of this.objectives) {
      if (obj.completed) continue;
      if (obj.type === 'capture_zone' || obj.type === 'hold_zone') {
        const zone = this.zones[obj.zoneId];
        if (!zone) continue;
        const playerHolds = zone.owner === 'player';
        if (playerHolds) {
          obj.progress += dt;
          if (obj.progress >= obj.time) { obj.completed = true; this._checkVictory(); }
        } else {
          obj.progress = Math.max(0, obj.progress - dt * 0.5);
        }
      }
    }

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

    this._checkDefeat(world);
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
        const p = unitManager.getSafeSpawnPoint(trigger.spawnX + (Math.random() - 0.5) * 5, trigger.spawnY + (Math.random() - 0.5) * 5, 1.0, true);
        const unit = new Unit(Math.max(2, Math.min(mapSize - 2, p.x)), Math.max(2, Math.min(mapSize - 2, p.y)), trigger.faction, roleId);
        unitManager.addUnit(unit);
        units.push(unit);
      }
      if (units.length > 0) unitManager.createSquad(units, trigger.faction);
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
