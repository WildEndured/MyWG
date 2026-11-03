export const EVENTS = {
  INPUT_TAP: 'input:tap',
  INPUT_DOUBLE_TAP: 'input:doubleTap',
  UNITS_SELECTED: 'units:selected',
  UNIT_DEATH: 'unit:death',
  UNIT_UNCONSCIOUS: 'unit:unconscious',
  UNIT_SHOOT: 'unit:shoot',
  BULLET_IMPACT: 'bullet:impact',
  WORLD_NOISE: 'world:noise',
  TIME_CHANGED: 'time:changed',
  DEBUG_TOGGLED: 'debug:toggled',
};

class EventBusClass {
  constructor() { this.listeners = new Map(); }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const unsub = this.on(event, (data) => { unsub(); callback(data); });
    return unsub;
  }

  off(event, callback) {
    if (this.listeners.has(event)) this.listeners.get(event).delete(callback);
  }

  clear(event) {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }

  emit(event, data) {
    const set = this.listeners.get(event);
    if (!set) return;
    const callbacks = [...set];
    for (const cb of callbacks) {
      try { cb(data); }
      catch (err) { console.error(`[EventBus] "${event}":`, err); }
    }
  }
}

export const EventBus = new EventBusClass();
