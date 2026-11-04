import { CONFIG } from '../data/config.js';

export class Renderer {
  static draw(ctx, camera, map, unitManager) {
    const dpr = camera.dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    map.draw(ctx); // Карта с высотами
    
    Renderer.drawDecals(ctx, camera, unitManager.decals);
    Renderer.drawShells(ctx, camera, unitManager.shells);
    Renderer.drawObstacles(ctx, camera, unitManager.pathfinder.obstacles);
    
    if (unitManager.captureZone) Renderer.drawZone(ctx, camera, unitManager.captureZone);

    Renderer.drawPaths(ctx, camera, unitManager.selectedUnits);

    const sortedUnits = [...unitManager.units].sort((a, b) => a.y - b.y);
    for (const unit of sortedUnits) if (camera.isPointVisible(unit.x, unit.y, 200)) Renderer.drawUnit(ctx, camera, unit);

    Renderer.drawTracers(ctx, camera, unitManager.tracerTrails);
    Renderer.drawBullets(ctx, camera, unitManager.bullets);
    Renderer.drawEffects(ctx, camera, unitManager.flashes);
    Renderer.drawGrenades(ctx, camera, unitManager.grenades);
    Renderer.drawExplosions(ctx, camera, unitManager.explosions);
    Renderer.drawFragments(ctx, camera, unitManager.fragments);
    Renderer.drawDebris(ctx, camera, unitManager.debris);
    Renderer.drawDust(ctx, camera, unitManager.dust);
  }

  static drawZone(ctx, camera, zone) {
    const p = camera.worldToScreen(zone.x, zone.y);
    const r = zone.radius * camera.zoom;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = zone.owner === 'player' ? 'rgba(66, 133, 244, 0.15)' : 'rgba(234, 67, 53, 0.15)'; ctx.fill();
    ctx.strokeStyle = zone.owner === 'player' ? 'rgba(66, 133, 244, 0.8)' : 'rgba(234, 67, 53, 0.8)';
    ctx.lineWidth = 2; ctx.setLineDash([10, 5]); ctx.stroke(); ctx.setLineDash([]);
    if (zone.captureProgress > 0) {
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2) * (zone.captureProgress / 100));
      ctx.strokeStyle = '#F4B400'; ctx.lineWidth = 4; ctx.stroke();
    }
  }

  static drawDecals(ctx, camera, decals) {
    for (const d of decals) { 
      if (!camera.isPointVisible(d.x, d.y, 50)) continue; 
      const p = camera.worldToScreen(d.x, d.y); 
      const r = d.r * camera.zoom; 
      const fade = Math.min(1, Math.max(0, (d.ttl - d.age) / 3)); 
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2); 
      ctx.fillStyle = `rgba(120, 10, 10, ${d.alpha * fade})`; 
      ctx.fill(); 
    }
  }

  static drawShells(ctx, camera, shells) {
    if (!shells) return;
    for (const s of shells) {
      if (!camera.isPointVisible(s.x, s.y, 20)) continue;
      const p = camera.worldToScreen(s.x, s.y);
      ctx.fillStyle = '#C2B280';
      ctx.fillRect(p.x, p.y, Math.max(1, 2 * camera.zoom / 8), Math.max(1, 1 * camera.zoom / 8));
    }
  }

  static drawObstacles(ctx, camera, obstacles) {
    ctx.lineWidth = 1; 
    const colorMap = { wood: '#8B5A2B', sandbags: '#C2B280', concrete: '#777', steel: '#889', brick: '#a55', aluminum: '#ccc' };
    
    for (const obs of obstacles) {
      for (const seg of obs.segments) {
        if (seg.state === 'rubble') {
          const tl = camera.worldToScreen(seg.x, seg.y);
          const br = camera.worldToScreen(seg.x + seg.w, seg.y + seg.h);
          ctx.fillStyle = '#444'; ctx.fillRect(tl.x, tl.y, (br.x - tl.x) * 0.8, (br.y - tl.y) * 0.5);
          continue;
        }
        
        const tl = camera.worldToScreen(seg.x, seg.y);
        const br = camera.worldToScreen(seg.x + seg.w, seg.y + seg.h);
        
        let color = colorMap[obs.materialId] || '#555';
        if (seg.state === 'damaged') color = color === '#8B5A2B' ? '#6B4A1B' : '#555';
        if (seg.state === 'breached') color = color === '#8B5A2B' ? '#4B3A0B' : '#333';

        let drawH = br.y - tl.y;
        if (obs.matData.destructionType === 'collapse') drawH *= (obs.height / obs.maxHeight);

        ctx.fillStyle = color; 
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, drawH);
        ctx.strokeStyle = '#000'; 
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, drawH);
      }
    }
  }

  static drawPaths(ctx, camera, selectedUnits) {
    for (const unit of selectedUnits) {
      if (unit.isDead || !unit.isMoving || unit.path.length === 0) continue;
      const start = camera.worldToScreen(unit.x, unit.y); ctx.beginPath(); ctx.moveTo(start.x, start.y);
      for (let i = unit.pathIndex; i < unit.path.length; i++) { const p = camera.worldToScreen(unit.path[i].x, unit.path[i].y); ctx.lineTo(p.x, p.y); }
      ctx.strokeStyle = 'rgba(244, 180, 0, 0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  static drawUnit(ctx, camera, unit) {
    const screenPos = camera.worldToScreen(unit.x, unit.y); const color = unit.isDead ? '#444' : (unit.faction === 'player' ? '#4285F4' : '#EA4335');
    let visualStance = unit.stance; if (unit.stanceTransition) { const t = unit.stanceTransitionProgress; visualStance = t < 0.5 ? unit.stanceTransition.from : unit.stanceTransition.to; }

    ctx.save(); ctx.translate(screenPos.x, screenPos.y); ctx.rotate(unit.angle);
    
    if (unit.isSurrendered) {
      ctx.beginPath(); ctx.arc(0, 0, Math.max(3, unit.baseRadius * camera.zoom), 0, Math.PI * 2); 
      ctx.fillStyle = '#FFF'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    } else if (visualStance === 'prone' || unit.isUnconscious) {
      const bodyLength = 1.6 * camera.zoom; const bodyWidth = 0.5 * camera.zoom;
      ctx.beginPath(); ctx.ellipse(0.2 * camera.zoom, 0, Math.max(3, bodyLength / 2), Math.max(2, bodyWidth / 2), 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
      const headR = Math.max(2, 0.1 * camera.zoom); ctx.beginPath(); ctx.arc(0.2 * camera.zoom + bodyLength / 2 * 0.7, 0, headR, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    } else {
      const crouchScale = visualStance === 'crouch' ? 0.8 : 1.0; const r = Math.max(3, unit.baseRadius * camera.zoom * crouchScale);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
      if (r > 5 && visualStance !== 'crouch') { ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
    }
    ctx.restore();

    if (unit.isSelected && !unit.isDead) {
      ctx.beginPath(); const ringR = (unit.stance === 'prone' || unit.isUnconscious) ? Math.max(3, 0.8 * camera.zoom) : Math.max(3, unit.baseRadius * camera.zoom);
      ctx.arc(screenPos.x, screenPos.y, ringR + 4, 0, Math.PI * 2); ctx.strokeStyle = '#F4B400'; ctx.lineWidth = 2; ctx.stroke();
    }

    if (!unit.isDead) {
      const barW = Math.max(20, unit.baseRadius * camera.zoom * 2); const barH = 3; const barX = screenPos.x - barW / 2; let y = screenPos.y - (unit.baseRadius * camera.zoom) - 12;

      if (unit.hp < unit.maxHp) { ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH); ctx.fillStyle = unit.hp > unit.maxHp * 0.5 ? '#0F9D58' : '#EA4335'; ctx.fillRect(barX, y, barW * (unit.hp / unit.maxHp), barH); y -= barH + 2; }
      if (unit.stamina < unit.maxStamina) { ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH); ctx.fillStyle = unit.stamina > 20 ? '#F4B400' : '#EA4335'; ctx.fillRect(barX, y, barW * (unit.stamina / unit.maxStamina), barH); y -= barH + 2; }
      if (unit.weapon.isReloading) { ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH); ctx.fillStyle = '#5096ff'; const progress = 1 - Math.max(0, Math.min(1, unit.weapon.reloadTimer / unit.weapon.reloadTime)); ctx.fillRect(barX, y, barW * progress, barH); }
      
      if (unit.shock > 0.1) { y -= barH + 2; ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH); ctx.fillStyle = '#FF00FF'; ctx.fillRect(barX, y, barW * Math.min(1, unit.shock), barH); }
      if (unit.medical.isApplying) { y -= barH + 2; ctx.fillStyle = '#333'; ctx.fillRect(barX, y, barW, barH); ctx.fillStyle = '#FFF'; ctx.fillRect(barX, y, barW * (1 - unit.medical.applyTimer / (unit.medical.applyType === 'bandage' ? CONFIG.MEDICAL.BANDAGE_TIME : CONFIG.MEDICAL.TOURNIQUET_TIME)), barH); }
    }
  }

  static drawTracers(ctx, camera, tracerTrails) {
    if (!tracerTrails) return;
    for (const t of tracerTrails) {
      const p1 = camera.worldToScreen(t.x1, t.y1);
      const p2 = camera.worldToScreen(t.x2, t.y2);
      
      const cx = p1.x + (p2.x - p1.x) * t.progress;
      const cy = p1.y + (p2.y - p1.y) * t.progress;
      
      const trailAlpha = t.life / t.maxLife;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = `rgba(255, 220, 80, ${trailAlpha * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      if (t.progress < 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 200, ${trailAlpha})`;
        ctx.fill();
      }
    }
  }

  static drawBullets(ctx, camera, bullets) {
    for (const b of bullets) {
      if (b.isDead || !camera.isPointVisible(b.x, b.y, 50)) continue;
      const p = camera.worldToScreen(b.x, b.y); 
      ctx.beginPath(); 
      ctx.arc(p.x, p.y, Math.max(1.2, 1.6 * (camera.zoom / 8)), 0, Math.PI * 2); 
      ctx.fillStyle = b.hasRicocheted ? '#FF00FF' : '#FFFF88'; 
      ctx.fill();
    }
  }

  static drawFragments(ctx, camera, fragments) {
    if (!fragments) return;
    for (const f of fragments) {
      if (!camera.isPointVisible(f.x, f.y, 30)) continue;
      const p = camera.worldToScreen(f.x, f.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, 1.5 * camera.zoom / 8), 0, Math.PI * 2);
      ctx.fillStyle = '#FF8800';
      ctx.fill();
    }
  }

  static drawEffects(ctx, camera, flashes) {
    for (const f of flashes) { const p = camera.worldToScreen(f.x, f.y); const radius = (1.0 - f.life / 0.05) * 20; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 200, 0, ${Math.max(0, f.life / 0.05)})`; ctx.fill(); }
  }

  static drawGrenades(ctx, camera, grenades) {
    if (!grenades) return;
    for (const g of grenades) {
      if (!camera.isPointVisible(g.x, g.y, 50)) continue;
      const p = camera.worldToScreen(g.x, g.y);
      const r = Math.max(2, 3 * camera.zoom / 8);
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = g.hasExploded ? '#FF5500' : '#2A2A2A';
      ctx.fill();
      
      if (g.fuseTimer < 1.0 && !g.hasExploded) {
        ctx.beginPath();
        ctx.arc(p.x, p.y - r * 2, r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
      }
    }
  }

  static drawExplosions(ctx, camera, explosions) {
    if (!explosions) return;
    for (const ex of explosions) {
      if (!camera.isPointVisible(ex.x, ex.y, ex.radius * 2)) continue;
      const p = camera.worldToScreen(ex.x, ex.y);
      const r = (ex.radius * camera.zoom) * (ex.life / ex.maxLife);
      const alpha = 1 - (ex.life / ex.maxLife);
      
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 150, 0, ${alpha * 0.6})`; ctx.fill();
      
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.8})`; ctx.fill();
    }
  }

  static drawDebris(ctx, camera, debris) {
    if (!debris) return;
    for (const d of debris) {
      if (!camera.isPointVisible(d.x, d.y, 50)) continue;
      const p = camera.worldToScreen(d.x, d.y);
      const size = d.size * camera.zoom;
      
      let color = '#555';
      if (d.material === 'wood') color = '#8B5A2B';
      else if (d.material === 'brick') color = '#a55';
      else if (d.material === 'concrete') color = '#777';
      
      ctx.fillStyle = color;
      ctx.fillRect(p.x - size/2, p.y - size/2, Math.max(1, size), Math.max(1, size));
    }
  }

  static drawDust(ctx, camera, dust) {
    if (!dust) return;
    for (const d of dust) {
      if (!camera.isPointVisible(d.x, d.y, d.radius * 2)) continue;
      const p = camera.worldToScreen(d.x, d.y);
      const r = d.radius * camera.zoom;
      const alpha = 1 - (d.life / d.maxLife);
      
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 180, 180, ${alpha * 0.5})`;
      ctx.fill();
    }
  }
}
