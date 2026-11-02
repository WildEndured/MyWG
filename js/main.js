// js/main.js
import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus } from './core/EventBus.js';
import { GameMap } from './world/map.js';
import { UnitManager } from './entities/UnitManager.js'; // ИМПОРТ
import { Unit } from './entities/Unit.js';             // ИМПОРТ
import { MAP_PRESETS } from './data/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

const camera = new Camera(canvas);
const map = new GameMap(camera);
const input = new Input(canvas, camera);
const unitManager = new UnitManager(); // СОЗДАЕМ МЕНЕДЖЕР

let dpr = 1;
let lastTime = performance.now(); // Для расчета dt

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
  camera.fit(meters, meters);
  
  document.querySelectorAll('#hud button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
}

// Спавним юнитов при старте
function spawnInitialUnits() {
  unitManager.units = []; // Очистка
  unitManager.selectedUnit = null;
  
  // Игрок (синий) и Враг (красный)
  unitManager.addUnit(new Unit(40, 50, 'player'));
  unitManager.addUnit(new Unit(60, 50, 'enemy'));
  unitManager.addUnit(new Unit(50, 70, 'player'));
}

EventBus.on('input:tap', (data) => {
  coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
});

// HUD
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => setMapSize(Number(btn.dataset.size)));
});
document.getElementById('fit').addEventListener('click', () => {
  camera.fit(map.size, map.size);
});

// ГЛАВНЫЙ ЦИКЛ
function frame(now) {
  // 1. Считаем время кадра (dt) в секундах
  const dt = Math.min((now - lastTime) / 1000, 0.1); // Ограничиваем 0.1с, чтобы при лагах юниты не телепортировались
  lastTime = now;

  // 2. Обновляем логику
  unitManager.update(dt);

  // 3. Рендерим
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
  map.draw(ctx);
  unitManager.draw(ctx, camera); // РИСУЕМ ЮНИТОВ

  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

// ЗАПУСК
resize();
setMapSize(100);
spawnInitialUnits();
lastTime = performance.now();
requestAnimationFrame(frame);

setTimeout(() => {
    resize();
    camera.fit(map.size, map.size);
}, 100);
