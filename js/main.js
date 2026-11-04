import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus, EVENTS } from './core/EventBus.js';
import { TimeManager } from './core/TimeManager.js';
import { GameMap } from './world/map.js';
import { UnitManager } from './entities/UnitManager.js';
import { Unit } from './entities/Unit.js';
import { Mission } from './entities/Mission.js';
import { CONFIG } from './data/config.js';
import { Debug } from './core/Debug.js';
import { Renderer } from './core/Renderer.js';
import { AudioManager } from './core/AudioManager.js';
import { CaptureZone } from './entities/CaptureZone.js';
import { validateArmorData } from './data/armor.js';
import { validateWeapons } from './data/weapons.js';
import { CALIBERS } from './data/calibers.js';

document.addEventListener('DOMContentLoaded', () => {
  const TEAM_INFO = { team1: { id: 'team1', name: 'Команда 1', faction: 'player', player: true }, team2: { id: 'team2', name: 'Команда 2', faction: 'enemy', player: true }, spectator: { id: 'spectator', name: 'Наблюдатель', faction: null, player: false } };
  const MODE_INFO = { attack: { id: 'attack', name: 'Наступление' }, defense: { id: 'defense', name: 'Оборона' } };
  const selection = { team: null, mode: null };

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const coordsDiv = document.getElementById('coords');
  const startScreen = document.getElementById('start-screen');
  const hud = document.getElementById('hud');
  const btnStart = document.getElementById('btn-start');
  const battleTeamEl = document.getElementById('battle-team');
  const battleModeEl = document.getElementById('battle-mode');

  try { const errs = [...validateArmorData(), ...validateWeapons(CALIBERS)]; if (errs.length) console.error('[data]', errs); } catch (e) { console.warn(e); }

  const camera = new Camera(canvas);
  const map = new GameMap(camera);
  const input = new Input(canvas, camera);
  const unitManager = new UnitManager();
  unitManager.camera = camera;
  
  window.__CONFIG = CONFIG;

  window.__TimeManager = TimeManager;
  let lastTime = performance.now();
  let rafId = 0;
  let gameStarted = false;
  let lastTapWorld = { x: 0, y: 0 };
  let currentMission = null;

  function updateStartButton() { if (btnStart) btnStart.disabled = !(selection.team !== null && selection.mode !== null); }
  function bindOptionGroup(groupId, key) { const group = document.getElementById(groupId); if (!group) return; group.querySelectorAll('.opt-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); selection[key] = btn.dataset.value; updateStartButton(); }); }); }

  bindOptionGroup('opt-team', 'team');
  bindOptionGroup('opt-mode', 'mode');

  if (btnStart) { 
    btnStart.addEventListener('click', () => { 
      if (btnStart.disabled) return; 
      if (window.AudioManager) AudioManager.init(); 
      startBattle(selection.team, selection.mode); 
    }); 
  }

  function startBattle(teamId, modeId) {
    const team = TEAM_INFO[teamId], mode = MODE_INFO[modeId]; 
    if (!team || !mode) return;
    
    gameStarted = true; 
    if (startScreen) startScreen.classList.add('hidden'); 
    if (hud) hud.classList.remove('hidden');
    
    unitManager.playerFaction = team.player ? team.faction : null; 
    unitManager.playerTeamId = team.id; 
    unitManager.gameMode = mode.id;
    
    if (battleTeamEl) { battleTeamEl.textContent = team.name; battleTeamEl.className = team.id; } 
    if (battleModeEl) battleModeEl.textContent = mode.name;
    
    // Загрузка миссии
    const missionId = mode.id === 'attack' ? 'capture_bridge' : 'defend_village';
    currentMission = new Mission(missionId);
    
    resize();
    currentMission.load(unitManager, map, camera);
    camera.clampTo(map.size, map.size);
    
    lastTime = performance.now();
  }

  function resize() { 
    const dpr = Math.min(window.devicePixelRatio || 1, 2); 
    const w = window.innerWidth, h = window.innerHeight; 
    canvas.style.width = w + 'px'; 
    canvas.style.height = h + 'px'; 
    canvas.width = Math.floor(w * dpr); 
    canvas.height = Math.floor(h * dpr); 
    camera.setDpr(dpr); 
    camera.clampTo(map.size, map.size); 
  }

  // Обработчики событий миссии
  EventBus.on('mission:victory', (data) => {
    console.log('[Mission] VICTORY:', data.mission.name);
    showMissionEnd('ПОБЕДА!', '#0F9D58');
  });

  EventBus.on('mission:defeat', (data) => {
    console.log('[Mission] DEFEAT:', data.reason);
    showMissionEnd('ПОРАЖЕНИЕ', '#EA4335');
  });

  EventBus.on('mission:reinforcement', (data) => {
    console.log(`[Mission] Reinforcement: ${data.count} ${data.faction}`);
  });

  function showMissionEnd(text, color) {
    const endScreen = document.createElement('div');
    endScreen.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.8); 
      display: flex; align-items: center; justify-content: center; 
      z-index: 200; font-family: system-ui, sans-serif;
    `;
    endScreen.innerHTML = `
      <div style="text-align: center;">
        <h1 style="color: ${color}; font-size: 64px; margin: 0;">${text}</h1>
        <p style="color: #fff; font-size: 18px; margin: 20px 0;">${currentMission ? currentMission.name : ''}</p>
        <button id="btn-restart" style="
          padding: 15px 40px; font-size: 18px; font-weight: bold;
          background: #4285F4; color: #fff; border: none; 
          border-radius: 8px; cursor: pointer; margin-top: 20px;
        ">Начать заново</button>
      </div>
    `;
    document.body.appendChild(endScreen);
    
    document.getElementById('btn-restart').addEventListener('click', () => {
      endScreen.remove();
      startBattle(selection.team, selection.mode);
    });
  }

  EventBus.on(EVENTS.WORLD_NOISE, ({ x, y, loudness, source }) => { 
    if (!source || !loudness) return; 
    for (const unit of unitManager.units) { 
      if (unit.isDead || unit.faction === source.faction) continue; 
      const dist = Math.max(0.5, Math.hypot(unit.x - x, unit.y - y)); 
      if (loudness / Math.sqrt(dist) * unit.hearingMultiplier >= 10) {
        unit.lastHeardNoise = { x, y, loudness, time: performance.now() };
      } 
    } 
  });
  
  EventBus.on(EVENTS.INPUT_TAP, (data) => { 
    if (coordsDiv) coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`; 
    lastTapWorld.x = data.x; 
    lastTapWorld.y = data.y; 
  });

  const fitBtn = document.getElementById('fit'); 
  if (fitBtn) fitBtn.addEventListener('click', () => { camera.fit(map.size, map.size); camera.clampTo(map.size, map.size); });

  const stanceButtons = { 'btn-stand': 'stand', 'btn-run': 'run', 'btn-crouch': 'crouch', 'btn-prone': 'prone' };
  function updateStanceUI(active) { for (const [id, stance] of Object.entries(stanceButtons)) { const btn = document.getElementById(id); if (btn) btn.classList.toggle('active', stance === active); } }
  for (const [id, stance] of Object.entries(stanceButtons)) { 
    const btn = document.getElementById(id); 
    if (btn) btn.addEventListener('click', () => { 
      unitManager.setSelectedStance(stance); 
      updateStanceUI(stance); 
    }); 
  }
  updateStanceUI('stand');

  const btnBandage = document.getElementById('btn-bandage'); 
  const btnTourniquet = document.getElementById('btn-tourniquet'); 
  const btnClearMalfunction = document.getElementById('btn-clear-malfunction');
  if (btnBandage) btnBandage.addEventListener('click', () => { if (unitManager.selectedUnits.length === 1) { const u = unitManager.selectedUnits[0]; if (u.bleedingRate > 0) u.applyBandage('torso', true); } });
  if (btnTourniquet) btnTourniquet.addEventListener('click', () => { if (unitManager.selectedUnits.length === 1) { const u = unitManager.selectedUnits[0]; if (u.bleedingRate > 0) u.applyTourniquet('leftLeg', true); } });
  if (btnClearMalfunction) btnClearMalfunction.addEventListener('click', () => { if (unitManager.selectedUnits.length === 1) { const u = unitManager.selectedUnits[0]; if (u.weapon.isJammed || u.weapon.isMisfired) u.weapon.clearMalfunction(); } });

  const btnGrenade = document.getElementById('btn-grenade');
  if (btnGrenade) {
    btnGrenade.addEventListener('click', () => {
      if (unitManager.selectedUnits.length === 1) {
        const u = unitManager.selectedUnits[0];
        if (u.grenades > 0) {
          const targetX = lastTapWorld.x || camera.x;
          const targetY = lastTapWorld.y || camera.y;
          u.throwGrenade(targetX, targetY, { unitManager });
        }
      }
    });
  }

  const btnSwitchWeapon = document.getElementById('btn-switch-weapon');
  if (btnSwitchWeapon) {
    btnSwitchWeapon.addEventListener('click', () => {
      if (unitManager.selectedUnits.length === 1) {
        const u = unitManager.selectedUnits[0];
        if (u.secondaryWeaponConfig) u.switchWeapon();
      }
    });
  }

  // ПРИКАЗЫ ОТРЯДА
  const btnOrderAdvance = document.getElementById('btn-order-advance');
  const btnOrderHold = document.getElementById('btn-order-hold');
  const btnOrderRetreat = document.getElementById('btn-order-retreat');

  if (btnOrderAdvance) btnOrderAdvance.addEventListener('click', () => {
    for (const squad of unitManager.squads) if (squad.faction === unitManager.playerFaction) squad.order = 'advance';
  });
  if (btnOrderHold) btnOrderHold.addEventListener('click', () => {
    for (const squad of unitManager.squads) if (squad.faction === unitManager.playerFaction) squad.order = 'hold';
  });
  if (btnOrderRetreat) btnOrderRetreat.addEventListener('click', () => {
    for (const squad of unitManager.squads) if (squad.faction === unitManager.playerFaction) squad.order = 'retreat';
  });

  const tacticalBtn = document.getElementById('btn-tactical'); 
  if (tacticalBtn) tacticalBtn.addEventListener('click', () => TimeManager.toggleTacticalPause());
  
  window.addEventListener('keydown', (e) => { 
    if (e.key === CONFIG.TACTICAL_PAUSE.KEY && gameStarted) { 
      e.preventDefault(); 
      TimeManager.toggleTacticalPause(); 
    } 
  });
  
  const pauseBtn = document.getElementById('btn-pause'); 
  if (pauseBtn) pauseBtn.addEventListener('click', () => TimeManager.togglePause());
  
  [1, 2, 4].forEach(s => { 
    const b = document.getElementById(`btn-speed-${s}`); 
    if (b) b.addEventListener('click', () => TimeManager.setTimeScale(s)); 
  });

  EventBus.on(EVENTS.TIME_CHANGED, ({ scale, isPaused, isTacticalPause }) => {
    document.querySelectorAll('.time-btn').forEach(btn => { 
      if (btn.id === 'btn-debug' || btn.id === 'btn-tactical') return; 
      btn.classList.remove('active'); 
    });
    if (isTacticalPause) { 
      document.getElementById('btn-tactical')?.classList.add('active'); 
      document.getElementById('btn-pause')?.classList.remove('active'); 
    } else if (isPaused) { 
      document.getElementById('btn-pause')?.classList.add('active'); 
      document.getElementById('btn-tactical')?.classList.remove('active'); 
    } else { 
      document.getElementById(`btn-speed-${scale}`)?.classList.add('active'); 
      document.getElementById('btn-tactical')?.classList.remove('active'); 
    }
  });

  const debugBtn = document.getElementById('btn-debug'); 
  function syncDebugButton() { if (debugBtn) debugBtn.classList.toggle('active', Debug.isEnabled); }
  if (debugBtn) { debugBtn.addEventListener('click', () => { Debug.setEnabled(!Debug.isEnabled); syncDebugButton(); }); }
  EventBus.on(EVENTS.DEBUG_TOGGLED, syncDebugButton);

  // ПАНЕЛЬ ЮНИТА
  const unitPanel = document.getElementById('unit-panel'); 
  const tabButtons = document.querySelectorAll('.unit-tab'); 
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(btn => { 
    btn.addEventListener('click', () => { 
      tabButtons.forEach(b => b.classList.remove('active')); 
      tabContents.forEach(c => c.classList.remove('active')); 
      btn.classList.add('active'); 
      const target = document.getElementById(`tab-${btn.dataset.tab}`); 
      if (target) target.classList.add('active'); 
    }); 
  });

  function updateUnitPanel(unit) {
    if (!unit) return;
    document.getElementById('info-name').textContent = unit.name || 'Безымянный';
    document.getElementById('info-role').textContent = `${unit.name} (Ранг ${unit.rank})`;
    document.getElementById('info-weight').textContent = `${unit.totalWeight.toFixed(1)} кг (оружие: ${unit.weapon.weightLoaded.toFixed(1)} кг)`;
    
    let statusText = 'Живой', statusColor = '#0F9D58';
    if (unit.isDead) { statusText = 'Мертв'; statusColor = '#EA4335'; }
    else if (unit.isUnconscious) { statusText = 'Без сознания'; statusColor = '#F4B400'; }
    else if (unit.isSurrendered) { statusText = 'Сдался'; statusColor = '#FFF'; }
    
    const statusEl = document.getElementById('info-status'); if (statusEl) { statusEl.textContent = statusText; statusEl.style.color = statusColor; }
    
    let weaponStr = unit.weapon.name;
    if (unit.secondaryWeaponConfig) weaponStr += ` (запас: ${unit.secondaryWeaponConfig.name})`;
    document.getElementById('info-weapon').textContent = weaponStr;
    
    const reserveRounds = unit.weapon.getReserveRounds();
    document.getElementById('info-ammo').textContent = `${unit.weapon.ammo} / ${reserveRounds} (маг.: ${unit.weapon.reserveMagazines}) | Гранат: ${unit.grenades}`;
    
    const armorNames = [];
    for (const [zone, piece] of Object.entries(unit.armor)) {
      if (!armorNames.find(a => a.name === piece.name)) armorNames.push({ name: piece.name, level: piece.level, maxLevel: piece.baseLevel, durability: piece.durability, maxDurability: piece.maxDurability, cracked: piece.durability < piece.maxDurability * 0.5 });
    }
    const armorStr = armorNames.map(a => {
      const status = a.level < a.maxLevel ? (a.level === 0 ? ' (разрушена)' : ` (уровень ${a.level})`) : '';
      const crack = a.cracked ? ' [треснула]' : '';
      return `${a.name}${status}${crack}`;
    }).join(', ');
    document.getElementById('info-armor').textContent = armorStr || 'Нет';
    document.getElementById('info-medical').textContent = `Бинты: ${unit.medical.bandage} | Жгуты: ${unit.medical.tourniquet}`;
    
    const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100), stamPercent = Math.max(0, (unit.stamina / unit.maxStamina) * 100), bloodPercent = Math.max(0, (unit.blood / unit.maxBlood) * 100), shockPercent = Math.max(0, unit.shock * 100);
    document.getElementById('info-hp-text').textContent = `${Math.round(unit.hp)} / ${unit.maxHp}`; document.getElementById('info-hp-bar').style.width = `${hpPercent}%`; document.getElementById('info-hp-bar').style.background = hpPercent > 50 ? '#0F9D58' : (hpPercent > 20 ? '#F4B400' : '#EA4335');
    document.getElementById('info-stamina-text').textContent = `${Math.round(unit.stamina)} / ${unit.maxStamina}`; document.getElementById('info-stamina-bar').style.width = `${stamPercent}%`;
    document.getElementById('info-blood-text').textContent = `${Math.round(unit.blood)} / ${unit.maxBlood}`; document.getElementById('info-blood-bar').style.width = `${bloodPercent}%`;
    document.getElementById('info-shock-text').textContent = `${Math.round(shockPercent)}%`; document.getElementById('info-shock-bar').style.width = `${shockPercent}%`;
    
    const bleedEl = document.getElementById('info-bleeding'); if (bleedEl) { if (unit.bleedingRate > 0) bleedEl.classList.remove('hidden'); else bleedEl.classList.add('hidden'); }
    const medEl = document.getElementById('info-med-progress'); if (medEl) { if (unit.medical.isApplying) medEl.classList.remove('hidden'); else medEl.classList.add('hidden'); }
  }

  EventBus.on(EVENTS.UNITS_SELECTED, (units) => { 
    if (units.length === 1) { unitPanel.classList.remove('hidden'); updateUnitPanel(units[0]); } 
    else unitPanel.classList.add('hidden'); 
  });
  
  function updatePanelLoop() { 
    if (!unitPanel.classList.contains('hidden') && unitManager.selectedUnits.length === 1) { 
      const u = unitManager.selectedUnits[0]; 
      if (!u.isDead) updateUnitPanel(u); 
    } 
    requestAnimationFrame(updatePanelLoop); 
  }
  updatePanelLoop();

  function frame(now) {
    const realDt = (now - lastTime) / 1000; 
    lastTime = now;
    
    if (gameStarted) {
      let dt = TimeManager.getScaledDt(realDt); 
      dt = Math.min(dt, CONFIG.MAX_DT);
      
      if (dt > 0) { 
        try { 
          unitManager.update(dt); 
          if (currentMission) currentMission.update(dt, unitManager);
        } catch (err) { console.error('[Game] update error:', err); } 
      }
      
      if (!Number.isFinite(camera.zoom) || !Number.isFinite(camera.x) || !Number.isFinite(camera.y)) {
        camera.fit(map.size, map.size);
      }
      
      Debug.update(realDt);

      const dpr = camera.dpr; 
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      try {
        Renderer.draw(ctx, camera, map, unitManager);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
        Debug.draw(ctx, camera, unitManager, map, unitManager.pathfinder);
        
        if (TimeManager.isTacticalPause) { 
          ctx.save(); 
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
          ctx.fillStyle = 'rgba(80, 150, 255, 0.08)'; 
          ctx.fillRect(0, 0, camera.vw, camera.vh); 
          ctx.fillStyle = '#8ab4f8'; 
          ctx.font = 'bold 16px monospace'; 
          ctx.textAlign = 'center'; 
          ctx.fillText('ТАКТИЧЕСКАЯ ПАУЗА — приказы разрешены', camera.vw / 2, 40); 
          ctx.restore(); 
        }
      } catch (err) { 
        console.error('[Game] draw error:', err); 
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('beforeunload', () => { cancelAnimationFrame(rafId); input.destroy(); unitManager.destroy(); Debug.destroy(); });
  window.addEventListener('resize', resize); 
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  document.addEventListener('visibilitychange', () => { if (document.hidden && !TimeManager.isPaused && !TimeManager.isTacticalPause) TimeManager.togglePause(); });
  
  resize(); 
  lastTime = performance.now(); 
  rafId = requestAnimationFrame(frame);
});
