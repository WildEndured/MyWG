// js/entities/Unit.js
import { CONFIG } from '../data/config.js';

export class Unit {
  constructor(x, y, faction = 'player') {
    // Позиция в метрах
    this.x = x;
    this.y = y;
    
    // Характеристики
    this.faction = faction; 
    
    // ВИЗУАЛЬНЫЙ РАДИУС: 0.5 метра (как вы просили)
    this.radius = 0.5; 
    
    // РАДИУС КЛИКА: 2 метра (чтобы пальцем было легко попасть)
    this.hitRadius = 2.0; 
    
    this.speed = 15;        // Скорость в метрах в секунду
    this.maxHp = 100;
    this.hp = this.maxHp;
    
    // Состояние
    this.isSelected = false;
    
    // Движение по пути
    this.path = [];        
    this.pathIndex = 0;    
    this.isMoving = false;
    this.angle = 0;        
  }

  setPath(path) {
    if (!path || path.length === 0) return;
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = true;
  }

  update(dt) {
    if (!this.isMoving || this.path.length === 0) return;

    const target = this.path[this.pathIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Если достигли текущей точки пути (порог 0.5 метра, т.к. юнит маленький)
    if (dist < 0.5) { 
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.isMoving = false;
        this.path = [];
      }
      return;
    }

    // Вычисляем угол (для отрисовки направления)
    this.angle = Math.atan2(dy, dx);

    // Двигаемся
    const moveStep = this.speed * dt;
    if (moveStep >= dist) {
      this.x = target.x;
      this.y = target.y;
    } else {
      this.x += (dx / dist) * moveStep;
      this.y += (dy / dist) * moveStep;
    }
  }

  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    // Умножаем радиус в метрах на зум камеры
    const screenRadius = this.radius * camera.zoom;

    // Цвет фракции
    const color = this.faction === 'player' ? '#4285F4' : '#EA4335';
    
    // 1. Отрисовка тела (круг)
    ctx.beginPath();
    // Защита от микроскопического размера (чтобы на дальнем зуме не исчезал)
    const drawRadius = Math.max(3, screenRadius); 
    ctx.arc(screenPos.x, screenPos.y, drawRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // 2. Отрисовка направления (маленькая точка впереди)
    if (drawRadius > 5) {
      const dirX = screenPos.x + Math.cos(this.angle) * drawRadius * 0.6;
      const dirY = screenPos.y + Math.sin(this.angle) * drawRadius * 0.6;
      ctx.beginPath();
      ctx.arc(dirX, dirY, drawRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    // 3. Отрисовка выделения (желтое кольцо)
    if (this.isSelected) {
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, drawRadius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#F4B400'; 
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Отрисовка линии пути (отладка)
      if (this.isMoving && this.path.length > 0) {
        ctx.beginPath();
        const start = camera.worldToScreen(this.x, this.y);
        ctx.moveTo(start.x, start.y);
        for (let i = this.pathIndex; i < this.path.length; i++) {
           const p = camera.worldToScreen(this.path[i].x, this.path[i].y);
           ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(244, 180, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 4. Отрисовка HP бара (если здоровье не полное)
    if (this.hp < this.maxHp) {
      const barW = Math.max(20, drawRadius * 2); // Минимальная ширина бара
      const barH = 4;
      const barX = screenPos.x - barW / 2;
      const barY = screenPos.y - drawRadius - 8;
      
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      
      ctx.fillStyle = this.hp > 50 ? '#0F9D58' : '#EA4335';
      ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    }
  }
}
