// js/main.js
import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus } from './core/EventBus.js';
import { GameMap } from './world/map.js';
import { UnitManager } from './entities/UnitManager.js';
import { Unit } from './entities/Unit.js';
import { MAP_PRESETS } from './data/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

// 1. Инициализация систем
const camera = new Camera(canvas);
const map = new GameMap(camera);
const input = new Input(canvas, camera);
const unitManager = new UnitManager();

let dpr = 1;
let lastTime = performance.now();

// 2. Обработка размеров экрана
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
}

// 3. Установка размера карты
function setMapSize(meters) {
  map.setSize(meters);
  input.setWorldSize(meters);
  unitManager.setWorldSize(meters); // Обновляем сетку A*
  
  camera.fit(meters, meters);
  
  // Обновляем активную кнопку в HUD
  document.querySelectorAll('#hud button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
  
  // Спавним тестовых юнитов для новой карты
  spawnInitialUnits(meters);
}

// 4. Спавн юнитов (адаптированный под размер карты)
function spawnInitialUnits(mapSize) {
  unitManager.units = []; // Очищаем старых
  unitManager.selectedUnit = null;

  // Размещаем юнитов в центре карты, разнесенными друг от друга
  const center = mapSize / 2;
  const offset = mapSize * 0.1; // 10% от размера карты

  // Игрок (синие)
  unitManager.addUnit(new Unit(center - offset, center, 'player'));
  unitManager.addUnit(new Unit(center - offset, center + offset, 'player'));
  
  // Враг (красный)
  unitManager.addUnit(new Unit(center + offset, center, 'enemy'));
}

// 5. Подписка на события (координаты в HUD)
EventBus.on('input:tap', (data) => {
  coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
});

// 6. Обработчики кнопок HUD
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => setMapSize(Number(btn.dataset.size)));
});

document.getElementById('fit').addEventListener('click', () => {
  camera.fit(map.size, map.size);
});

// 7. Главный игровой цикл
function frame(now) {
  // Дельта времени (в секундах), ограниченная 0.1с для защиты от лагов
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // --- ОБНОВЛЕНИЕ (Update) ---
  unitManager.update(dt);

  // --- ОТРИСОВКА (Render) ---
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Сброс под DPR
  map.draw(ctx);
  unitManager.draw(ctx, camera);

  requestAnimationFrame(frame);
}

// 8. Системные события
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

// --- ЗАПУСК ИГРЫ ---
resize();
setMapSize(100); // Стартовая карта 100х100 (внутри вызовется spawnInitialUnits)
lastTime = performance.now();
requestAnimationFrame(frame);

// Хак для мобильных браузеров (адресная строка меняет высоту)
setTimeout(() => {
  resize();
  camera.fit(map.size, map.size);
}, 100);
