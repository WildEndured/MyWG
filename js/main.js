import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus, EVENTS } from './core/EventBus.js';
import { TimeManager } from './core/TimeManager.js';
import { GameMap } from './world/map.js';
import { UnitManager } from './entities/UnitManager.js';
import { Unit } from './entities/Unit.js';
import { CONFIG } from './data/config.js';
import { Debug } from './core/Debug.js';
import { Renderer } from './core/Renderer.js';
import { validateArmorData } from './data/armor.js';
import { validateWeapons } from './data/weapons.js';
import { CALIBERS } from './data/calibers.js';

const TEAM_INFO = {
  team1:     { id: 'team1',     name: 'Команда 1',  faction: 'player', color: '#4285F4', player: true  },
  team2:     { id: 'team2',     name: 'Команда 2',  faction: 'enemy',  color: '#EA4335', player: true  },
  spectator: { id: 'spectator', name: 'Наблюдатель',faction: null,     color: '#9aa0a6', player: false },
};

const MODE_INFO = {
  attack:  { id: 'attack',  name: 'Наступление' },
  defense: { id: 'defense', name: 'Оборона' },
};

const selection = { team: null, mode: null };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');
const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const btnStart = document.getElementById('btn-start');
const battleTeamEl = document.getElementById('battle-team');
const battleModeEl = document.getElementById('battle-mode');

{
  const errs = [...validateArmorData(), ...validateWeapons(CALIBERS)];
  if (errs.length) console.error('[data] validation errors:', errs);
}

const camera = new Camera(canvas);
const map = new GameMap(camera);
const input = new Input(canvas, camera);
const unitManager = new UnitManager();
unitManager.camera = camera;

window.__TimeManager = TimeManager;

let lastTime = performance.now();
let rafId = 0;
let gameStarted = false;

function updateStartButton() {
  if (btnStart) {
    btnStart.disabled = !(selection.team !== null && selection.mode !== null);
  }
}

function bindOptionGroup(groupId, key) {
  const group = document.getElementById(groupId);
  if (!group) return;
  
  group.querySelectorAll('.opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selection[key] = btn.dataset.value;
      updateStartButton();
    });
  });
}

bindOptionGroup('opt-team', 'team');
bindOptionGroup('opt-mode', 'mode');

if (btnStart) {
  btnStart.addEventListener('click', () => {
    if (btnStart.disabled) return;
    startBattle(selection.team, selection.mode);
  });
}

function startBattle(teamId, modeId) {
  const team = TEAM_INFO[teamId];
  const mode = MODE_INFO[modeId];
  if (!team || !mode) return;

  gameStarted = true;
  if (startScreen) startScreen.classList.add('hidden');
  if (hud) hud.classList.remove('hidden');

  unitManager.playerFaction = team.player ? team.faction : null;
  unitManager.playerTeamId = team.id;
  unitManager.gameMode = mode.id;

  if (battleTeamEl) {
    battleTeamEl.textContent = team.name;
    battleTeamEl.className = team.id;
  }
  if (battleModeEl) battleModeEl.textContent = mode.name;

  setMapSize(100);
  lastTime = performance.now();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  camera.setDpr(dpr);
  camera.clampTo(map.size, map.size);
}

function setMapSize(meters) {
  map.setSize(meters);
  input.setWorldSize(meters);
  unitManager.setWorldSize(meters);
  camera.fit(meters, meters);
  camera.clampTo(meters, meters);
  document.querySelectorAll('.hud-top-left button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
  spawnInitialUnits(meters);
}

function spawnInitialUnits(mapSize) {
  unitManager.units = [];
  unitManager.selectedUnits = [];
  unitManager.bullets = [];
  unitManager.tracers = [];
  unitManager.flashes = [];
  unitManager.decals = [];
  
  if (typeof unitManager._spawnTestObstacles === 'function') {
    unitManager._spawnTestObstacles(mapSize, true);
  }

  const center = mapSize / 2;
  const offset = mapSize * 0.1;
  const mode = unitManager.gameMode || 'attack';
  const playerTeam = unitManager.playerTeamId || 'team1';

  const spawn = (dx, dy, faction, role) => {
    const p = unitManager.getSafeSpawnPoint(center + dx, center + dy);
    const cx = Math.max(0, Math.min(mapSize, p.x));
    const cy = Math.max(0, Math.min(mapSize, p.y));
    unitManager.addUnit(new Unit(cx, cy, faction, role));
  };

  if (mode === 'attack') {
    spawn(-offset * 2, -offset * 0.4, 'player', 'infantry');
    spawn(-offset * 2, 0,              'player', 'machinegunner');
    spawn(-offset * 2, offset * 0.4,   'player', 'infantry');

    spawn(offset * 2, -offset * 0.5, 'enemy', 'infantry');
    spawn(offset * 2, 0,             'enemy', 'machinegunner');
    spawn(offset * 2, offset * 0.5,  'enemy', 'infantry');
    spawn(offset * 1.5, offset * 0.2, 'enemy', 'infantry');
  } else {
    spawn(0, -offset * 0.5, 'player', 'infantry');
    spawn(0, 0,             'player', 'machinegunner');
    spawn(0, offset * 0.5,  'player', 'infantry');
    spawn(-offset * 0.3, 0, 'player', 'infantry');

    spawn(-offset * 2.5, -offset * 0.5, 'enemy', 'infantry');
    spawn(-offset * 2.5, 0,             'enemy', 'machinegunner');
    spawn(-offset * 2.5, offset * 0.5,  'enemy', 'infantry');
  }

  if (playerTeam === 'team2') {
    for (const u of unitManager.units) {
      u.faction = u.faction === 'player' ? 'enemy' : 'player';
    }
  }
}

EventBus.on(EVENTS.WORLD_NOISE, ({ x, y, loudness, source }) => {
  if (!source || !loudness) return;
  for (const unit of unitManager.units) {
    if (unit.isDead || unit.faction === source.faction) continue;
    const dist = Math.max(0.5, Math.hypot(unit.x - x, unit.y - y));
    const heard = loudness / Math.sqrt(dist) * unit.hearingMultiplier;
    if (heard >= 10) {
      unit.lastHeardNoise = { x, y, loudness, time: performance.now() };
    }
  }
});

EventBus.on(EVENTS.INPUT_TAP, (data) => {
  if (coordsDiv) coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
});

document.querySelectorAll('.hud-top-left button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!gameStarted) return;
    const meters = Number(btn.dataset.size);
    if (meters !== map.size && unitManager.units.some(u => !u.isDead)) {
      if (!confirm('Сменить карту? Текущий бой будет сброшен.')) return;
    }
    setMapSize(meters);
  });
});

const fitBtn = document.getElementById('fit');
if (fitBtn) fitBtn.addEventListener('click', () => {
  camera.fit(map.size, map.size);
  camera.clampTo(map.size, map.size);
});

const stanceButtons = {
  'btn-stand': 'stand', 'btn-run': 'run', 'btn-crouch': 'crouch', 'btn-prone': 'prone',
};

function updateStanceUI(active) {
  for (const [id, stance] of Object.entries(stanceButtons)) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', stance === active);
  }
}

for (const [id, stance] of Object.entries(stanceButtons)) {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => {
    unitManager.setSelectedStance(stance);
    updateStanceUI(stance);
  });
}
updateStanceUI('stand');

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
function syncDebugButton() {
  if (debugBtn) debugBtn.classList.toggle('active', Debug.isEnabled);
}
if (debugBtn) {
  debugBtn.addEventListener('click', () => {
    Debug.setEnabled(!Debug.isEnabled);
    syncDebugButton();
  });
}
EventBus.on(EVENTS.DEBUG_TOGGLED, syncDebugButton);

function frame(now) {
  const realDt = (now - lastTime) / 1000;
  lastTime = now;

  if (gameStarted) {
    let dt = TimeManager.getScaledDt(realDt);
    dt = Math.min(dt, CONFIG.MAX_DT);

    if (dt > 0) {
      try { unitManager.update(dt); }
      catch (err) { console.error('[Game] update error:', err); }
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

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(rafId);
  input.destroy();
  unitManager.destroy();
  Debug.destroy();
});

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !TimeManager.isPaused && !TimeManager.isTacticalPause) TimeManager.togglePause();
});

resize();
lastTime = performance.now();
rafId = requestAnimationFrame(frame);
