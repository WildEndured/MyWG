// js/core/Pathfinder.js

export class Pathfinder {
  constructor(worldSize, cellSize = 5) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = Math.ceil(worldSize / cellSize);
    
    // Сетка проходимости: 0 - можно ходить, 1 - препятствие
    // Пока пустая (все нули). Позже сюда добавим стены и камни.
    this.grid = new Uint8Array(this.cols * this.rows);
  }

  setWorldSize(worldSize) {
    this.worldSize = worldSize;
    this.cols = Math.ceil(worldSize / this.cellSize);
    this.rows = Math.ceil(worldSize / this.cellSize);
    this.grid = new Uint8Array(this.cols * this.rows);
  }

  // Перевод мировых координат (метры) в индексы сетки
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

  // Главный метод: поиск пути
  findPath(startX, startY, endX, endY) {
    const start = this.worldToGrid(startX, startY);
    const end = this.worldToGrid(endX, endY);

    // Если старт и финиш в одной клетке — возвращаем прямую
    if (start.x === end.x && start.y === end.y) {
      return [{ x: endX, y: endY }];
    }

    // Алгоритм A*
    const openSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startId = start.y * this.cols + start.x;
    const endId = end.y * this.cols + end.x;

    openSet.add(startId);
    gScore.set(startId, 0);
    fScore.set(startId, this._heuristic(start.x, start.y, end.x, end.y));

    while (openSet.size > 0) {
      // Ищем узел с наименьшим fScore
      let currentId = null;
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentId = id;
        }
      }

      if (currentId === endId) {
        return this._reconstructPath(cameFrom, currentId);
      }

      openSet.delete(currentId);
      const cx = currentId % this.cols;
      const cy = Math.floor(currentId / this.cols);

      // Проверяем 8 соседей (включая диагонали)
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
        // Проверка выхода за границы
        if (n.x < 0 || n.x >= this.cols || n.y < 0 || n.y >= this.rows) continue;
        
        const neighborId = n.y * this.cols + n.x;
        
        // Проверка препятствий
        if (this.grid[neighborId] === 1) continue;

        const tentativeG = (gScore.get(currentId) || 0) + n.cost;

        if (tentativeG < (gScore.get(neighborId) || Infinity)) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + this._heuristic(n.x, n.y, end.x, end.y));
          openSet.add(neighborId);
        }
      }
    }

    // Путь не найден (возвращаем прямую, если застряли)
    return [{ x: endX, y: endY }];
  }

  _heuristic(x1, y1, x2, y2) {
    // Дистанция Чебышева (для 8 направлений)
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
  }

  _reconstructPath(cameFrom, currentId) {
    const path = [];
    while (cameFrom.has(currentId)) {
      const gx = currentId % this.cols;
      const gy = Math.floor(currentId / this.cols);
      path.push(this.gridToWorld(gx, gy));
      currentId = cameFrom.get(currentId);
    }
    path.reverse();
    return path;
  }
}
