import { EventBus, EVENTS } from './EventBus.js';

class DebugClass {
  constructor() {
    this.isEnabled = false;
    this.showGrid = false;      // ← FIX: сетка A* выключена по умолчанию
    this.showHitboxes = true;

    this.fps = 0;
    this.frameTime = 0;
    this.frames = 0;
    this.fpsAccum = 0;

    this._timers = new Map();
    this._currentStart = new Map();
    this._maxSamples = 60;

    this._counters = new Map();
    this._countersSnapshot = new Map();

    this._onKeyDown = (e) => {
      if (e.key === '`' || e.key === 'F1') {
        this.setEnabled(!this.isEnabled);
      } else if (e.key === 'g' || e.key === 'G') {
        if (this.isEnabled) this.showGrid = !this.showGrid;
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  setEnabled(v) {
    this.isEnabled = !!v;
    EventBus.emit(EVENTS.DEBUG_TOGGLED, this.isEnabled);
  }

  start(name) {
    if (!this.isEnabled) return;
    this._currentStart.set(name, performance.now());
  }

  end(name) {
    if (!this.isEnabled) return;
    const t0 = this._currentStart.get(name);
    if (t0 === undefined) return;
    const dt = performance.now() - t0;
    this._currentStart.delete(name);

    let arr = this._timers.get(name);
    if (!arr) { arr = []; this._timers.set(name, arr); }
    arr.push(dt);
    if (arr.length > this._maxSamples) arr.shift();
  }

  count(name) {
    if (!this.isEnabled) return;
    this._counters.set(name, (this._counters.get(name) || 0) + 1);
  }

  _avg(name) {
    const arr = this._timers.get(name);
    if (!arr || arr.length === 0) return 0;
    let sum = 0;
    for (const v of arr) sum += v;
    return sum / arr.length;
  }

  update(realDt) {
    if (!this.isEnabled) { this.frames = 0; this.fpsAccum = 0; return; }
    this.frames++;
    this.fpsAccum += realDt;
    this.frameTime = realDt * 1000;
    if (this.fpsAccum >= 1.0) {
      this.fps = Math.round(this.frames / this.fpsAccum);
      this.frames = 0;
      this.fpsAccum = 0;
      this._countersSnapshot = new Map(this._counters);
      this._counters.clear();
    }
  }

  draw(ctx, camera, unitManager, map, pathfinder) {
    if (!this.isEnabled) return;

    const vw = camera.vw;
    const vh = camera.vh;

    // Сетка A* — только если включена (G)
    if (this.showGrid && pathfinder) {
      const cellSize = pathfinder.cellSize;
      const wTL = camera.screenToWorld(0, 0);
      const wBR = camera.screenToWorld(vw, vh);
      const startX = Math.max(0, Math.floor(wTL.x / cellSize));
      const endX = Math.min(pathfinder.cols, Math.ceil(wBR.x / cellSize));
      const startY = Math.max(0, Math.floor(wTL.y / cellSize));
      const endY = Math.min(pathfinder.rows, Math.ceil(wBR.y / cellSize));
      const size = cellSize * camera.zoom;

      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.beginPath();
      for (let gy = startY; gy < endY; gy++) {
        const rowBase = gy * pathfinder.cols;
        for (let gx = startX; gx < endX; gx++) {
          if (pathfinder.grid[rowBase + gx] === 1) {
            const p = camera.worldToScreen(gx * cellSize, gy * cellSize);
            ctx.rect(p.x, p.y, size, size);
          }
        }
      }
      ctx.fill();
    }

    if (unitManager) {
      const drawHitboxes = this.showHitboxes && unitManager.units.length <= 30;
      for (const unit of unitManager.units) {
        if (unit.isDead) continue;
        const p = camera.worldToScreen(unit.x, unit.y);

        if (drawHitboxes) {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
          ctx.lineWidth = 1;
          for (const [, part] of Object.entries(unit.bodyParts)) {
            if (!part.hitbox || part.hp <= 0) continue;
            const scale = part.stanceScale[unit.stance] ?? 1;
            const cos = Math.cos(unit.angle), sin = Math.sin(unit.angle);
            const cx = unit.x + part.hitbox.dx * cos - part.hitbox.dy * sin;
            const cy = unit.y + part.hitbox.dx * sin + part.hitbox.dy * cos;
            const sp = camera.worldToScreen(cx, cy);
            const r = part.hitbox.r * scale * camera.zoom;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, Math.max(1, r), 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, unit.hitRadius * camera.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.stroke();

        if (unit.isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, unit.weapon.effectiveRange * camera.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(80, 150, 255, 0.2)';
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#0f0';
          ctx.font = '10px monospace';
          ctx.fillText(`HP: ${Math.round(unit.hp)}/${unit.maxHp}`, p.x + 10, p.y - 10);
          ctx.fillText(`Stam: ${Math.round(unit.stamina)}`, p.x + 10, p.y + 5);
          ctx.fillText(`Suppr: ${(unit.suppression * 100).toFixed(0)}%`, p.x + 10, p.y + 20);
        }
      }
    }

    // Панель
    const panelX = 10;
    const panelY = 80;
    const panelW = 250;
    const panelH = 200;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#0f0';
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#0f0';
    ctx.font = '11px monospace';

    let y = panelY + 16;
    const line = (s, color) => {
      if (color) ctx.fillStyle = color;
      ctx.fillText(s, panelX + 8, y);
      ctx.fillStyle = '#0f0';
      y += 13;
    };

    line(`FPS: ${this.fps}`);
    line(`Frame: ${this.frameTime.toFixed(2)}ms`);
    line(`update: ${this._avg('update').toFixed(2)}ms`);
    line(`draw:   ${this._avg('draw').toFixed(2)}ms`);
    line(`path:   ${this._avg('path').toFixed(2)}ms`);
    line(`collide:${this._avg('collide').toFixed(2)}ms`);
    line(`Units: ${unitManager?.units?.length ?? 0}`);
    line(`Bullets: ${unitManager?.bullets?.length ?? 0}`);
    line(`Decals: ${unitManager?.decals?.length ?? 0}`);
    line(`Grid: ${this.showGrid ? 'ON (G)' : 'OFF (G)'}`, this.showGrid ? '#F4B400' : '#8ab4f8');

    ctx.fillStyle = '#F4B400';
    line(`path calls: ${this._countersSnapshot.get('pathfinderCalls') || 0}/s`);
    line(`grid upd:   ${this._countersSnapshot.get('gridUpdates') || 0}/s`);
    line(`los calls:  ${this._countersSnapshot.get('losCalls') || 0}/s`);
  }
}

export const Debug = new DebugClass();
