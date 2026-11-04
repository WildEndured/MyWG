import { EventBus, EVENTS } from '../core/EventBus.js';
import { Unit } from './Unit.js';
import { CaptureZone } from './CaptureZone.js';
import { MISSIONS } from '../data/missions.js';

export class Mission {
  constructor(configId, mapSize = 100) {
    this.config = MISSIONS[configId];
    if (!this.config) throw new Error(`Mission ${configId} not found`);
    
    this.id = this.config.id;
    this.name = this.config.name;
    this.type = this.config.type;
    this.mapSize = mapSize; // НОВОЕ: размер карты
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
    const size = this.mapSize;
    
    map.setSize(size);
    unitManager.setWorldSize(size);
    
    if (cfg.weather) {
      const CONFIG = window.__CONFIG;
      if (CONFIG && CONFIG.ENVIRONMENT) {
        CONFIG.ENVIRONMENT.WIND_SPEED = cfg.weather.windSpeed || 0;
        CONFIG.ENVIRONMENT.WIND_ANGLE = cfg.weather.windAngle || 0;
        CONFIG.ENVIRONMENT.TEMPERATURE = cfg.weather.temperature || 20;
      }
    }
    
    // Очистка
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
    unitManager.fires = [];
    
    // Зоны (пересчёт из процентов в координаты)
    this.zones = [];
    for (const zoneConfig of cfg.zones) {
      const zoneX = zoneConfig.xRel * size;
      const zoneY = zoneConfig.yRel * size;
      const zoneRadius = zoneConfig.radiusRel * size;
      
      const zone = new CaptureZone(
        zoneX, zoneY, zoneRadius,
        this.type === 'defense' ? 'player' : 'enemy'
      );
      this.zones.push(zone);
    }
    unitManager.captureZone = this.zones[0];
    
    // Генерация рельефа (пропорционально)
    this._setupObstaclesAndTerrain(unitManager, size);
    
    // Спавн отрядов (пересчёт из процентов)
    const playerX = cfg.playerSquad.spawnXRel * size;
    const playerY = cfg.playerSquad.spawnYRel * size;
    this._spawnSquad(unitManager, playerX, playerY, 'player', size);
    
    const enemyX = cfg.enemySquad.spawnXRel * size;
    const enemyY = cfg.enemySquad.spawnYRel * size;
    this._spawnSquad(unitManager, enemyX, enemyY, 'enemy', size);
    
    if (camera) camera.fit(size, size);
  }

  _setupObstaclesAndTerrain(unitManager, size) {
    unitManager.pathfinder.clearObstacles();
    const center = size / 2;
    
    // Масштабирование: 1 единица на карте 100 = X на карте 1000
    const scale = size / 100;
    
    if (this.id === 'capture_bridge') {
      // Река (глубокий окоп) шириной 10% от карты
      const riverWidth = size * 0.05;
      for (let dy = 0; dy < size; dy += 1) {
        for (let dx = -riverWidth; dx < riverWidth; dx++) {
          unitManager.pathfinder.setHeight(center + dx, dy, -2.0);
        }
      }
      
      // Берега (холмы)
      const bankWidth = size * 0.07;
      for (let dy = 0; dy < size; dy += 1) {
        for (let dx = riverWidth; dx < riverWidth + bankWidth; dx++) {
          const factor = 1 - (dx - riverWidth) / bankWidth;
          const h = factor * 1.5;
          if (h > 0) {
            unitManager.pathfinder.setHeight(center + dx, dy, h);
            unitManager.pathfinder.setHeight(center - dx, dy, h);
          }
        }
      }
      
      // Мост (проходимая зона) — снимаем окоп в центре
      const bridgeWidth = size * 0.03;
      const bridgeLength = size * 0.06;
      for (let dy = -bridgeLength; dy < bridgeLength; dy++) {
        for (let dx = -riverWidth; dx < riverWidth; dx++) {
          unitManager.pathfinder.setHeight(center + dx, center + dy, 0);
        }
      }
      
      // Стены (укрытия у моста)
      const wallSize = size * 0.02;
      unitManager.pathfinder.addObstacle(center - riverWidth * 1.2, center - wallSize * 4, wallSize, wallSize * 2, 'sandbags');
      unitManager.pathfinder.addObstacle(center + riverWidth * 1.2, center - wallSize * 4, wallSize, wallSize * 2, 'sandbags');
      unitManager.pathfinder.addObstacle(center - riverWidth * 1.2, center + wallSize * 2, wallSize, wallSize * 2, 'sandbags');
      unitManager.pathfinder.addObstacle(center + riverWidth * 1.2, center + wallSize * 2, wallSize, wallSize * 2, 'sandbags');
    } else if (this.id === 'defend_village') {
      // Холм в центре (радиус 20% от карты)
      const hillRadius = size * 0.2;
      for (let dy = -hillRadius; dy < hillRadius; dy += 1) {
        for (let dx = -hillRadius; dx < hillRadius; dx += 1) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hillRadius) {
            unitManager.pathfinder.setHeight(center + dx, center + dy, (1 - dist / hillRadius) * 2);
          }
        }
      }
      
      // Дома (кирпич) на холме
      const houseSize = size * 0.04;
      unitManager.pathfinder.addObstacle(center - size * 0.1, center - houseSize, houseSize, houseSize, 'brick');
      unitManager.pathfinder.addObstacle(center + size * 0.06, center - houseSize, houseSize, houseSize, 'brick');
      unitManager.pathfinder.addObstacle(center - houseSize / 2, center + size * 0.06, houseSize * 1.5, houseSize * 0.8, 'wood');
      
      // Окопы у подножия
      const trenchRadius = size * 0.25;
      for (let dy = -trenchRadius; dy < trenchRadius; dy += 1) {
        for (let dx = -trenchRadius; dx < trenchRadius; dx += 1) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > hillRadius && dist < trenchRadius) {
            unitManager.pathfinder.setHeight(center + dx, center + dy, -0.8);
          }
        }
      }
    }
  }

  _spawnSquad(unitManager, baseX, baseY, faction, mapSize) {
    const roles = ['squad_leader', 'machine_gunner', 'grenadier', 'grenadier_help', 'senior_rifleman', 'rifleman', 'rifleman', 'rifleman', 'driver', 'gunner'];
    const units = [];
    
    // Масштабируем отступы (2.5 м на карте 100 = 2.5% от карты)
    const spacing = mapSize * 0.025;
    
    roles.forEach((roleId, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const dx = baseX + (col - 2) * spacing;
      const dy = baseY + row * spacing;
      
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
      const mapSize = this.mapSize;
      const units = [];
      
      // Пересчёт координат из процентов
      const spawnX = trigger.spawnXRel * mapSize;
      const spawnY = trigger.spawnYRel * mapSize;
      const spacing = mapSize * 0.025;
      
      for (let i = 0; i < trigger.roles.length; i++) {
        const roleId = trigger.roles[i];
        const dx = spawnX + (i % 5 - 2) * spacing;
        const dy = spawnY + Math.floor(i / 5) * spacing;
        
        const p = unitManager.getSafeSpawnPoint(dx + (Math.random() - 0.5) * spacing, dy + (Math.random() - 0.5) * spacing, 1.0, true);
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
