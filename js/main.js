// js/main.js
import { Camera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { EventBus } from './core/EventBus.js';
import { GameMap } from './world/map.js';
import { MAP_PRESETS } from './data/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const coordsDiv = document.getElementById('coords');

const camera = new Camera();
let currentWorldSize = 100; // Храним текущий размер мира
let dpr = 1;

// Функция, которая всегда возвращает актуальные размеры экрана (в CSS-пикселях)
const getViewport = () => ({
  w: window.innerWidth,
  h: window.innerHeight,
});

const map = new GameMap(camera, getViewport);
const input = new Input(canvas, camera, getViewport);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w, h } = getViewport();
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  
  // При ресайзе не даем камере улететь за границы
  camera.clampTo(currentWorldSize, currentWorldSize, w, h);
}

function setMapSize(meters) {
  currentWorldSize = meters;
  map.setSize(meters);
  
  const { w, h } = getViewport();
  camera.fit(meters, meters, w, h);
  
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
  const { w, h } = getViewport();
  camera.fit(currentWorldSize, currentWorldSize, w, h);
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

setTimeout(() => {
    resize();
    const { w, h } = getViewport();
    camera.fit(currentWorldSize, currentWorldSize, w, h);
}, 100);
