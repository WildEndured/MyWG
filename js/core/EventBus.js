// js/core/EventBus.js

class EventBusClass {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Подписаться на событие
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   * @returns {Function} - Функция для отписки
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Возвращаем функцию отписки для удобства (паттерн Cleanup)
    return () => this.off(event, callback);
  }

  /**
   * Отписаться от события
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Вызвать событие
   * @param {string} event - Название события
   * @param {*} data - Данные, передаваемые слушателям
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;

    // Копируем Set в массив, чтобы безопасно удалять слушателей во время emit
    const callbacks = [...this.listeners.get(event)];
    
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Ошибка в обработчике события "${event}":`, err);
      }
    }
  }
}

// Экспортируем Singleton (единственный экземпляр на всю игру)
export const EventBus = new EventBusClass();
