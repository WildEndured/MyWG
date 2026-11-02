// js/core/Pathfinder.js

export class Pathfinder {
  constructor(worldSize, cellSize = 1) {
    this.cellSize = cellSize;
    this.worldSize = worldSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = Math.ceil(worldSize / cellSize);
    this.grid = new Uint8Array(this.cols * this.rows);
    this.obstacles = [];
  }

  setWorldSize(worldSize) {
    this.worldSize = worldSize;
    this.cols = Math.ceil(worldSize / this.cellSize);
    this.rows = Math.ceil(worldSize / this.cellSize);
    this.grid = new Uint8Array(this.cols * this.rows);
    this.obstacles = [];
  }

  addObstacle(x, y, w, h) {
    this.obstacles.push({ x, y, w, h });
    
    // PADDING 0.3 метра — A* будет огибать стены, оставляя зазор
    const padding = 0.3; 
    
    const start = this.worldToGrid(x - padding, y - padding);
    const end = this.worldToGrid(x + w + padding, y + h + padding);

    for (let gy = start.y; gy <= end.y; gy++) {
      for (let gx = start.x; gx <= end.x; gx++) {
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
          this.grid[gy * this.cols + gx] = 1;
        }
      }
    }
  }

  clearObstacles() {
    this.grid.fill(0);
    this.obstacles = [];
  }

  worldToGrid(x, y) {
    return {
      x: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize))),
      y: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)))
    };
  }

  gridToWorld(gx, gy) {
    return {
      x: gx * this.cellSize + this.cellSize / 2,
      y: gy * this.cellSize + this.cellSize / 2
    };
  }

  findNearestFreePoint(x, y) {
    let g = this.worldToGrid(x, y);
    if (this.grid[g.y * this.cols + g.x] === 0) return { x, y };

    for (let r = 1; r < 30; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = g.x + dx;
          const ny = g.y + dy;
          if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
            if (this.grid[ny * this.cols + nx] === 0) {
              return this.gridToWorld(nx, ny);
            }
          }
        }
      }
    }
    return { x, y };
  }

  hasLineOfSight(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / 0.2);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
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
    const freeEnd = this.findNearestFreePoint(endX, endY);
    endX = freeEnd.x;
    endY = freeEnd.y;

    startX = Math.max(0, Math.min(this.worldSize, startX));
    startY = Math.max(0, Math.min(this.worldSize, startY));
    endX = Math.max(0, Math.min(this.worldSize, endX));
    endY = Math.max(0, Math.min(this.worldSize, endY));

    const start = this.worldToGrid(startX, startY);
    const end = this.worldToGrid(endX, endY);

    if (start.x === end.x && start.y === end.y) {
      return [{ x: endX, y: endY }];
    }

    const startId = start.y * this.cols + start.x;
    const endId = end.y * this.cols + end.x;

    const openSet = new Set([startId]);
    const cameFrom = new Map();
    const gScore = new Map([[startId, 0]]);
    const fScore = new Map([[startId, this._heuristic(start.x, start.y, end.x, end.y)]]);

    const maxIterations = this.cols * this.rows;
    let iterations = 0;

    while (openSet.size > 0) {
      iterations++;
      if (iterations > maxIterations) return [{ x: endX, y: endY }];

      let currentId = null;
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < lowestF) { lowestF = f; currentId = id; }
      }

      if (currentId === null) break;
      if (currentId === endId) {
        const rawPath = this._reconstructPath(cameFrom, currentId);
        return this.smoothPath(rawPath);
      }

      openSet.delete(currentId);
      const cx = currentId % this.cols;
      const cy = Math.floor(currentId / this.cols);

      const neighbors = [
        { x: cx + 1, y: cy, cost: 1 }, { x: cx - 1, y: cy, cost: 1 },
        { x: cx, y: cy + 1, cost: 1 }, { x: cx, y: cy - 1, cost: 1 },
        { x: cx + 1, y: cy + 1, cost: 1.414 }, { x: cx - 1, y: cy + 1, cost: 1.414 },
        { x: cx + 1, y: cy - 1, cost: 1.414 }, { x: cx - 1, y: cy - 1, cost: 1.414 },
      ];

      for (const n of neighbors) {
        if (n.x < 0 || n.x >= this.cols || n.y < 0 || n.y >= this.rows) continue;
        const neighborId = n.y * this.cols + n.x;
        if (this.grid[neighborId] === 1) continue;

        const tentativeG = (gScore.get(currentId) ?? Infinity) + n.cost;
        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + this._heuristic(n.x, n.y, end.x, end.y));
          openSet.add(neighborId);
        }
      }
    }
    return [{ x: endX, y: endY }];
  }

  _heuristic(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
  }

  _reconstructPath(cameFrom, currentId) {
    const path = [];
    let safety = 0;
    while (cameFrom.has(currentId)) {
      safety++;
      if (safety > this.cols * this.rows) break;
      const gx = currentId % this.cols;
      const gy = Math.floor(currentId / this.cols);
      path.push(this.gridToWorld(gx, gy));
      currentId = cameFrom.get(currentId);
    }
    path.reverse();
    return path;
  }
}
