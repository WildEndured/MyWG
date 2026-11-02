import { Camera } from './camera.js';
import { GameMap } from './map.js';
import { Input } from './input.js';
import { MAP_PRESETS } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const camera = new Camera();
const map = new GameMap(camera);

let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2); // кап на 2 для мобил
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
}

// Инпут: тап по миру — пока просто лог
const input = new Input(canvas, camera, (wx, wy) => {
  console.log('tap world', wx.toFixed(1), wy.toFixed(1));
});

// HUD
document.querySelectorAll('#hud button[data-size]').forEach(btn => {
  btn.addEventListener('click', () => {
    setMapSize(Number(btn.dataset.size));
  });
});
document.getElementById('fit').addEventListener('click', () => camera.fit());

// Рендер-луп
let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 100) / 1000;
  last = now;

  // --- Update --- (пока пусто)

  // --- Render ---
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // работаем в CSS-пикселях
  map.draw(ctx);

  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

resize();
setMapSize(100); // стартовый пресет
requestAnimationFrame(frame);
