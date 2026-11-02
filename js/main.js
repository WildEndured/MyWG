import { Camera } from './core/Camera.js';
import { Input } from './world/core/Input.js';
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
  
  // Обновить активную кнопку в HUD
  document.querySelectorAll('#hud button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
}

// Инициализация ввода
const input = new Input(canvas, camera, (wx, wy) => {
  console.log(`Тап по карте: X=${wx.toFixed(1)}, Y=${wy.toFixed(1)}`);
  coordsDiv.textContent = `X: ${wx.toFixed(1)}, Y: ${wy.toFixed(1)}`;
});

// Кнопки HUD
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => setMapSize(Number(btn.dataset.size)));
});
document.getElementById('fit').addEventListener('click', () => camera.fit());

// Цикл отрисовки
function frame() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Сброс трансформации под DPR
  map.draw(ctx);
  requestAnimationFrame(frame);
}

// Слушатели событий окна
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

// Запуск
resize();
setMapSize(MAP_PRESETS[100].size);
requestAnimationFrame(frame);
