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

// ---------- Данные стартового экрана ----------
const TEAM_INFO = {
  team1:     { id: 'team1',     name: 'Команда 1',  faction: 'player',     color: '#4285F4', player: true  },
  team2:     { id: 'team2',     name: 'Команда 2',  faction: 'enemy',      color: '#EA4335', player: true  },
  spectator: { id: 'spectator', name: 'Наблюдатель',faction: null,         color: '#9aa0a6', player: false },
};
const MODE_INFO = {
  attack:  { id: 'attack',  name: 'Наступление' },
  defense: { id: 'defense', name: 'Оборона' },
};

// ---------- Состояние выбора ----------
const selection = { team: null, mode: null };

// ---------- DOM ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');
const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const btnStart = document.getElementById('btn-start');
const battleTeamEl = document.getElementById('battle-team');
const battleModeEl = document.getElementById('battle-mode');

// ---------- Валидация данных ----------
{
  const errs = [...validateArmorData(), ...validateWeapons(CALIBERS)];
  if (errs.length) console.error('[data] validation errors:', errs);
}

// ---------- Инициализация движка ----------
const camera = new Camera(canvas);
const map = new GameMap(camera);
const input = new Input(canvas, camera);
const unitManager = new UnitManager();
unitManager.camera = camera;

window.__TimeManager = TimeManager;

let lastTime = performance.now();
let rafId = 0;
let gameStarted = false;

// ---------- Стартовый экран ----------
function updateStartButton() {
  const ok = selection.team !== null && selection.mode !== null;
  btnStart.disabled = !ok;
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

btnStart.addEventListener('click', () => {
  if (btnStart.disabled) return;
  startBattle(selection.team, selection.mode);
});

// ---------- Старт боя ----------
function startBattle(teamId, modeId) {
  const team = TEAM_INFO[teamId];
  const mode = MODE_INFO[modeId];
  if (!team || !mode) return;

  gameStarted = true;
  startScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  // FIX: применяем выбор к UnitManager
  unitManager.playerFaction = team.player ? team.faction : null;
  unitManager.playerTeamId = team.id;
  unitManager.gameMode = mode.id;

  // Инфо в HUD
  if (battleTeamEl) {
    battleTeamEl.textContent = team.name;
    battleTeamEl.className = team.id;
  }
  if (battleModeEl) battleModeEl.textContent = mode.name;

  // Стартовая карта
  setMapSize(100);
  lastTime = performance.now();
}

// ---------- Ресайз ----------
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

// ---------- Карта и спавн ----------
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

  const mode = unitManager.gameMode || 'attack';
  const playerTeam = unitManager.playerTeamId || 'team1';

  // Определяем, какая фракция игрока, а какая — врага
  // team1 = 'player', team2 = 'enemy' (зафиксировано в TEAM_INFO)
  const playerFaction = playerTeam === 'team1' ? 'player'
                      : playerTeam === 'team2' ? 'enemy'
                      : null; // наблюдатель

  // Расстановка по режиму:
  // - attack:  атакующая сторона с одной стороны карты, обороняющаяся — с другой
  // - defense: игрок-оборона в центре/за укрытиями, враг наступает с края
  const spawn = (dx, dy, faction, role) => {
    const p = unitManager.getSafeSpawnPoint(center + dx, center + dy);
    const cx = Math.max(0, Math.min(mapSize, p.x));
    const cy = Math.max(0, Math.min(mapSize, p.y));
    unitManager.addUnit(new Unit(cx, cy, faction, role));
  };

  if (mode === 'attack') {
    // Атакующая сторона — на левом краю (небольшой кластер)
    // Обороняющаяся — справа (за укрытиями)
    const atk = (dx, dy, role) => spawn(-offset * 2 + dx, dy, 'player', role);
    const def = (dx, dy, role) => spawn(offset * 2 + dx, dy, 'enemy', role);

    // Если игрок — team2 (enemy), то он «атакует» с правой стороны
    // Проще: определяем сторону игрока и его врага
    const playerIsAtk = (playerFaction === 'player') || (playerFaction === null);
    // team1(player) всегда атакует слева, team2(enemy) — справа
    // Если наблюдатель — сценарий «team1 атакует team2»

    // Атакующая сторона (team1, синие)
    spawn(-offset * 2, -offset * 0.4, 'player', 'infantry');
    spawn(-offset * 2, 0,              'player', 'machinegunner');
    spawn(-offset * 2, offset * 0.4,   'player', 'infantry');

    // Обороняющаяся сторона (team2, красные)
    spawn(offset * 2, -offset * 0.5, 'enemy', 'infantry');
    spawn(offset * 2, 0,             'enemy', 'machinegunner');
    spawn(offset * 2, offset * 0.5,  'enemy', 'infantry');
    spawn(offset * 1.5, offset * 0.2, 'enemy', 'infantry');
  } else {
    // defense: обороняющийся — ближе к центру, за укрытиями
    // атакующий — на краю карты
    spawn(0, -offset * 0.5, 'player', 'infantry');
    spawn(0, 0,             'player', 'machinegunner');
    spawn(0, offset * 0.5,  'player', 'infantry');
    spawn(-offset * 0.3, 0, 'player', 'infantry');

    // Атакующие (enemy) — с края
    spawn(-offset * 2.5, -offset * 0.5, 'enemy', 'infantry');
    spawn(-offset * 2.5, 0,             'enemy', 'machinegunner');
    spawn(-offset * 2.5, offset * 0.5,  'enemy', 'infantry');
  }

  // Переопределяем фракции, если игрок — team2
  if (playerTeam === 'team2') {
    for (const u of unitManager.units) {
      u.faction = u.faction === 'player' ? 'enemy' : 'player';
    }
  }
}

// ---------- Слух ----------
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

// ---------- Координаты ----------
EventBus.on(EVENTS.INPUT_TAP, (data) => {
  if (coordsDiv) coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
});

// ---------- HUD: размер карты ----------
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

// ---------- HUD: позы ----------
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

// ---------- HUD: время ----------
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

// ---------- HUD: debug ----------
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

// ---------- Игровой цикл ----------
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
  }

  rafId = requestAnimationFrame(frame);
}

// ---------- Очистка ----------
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

// ---------- Старт ----------
resize();
lastTime = performance.now();
rafId = requestAnimationFrame(frame);
// Бой не стартует, пока не выбран режим и команда — ждём нажатия «Начать бой»
