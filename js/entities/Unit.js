// js/entities/Unit.js
import { CONFIG } from '../data/config.js';

export class Unit {
  constructor(x, y, faction = 'player') {
    // Позиция в метрах
    this.x = x;
    this.y = y;
    
    // Характеристики
    this.faction = faction; // 'player' (синий) или 'enemy' (красный)
    this.radius = 1.5;      // Радиус в метрах (для попадания тапом)
    this.speed = 20;        // Скорость в метрах в секунду
    this.maxHp = 100;
    this.hp = this.maxHp;
    
    // Состояние
    this.isSelected = false;
    
    // Движение
    this.targetX = x;
    this.targetY = y;
    this.isMoving = false;
  }

  // Установка точки назначения
  setTarget(tx, ty) {
    this.targetX = tx;
    this.targetY = ty;
    this.isMoving = true;
  }

  // Обновление логики (вызывается каждый кадр)
  update(dt) {
    if (!this.isMoving) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    // Если дистанция меньше 0.5 метра — мы на месте
    if (dist < 0.5) {
      this.isMoving = false;
      this.x = this.targetX;
      this.y = this.targetY;
      return;
    }

    // Двигаемся к цели
    const moveStep = this.speed * dt;
    // Если осталось идти меньше, чем шаг за кадр, просто телепортируемся в цель
    if (moveStep >= dist) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
    } else {
      this.x += (dx / dist) * moveStep;
      this.y += (dy / dist) * moveStep;
    }
  }

  // Отрисовка юнита
  draw(ctx, camera) {
    const screenPos = camera.worldToScreen(this.x, this.y);
    const screenRadius = this.radius * camera.zoom;

    // Цвет фракции
    const color = this.faction === 'player' ? '#4285F4' : '#EA4335';
    
    // Отрисовка тела (круг)
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Отрисовка выделения (желтое кольцо)
    if (this.isSelected) {
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, screenRadius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#F4B400'; // Желтый
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Отрисовка HP бара (если здоровье не полное)
    if (this.hp < this.maxHp) {
      const barW = screenRadius * 2;
      const barH = 4;
      const barX = screenPos.x - barW / 2;
      const barY = screenPos.y - screenRadius - 8;
      
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      
      ctx.fillStyle = this.hp > 50 ? '#0F9D58' : '#EA4335';
      ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    }
  }
}
