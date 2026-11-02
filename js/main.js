// js/main.js
import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus } from './core/EventBus.js';
import { TimeManager } from './core/TimeManager.js'; // <-- ИМПОРТ
import { GameMap } from './world/map.js';
import { UnitManager } from './entities/UnitManager.js';
import { Unit } from './entities/Unit.js';
import { MAP_PRESETS } from './data/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

const camera = new Camera(canvas);
const map = new GameMap(camera);
const input = new Input(canvas, camera);
const unitManager = new UnitManager();
unitManager.camera = camera; 

let dpr = 1;
let lastTime = performance.now();

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
}

function setMapSize(meters) {
  map.setSize(meters);
  input.setWorldSize(meters);
  unitManager.setWorldSize(meters);
  camera.fit(meters, meters);
  
  document.querySelectorAll('#hud button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
  
  spawnInitialUnits(meters);
}

function spawnInitialUnits(mapSize) {
  unitManager.units = [];
  unitManager.selectedUnits = [];

  const center = mapSize / 2;
  const offset = mapSize * 0.1;

  unitManager.addUnit(new Unit(center - offset, center, 'player'));
  unitManager.addUnit(new Unit(center - offset, center + offset * 0.5, 'player'));
  unitManager.addUnit(new Unit(center - offset * 0.5, center - offset, 'player'));
  unitManager.addUnit(new Unit(center - offset * 1.5, center + offset, 'player'));
  
  unitManager.addUnit(new Unit(center + offset, center, 'enemy'));
  unitManager.addUnit(new Unit(center + offset, center + offset, 'enemy'));

  unitManager._spawnTestObstacles(mapSize);
}

EventBus.on('input:tap', (data) => {
  coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
});

// HUD размеров карты
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => setMapSize(Number(btn.dataset.size)));
});

document.getElementById('fit').addEventListener('click', () => {
  camera.fit(map.size, map.size);
});

// Кнопки поз
const stanceButtons = {
  'btn-stand': 'stand',
  'btn-run': 'run',
  'btn-crouch': 'crouch',
  'btn-prone': 'prone'
};
for (const [id, stance] of Object.entries(stanceButtons)) {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => unitManager.setSelectedStance(stance));
}

// --- УПРАВЛЕНИЕ ВРЕМЕНЕМ ---
document.getElementById('btn-pause').addEventListener('click', () => {
  TimeManager.togglePause();
});

document.getElementById('btn-speed-1').addEventListener('click', () => TimeManager.setTimeScale(1.0));
document.getElementById('btn-speed-2').addEventListener('click', () => TimeManager.setTimeScale(2.0));
document.getElementById('btn-speed-4').addEventListener('click', () => TimeManager.setTimeScale(4.0));

// Подсветка активной кнопки времени
EventBus.on('time:changed', ({ scale, isPaused }) => {
  document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
  
  if (isPaused) {
    document.getElementById('btn-pause').classList.add('active');
  } else {
    const activeBtn = document.getElementById(`btn-speed-${scale}`);
    if (activeBtn) activeBtn.classList.add('active');
  }
});


function frame(now) {
  // 1. Считаем реальное время
  const realDt = (now - lastTime) / 1000;
  lastTime = now;

  // 2. Получаем масштабированное время (с учетом паузы/ускорения)
  const dt = TimeManager.getScaledDt(realDt);

  // 3. Обновляем только если не пауза
  if (dt > 0) {
    unitManager.update(dt);
  }

  // 4. Рендерим всегда (чтобы камера работала на паузе)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  map.draw(ctx);
  unitManager.draw(ctx, camera);

  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

resize();
setMapSize(100);
lastTime = performance.now();
requestAnimationFrame(frame);

setTimeout(() => {
  resize();
  camera.fit(map.size, map.size);
}, 100);
