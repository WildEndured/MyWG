// js/main.js
import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { GameMap } from './world/map.js'; // Путь обновлен
import { MAP_PRESETS } from './data/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

// Инициализация камеры и карты
const camera = new Camera();
const map = new GameMap(camera);

let dpr = 1;

// Обработка изменения размера экрана (поворот телефона, ресайз окна)
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  
  camera.setViewport(w, h, dpr);
}

// Установка размера карты (100, 500, 1000 метров)
function setMapSize(meters) {
  map.setSize(meters);
  camera.setWorld(meters, meters);
  camera.fit();
  
  // Обновляем визуальное состояние кнопок в HUD
  document.querySelectorAll('#hud button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
}

// Инициализация ввода (камера + обработка тапов)
const input = new Input(canvas, camera, (wx, wy) => {
  // Сюда мы позже добавим логику выделения юнитов и приказов
  console.log(`Тап по карте: X=${wx.toFixed(1)}, Y=${wy.toFixed(1)}`);
  coordsDiv.textContent = `X: ${wx.toFixed(1)}, Y: ${wy.toFixed(1)}`;
});

// Обработчики кнопок HUD
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => setMapSize(Number(btn.dataset.size)));
});
document.getElementById('fit').addEventListener('click', () => camera.fit());

// Главный игровой цикл
function frame() {
  // 1. Сброс трансформации (чтобы работал Retina/DPI)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
  
  // 2. Отрисовка мира
  map.draw(ctx);
  
  // 3. Запрос следующего кадра
  requestAnimationFrame(frame);
}

// Слушатели системных событий
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

// --- ЗАПУСК ---
resize();
setMapSize(MAP_PRESETS[100].size); // Стартовая карта 100х100
requestAnimationFrame(frame);
