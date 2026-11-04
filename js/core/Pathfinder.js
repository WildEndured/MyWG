import { CONFIG } from '../data/config.js';
import { MATERIALS } from '../data/materials.js';

export class Pathfinder {
  constructor(worldSize, cellSize = 1) {
    this.cellSize = cellSize;
    this.worldSize = worldSize;
    this.cols = Math.max(1, Math.ceil(worldSize / cellSize));
    this.rows = this.cols;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.obstacles = [];
    this.heightMap = new Float32Array(this.cols * this.rows);
    this.floorMap = new Uint8Array(this.cols * this.rows); // НОВОЕ: этажи (0 = земля, 1 = 2 этаж)
  }

  setWorldSize(worldSize) {
    this.worldSize = worldSize;
    this.cols = Math.max(1, Math.ceil(worldSize / this.cellSize));
    this.rows = this.cols;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.obstacles = [];
    this.heightMap = new Float32Array(this.cols * this.rows);
    this.floorMap = new Uint8Array(this.cols * this.rows);
  }

  setHeight(worldX, worldY, height) {
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      this.heightMap[g.y * this.cols + g.x] = height;
    }
  }

  getHeight(worldX, worldY) {
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      return this.heightMap[g.y * this.cols + g.x];
    }
    return 0;
  }

  setFloor(worldX, worldY, floor) {
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      this.floorMap[g.y * this.cols + g.x] = floor;
    }
  }

  getFloor(worldX, worldY) {
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      return this.floorMap[g.y * this.cols + g.x];
    }
    return 0;
  }

  createCrater(worldX, worldY, radius, depth) {
    const g = this.worldToGrid(worldX, worldY);
    const rGrid = Math.ceil(radius / this.cellSize);
    
    for (let dy = -rGrid; dy <= rGrid; dy++) {
      for (let dx = -rGrid; dx <= rGrid; dx++) {
        const nx = g.x + dx;
        const ny = g.y + dy;
        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
        
        const dist = Math.hypot(dx * this.cellSize, dy * this.cellSize);
        if (dist < radius) {
          const factor = 1 - (dist / radius);
          this.heightMap[ny * this.cols + nx] -= depth * factor;
        }
      }
    }
  }

  generateTerrain() {
    const center = this.cols / 2;
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const dx = gx - center, dy = gy - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let height = 0;
        if (dist < 20) height = (1 - dist / 20) * 3;
        
        const ox = gx - 50, oy = gy - 20;
        if (Math.sqrt(ox * ox + oy * oy) < 10) height = Math.min(height, -1.5);
        
        const ex = gx - 80, ey = gy - 50;
        if (Math.sqrt(ex * ex + ey * ey) < 15) height = Math.max(height, (1 - Math.sqrt(ex * ex + ey * ey) / 15) * 2);
        
        this.heightMap[gy * this.cols + gx] = Math.max(-2, Math.round(height * 10) / 10);
      }
    }
  }

  // НОВОЕ: Многоуровневое здание (этажи)
  addMultiFloorBuilding(x, y, w, h, floors = 2) {
    for (let f = 0; f < floors; f++) {
      for (let sy = 0; sy < h; sy += 1) {
        for (let sx = 0; sx < w; sx += 1) {
          const isWall = (sx === 0 || sx === w - 1 || sy === 0 || sy === h - 1);
          if (isWall) {
            // Стена (на каждом этаже)
            const wx = x + sx;
            const wy = y + sy;
            this.setFloor(wx, wy, f);
            this.setHeight(wx, wy, f * 3.0); // Каждый этаж +3 м
          } else if (f === 0) {
            // Пол первого этажа
            this.setFloor(x + sx, y + sy, 0);
          }
        }
      }
    }
    // Лестница (внутри) — проходима на всех этажах
    const stairX = x + Math.floor(w / 2);
    const stairY = y + Math.floor(h / 2);
    for (let f = 0; f < floors; f++) {
      this.setFloor(stairX, stairY, f);
    }
    // Окна (дыры в стенах) на 2 этаже
    for (let sy = 1; sy < h - 1; sy += 2) {
      this.setFloor(x, y + sy, 1); // Окно
      this.setFloor(x + w - 1, y + sy, 1);
    }
  }

  addObstacle(x, y, w, h, materialId = 'concrete') {
    const matData = MATERIALS[materialId] || MATERIALS.concrete;
    const segments = [];
    const segSize = 1.0;
    for (let sy = 0; sy < h; sy += segSize) {
      for (let sx = 0; sx < w; sx += segSize) {
        const sw = Math.min(segSize, w - sx);
        const sh = Math.min(segSize, h - sy);
        segments.push({
          x: x + sx, y: y + sy, w: sw, h: sh,
          hp: 100, maxHp: 100,
          state: 'intact',
        });
      }
    }

    const obs = {
      x, y, w, h, materialId, matData, segments,
      state: 'intact',
      height: matData.height || 2.0,
      maxHeight: matData.height || 2.0,
    };
    this.obstacles.push(obs);
    this._updateGrid();
  }

  removeObstacle(obs) {
    const idx = this.obstacles.indexOf(obs);
    if (idx >= 0) { this.obstacles.splice(idx, 1); this._updateGrid(); }
  }

  damageSegment(obs, segX, segY, damage) {
    const seg = obs.segments.find(s => segX >= s.x && segX <= s.x + s.w && segY >= s.y && segY <= s.y + s.h);
    if (!seg) return;
    seg.hp -= damage;
    if (seg.hp <= 0) seg.hp = 0;

    const ratio = seg.hp / seg.maxHp;
    if (ratio > 0.66) seg.state = 'intact';
    else if (ratio > 0.33) seg.state = 'damaged';
    else if (ratio > 0) seg.state = 'breached';
    else seg.state = 'rubble';

    const worst = obs.segments.reduce((min, s) => s.hp < min.hp ? s : min, obs.segments[0]);
    obs.state = worst.state;

    if (obs.matData.destructionType === 'collapse') {
      const avgHp = obs.segments.reduce((sum, s) => sum + s.hp, 0) / obs.segments.length / 100;
      obs.height = obs.maxHeight * avgHp;
    }
    this._updateGrid();
  }

  _updateGrid() {
    this.grid.fill(0);
    const padding = CONFIG.PHYSICS.PATHFINDER_PADDING;
    for (const obs of this.obstacles) {
      for (const seg of obs.segments) {
        if (seg.state === 'rubble') continue;
        const start = this.worldToGrid(seg.x - padding, seg.y - padding);
        const end = this.worldToGrid(seg.x + seg.w + padding, seg.y + seg.h + padding);
        for (let gy = start.y; gy <= end.y; gy++) {
          for (let gx = start.x; gx <= end.x; gx++) {
            if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
              this.grid[gy * this.cols + gx] = 1;
            }
          }
        }
      }
    }
  }

  clearObstacles() { this.grid.fill(0); this.obstacles = []; }

  worldToGrid(x, y) {
    return { 
      x: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize))), 
      y: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize))) 
    };
  }

  gridToWorld(gx, gy) {
    return { x: gx * this.cellSize + this.cellSize / 2, y: gy * this.cellSize + this.cellSize / 2 };
  }

  findNearestFreePoint(x, y) {
    const g = this.worldToGrid(x, y);
    if (this.grid[g.y * this.cols + g.x] === 0) return { x, y };
    for (let r = 1; r < 60; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = g.x + dx, ny = g.y + dy;
          if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
          if (this.grid[ny * this.cols + nx] === 0) return this.gridToWorld(nx, ny);
        }
      }
    }
    return { x, y };
  }

  hasLineOfSight(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 0.001) return true;
    const steps = Math.max(8, Math.ceil(dist / (this.cellSize * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
      const g = this.worldToGrid(cx, cy);
      if (this.grid[g.y * this.cols + g.x] === 1) return false;
    }
    return true;
  }

  smoothPath(path) {
    if (path.length <= 2) return path;
    const smoothed = [path[0]];
    let currentIndex = 0;
    while (currentIndex < path.length - 1) {
      let furthestVisible = currentIndex + 1;
      for (let i = path.length - 1; i > currentIndex; i--) {
        if (this.hasLineOfSight(path[currentIndex].x, path[currentIndex].y, path[i].x, path[i].y)) { furthestVisible = i; break; }
      }
      smoothed.push(path[furthestVisible]);
      currentIndex = furthestVisible;
    }
    return smoothed;
  }

  findPath(startX, startY, endX, endY) {
    const freeEnd = this.findNearestFreePoint(endX, endY);
    endX = freeEnd.x; endY = freeEnd.y;
    startX = Math.max(0, Math.min(this.worldSize, startX)); startY = Math.max(0, Math.min(this.worldSize, startY));
    const start = this.worldToGrid(startX, startY); const end = this.worldToGrid(endX, endY);
    if (this.grid[start.y * this.cols + start.x] === 1) {
      const fs = this.findNearestFreePoint(startX, startY); const ns = this.worldToGrid(fs.x, fs.y); start.x = ns.x; start.y = ns.y;
    }
    if (start.x === end.x && start.y === end.y) return [{ x: endX, y: endY }];

    const startId = start.y * this.cols + start.x; const endId = end.y * this.cols + end.x;
    const openSet = new Set([startId]); const cameFrom = new Map(); const gScore = new Map([[startId, 0]]); const fScore = new Map([[startId, this._heuristic(start.x, start.y, end.x, end.y)]]);
    let iterations = 0; const maxIterations = this.cols * this.rows;

    while (openSet.size > 0) {
      if (++iterations > maxIterations) return [];
      let currentId = null, lowestF = Infinity;
      for (const id of openSet) { const f = fScore.get(id) ?? Infinity; if (f < lowestF) { lowestF = f; currentId = id; } }
      if (currentId === null) break;
      if (currentId === endId) return this.smoothPath(this._reconstructPath(cameFrom, currentId));
      openSet.delete(currentId);
      const cx = currentId % this.cols, cy = Math.floor(currentId / this.cols);
      const neighbors = [
        { x: cx + 1, y: cy, cost: 1 }, { x: cx - 1, y: cy, cost: 1 }, { x: cx, y: cy + 1, cost: 1 }, { x: cx, y: cy - 1, cost: 1 },
        { x: cx + 1, y: cy + 1, cost: 1.414 }, { x: cx - 1, y: cy + 1, cost: 1.414 }, { x: cx + 1, y: cy - 1, cost: 1.414 }, { x: cx - 1, y: cy - 1, cost: 1.414 }
      ];
      for (const n of neighbors) {
        if (n.x < 0 || n.x >= this.cols || n.y < 0 || n.y >= this.rows) continue;
        const nid = n.y * this.cols + n.x;
        if (this.grid[nid] === 1) continue;
        if (n.x !== cx && n.y !== cy) { if (this.grid[cy * this.cols + n.x] === 1 || this.grid[n.y * this.cols + cx] === 1) continue; }
        
        const currentHeight = this.heightMap[currentId];
        const neighborHeight = this.heightMap[nid];
        let heightCost = 1.0;
        if (neighborHeight > currentHeight) heightCost = 1.5;
        else if (neighborHeight < currentHeight) heightCost = 0.8;

        const tG = (gScore.get(currentId) ?? Infinity) + n.cost * heightCost;
        if (tG < (gScore.get(nid) ?? Infinity)) {
          cameFrom.set(nid, currentId); gScore.set(nid, tG);
          fScore.set(nid, tG + this._heuristic(n.x, n.y, end.x, end.y)); openSet.add(nid);
        }
      }
    }
    return [];
  }
  _heuristic(x1, y1, x2, y2) { const dx = Math.abs(x1 - x2), dy = Math.abs(y1 - y2); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); }
  _reconstructPath(cameFrom, currentId) {
    const path = []; let safety = 0;
    while (cameFrom.has(currentId)) {
      if (++safety > this.cols * this.rows) break;
      const gx = currentId % this.cols, gy = Math.floor(currentId / this.cols);
      path.push(this.gridToWorld(gx, gy)); currentId = cameFrom.get(currentId);
    }
    path.reverse(); return path;
  }
}
