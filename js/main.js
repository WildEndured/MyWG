// js/main.js
import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus } from './core/EventBus.js';
import { GameMap } from './world/map.js';
import { MAP_PRESETS } from './data/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

// Передаем canvas в камеру, чтобы она знала размеры
const camera = new Camera(canvas);
const map = new GameMap(camera);
const input = new Input(canvas, camera);

let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  // Важно: сначала задаем стили (CSS size), потом физический размер
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
}

function setMapSize(meters) {
  map.setSize(meters);
  input.setWorldSize(meters); // Сообщаем инпуту новый размер мира
  
  camera.fit(meters, meters); // Камера сама возьмет размеры из canvas
  
  document.querySelectorAll('#hud button[data-size]').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === meters);
  });
}

EventBus.on('input:tap', (data) => {
  console.log(`[EventBus] Тап по карте: X=${data.x.toFixed(1)}, Y=${data.y.toFixed(1)}`);
  coordsDiv.textContent = `X: ${data.x.toFixed(1)}, Y: ${data.y.toFixed(1)}`;
});

// Кнопки HUD
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => setMapSize(Number(btn.dataset.size)));
});
document.getElementById('fit').addEventListener('click', () => {
  // Берем текущий размер из карты
  camera.fit(map.size, map.size); 
});

// Цикл отрисовки
function frame() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
  map.draw(ctx);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

// --- ЗАПУСК ---
resize();
setMapSize(100);
requestAnimationFrame(frame);

// Хак для мобильных: принудительный фит после загрузки
setTimeout(() => {
    resize();
    camera.fit(map.size, map.size);
}, 100);
