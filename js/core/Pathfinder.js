import { CONFIG } from '../data/config.js';
import { MATERIALS } from '../data/materials.js';

class MinHeap {
  constructor() {
    this.items = [];
    this.priorities = [];
  }
  push(item, priority) {
    this.items.push(item);
    this.priorities.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.priorities[p] <= this.priorities[i]) break;
      this._swap(i, p);
      i = p;
    }
  }
  pop() {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const lastItem = this.items.pop();
    const lastPriority = this.priorities.pop();
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let i = 0;
      const n = this.items.length;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let m = i;
        if (l < n && this.priorities[l] < this.priorities[m]) m = l;
        if (r < n && this.priorities[r] < this.priorities[m]) m = r;
        if (m === i) break;
        this._swap(i, m);
        i = m;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
  _swap(a, b) {
    const ti = this.items[a]; this.items[a] = this.items[b]; this.items[b] = ti;
    const tp = this.priorities[a]; this.priorities[a] = this.priorities[b]; this.priorities[b] = tp;
  }
}

export class Pathfinder {
  constructor(worldSize, cellSize = 1) {
    this.cellSize = cellSize;
    this.worldSize = worldSize;
    this.cols = Math.max(1, Math.ceil(worldSize / cellSize));
    this.rows = this.cols;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.obstacles = [];
    this.heightMap = new Float32Array(this.cols * this.rows);
    this.floorMap = new Uint8Array(this.cols * this.rows);
    this._gridVersion = 0;
  }

  setWorldSize(worldSize) {
    if (!Number.isFinite(worldSize) || worldSize <= 0) return;
    this.worldSize = worldSize;
    this.cols = Math.max(1, Math.ceil(worldSize / this.cellSize));
    this.rows = this.cols;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.obstacles = [];
    this.heightMap = new Float32Array(this.cols * this.rows);
    this.floorMap = new Uint8Array(this.cols * this.rows);
    this._gridVersion++;
  }

  setHeight(worldX, worldY, height) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY) || !Number.isFinite(height)) return;
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      this.heightMap[g.y * this.cols + g.x] = height;
      this._gridVersion++;
    }
  }

  getHeight(worldX, worldY) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return 0;
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      return this.heightMap[g.y * this.cols + g.x];
    }
    return 0;
  }

  setFloor(worldX, worldY, floor) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      this.floorMap[g.y * this.cols + g.x] = floor;
    }
  }

  getFloor(worldX, worldY) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return 0;
    const g = this.worldToGrid(worldX, worldY);
    if (g.x >= 0 && g.x < this.cols && g.y >= 0 && g.y < this.rows) {
      return this.floorMap[g.y * this.cols + g.x];
    }
    return 0;
  }

  createCrater(worldX, worldY, radius, depth) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY) || !Number.isFinite(radius) || !Number.isFinite(depth)) return;
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
    this._gridVersion++;
  }

  generateTerrain() {
    const center = this.cols / 2;
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const dx = gx - center, dy = gy - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let height = 0;
        if (dist < this.cols * 0.2) height = (1 - dist / (this.cols * 0.2)) * 3;
        this.heightMap[gy * this.cols + gx] = Math.max(-2, Math.round(height * 10) / 10);
      }
    }
    this._gridVersion++;
  }

  addMultiFloorBuilding(x, y, w, h, floors = 2) {
    for (let f = 0; f < floors; f++) {
      for (let sy = 0; sy < h; sy += 1) {
        for (let sx = 0; sx < w; sx += 1) {
          const isWall = (sx === 0 || sx === w - 1 || sy === 0 || sy === h - 1);
          if (isWall) {
            this.setFloor(x + sx, y + sy, f);
            this.setHeight(x + sx, y + sy, f * 3.0);
          } else if (f === 0) {
            this.setFloor(x + sx, y + sy, 0);
          }
        }
      }
    }
    const stairX = x + Math.floor(w / 2);
    const stairY = y + Math.floor(h / 2);
    for (let f = 0; f < floors; f++) this.setFloor(stairX, stairY, f);
    for (let sy = 1; sy < h - 1; sy += 2) {
      this.setFloor(x, y + sy, 1);
      this.setFloor(x + w - 1, y + sy, 1);
    }
  }

  addObstacle(x, y, w, h, materialId = 'concrete') {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;
    const matData = MATERIALS[materialId] || MATERIALS.concrete;
    const segments = [];
    const segSize = 1.0;
    for (let sy = 0; sy < h; sy += segSize) {
      for (let sx = 0; sx < w; sx += segSize) {
        const sw = Math.min(segSize, w - sx);
        const sh = Math.min(segSize, h - sy);
        segments.push({ x: x + sx, y: y + sy, w: sw, h: sh, hp: 100, maxHp: 100, state: 'intact' });
      }
    }
    const obs = {
      x, y, w, h, materialId, matData, segments,
      state: 'intact',
      height: matData.height || 2.0,
      maxHeight: matData.height || 2.0
    };
    this.obstacles.push(obs);
    // Полный пересчёт — разово при добавлении
    this._updateGrid();
  }

  removeObstacle(obs) {
    const idx = this.obstacles.indexOf(obs);
    if (idx >= 0) {
      this.obstacles.splice(idx, 1);
      this._updateGrid();
    }
  }

  damageSegment(obs, segX, segY, damage) {
    const seg = obs.segments.find(s => segX >= s.x && segX <= s.x + s.w && segY >= s.y && segY <= s.y + s.h);
    if (!seg) return;
    const oldState = seg.state;

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
      this._gridVersion++;
    }

    // FIX: инкрементально, только если состояние изменилось
    if (oldState !== seg.state) {
      this._updateGridForSegment(seg);
    }
  }

  // Полный пересчёт сетки (только при addObstacle / removeObstacle / clearObstacles)
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
    this._gridVersion++;
  }

  // Инкрементальное обновление одного сегмента
  _updateGridForSegment(seg) {
    const padding = CONFIG.PHYSICS.PATHFINDER_PADDING;
    const start = this.worldToGrid(seg.x - padding, seg.y - padding);
    const end = this.worldToGrid(seg.x + seg.w + padding, seg.y + seg.h + padding);
    const value = (seg.state === 'rubble') ? 0 : 1;

    for (let gy = start.y; gy <= end.y; gy++) {
      for (let gx = start.x; gx <= end.x; gx++) {
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
          this.grid[gy * this.cols + gx] = value;
        }
      }
    }
  }

  clearObstacles() {
    this.grid.fill(0);
    this.obstacles = [];
    this._gridVersion++;
  }

  worldToGrid(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize))),
      y: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)))
    };
  }

  gridToWorld(gx, gy) {
    return { x: gx * this.cellSize + this.cellSize / 2, y: gy * this.cellSize + this.cellSize / 2 };
  }

  findNearestFreePoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    const g = this.worldToGrid(x, y);
    if (this.grid[g.y * this.cols + g.x] === 0) return { x, y };
    for (let r = 1; r < 30; r++) {
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
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return false;
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
        if (this.hasLineOfSight(path[currentIndex].x, path[currentIndex].y, path[i].x, path[i].y)) {
          furthestVisible = i;
          break;
        }
      }
      smoothed.push(path[furthestVisible]);
      currentIndex = furthestVisible;
    }
    return smoothed;
  }

  findPath(startX, startY, endX, endY) {
    if (!Number.isFinite(startX) || !Number.isFinite(startY) ||
        !Number.isFinite(endX) || !Number.isFinite(endY)) {
      return [];
    }

    const freeEnd = this.findNearestFreePoint(endX, endY);
    endX = freeEnd.x; endY = freeEnd.y;
    startX = Math.max(0, Math.min(this.worldSize, startX));
    startY = Math.max(0, Math.min(this.worldSize, startY));

    const start = this.worldToGrid(startX, startY);
    const end = this.worldToGrid(endX, endY);

    if (this.grid[start.y * this.cols + start.x] === 1) {
      const fs = this.findNearestFreePoint(startX, startY);
      const ns = this.worldToGrid(fs.x, fs.y);
      start.x = ns.x; start.y = ns.y;
    }
    if (start.x === end.x && start.y === end.y) return [{ x: endX, y: endY }];

    const startId = start.y * this.cols + start.x;
    const endId = end.y * this.cols + end.x;

    const openHeap = new MinHeap();
    const closed = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startId, 0);
    fScore.set(startId, this._heuristic(start.x, start.y, end.x, end.y));
    openHeap.push(startId, fScore.get(startId));

    let iterations = 0;
    const maxIterations = this.cols * this.rows;

    while (openHeap.size > 0) {
      if (++iterations > maxIterations) return [];
      const currentId = openHeap.pop();
      if (currentId === undefined) break;
      if (closed.has(currentId)) continue;
      if (currentId === endId) {
        return this.smoothPath(this._reconstructPath(cameFrom, currentId));
      }
      closed.add(currentId);

      const cx = currentId % this.cols;
      const cy = (currentId / this.cols) | 0;

      const neighbors = [
        { x: cx + 1, y: cy, cost: 1 },
        { x: cx - 1, y: cy, cost: 1 },
        { x: cx, y: cy + 1, cost: 1 },
        { x: cx, y: cy - 1, cost: 1 },
        { x: cx + 1, y: cy + 1, cost: 1.414 },
        { x: cx - 1, y: cy + 1, cost: 1.414 },
        { x: cx + 1, y: cy - 1, cost: 1.414 },
        { x: cx - 1, y: cy - 1, cost: 1.414 }
      ];

      for (const n of neighbors) {
        if (n.x < 0 || n.x >= this.cols || n.y < 0 || n.y >= this.rows) continue;
        const nid = n.y * this.cols + n.x;
        if (this.grid[nid] === 1) continue;
        if (closed.has(nid)) continue;
        if (n.x !== cx && n.y !== cy) {
          if (this.grid[cy * this.cols + n.x] === 1 || this.grid[n.y * this.cols + cx] === 1) continue;
        }

        const currentHeight = this.heightMap[currentId];
        const neighborHeight = this.heightMap[nid];
        let heightCost = 1.0;
        if (neighborHeight > currentHeight) heightCost = 1.5;
        else if (neighborHeight < currentHeight) heightCost = 0.8;

        const tG = (gScore.get(currentId) ?? Infinity) + n.cost * heightCost;
        if (tG < (gScore.get(nid) ?? Infinity)) {
          cameFrom.set(nid, currentId);
          gScore.set(nid, tG);
          const f = tG + this._heuristic(n.x, n.y, end.x, end.y);
          fScore.set(nid, f);
          openHeap.push(nid, f);
        }
      }
    }
    return [];
  }

  _heuristic(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2), dy = Math.abs(y1 - y2);
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
  }

  _reconstructPath(cameFrom, currentId) {
    const path = [];
    let safety = 0;
    while (cameFrom.has(currentId)) {
      if (++safety > this.cols * this.rows) break;
      const gx = currentId % this.cols;
      const gy = (currentId / this.cols) | 0;
      path.push(this.gridToWorld(gx, gy));
      currentId = cameFrom.get(currentId);
    }
    path.reverse();
    return path;
  }
}
