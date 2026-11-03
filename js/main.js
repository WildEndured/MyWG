import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus, EVENTS } from './core/EventBus.js';
import { TimeManager } from './core/TimeManager.js';
import { GameMap } from './world/map.js';
import { UnitManager } from './entities/UnitManager.js';
import { Unit } from './entities/Unit.js';
import { CONFIG } from './data/config.js';
import { Debug } from './core/Debug.js';
import { validateArmorData } from './data/armor.js';
import { validateWeapons } from './data/weapons.js';
import { CALIBERS } from './data/calibers.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

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
  unitManager._spawnTestObstacles(mapSize, true);

  const center = mapSize / 2;
  const offset = mapSize * 0.1;

  const spawn = (dx, dy, faction, role) => {
    const p = unitManager.getSafeSpawnPoint(center + dx, center + dy);
    const cx = Math.max(0, Math.min(mapSize, p.x));
    const cy = Math.max(0, Math.min(mapSize, p.y));
    unitManager.addUnit(new Unit(cx, cy, faction, role));
  };

  spawn(-offset, 0, 'player', 'infantry');
  spawn(-offset, offset * 0.5, 'player', 'machinegunner');
  spawn(-offset * 0.5, -offset, 'player', 'infantry');
  spawn(offset, 0, 'enemy', 'infantry');
  spawn(offset, offset, 'enemy', 'machinegunner');
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
    const meters = Number(btn.dataset.size);
    if (meters !== map.size && unitManager.units.some(u => !u.isDead)) {
      if (!confirm('Сменить карту? Текущий бой будет сброшен.')) return;
    }
    setMapSize(meters);
  });
});

const fitBtn = document.getElementById('fit');
if (fitBtn) fitBtn.addEventListener('click', () => { camera.fit(map.size, map.size); camera.clampTo(map.size, map.size); });

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

const pauseBtn = document.getElementById('btn-pause');
if (pauseBtn) pauseBtn.addEventListener('click', () => TimeManager.togglePause());
[1, 2, 4].forEach(s => {
  const b = document.getElementById(`btn-speed-${s}`);
  if (b) b.addEventListener('click', () => TimeManager.setTimeScale(s));
});

EventBus.on(EVENTS.TIME_CHANGED, ({ scale, isPaused }) => {
  document.querySelectorAll('.time-btn').forEach(btn => {
    if (btn.id === 'btn-debug') return;
    btn.classList.remove('active');
  });
  if (isPaused) {
    document.getElementById('btn-pause')?.classList.add('active');
  } else {
    document.getElementById(`btn-speed-${scale}`)?.classList.add('active');
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

  let dt = TimeManager.getScaledDt(realDt);
  dt = Math.min(dt, CONFIG.MAX_DT);

  if (dt > 0) {
    try { unitManager.update(dt); }
    catch (err) { console.error('[Game] update error:', err); }
  }

  Debug.update(realDt);

  const dpr = camera.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  try {
    map.draw(ctx);
    unitManager.draw(ctx, camera);
    Debug.draw(ctx, camera, unitManager, map, unitManager.pathfinder);
  } catch (err) {
    console.error('[Game] draw error:', err);
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
  if (document.hidden && !TimeManager.isPaused) TimeManager.togglePause();
});

resize();
setMapSize(100);
lastTime = performance.now();
rafId = requestAnimationFrame(frame);
