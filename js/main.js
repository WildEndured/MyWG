// js/main.js
import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus } from './core/EventBus.js'; // <-- Импорт шины
import { GameMap } from './world/map.js';
import { MAP_PRESETS } from './data/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

const camera = new Camera();
const map = new GameMap(camera);

let dpr = 1;

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

function setMapSize(meters) {
  map.setSize(meters);
  camera.setWorld(meters, meters);
  camera.fit();
  
  document.querySelectorAll('#hud button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
}

// Инициализация ввода (теперь без коллбэка)
const input = new Input(canvas, camera);

// ПОДПИСЫВАЕМСЯ НА СОБЫТИЯ
EventBus.on('input:tap', (data) => {
  console.log(`[EventBus] Тап по карте: X=${data.x.toFixed(1)}, Y=${data.y.toFixed(1)}`);
  coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
  
  // В будущем здесь будет логика: 
  // 1. Проверить, попали ли мы в юнита (выделение).
  // 2. Если юнит уже выделен — отправить приказ идти в точку (data.x, data.y).
});

// HUD
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => setMapSize(Number(btn.dataset.size)));
});
document.getElementById('fit').addEventListener('click', () => camera.fit());

// Цикл отрисовки
function frame() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
  map.draw(ctx);
  requestAnimationFrame(frame);
}

// Окно
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

// Старт
resize();
setMapSize(MAP_PRESETS[100].size);
requestAnimationFrame(frame);
