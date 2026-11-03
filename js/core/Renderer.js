import { CONFIG } from '../data/config.js';

export class Renderer {
  static draw(ctx, camera, map, unitManager) {
    const dpr = camera.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    Renderer.drawMap(ctx, camera, map);
    Renderer.drawDecals(ctx, camera, unitManager.decals);
    Renderer.drawObstacles(ctx, camera, unitManager.pathfinder.obstacles);
    Renderer.drawPaths(ctx, camera, unitManager.selectedUnits);

    const sortedUnits = [...unitManager.units].sort((a, b) => a.y - b.y);
    for (const unit of sortedUnits) {
      if (camera.isPointVisible(unit.x, unit.y, 200)) {
        Renderer.drawUnit(ctx, camera, unit);
      }
    }

    Renderer.drawBullets(ctx, camera, unitManager.bullets);
    Renderer.drawEffects(ctx, camera, unitManager.tracers, unitManager.flashes);
  }

  static drawMap(ctx, camera, map) {
    const c = CONFIG.COLORS;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, camera.vw, camera.vh);

    const tl = camera.worldToScreen(0, 0);
    const br = camera.worldToScreen(map.size, map.size);

    ctx.fillStyle = c.mapFill;
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    const wTL = camera.screenToWorld(0, 0);
    const wBR = camera.screenToWorld(camera.vw, camera.vh);
    const x0 = Math.max(0, wTL.x), y0 = Math.max(0, wTL.y);
    const x1 = Math.min(map.size, wBR.x), y1 = Math.min(map.size, wBR.y);

    if (x1 > x0 && y1 > y0) {
      if (map.cellSize * camera.zoom >= 15) {
        this._drawGrid(ctx, camera, x0, y0, x1, y1, map.cellSize, c.gridMinor);
      }
      if (map.majorStep * camera.zoom >= 10) {
        this._drawGrid(ctx, camera, x0, y0, x1, y1, map.majorStep, c.gridMajor);
      }
    }

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  static _drawGrid(ctx, camera, x0, y0, x1, y1, step, color) {
    if (!(step > 0)) return;
    const y0s = camera.worldToScreen(0, y0).y;
    const y1s = camera.worldToScreen(0, y1).y;
    const x0s = camera.worldToScreen(x0, 0).x;
    const x1s = camera.worldToScreen(x1, 0).x;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const startX = Math.floor(x0 / step) * step;
    for (let x = startX; x <= x1 + 1e-6; x += step) {
      const px = Math.round(camera.worldToScreen(x, 0).x) + 0.5;
      ctx.moveTo(px, y0s); ctx.lineTo(px, y1s);
    }
    
    const startY = Math.floor(y0 / step) * step;
    for (let y = startY; y <= y1 + 1e-6; y += step) {
      const py = Math.round(camera.worldToScreen(0, y).y) + 0.5;
      ctx.moveTo(x0s, py); ctx.lineTo(x1s, py);
    }
    ctx.stroke();
  }

  static drawDecals(ctx, camera, decals) {
    for (const d of decals) {
      if (!camera.isPointVisible(d.x, d.y, 50)) continue;
      const p = camera.worldToScreen(d.x, d.y);
      const r = d.r * camera.zoom;
      const fade = Math.min(1, Math.max(0, (d.ttl - d.age) / 3));
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120, 10, 10, ${d.alpha * fade})`; ctx.fill();
    }
  }

  static drawObstacles(ctx, camera, obstacles) {
    ctx.lineWidth = 1;
    const colorMap = { wood: '#8B5A2B', sandbags: '#C2B280', concrete: '#777', steel: '#889', brick: '#a55' };
    for (const obs of obstacles) {
      if (!camera.isPointVisible(obs.x + obs.w/2, obs.y + obs.h/2, 500)) continue;
      const tl = camera.worldToScreen(obs.x, obs.y);
      const br = camera.worldToScreen(obs.x + obs.w, obs.y + obs.h);
      ctx.fillStyle = colorMap[obs.materialId] || '#555';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeStyle = '#000'; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }
  }

  static drawPaths(ctx, camera, selectedUnits) {
    for (const unit of selectedUnits) {
      if (unit.isDead || !unit.isMoving || unit.path.length === 0) continue;
      const start = camera.worldToScreen(unit.x, unit.y);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = unit.pathIndex; i < unit.path.length; i++) {
        const p = camera.worldToScreen(unit.path[i].x, unit.path[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(244, 180, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  static drawUnit(ctx, camera, unit) {
    const screenPos = camera.worldToScreen(unit.x, unit.y);
    const color = unit.isDead ? '#444' : (unit.faction === 'player' ? '#4285F4' : '#EA4335');
    let visualStance = unit.stance;
    if (unit.stanceTransition) {
      const t = unit.stanceTransitionProgress;
      visualStance = t < 0.5 ? unit.stanceTransition.from : unit.stanceTransition.to;
    }

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(unit.angle);

    if (visualStance === 'prone' || unit.isUnconscious) {
      const bodyLength = 1.6 * camera.zoom;
      const bodyWidth  = 0.5 * camera.zoom;
      ctx.beginPath(); ctx.ellipse(0.2 * camera.zoom, 0, Math.max(3, bodyLength / 2), Math.max(2, bodyWidth / 2), 0, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
      const headR = Math.max(2, 0.1 * camera.zoom);
      ctx.beginPath(); ctx.arc(0.2 * camera.zoom + bodyLength / 2 * 0.7, 0, headR, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    } else {
      const crouchScale = visualStance === 'crouch' ? 0.8 : 1.0;
      const r = Math.max(3, unit.baseRadius * camera.zoom * crouchScale);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
      if (r > 5 && visualStance !== 'crouch') {
        ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      }
    }
    ctx.restore();

    if (unit.isSelected && !unit.isDead) {
      ctx.beginPath();
      const ringR = (unit.stance === 'prone' || unit.isUnconscious) ? Math.max(3, 0.8 * camera.zoom) : Math.max(3, unit.baseRadius * camera.zoom);
      ctx.arc(screenPos.x, screenPos.y, ringR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#F4B400'; ctx.lineWidth = 2; ctx.stroke();
    }

    if (!unit.isDead && (unit.hp < unit.maxHp || unit.stamina < unit.maxStamina || unit.weapon.isReloading)) {
      const barW = Math.max(20, unit.baseRadius * camera.zoom * 2);
      const barH = 3;
      const barX = screenPos.x - barW / 2;
      let y = screenPos.y - (unit.baseRadius * camera.zoom) - 12;

      if (unit.hp < unit.maxHp) {
        ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH);
        ctx.fillStyle = unit.hp > unit.maxHp * 0.5 ? '#0F9D58' : '#EA4335';
        ctx.fillRect(barX, y, barW * (unit.hp / unit.maxHp), barH); y -= barH + 2;
      }
      if (unit.stamina < unit.maxStamina) {
        ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH);
        ctx.fillStyle = unit.stamina > 20 ? '#F4B400' : '#EA4335';
        ctx.fillRect(barX, y, barW * (unit.stamina / unit.maxStamina), barH); y -= barH + 2;
      }
      if (unit.weapon.isReloading) {
        ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH);
        ctx.fillStyle = '#5096ff';
        const progress = 1 - Math.max(0, Math.min(1, unit.weapon.reloadTimer / unit.weapon.reloadTime));
        ctx.fillRect(barX, y, barW * progress, barH);
      }
    }
  }

  static drawBullets(ctx, camera, bullets) {
    for (const b of bullets) {
      if (b.isDead || !camera.isPointVisible(b.x, b.y, 50)) continue;
      if (b.isTracer) {
        const p1 = camera.worldToScreen(b.prevX, b.prevY);
        const p2 = camera.worldToScreen(b.x, b.y);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = b.hasRicocheted ? '#FF00FF' : 'rgba(255, 220, 80, 0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      const p = camera.worldToScreen(b.x, b.y);
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, 1.6 * (camera.zoom / 8)), 0, Math.PI * 2);
      ctx.fillStyle = b.hasRicocheted ? '#FF00FF' : (b.isTracer ? '#FFD34D' : '#FFFF88'); ctx.fill();
    }
  }

  static drawEffects(ctx, camera, tracers, flashes) {
    ctx.lineWidth = 1.5;
    for (const t of tracers) {
      const p1 = camera.worldToScreen(t.x1, t.y1);
      const p2 = camera.worldToScreen(t.x2, t.y2);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(255, 255, 0, ${Math.max(0, t.life * 20)})`; ctx.stroke();
    }
    for (const f of flashes) {
      const p = camera.worldToScreen(f.x, f.y);
      const radius = (1.0 - f.life / 0.05) * 20;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 0, ${Math.max(0, f.life / 0.05)})`; ctx.fill();
    }
  }
}
