// js/core/Pathfinder.js

export class Pathfinder {
  constructor(worldSize, cellSize = 5) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = Math.ceil(worldSize / cellSize);
    
    // Сетка проходимости: 0 - можно, 1 - нельзя
    this.grid = new Uint8Array(this.cols * this.rows);
  }

  setWorldSize(worldSize) {
    this.worldSize = worldSize;
    this.cols = Math.ceil(worldSize / this.cellSize);
    this.rows = Math.ceil(worldSize / this.cellSize);
    this.grid = new Uint8Array(this.cols * this.rows);
  }

  // Перевод мировых координат в индексы сетки
  worldToGrid(x, y) {
    return {
      x: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize))),
      y: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)))
    };
  }

  // Перевод индексов сетки в мировые координаты (центр клетки)
  gridToWorld(gx, gy) {
    return {
      x: gx * this.cellSize + this.cellSize / 2,
      y: gy * this.cellSize + this.cellSize / 2
    };
  }

  findPath(startX, startY, endX, endY) {
    // Защита: ограничиваем координаты границами карты
    startX = Math.max(0, Math.min(this.worldSize, startX));
    startY = Math.max(0, Math.min(this.worldSize, startY));
    endX = Math.max(0, Math.min(this.worldSize, endX));
    endY = Math.max(0, Math.min(this.worldSize, endY));

    const start = this.worldToGrid(startX, startY);
    const end = this.worldToGrid(endX, endY);

    // Если старт и финиш в одной клетке — просто идем напрямую
    if (start.x === end.x && start.y === end.y) {
      return [{ x: endX, y: endY }];
    }

    const startId = start.y * this.cols + start.x;
    const endId = end.y * this.cols + end.x;

    // ЗАЩИТА 1: если финиш в препятствии — возвращаем прямую
    if (this.grid[endId] === 1) {
      return [{ x: endX, y: endY }];
    }

    // Массивы для A*
    const openSet = new Set([startId]);
    const cameFrom = new Map();
    const gScore = new Map([[startId, 0]]);
    const fScore = new Map([[startId, this._heuristic(start.x, start.y, end.x, end.y)]]);

    // ЗАЩИТА 2: лимит итераций (чтобы не зависло)
    const maxIterations = this.cols * this.rows;
    let iterations = 0;

    while (openSet.size > 0) {
      iterations++;
      if (iterations > maxIterations) {
        console.warn('[Pathfinder] Превышен лимит итераций, возвращаем прямую');
        return [{ x: endX, y: endY }];
      }

      // Ищем узел с минимальным fScore
      let currentId = null;
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentId = id;
        }
      }

      if (currentId === null) break;

      if (currentId === endId) {
        return this._reconstructPath(cameFrom, currentId);
      }

      openSet.delete(currentId);
      const cx = currentId % this.cols;
      const cy = Math.floor(currentId / this.cols);

      // 8 соседей
      const neighbors = [
        { x: cx + 1, y: cy, cost: 1 },
        { x: cx - 1, y: cy, cost: 1 },
        { x: cx, y: cy + 1, cost: 1 },
        { x: cx, y: cy - 1, cost: 1 },
        { x: cx + 1, y: cy + 1, cost: 1.414 },
        { x: cx - 1, y: cy + 1, cost: 1.414 },
        { x: cx + 1, y: cy - 1, cost: 1.414 },
        { x: cx - 1, y: cy - 1, cost: 1.414 },
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

    // Путь не найден — идем по прямой (лучше, чем ничего)
    return [{ x: endX, y: endY }];
  }

  _heuristic(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    // Октальная дистанция
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
  }

  _reconstructPath(cameFrom, currentId) {
    const path = [];
    let safety = 0;
    const maxSteps = this.cols * this.rows;
    
    while (cameFrom.has(currentId)) {
      safety++;
      if (safety > maxSteps) {
        console.warn('[Pathfinder] Цикл в reconstructPath!');
        break;
      }
      const gx = currentId % this.cols;
      const gy = Math.floor(currentId / this.cols);
      path.push(this.gridToWorld(gx, gy));
      currentId = cameFrom.get(currentId);
    }
    path.reverse();
    
    // Если путь пустой — вернуть хотя бы конечную точку
    return path.length > 0 ? path : [];
  }
}
